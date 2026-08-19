import { Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { SlotService } from '../services/slot.service';
import { LLMService } from '../services/llm.service';
import { NotificationService } from '../services/notification.service';
import { GoogleCalendarService } from '../services/gcal.service';

export class PatientController {
  public static async searchDoctors(req: AuthRequest, res: Response) {
    try {
      const { specialisation, query } = req.query;

      const whereClause: any = {};
      if (specialisation) {
        whereClause.specialisation = { contains: String(specialisation) };
      }
      if (query) {
        whereClause.OR = [
          { specialisation: { contains: String(query) } },
          { user: { name: { contains: String(query) } } },
        ];
      }

      const doctors = await prisma.doctorProfile.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true } },
          leaveDays: true,
        },
      });

      return res.json({ doctors });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to search doctors' });
    }
  }

  public static async getDoctorSlots(req: AuthRequest, res: Response) {
    try {
      const { doctorId, date } = req.query;
      const patientId = req.user?.id;

      if (!doctorId || !date) {
        return res.status(400).json({ error: 'doctorId and date (YYYY-MM-DD) are required.' });
      }

      const availability = await SlotService.getAvailableSlots(
        String(doctorId),
        String(date),
        patientId
      );

      return res.json(availability);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch doctor availability' });
    }
  }

  public static async holdSlot(req: AuthRequest, res: Response) {
    try {
      const patientId = req.user!.id;
      const { doctorId, slotStartTime, slotEndTime } = req.body;

      if (!doctorId || !slotStartTime || !slotEndTime) {
        return res.status(400).json({ error: 'doctorId, slotStartTime, and slotEndTime are required.' });
      }

      const hold = await SlotService.holdSlot(doctorId, patientId, slotStartTime, slotEndTime);
      return res.json({
        message: 'Slot temporarily reserved for 3 minutes.',
        hold,
      });
    } catch (err: any) {
      return res.status(409).json({ error: err?.message || 'Slot hold failed.' });
    }
  }

  public static async bookAppointment(req: AuthRequest, res: Response) {
    try {
      const patientId = req.user!.id;
      const { doctorId, slotStartTime, slotEndTime, symptoms, duration, severity } = req.body;

      if (!doctorId || !slotStartTime || !slotEndTime || !symptoms) {
        return res.status(400).json({ error: 'Missing required booking details or symptom info.' });
      }

      const appointment = await SlotService.confirmBooking(
        doctorId,
        patientId,
        slotStartTime,
        slotEndTime
      );

      await prisma.symptomForm.create({
        data: {
          appointmentId: appointment.id,
          freeText: symptoms,
          duration: duration || 'Not specified',
          severity: severity || 'Moderate',
        },
      });

      const llmResult = await LLMService.generatePreVisitSummary(
        symptoms,
        duration || 'Not specified',
        severity || 'Moderate'
      );

      await prisma.preVisitSummary.create({
        data: {
          appointmentId: appointment.id,
          urgency: llmResult.urgency,
          chiefComplaint: llmResult.chiefComplaint,
          suggestedQuestions: JSON.stringify(llmResult.suggestedQuestions),
          isFallback: llmResult.isFallback,
          rawInput: llmResult.rawInput || null,
        },
      });

      const gcalEventId = await GoogleCalendarService.createEvent({
        summary: `Medical Appointment with Dr. ${appointment.doctorProfile.user.name}`,
        description: `Patient Chief Complaint: ${llmResult.chiefComplaint}`,
        startIso: slotStartTime,
        endIso: slotEndTime,
        attendeeEmails: [appointment.patient.email, appointment.doctorProfile.user.email],
      });

      if (gcalEventId) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { gcalEventId },
        });
      }

      await NotificationService.sendEmail({
        to: appointment.patient.email,
        subject: `Appointment Booking Confirmation - Dr. ${appointment.doctorProfile.user.name}`,
        body: `Dear ${appointment.patient.name},\n\nYour appointment with Dr. ${appointment.doctorProfile.user.name} (${appointment.doctorProfile.specialisation}) is confirmed for ${new Date(slotStartTime).toLocaleString()}.\n\nAI Urgency Assessment: ${llmResult.urgency}\n\nThank you for using Healthcare Manager.`,
        type: 'BOOKING_CONFIRMATION',
      });

      return res.status(201).json({
        message: 'Appointment booked successfully!',
        appointmentId: appointment.id,
        urgency: llmResult.urgency,
        isAiFallback: llmResult.isFallback,
      });
    } catch (err: any) {
      console.error('Book appointment error:', err);
      return res.status(400).json({ error: err?.message || 'Failed to book appointment' });
    }
  }

  public static async getMyAppointments(req: AuthRequest, res: Response) {
    try {
      const patientId = req.user!.id;
      const appointments = await prisma.appointment.findMany({
        where: { patientId },
        include: {
          doctorProfile: { include: { user: { select: { name: true, email: true } } } },
          symptomForm: true,
          preVisitSummary: true,
          postVisitSummary: true,
          prescription: true,
        },
        orderBy: { slotStartTime: 'desc' },
      });

      return res.json({ appointments });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch appointment history' });
    }
  }

  public static async getMyReminders(req: AuthRequest, res: Response) {
    try {
      const patientId = req.user!.id;
      const reminders = await prisma.medicationReminder.findMany({
        where: { patientId },
        orderBy: { scheduledTime: 'asc' },
      });

      return res.json({ reminders });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch medication reminders' });
    }
  }

  public static async cancelAppointment(req: AuthRequest, res: Response) {
    try {
      const patientId = req.user!.id;
      const { id } = req.params;

      const appointment = await prisma.appointment.findFirst({
        where: { id, patientId },
        include: { doctorProfile: { include: { user: true } }, patient: true },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found.' });
      }

      await prisma.appointment.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      if (appointment.gcalEventId) {
        await GoogleCalendarService.deleteEvent(appointment.gcalEventId);
      }

      await NotificationService.sendEmail({
        to: appointment.patient.email,
        subject: `Appointment Cancelled - Dr. ${appointment.doctorProfile.user.name}`,
        body: `Dear ${appointment.patient.name},\n\nYour appointment scheduled for ${new Date(appointment.slotStartTime).toLocaleString()} has been cancelled as requested.`,
        type: 'CANCELLATION',
      });

      return res.json({ message: 'Appointment cancelled successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to cancel appointment' });
    }
  }
}
