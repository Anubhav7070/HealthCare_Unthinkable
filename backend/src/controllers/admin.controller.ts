import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { SlotService } from '../services/slot.service';

export class AdminController {
  public static async createDoctor(req: Request, res: Response) {
    try {
      const { email, password, name, specialisation, workingHoursStart, workingHoursEnd, slotDurationMinutes, bio } = req.body;

      if (!email || !password || !name || !specialisation || !workingHoursStart || !workingHoursEnd) {
        return res.status(400).json({ error: 'Missing required doctor fields (email, password, name, specialisation, working hours).' });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name,
            role: 'DOCTOR',
          },
        });

        const profile = await tx.doctorProfile.create({
          data: {
            userId: user.id,
            specialisation,
            workingHoursStart,
            workingHoursEnd,
            slotDurationMinutes: slotDurationMinutes ? parseInt(slotDurationMinutes, 10) : 30,
            bio: bio || null,
          },
        });

        return { user, profile };
      });

      return res.status(201).json({
        message: 'Doctor profile created successfully',
        doctor: {
          id: result.profile.id,
          userId: result.user.id,
          name: result.user.name,
          email: result.user.email,
          specialisation: result.profile.specialisation,
          workingHoursStart: result.profile.workingHoursStart,
          workingHoursEnd: result.profile.workingHoursEnd,
          slotDurationMinutes: result.profile.slotDurationMinutes,
        },
      });
    } catch (err: any) {
      console.error('Create doctor error:', err);
      return res.status(500).json({ error: err?.message || 'Server error creating doctor' });
    }
  }

  public static async listDoctors(req: Request, res: Response) {
    try {
      const doctors = await prisma.doctorProfile.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          leaveDays: true,
        },
      });
      return res.json({ doctors });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to list doctors' });
    }
  }

  public static async markDoctorLeave(req: Request, res: Response) {
    try {
      const { doctorId, startDate, endDate, reason } = req.body;

      if (!doctorId || !startDate || !endDate) {
        return res.status(400).json({ error: 'doctorId, startDate, and endDate are required.' });
      }

      const result = await SlotService.handleDoctorLeave(doctorId, startDate, endDate, reason);

      return res.json({
        message: `Doctor leave recorded. ${result.affectedCount} affected appointments updated and patients notified.`,
        leave: result.leave,
        affectedAppointmentsCount: result.affectedCount,
      });
    } catch (err: any) {
      console.error('Mark doctor leave error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to record doctor leave' });
    }
  }

  public static async getAllAppointments(req: Request, res: Response) {
    try {
      const appointments = await prisma.appointment.findMany({
        include: {
          patient: { select: { id: true, name: true, email: true } },
          doctorProfile: { include: { user: { select: { name: true, email: true } } } },
          symptomForm: true,
          preVisitSummary: true,
          postVisitSummary: true,
        },
        orderBy: { slotStartTime: 'desc' },
      });
      return res.json({ appointments });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch appointments' });
    }
  }

  public static async getNotificationLogs(req: Request, res: Response) {
    try {
      const logs = await prisma.notificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return res.json({ logs });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch notification logs' });
    }
  }
}
