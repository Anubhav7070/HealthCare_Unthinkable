import { prisma } from '../prisma';
import { NotificationService } from './notification.service';
import { GoogleCalendarService } from './gcal.service';

export interface TimeSlot {
  startTime: string; // ISO String
  endTime: string;   // ISO String
  available: boolean;
  heldByMe?: boolean;
}

export class SlotService {
  /**
   * Calculates available time slots for a given doctor on a specific YYYY-MM-DD date.
   */
  public static async getAvailableSlots(
    doctorId: string,
    dateStr: string,
    currentPatientId?: string
  ): Promise<{ slots: TimeSlot[]; isOnLeave: boolean; leaveReason?: string }> {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { leaveDays: true },
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const targetDateObj = new Date(dateStr);
    const isOnLeave = doctorProfile.leaveDays.some(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      targetDateObj.setHours(12, 0, 0, 0);
      return targetDateObj >= start && targetDateObj <= end;
    });

    if (isOnLeave) {
      const leaveInfo = doctorProfile.leaveDays.find(l => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return targetDateObj >= start && targetDateObj <= end;
      });
      return { slots: [], isOnLeave: true, leaveReason: leaveInfo?.reason || 'Doctor on leave' };
    }

    const [startHour, startMin] = doctorProfile.workingHoursStart.split(':').map(Number);
    const [endHour, endMin] = doctorProfile.workingHoursEnd.split(':').map(Number);
    const durationMin = doctorProfile.slotDurationMinutes || 30;

    const dayStart = new Date(`${dateStr}T00:00:00`);
    const startTimePointer = new Date(dayStart);
    startTimePointer.setHours(startHour, startMin, 0, 0);

    const endTimeBoundary = new Date(dayStart);
    endTimeBoundary.setHours(endHour, endMin, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        slotStartTime: { gte: dayStart, lte: dayEnd },
        status: { in: ['BOOKED', 'COMPLETED', 'HELD'] },
      },
    });

    const now = new Date();
    const activeHolds = await prisma.slotHold.findMany({
      where: {
        doctorId,
        slotStartTime: { gte: dayStart, lte: dayEnd },
        expiresAt: { gt: now },
      },
    });

    const slots: TimeSlot[] = [];

    while (startTimePointer < endTimeBoundary) {
      const slotStart = new Date(startTimePointer);
      const slotEnd = new Date(startTimePointer.getTime() + durationMin * 60 * 1000);

      if (slotEnd > endTimeBoundary) break;

      const isBooked = existingAppointments.some(
        app => app.slotStartTime.getTime() === slotStart.getTime()
      );

      const activeHold = activeHolds.find(
        h => h.slotStartTime.getTime() === slotStart.getTime()
      );

      let available = !isBooked && !activeHold;
      let heldByMe = false;

      if (activeHold && currentPatientId && activeHold.patientId === currentPatientId) {
        available = true;
        heldByMe = true;
      }

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        available,
        heldByMe,
      });

      startTimePointer.setTime(slotEnd.getTime());
    }

    return { slots, isOnLeave: false };
  }

  /**
   * Acquire a short-lived slot hold (3-minute TTL)
   */
  public static async holdSlot(
    doctorId: string,
    patientId: string,
    slotStartTimeIso: string,
    slotEndTimeIso: string
  ) {
    const slotStart = new Date(slotStartTimeIso);
    const slotEnd = new Date(slotEndTimeIso);
    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      const existingApp = await tx.appointment.findFirst({
        where: {
          doctorId,
          slotStartTime: slotStart,
          status: { in: ['BOOKED', 'COMPLETED'] },
        },
      });

      if (existingApp) {
        throw new Error('Slot is already booked by another patient.');
      }

      const existingHold = await tx.slotHold.findFirst({
        where: {
          doctorId,
          slotStartTime: slotStart,
          expiresAt: { gt: now },
        },
      });

      if (existingHold && existingHold.patientId !== patientId) {
        throw new Error('Slot is currently held by another patient. Please select a different slot.');
      }

      await tx.slotHold.deleteMany({
        where: { patientId, doctorId },
      });

      const expiresAt = new Date(now.getTime() + 3 * 60 * 1000);
      const hold = await tx.slotHold.create({
        data: {
          doctorId,
          patientId,
          slotStartTime: slotStart,
          slotEndTime: slotEnd,
          expiresAt,
        },
      });

      return hold;
    });
  }

  /**
   * Confirm booking with concurrency locking & double-booking prevention
   */
  public static async confirmBooking(
    doctorId: string,
    patientId: string,
    slotStartTimeIso: string,
    slotEndTimeIso: string
  ) {
    const slotStart = new Date(slotStartTimeIso);
    const slotEnd = new Date(slotEndTimeIso);

    return await prisma.$transaction(async (tx) => {
      const existingBooking = await tx.appointment.findFirst({
        where: {
          doctorId,
          slotStartTime: slotStart,
          status: { in: ['BOOKED', 'COMPLETED'] },
        },
      });

      if (existingBooking) {
        throw new Error('Slot no longer available — another request completed first.');
      }

      const appointment = await tx.appointment.create({
        data: {
          doctorId,
          patientId,
          slotStartTime: slotStart,
          slotEndTime: slotEnd,
          status: 'BOOKED',
        },
        include: {
          doctorProfile: { include: { user: true } },
          patient: true,
        },
      });

      await tx.slotHold.deleteMany({
        where: { doctorId, slotStartTime: slotStart },
      });

      return appointment;
    });
  }

  /**
   * Doctor Leave Conflict Resolution
   */
  public static async handleDoctorLeave(doctorId: string, startDateStr: string, endDateStr: string, reason?: string) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const leave = await prisma.doctorLeave.create({
      data: {
        doctorId,
        startDate: startDateStr,
        endDate: endDateStr,
        reason: reason || 'Doctor on leave',
      },
    });

    const affectedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        slotStartTime: { gte: start, lte: end },
        status: 'BOOKED',
      },
      include: {
        patient: true,
        doctorProfile: { include: { user: true } },
      },
    });

    for (const app of affectedAppointments) {
      await prisma.appointment.update({
        where: { id: app.id },
        data: { status: 'NEEDS_RESCHEDULE' },
      });

      if (app.gcalEventId) {
        await GoogleCalendarService.deleteEvent(app.gcalEventId);
      }

      const altSlots = await this.getAvailableSlots(doctorId, new Date(app.slotStartTime.getTime() + 86400000 * 2).toISOString().split('T')[0]);

      const altTimesText = altSlots.slots
        .filter(s => s.available)
        .slice(0, 3)
        .map(s => new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        .join(', ');

      await NotificationService.sendEmail({
        to: app.patient.email,
        subject: `Appointment Update: Doctor on Leave for ${new Date(app.slotStartTime).toLocaleDateString()}`,
        body: `Dear ${app.patient.name},\n\nDr. ${app.doctorProfile.user.name} will be on leave on ${new Date(app.slotStartTime).toLocaleDateString()} (${reason || 'Unscheduled leave'}).\n\nYour appointment scheduled for ${new Date(app.slotStartTime).toLocaleTimeString()} has been cancelled/marked for rescheduling.\n\n${altTimesText ? `Suggested upcoming available times: ${altTimesText}` : 'Please log in to your patient dashboard to choose an alternative date or doctor.'}\n\nWe apologize for any inconvenience.`,
        type: 'LEAVE_CANCEL',
      });
    }

    return { leave, affectedCount: affectedAppointments.length };
  }
}
