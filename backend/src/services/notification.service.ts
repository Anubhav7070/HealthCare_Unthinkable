import { prisma } from '../prisma';

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  type: 'BOOKING_CONFIRMATION' | 'REMINDER' | 'CANCELLATION' | 'LEAVE_CANCEL' | 'MEDICATION_REMINDER';
}

export class NotificationService {
  /**
   * Queue and dispatch email with retry mechanism & notification log tracing
   */
  public static async sendEmail(options: EmailOptions): Promise<boolean> {
    const log = await prisma.notificationLog.create({
      data: {
        recipientEmail: options.to,
        type: options.type,
        status: 'PENDING',
        retryCount: 0,
      },
    });

    // Execute send asynchronously with backoff retry
    this.dispatchWithRetry(log.id, options);
    return true;
  }

  private static async dispatchWithRetry(logId: string, options: EmailOptions) {
    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    let lastError = '';

    while (attempt < maxRetries && !success) {
      attempt++;
      try {
        await this.simulateSMTPDelivery(options);
        success = true;

        await prisma.notificationLog.update({
          where: { id: logId },
          data: {
            status: 'SENT',
            retryCount: attempt - 1,
            errorLog: null,
          },
        });
        console.log(`[NotificationService] Email sent successfully to ${options.to} (Type: ${options.type})`);
      } catch (err: any) {
        lastError = err?.message || 'SMTP network timeout';
        console.warn(`[NotificationService] Attempt ${attempt} failed for ${options.to}: ${lastError}`);

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        }
      }
    }

    if (!success) {
      await prisma.notificationLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          retryCount: maxRetries,
          errorLog: `Failed after ${maxRetries} retries: ${lastError}`,
        },
      });
      console.error(`[NotificationService] Email flagged as FAILED in notification_logs for admin review: ${options.to}`);
    }
  }

  private static async simulateSMTPDelivery(options: EmailOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.99) {
          reject(new Error('Simulated SMTP connection error'));
        } else {
          resolve();
        }
      }, 200);
    });
  }
}
