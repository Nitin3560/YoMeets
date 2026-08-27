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

export type MeetingActionVerification = {
  passed: boolean;
  reason?: string;
  observed: unknown;
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

export async function verifyPlannedMeetingAction(
  action: PlannedMeetingAction,
  result: IntegrationResult,
  config: MeetingActionExecutorConfig = {}
): Promise<MeetingActionVerification> {
  if (action.type === "github.create_issue") {
    const issue = await new GitHubIntegration().getIssue({
      issueNumber: result.externalId,
      owner: config.githubOwner ?? "OWNER_REQUIRED",
      repo: config.githubRepo ?? "REPO_REQUIRED"
    });
    const assigneeMatches = Boolean(
      !action.input.assignee || issue.assignees?.some((assignee) => assignee.login === action.input.assignee)
    );
    const passed = issue.title === action.input.title && assigneeMatches;

    return {
      observed: issue,
      passed,
      reason: passed ? undefined : "GitHub issue fields did not match the planned action."
    };
  }

  if (action.type === "calendar.update_event") {
    const event = await new GoogleCalendarIntegration().getEvent({
      calendarId: config.calendarId,
      eventId: result.externalId || config.calendarEventId || action.input.eventId
    });
    const expectedStart = action.input.start ?? action.input.newTime;
    const passed = !expectedStart || event.start?.dateTime === expectedStart;

    return {
      observed: event,
      passed,
      reason: passed ? undefined : "Calendar event time did not match the planned action."
    };
  }

  if (action.type === "gmail.create_draft") {
    const draft = await new GmailIntegration().getDraft({
      draftId: result.externalId
    });
    const passed = draft.id === result.externalId || draft.message?.id === result.externalId;

    return {
      observed: draft,
      passed,
      reason: passed ? undefined : "Gmail draft was not found after creation."
    };
  }

  return {
    observed: result.raw,
    passed: true
  };
}
