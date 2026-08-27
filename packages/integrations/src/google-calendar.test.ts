import assert from "node:assert/strict";
import { GoogleCalendarIntegration } from "./google-calendar.js";

const originalFetch = globalThis.fetch;

try {
  const seenMethods: string[] = [];

  globalThis.fetch = async (input, init) => {
    seenMethods.push(init?.method ?? "");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer google_test");

    const body = JSON.parse(String(init?.body));

    assert.equal(body.start.dateTime, "2026-08-28T14:00:00-05:00");
    assert.equal(body.end.dateTime, "2026-08-28T14:30:00-05:00");

    return new Response(JSON.stringify({
      htmlLink: "https://calendar.google.com/event?eid=event_1",
      id: "event_1"
    }));
  };

  const calendar = new GoogleCalendarIntegration({ token: "google_test" });
  const created = await calendar.createEvent({
    end: "2026-08-28T14:30:00-05:00",
    start: "2026-08-28T14:00:00-05:00",
    summary: "Deployment review"
  });
  const moved = await calendar.moveEvent({
    end: "2026-08-28T14:30:00-05:00",
    eventId: "event_1",
    start: "2026-08-28T14:00:00-05:00"
  });

  assert.deepEqual(seenMethods, ["POST", "PATCH"]);
  assert.equal(created.provider, "google_calendar");
  assert.equal(moved.externalId, "event_1");
} finally {
  globalThis.fetch = originalFetch;
}
