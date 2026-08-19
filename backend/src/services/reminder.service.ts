import { prisma } from '../prisma';
import { NotificationService } from './notification.service';

export interface MedicationInput {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export class ReminderService {
  /**
   * Generates Medication Reminder schedule records based on prescription specifications
   */
  public static async createRemindersForPrescription(
    prescriptionId: string,
    patientId: string,
    medications: MedicationInput[]
  ) {
    const reminderRecords: any[] = [];
    const now = new Date();

    for (const med of medications) {
      const timesPerDay = this.parseTimesPerDay(med.frequency);
      const days = this.parseDurationDays(med.duration);

      for (let day = 0; day < days; day++) {
        for (let timeIdx = 0; timeIdx < timesPerDay; timeIdx++) {
          const scheduledTime = new Date(now);
          scheduledTime.setDate(scheduledTime.getDate() + day);
          // Set hours spread throughout daytime (e.g., 8:00, 14:00, 20:00)
          const hourOffset = 8 + (timeIdx * Math.floor(12 / Math.max(1, timesPerDay)));
          scheduledTime.setHours(hourOffset, 0, 0, 0);

          reminderRecords.push({
            prescriptionId,
            patientId,
            medicationName: med.drug,
            dosage: med.dosage,
            scheduledTime,
            status: 'PENDING',
          });
        }
      }
    }

    if (reminderRecords.length > 0) {
      await prisma.medicationReminder.createMany({
        data: reminderRecords,
      });
      console.log(`[ReminderService] Scheduled ${reminderRecords.length} medication reminders for patient ${patientId}`);
    }
  }

  /**
   * Background job executor: checks for pending reminders due now/in past, sends email notifications, and updates status
   */
  public static async processPendingReminders() {
    try {
      const now = new Date();
      const pendingReminders = await prisma.medicationReminder.findMany({
        where: {
          status: 'PENDING',
          scheduledTime: { lte: now },
        },
        include: {
          patient: true,
        },
        take: 50,
      });

      for (const reminder of pendingReminders) {
        if (reminder.patient && reminder.patient.email) {
          await NotificationService.sendEmail({
            to: reminder.patient.email,
            subject: `Medication Reminder: ${reminder.medicationName}`,
            body: `Hello ${reminder.patient.name},\n\nThis is a friendly reminder to take your medication: ${reminder.medicationName} (${reminder.dosage}).\n\nPrescription details were issued during your recent appointment. Stay healthy!`,
            type: 'MEDICATION_REMINDER',
          });

          await prisma.medicationReminder.update({
            where: { id: reminder.id },
            data: { status: 'SENT' },
          });
        }
      }
    } catch (err: any) {
      console.error('[ReminderService] Error processing pending reminders:', err?.message);
    }
  }

  private static parseTimesPerDay(freqStr: string): number {
    const lower = freqStr.toLowerCase();
    if (lower.includes('twice') || lower.includes('2 times') || lower.includes('b.i.d')) return 2;
    if (lower.includes('thrice') || lower.includes('3 times') || lower.includes('t.i.d')) return 3;
    if (lower.includes('4 times') || lower.includes('q.i.d')) return 4;
    return 1; // Default 1 time daily
  }

  private static parseDurationDays(durStr: string): number {
    const match = durStr.match(/(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return 5; // Default 5 days
  }
}
