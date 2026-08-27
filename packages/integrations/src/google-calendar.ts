import { patchJson, postJson, requireEnv, type AuthConfig, type IntegrationResult } from "./http.js";

export type CalendarEventInput = {
  calendarId?: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
};

export type MoveCalendarEventInput = {
  calendarId?: string;
  eventId: string;
  start: string;
  end: string;
  timeZone?: string;
  reason?: string;
};

type CalendarEventResponse = {
  htmlLink?: string;
  id?: string;
};

function eventBody(input: Pick<CalendarEventInput, "description" | "end" | "start" | "summary" | "timeZone">) {
  return {
    description: input.description,
    end: {
      dateTime: input.end,
      timeZone: input.timeZone
    },
    start: {
      dateTime: input.start,
      timeZone: input.timeZone
    },
    summary: input.summary
  };
}

function calendarUrl(calendarId: string, eventId?: string) {
  const encodedCalendar = encodeURIComponent(calendarId);

  if (eventId) {
    return `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendar}/events/${encodeURIComponent(eventId)}`;
  }

  return `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendar}/events`;
}

export class GoogleCalendarIntegration {
  constructor(private readonly auth: AuthConfig = { token: requireEnv("GOOGLE_ACCESS_TOKEN") }) {}

  async createEvent(input: CalendarEventInput): Promise<IntegrationResult> {
    const event = await postJson<CalendarEventResponse>(calendarUrl(input.calendarId ?? "primary"), {
      Authorization: `Bearer ${this.auth.token}`
    }, eventBody(input));

    return {
      externalId: event.id ?? "",
      provider: "google_calendar",
      raw: event,
      url: event.htmlLink
    };
  }

  async moveEvent(input: MoveCalendarEventInput): Promise<IntegrationResult> {
    const event = await patchJson<CalendarEventResponse>(calendarUrl(input.calendarId ?? "primary", input.eventId), {
      Authorization: `Bearer ${this.auth.token}`
    }, eventBody({
      description: input.reason,
      end: input.end,
      start: input.start,
      summary: "Updated meeting"
    }));

    return {
      externalId: event.id ?? input.eventId,
      provider: "google_calendar",
      raw: event,
      url: event.htmlLink
    };
  }
}
