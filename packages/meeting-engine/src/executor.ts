import {
  GitHubIntegration,
  GmailIntegration,
  GoogleCalendarIntegration,
  createDraft,
  createIssue,
  createOrUpdateEvent,
  type IntegrationResult
} from "@yomeets/integrations";
import { createApprovalRequest, decideApproval, evaluatePolicy, type ApprovalAnswer, type ApprovalRequest } from "@yomeets/policy-engine";
import {
  ExecutionResultRepository,
  MeetingCommitmentRepository,
  MeetingRepository,
  PlannedMeetingActionRepository,
  type Storage
} from "@yomeets/storage";
import type { ModelProvider } from "@yomeets/model-router";
import { extractCommitments } from "./extractor.js";
import { planCommitments, type PlannedAction } from "./planner.js";
import type { Commitment } from "./types.js";

export type MeetingExecutionStatus = "approved" | "rejected" | "verified" | "failed";

export type MeetingExecutionRecord = {
  commitment: Commitment;
  action: PlannedAction;
  status: MeetingExecutionStatus;
  externalId?: string;
  verificationPassed?: boolean;
  failure?: string;
};

export type MeetingIntegrationAdapter = {
  createIssue(action: Extract<PlannedAction, { type: "github_issue" }>): Promise<IntegrationResult>;
  createOrUpdateEvent(action: Extract<PlannedAction, { type: "calendar_update" }>): Promise<IntegrationResult>;
  createDraft(action: Extract<PlannedAction, { type: "gmail_draft" }>): Promise<IntegrationResult>;
  getIssue(id: string): Promise<{ title?: string }>;
  getEvent(id: string): Promise<{ start?: { dateTime?: string } }>;
  getDraft(id: string): Promise<{ id?: string; message?: { id?: string } }>;
};

export type RunMeetingPipelineInput = {
  transcript: string;
  title?: string;
  provider: ModelProvider;
  approve: (request: ApprovalRequest, action: PlannedAction) => Promise<ApprovalAnswer>;
  integrations?: MeetingIntegrationAdapter;
};

export type RunMeetingPipelineResult = {
  meetingId: string;
  commitments: Commitment[];
  actions: MeetingExecutionRecord[];
};

function defaultIntegrations(): MeetingIntegrationAdapter {
  return {
    createDraft: (action) => createDraft({
      body: action.body,
      subject: action.subject,
      to: action.to
    }),
    createIssue: (action) => createIssue({
      assignee: action.assignee,
      body: action.body,
      title: action.title
    }),
    createOrUpdateEvent: (action) => createOrUpdateEvent({
      end: action.newTime,
      eventId: action.eventId,
      start: action.newTime,
      summary: "Meeting follow-up"
    }),
    getDraft: (id) => new GmailIntegration().getDraft({ draftId: id }),
    getEvent: (id) => new GoogleCalendarIntegration().getEvent({ eventId: id }),
    getIssue: (id) => new GitHubIntegration().getIssue({
      issueNumber: id,
      owner: process.env.GITHUB_OWNER ?? "OWNER_REQUIRED",
      repo: process.env.GITHUB_REPO ?? "REPO_REQUIRED"
    })
  };
}

function actionLabel(action: PlannedAction) {
  if (action.type === "github_issue") {
    return `Create GitHub issue: ${action.title}`;
  }

  if (action.type === "calendar_update") {
    return `Update calendar event to ${action.newTime}`;
  }

  if (action.type === "gmail_draft") {
    return `Create Gmail draft to ${action.to}`;
  }

  return `Record decision: ${action.text}`;
}

function assertApprovalPolicy(action: PlannedAction) {
  const decision = evaluatePolicy({
    label: actionLabel(action),
    riskLevel: "external_side_effect",
    type: action.type
  });

  if (decision.status !== "approval_required") {
    throw new Error(`Expected approval requirement for ${action.type}`);
  }

  return decision;
}

