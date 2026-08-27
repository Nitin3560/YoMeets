import { GitHubIntegration, GmailIntegration, GoogleCalendarIntegration } from "@yomeets/integrations";
import {
  MeetingCommitmentRepository,
  PlannedMeetingActionRepository,
  type Storage
} from "@yomeets/storage";
import type { Commitment } from "./types.js";

export type MeetingCommitmentStatus = "open" | "in_progress" | "completed" | "stale";

export type MeetingOutstandingCommitment = {
  commitmentId: string;
  meetingId: string;
  commitment: Commitment;
  status: MeetingCommitmentStatus;
  externalStatus?: string;
  actionType?: string;
  externalId?: string;
};

export type MeetingStatusAdapter = {
  getIssue(id: string): Promise<{ state?: string }>;
  getEvent(id: string): Promise<unknown>;
  getDraft(id: string): Promise<{ id?: string; message?: { id?: string } }>;
};

function defaultStatusAdapter(): MeetingStatusAdapter {
  return {
    getDraft: (id) => new GmailIntegration().getDraft({ draftId: id }),
    getEvent: (id) => new GoogleCalendarIntegration().getEvent({ eventId: id }),
    getIssue: (id) => new GitHubIntegration().getIssue({
      issueNumber: id,
      owner: process.env.GITHUB_OWNER ?? "OWNER_REQUIRED",
      repo: process.env.GITHUB_REPO ?? "REPO_REQUIRED"
    })
  };
}

async function externalStatus(actionType: string | undefined, externalId: string | null, adapter: MeetingStatusAdapter) {
  if (!externalId) {
    return "missing_external_id";
  }

  if (actionType === "github_issue") {
    const issue = await adapter.getIssue(externalId);
    return issue.state === "closed" ? "closed" : "open";
  }

  if (actionType === "calendar_update") {
    await adapter.getEvent(externalId);
    return "scheduled";
  }

  if (actionType === "gmail_draft") {
    const draft = await adapter.getDraft(externalId);
    return draft.id || draft.message?.id ? "draft_exists" : "draft_missing";
  }

  if (actionType === "record_decision") {
    return "recorded";
  }

  return "unknown";
}

function storedStatus(status: string): MeetingCommitmentStatus {
  if (status === "completed" || status === "stale" || status === "in_progress") {
    return status;
  }

  return "open";
}

function statusFromExternal(status: string): MeetingCommitmentStatus {
  if (status === "closed" || status === "recorded" || status === "draft_missing") {
    return "completed";
  }

  if (status === "missing_external_id" || status === "unknown") {
    return "stale";
  }

  return "open";
}

export async function loadMeetingOutstandingCommitments(
  storage: Storage,
  adapter: MeetingStatusAdapter = defaultStatusAdapter()
): Promise<MeetingOutstandingCommitment[]> {
  const commitments = new MeetingCommitmentRepository(storage);
  const plannedActions = new PlannedMeetingActionRepository(storage);
  const rows = commitments.listOpen();
  const outstanding: MeetingOutstandingCommitment[] = [];

  for (const row of rows) {
    const action = plannedActions.latestForCommitment(row.id);
    const checkedStatus = await externalStatus(action?.actionType, action?.externalId ?? null, adapter);
    const status = statusFromExternal(checkedStatus);

    commitments.updateExternalStatus(row.id, checkedStatus, status);
    outstanding.push({
      actionType: action?.actionType,
      commitment: JSON.parse(row.commitmentJson) as Commitment,
      commitmentId: row.id,
      externalId: action?.externalId ?? undefined,
      externalStatus: checkedStatus,
      meetingId: row.meetingId,
      status
    });
  }

  return outstanding;
}

export function loadStoredMeetingCommitments(storage: Storage): MeetingOutstandingCommitment[] {
  const plannedActions = new PlannedMeetingActionRepository(storage);

  return new MeetingCommitmentRepository(storage).listOpen().map((row) => {
    const action = plannedActions.latestForCommitment(row.id);

    return {
      actionType: action?.actionType,
      commitment: JSON.parse(row.commitmentJson) as Commitment,
      commitmentId: row.id,
      externalId: action?.externalId ?? undefined,
      externalStatus: row.externalStatus ?? undefined,
      meetingId: row.meetingId,
      status: storedStatus(row.status)
    };
  });
}

export function formatMeetingOutstandingCommitments(commitments: MeetingOutstandingCommitment[]) {
  return commitments.map((item) => {
    const owner = item.commitment.owner ? `${item.commitment.owner}: ` : "";
    const deadline = item.commitment.deadline ? ` due ${item.commitment.deadline}` : "";
    const external = item.externalStatus ? ` [${item.externalStatus}]` : "";

    return `${item.status}: ${owner}${item.commitment.description}${deadline}${external}`;
  });
}
