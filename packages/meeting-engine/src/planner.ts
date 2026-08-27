import type { Commitment } from "./types.js";

export type PlannedAction =
  | {
      type: "github_issue";
      title: string;
      body: string;
      assignee?: string;
    }
  | {
      type: "calendar_update";
      eventId?: string;
      newTime: string;
    }
  | {
      type: "gmail_draft";
      to: string;
      subject: string;
      body: string;
    }
  | {
      type: "record_decision";
      text: string;
    };

function clean(value: string | undefined | null) {
  return value?.trim() ?? "";
}

function issueTitle(commitment: Commitment) {
  return commitment.description.replace(/^(investigate|check|create an issue for)\s+/i, "").trim();
}

function issueBody(commitment: Commitment) {
  return [
    commitment.description,
    commitment.deadline ? `Deadline: ${commitment.deadline}` : undefined,
    `Source: ${commitment.sourceQuote}`,
    `Confidence: ${commitment.confidence}`
  ].filter(Boolean).join("\n\n");
}

function emailRecipient(commitment: Commitment) {
  const match = commitment.description.match(/\bto\s+(.+)$/i);

  return clean(match?.[1]) || clean(commitment.owner);
}

function emailSubject(commitment: Commitment) {
  return commitment.description.replace(/^send\s+/i, "").replace(/\s+to\s+.+$/i, "").trim();
}

export function planCommitment(commitment: Commitment): PlannedAction {
  if (commitment.actionType === "create_issue") {
    return {
      assignee: clean(commitment.owner) || undefined,
      body: issueBody(commitment),
      title: issueTitle(commitment) || commitment.description,
      type: "github_issue"
    };
  }

  if (commitment.actionType === "schedule_event") {
    return {
      newTime: clean(commitment.deadline),
      type: "calendar_update"
    };
  }

  if (commitment.actionType === "send_email") {
    return {
      body: [
        commitment.description,
        commitment.deadline ? `Deadline: ${commitment.deadline}` : undefined,
        `Source: ${commitment.sourceQuote}`
      ].filter(Boolean).join("\n\n"),
      subject: emailSubject(commitment) || "Meeting follow-up",
      to: emailRecipient(commitment),
      type: "gmail_draft"
    };
  }

  return {
    text: commitment.description,
    type: "record_decision"
  };
}

export function planCommitments(commitments: Commitment[]) {
  return commitments.map(planCommitment);
}
