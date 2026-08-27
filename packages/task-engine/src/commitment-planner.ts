export type CommitmentType =
  | "investigation"
  | "schedule_change"
  | "follow_up_message"
  | "decision_record";

export type MeetingCommitment = {
  id: string;
  type: CommitmentType;
  summary: string;
  owner?: string;
  due?: string;
  recipient?: string;
  subject?: string;
  context?: string;
};

export type PlannedActionType =
  | "github.create_issue"
  | "calendar.update_event"
  | "gmail.create_draft"
  | "memory.record_decision";

export type PlannedMeetingAction = {
  id: string;
  commitmentId: string;
  type: PlannedActionType;
  label: string;
  requiresApproval: boolean;
  input: Record<string, string>;
};

export type MeetingExecutionPlan = {
  actions: PlannedMeetingAction[];
};

function clean(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : fallback;
}

function issueTitle(commitment: MeetingCommitment) {
  return `Investigate ${clean(commitment.subject, commitment.summary)}`;
}

function issueBody(commitment: MeetingCommitment) {
  return [
    commitment.summary,
    commitment.context ? `Context: ${commitment.context}` : undefined,
    commitment.due ? `Due: ${commitment.due}` : undefined
  ].filter(Boolean).join("\n\n");
}

function actionForCommitment(commitment: MeetingCommitment): PlannedMeetingAction {
  if (commitment.type === "investigation") {
    return {
      commitmentId: commitment.id,
      id: `${commitment.id}_github_issue`,
      input: {
        assignee: clean(commitment.owner, "unassigned"),
        body: issueBody(commitment),
        title: issueTitle(commitment)
      },
      label: `Create GitHub issue for ${clean(commitment.subject, commitment.summary)}`,
      requiresApproval: true,
      type: "github.create_issue"
    };
  }

  if (commitment.type === "schedule_change") {
    return {
      commitmentId: commitment.id,
      id: `${commitment.id}_calendar_update`,
      input: {
        event: clean(commitment.subject, commitment.summary),
        newTime: clean(commitment.due, "needs time confirmation"),
        reason: commitment.context ?? commitment.summary
      },
      label: `Update calendar event for ${clean(commitment.subject, commitment.summary)}`,
      requiresApproval: true,
      type: "calendar.update_event"
    };
  }

  if (commitment.type === "follow_up_message") {
    return {
      commitmentId: commitment.id,
      id: `${commitment.id}_gmail_draft`,
      input: {
        body: commitment.context ?? commitment.summary,
        recipient: clean(commitment.recipient, "needs recipient confirmation"),
        subject: clean(commitment.subject, commitment.summary)
      },
      label: `Draft follow-up email to ${clean(commitment.recipient, "recipient")}`,
      requiresApproval: true,
      type: "gmail.create_draft"
    };
  }

  return {
    commitmentId: commitment.id,
    id: `${commitment.id}_decision`,
    input: {
      decision: commitment.summary,
      owner: clean(commitment.owner, "team"),
      rationale: commitment.context ?? ""
    },
    label: `Record decision: ${commitment.summary}`,
    requiresApproval: false,
    type: "memory.record_decision"
  };
}

export function planMeetingCommitments(commitments: MeetingCommitment[]): MeetingExecutionPlan {
  return {
    actions: commitments.map(actionForCommitment)
  };
}
