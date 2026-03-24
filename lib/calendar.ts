import { calendar_v3, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Create Calendar client from access token
export function getCalendarClient(accessToken: string): calendar_v3.Calendar {
  const oauth2Client = new OAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.calendar({
    version: 'v3',
    auth: oauth2Client,
  });
}

// Interface for event data
export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
}

// Get today's events
export async function getTodayEvents(
  accessToken: string,
  timeZone: string = 'America/Los_Angeles'
): Promise<CalendarEvent[]> {
  try {
    const calendar = getCalendarClient(accessToken);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone,
    });

    const events = res.data.items || [];

    return events.map(parseCalendarEvent);
  } catch (error) {
    console.error('Error fetching today\'s events:', error);
    return [];
  }
}

// Get upcoming events for next N days
export async function getUpcomingEvents(
  accessToken: string,
  days: number = 7,
  timeZone: string = 'America/Los_Angeles'
): Promise<CalendarEvent[]> {
  try {
    const calendar = getCalendarClient(accessToken);

    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: futureDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
      timeZone,
    });

    const events = res.data.items || [];

    return events.map(parseCalendarEvent);
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return [];
  }
}

// Create event
export async function createEvent(
  accessToken: string,
  event: CalendarEvent,
  timeZone: string = 'America/Los_Angeles'
): Promise<CalendarEvent | null> {
  try {
    const calendar = getCalendarClient(accessToken);

    const eventBody: calendar_v3.Schema$Event = {
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      location: event.location,
      attendees: event.attendees,
    };

    // Add timezone if not already specified
    if (eventBody.start && !eventBody.start.timeZone) {
      eventBody.start.timeZone = timeZone;
    }
    if (eventBody.end && !eventBody.end.timeZone) {
      eventBody.end.timeZone = timeZone;
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    });

    return res.data ? parseCalendarEvent(res.data) : null;
  } catch (error) {
    console.error('Error creating event:', error);
    return null;
  }
}

// Update event
export async function updateEvent(
  accessToken: string,
  eventId: string,
  event: Partial<CalendarEvent>,
  timeZone: string = 'America/Los_Angeles'
): Promise<CalendarEvent | null> {
  try {
    const calendar = getCalendarClient(accessToken);

    const eventBody: calendar_v3.Schema$Event = {
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      location: event.location,
      attendees: event.attendees,
    };

    const res = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: eventBody,
    });

    return res.data ? parseCalendarEvent(res.data) : null;
  } catch (error) {
    console.error('Error updating event:', error);
    return null;
  }
}

// Delete event
export async function deleteEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  try {
    const calendar = getCalendarClient(accessToken);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    return true;
  } catch (error) {
    console.error('Error deleting event:', error);
    return false;
  }
}

// Get event by ID
export async function getEvent(
  accessToken: string,
  eventId: string
): Promise<CalendarEvent | null> {
  try {
    const calendar = getCalendarClient(accessToken);

    const res = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    return res.data ? parseCalendarEvent(res.data) : null;
  } catch (error) {
    console.error('Error getting event:', error);
    return null;
  }
}

// Helper function to parse calendar event
function parseCalendarEvent(event: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: event.id,
    summary: event.summary || '',
    description: event.description,
    start: {
      dateTime: event.start?.dateTime,
      date: event.start?.date,
      timeZone: event.start?.timeZone,
    },
    end: {
      dateTime: event.end?.dateTime,
      date: event.end?.date,
      timeZone: event.end?.timeZone,
    },
    location: event.location,
    attendees: event.attendees?.map((att) => ({
      email: att.email || '',
      displayName: att.displayName,
    })),
    conferenceData: event.conferenceData,
  };
}
