import type { PlannedMeetingAction } from "@yomeets/task-engine";
import { GitHubIntegration } from "./github.js";
import { GmailIntegration } from "./gmail.js";
import { GoogleCalendarIntegration } from "./google-calendar.js";
import type { IntegrationResult } from "./http.js";

export type MeetingActionExecutorConfig = {
  githubOwner?: string;
  githubRepo?: string;
  calendarId?: string;
  calendarEventId?: string;
};

export async function executePlannedMeetingAction(
  action: PlannedMeetingAction,
  config: MeetingActionExecutorConfig = {}
): Promise<IntegrationResult> {
  if (action.type === "github.create_issue") {
    return new GitHubIntegration().createIssue({
      assignee: action.input.assignee,
      body: action.input.body,
      owner: config.githubOwner ?? "OWNER_REQUIRED",
      repo: config.githubRepo ?? "REPO_REQUIRED",
      title: action.input.title
    });
  }

  if (action.type === "calendar.update_event") {
    return new GoogleCalendarIntegration().moveEvent({
      calendarId: config.calendarId,
      end: action.input.end ?? action.input.newTime,
      eventId: config.calendarEventId ?? action.input.eventId ?? "EVENT_ID_REQUIRED",
      reason: action.input.reason,
      start: action.input.start ?? action.input.newTime
    });
  }

  if (action.type === "gmail.create_draft") {
    return new GmailIntegration().createDraft({
      body: action.input.body,
      subject: action.input.subject,
      to: action.input.recipient
    });
  }

  return {
    externalId: action.id,
    provider: "memory",
    raw: {
      recorded: action.input.decision
    }
  };
}
