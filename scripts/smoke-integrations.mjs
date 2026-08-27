import { createDraft, createIssue, createOrUpdateEvent } from "@yomeets/integrations";

const now = new Date();
const start = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
const end = new Date(now.getTime() + 90 * 60 * 1000).toISOString();

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const issue = await createIssue({
  assignee: process.env.GITHUB_ASSIGNEE,
  body: "YoMeets Phase 3 integration smoke test.",
  title: "YoMeets integration smoke test"
});

const event = await createOrUpdateEvent({
  calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",
  description: "YoMeets Phase 3 integration smoke test.",
  end,
  start,
  summary: "YoMeets integration smoke test"
});

const draft = await createDraft({
  body: "YoMeets Phase 3 integration smoke test.",
  subject: "YoMeets integration smoke test",
  to: required("GMAIL_SMOKE_TO")
});

console.table([
  { provider: issue.provider, externalId: issue.externalId, url: issue.url ?? "" },
  { provider: event.provider, externalId: event.externalId, url: event.url ?? "" },
  { provider: draft.provider, externalId: draft.externalId, url: draft.url ?? "" }
]);
