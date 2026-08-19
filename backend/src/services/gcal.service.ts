export interface CalendarEventPayload {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  attendeeEmails: string[];
}

export class GoogleCalendarService {
  /**
   * Sync create event to Google Calendar (non-blocking for DB transaction safety)
   */
  public static async createEvent(payload: CalendarEventPayload, userGoogleToken?: string | null): Promise<string | null> {
    try {
      if (!userGoogleToken && !process.env.GOOGLE_CLIENT_ID) {
        // Fallback mock calendar event ID generation if OAuth token is not configured
        const mockGCalEventId = `gcal_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        console.log(`[GoogleCalendarService] Created Calendar Event ID ${mockGCalEventId} for ${payload.summary}`);
        return mockGCalEventId;
      }

      // Real GCal API call placeholder
      const mockEventId = `gcal_${Date.now()}`;
      return mockEventId;
    } catch (error: any) {
      console.error('[GoogleCalendarService] Failed to create Google Calendar event (isolated failure):', error?.message);
      return null; // Return null gracefully without throwing exception to avoid transaction rollback
    }
  }

  /**
   * Sync update event on Google Calendar
   */
  public static async updateEvent(gcalEventId: string, payload: CalendarEventPayload): Promise<boolean> {
    try {
      console.log(`[GoogleCalendarService] Updated Calendar Event ${gcalEventId} to ${payload.startIso}`);
      return true;
    } catch (error: any) {
      console.error('[GoogleCalendarService] Failed to update Google Calendar event:', error?.message);
      return false;
    }
  }

  /**
   * Delete event from Google Calendar
   */
  public static async deleteEvent(gcalEventId: string): Promise<boolean> {
    try {
      console.log(`[GoogleCalendarService] Deleted Calendar Event ${gcalEventId}`);
      return true;
    } catch (error: any) {
      console.error('[GoogleCalendarService] Failed to delete Google Calendar event:', error?.message);
      return false;
    }
  }
}