async function executeAction(action: PlannedAction, integrations: MeetingIntegrationAdapter) {
  if (action.type === "github_issue") {
    return integrations.createIssue(action);
  }

  if (action.type === "calendar_update") {
    return integrations.createOrUpdateEvent(action);
  }

  if (action.type === "gmail_draft") {
    return integrations.createDraft(action);
  }

  return {
    externalId: action.text,
    provider: "memory",
    raw: action
  } satisfies IntegrationResult;
}

async function verifyAction(action: PlannedAction, result: IntegrationResult, integrations: MeetingIntegrationAdapter) {
  if (action.type === "github_issue") {
    const issue = await integrations.getIssue(result.externalId);
    return issue.title === action.title;
  }

  if (action.type === "calendar_update") {
    const event = await integrations.getEvent(result.externalId);
    return event.start?.dateTime === action.newTime;
  }

  if (action.type === "gmail_draft") {
    const draft = await integrations.getDraft(result.externalId);
    return draft.id === result.externalId || draft.message?.id === result.externalId;
  }

  return true;
}

export async function runMeetingPipeline(storage: Storage, input: RunMeetingPipelineInput): Promise<RunMeetingPipelineResult> {
  const extraction = await extractCommitments(input.transcript, input.provider);

  if (extraction.status === "failed") {
    throw new Error(extraction.error);
  }

  const meetings = new MeetingRepository(storage);
  const commitments = new MeetingCommitmentRepository(storage);
  const plannedActions = new PlannedMeetingActionRepository(storage);
  const executionResults = new ExecutionResultRepository(storage);
  const meeting = meetings.create({
    title: input.title,
    transcript: input.transcript
  });
  const actions = planCommitments(extraction.commitments);
  const integrations = input.integrations ?? defaultIntegrations();
  const records: MeetingExecutionRecord[] = [];

  for (let index = 0; index < extraction.commitments.length; index += 1) {
    const commitment = extraction.commitments[index];
    const action = actions[index];

    if (!commitment || !action) {
      continue;
    }

    const commitmentRow = commitments.create({
      commitment,
      meetingId: meeting.id
    });
    const plannedRow = plannedActions.create({
      action: {
        id: `${commitment.id}_${action.type}`,
        ...action
      },
      approvalStatus: "pending",
      commitmentId: commitmentRow.id,
      executionStatus: "planned",
      meetingId: meeting.id
    });
    const approvalRequest = createApprovalRequest(`${plannedRow.id}_approval`, meeting.id, assertApprovalPolicy(action));
    const approval = decideApproval(approvalRequest, await input.approve(approvalRequest, action));

    plannedActions.updateApprovalStatus(plannedRow.id, approval.status);

    if (approval.status !== "approved") {
      plannedActions.recordExecution(plannedRow.id, { status: "rejected" });
      executionResults.create({
        meetingId: meeting.id,
        plannedActionId: plannedRow.id,
        result: approval,
        status: "rejected"
      });
      records.push({
        action,
        commitment,
        status: "rejected"
      });
      continue;
    }

    try {
      const result = await executeAction(action, integrations);
      const verificationPassed = await verifyAction(action, result, integrations);
      const status = verificationPassed ? "verified" : "failed";

      plannedActions.recordExecution(plannedRow.id, {
        externalId: result.externalId,
        status,
        verification: {
          passed: verificationPassed,
          result
        }
      });
      executionResults.create({
        externalId: result.externalId,
        meetingId: meeting.id,
        plannedActionId: plannedRow.id,
        result: {
          action,
          result,
          verificationPassed
        },
        status
      });
      records.push({
        action,
        commitment,
        externalId: result.externalId,
        status,
        verificationPassed
      });
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);

      plannedActions.recordExecution(plannedRow.id, {
        status: "failed",
        verification: {
          failure,
          passed: false
        }
      });
      executionResults.create({
        meetingId: meeting.id,
        plannedActionId: plannedRow.id,
        result: {
          failure
        },
        status: "failed"
      });
      records.push({
        action,
        commitment,
        failure,
        status: "failed",
        verificationPassed: false
      });
    }
  }

  return {
    actions: records,
    commitments: extraction.commitments,
    meetingId: meeting.id
  };
}
