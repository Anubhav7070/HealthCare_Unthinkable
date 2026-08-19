import { Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { LLMService } from '../services/llm.service';
import { ReminderService } from '../services/reminder.service';
import { SlotService } from '../services/slot.service';

export class DoctorController {
  public static async getSchedule(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId } });

      if (!doctorProfile) {
        return res.status(404).json({ error: 'Doctor profile not found for user.' });
      }

      const { date } = req.query;
      let dateFilter: any = {};
      if (date) {
        const start = new Date(String(date));
        start.setHours(0, 0, 0, 0);
        const end = new Date(String(date));
        end.setHours(23, 59, 59, 999);
        dateFilter = { slotStartTime: { gte: start, lte: end } };
      }

      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctorProfile.id,
          ...dateFilter,
        },
        include: {
          patient: { select: { id: true, name: true, email: true } },
          symptomForm: true,
          preVisitSummary: true,
          postVisitNotes: true,
          prescription: true,
          postVisitSummary: true,
        },
        orderBy: { slotStartTime: 'asc' },
      });

      return res.json({ appointments, doctorProfile });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch doctor schedule' });
    }
  }

  public static async submitPostVisit(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId } });

      if (!doctorProfile) {
        return res.status(404).json({ error: 'Doctor profile not found.' });
      }

      const { appointmentId, clinicalNotes, medications } = req.body;

      if (!appointmentId || !clinicalNotes) {
        return res.status(400).json({ error: 'appointmentId and clinicalNotes are required.' });
      }

      const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, doctorId: doctorProfile.id },
        include: { patient: true },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found or not assigned to this doctor.' });
      }

      await prisma.postVisitNotes.upsert({
        where: { appointmentId },
        update: { notes: clinicalNotes },
        create: { appointmentId, notes: clinicalNotes },
      });

      const rxList = Array.isArray(medications) ? medications : [];
      const rxRecord = await prisma.prescription.upsert({
        where: { appointmentId },
        update: { medications: JSON.stringify(rxList) },
        create: { appointmentId, medications: JSON.stringify(rxList) },
      });

      const postVisitLLM = await LLMService.generatePostVisitSummary(clinicalNotes, rxList);

      await prisma.postVisitSummary.upsert({
        where: { appointmentId },
        update: {
          summaryText: postVisitLLM.summaryText,
          medicationSchedule: JSON.stringify(postVisitLLM.medicationSchedule),
          followUpSteps: JSON.stringify(postVisitLLM.followUpSteps),
          isFallback: postVisitLLM.isFallback,
        },
        create: {
          appointmentId,
          summaryText: postVisitLLM.summaryText,
          medicationSchedule: JSON.stringify(postVisitLLM.medicationSchedule),
          followUpSteps: JSON.stringify(postVisitLLM.followUpSteps),
          isFallback: postVisitLLM.isFallback,
        },
      });

      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      });

      if (rxList.length > 0) {
        await ReminderService.createRemindersForPrescription(
          rxRecord.id,
          appointment.patientId,
          rxList
        );
      }

      return res.json({
        message: 'Post-visit summary and prescription submitted successfully!',
        summaryText: postVisitLLM.summaryText,
        isAiFallback: postVisitLLM.isFallback,
      });
    } catch (err: any) {
      console.error('Submit post-visit error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to submit post-visit records' });
    }
  }

  public static async markLeave(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId } });

      if (!doctorProfile) {
        return res.status(404).json({ error: 'Doctor profile not found.' });
      }

      const { startDate, endDate, reason } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate (YYYY-MM-DD) are required.' });
      }

      const result = await SlotService.handleDoctorLeave(
        doctorProfile.id,
        startDate,
        endDate,
        reason || 'Personal doctor leave'
      );

      return res.json({
        message: `Leave recorded successfully. ${result.affectedCount} booked appointments cancelled/rescheduled and patients notified.`,
        leave: result.leave,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to mark leave' });
    }
  }
}
