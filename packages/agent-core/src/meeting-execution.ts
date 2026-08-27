import {
  executePlannedMeetingAction,
  verifyPlannedMeetingAction,
  type MeetingActionExecutorConfig,
  type MeetingActionVerification
} from "@yomeets/integrations";
import { createApprovalRequest, decideApproval, evaluatePolicy, type ApprovalAnswer } from "@yomeets/policy-engine";
import {
  MeetingCommitmentRepository,
  MeetingRepository,
  PlannedMeetingActionRepository,
  type Storage
} from "@yomeets/storage";
import { planMeetingCommitments, type MeetingCommitment, type PlannedMeetingAction } from "@yomeets/task-engine";

export type MeetingActionExecutionStatus =
  | "waiting_for_approval"
  | "rejected"
  | "executed_unverified"
  | "verified"
  | "verification_failed"
  | "failed";

export type MeetingActionExecution = {
  actionId: string;
  commitmentId: string;
  status: MeetingActionExecutionStatus;
  externalId?: string;
  verification?: MeetingActionVerification;
  failure?: string;
};

export type RunMeetingExecutionInput = {
  title?: string;
  transcript: string;
  commitments: MeetingCommitment[];
  approvals?: Record<string, ApprovalAnswer>;
  integrationConfig?: MeetingActionExecutorConfig;
  execute?: typeof executePlannedMeetingAction;
  verify?: typeof verifyPlannedMeetingAction;
};

export type RunMeetingExecutionResult = {
  meetingId: string;
  executions: MeetingActionExecution[];
};

function statusForApproval(answer: ApprovalAnswer | undefined) {
  if (answer === "yes") {
    return "approved";
  }

  if (answer === "no") {
    return "rejected";
  }

  return "pending";
}

export async function runMeetingExecution(
  storage: Storage,
  input: RunMeetingExecutionInput
): Promise<RunMeetingExecutionResult> {
  const meetings = new MeetingRepository(storage);
  const commitments = new MeetingCommitmentRepository(storage);
  const plannedActions = new PlannedMeetingActionRepository(storage);
  const meeting = meetings.create({
    title: input.title,
    transcript: input.transcript
  });
  const commitmentRows = new Map<string, string>();

  for (const commitment of input.commitments) {
    const row = commitments.create({
      commitment,
      meetingId: meeting.id
    });

    commitmentRows.set(commitment.id, row.id);
  }

  const execute = input.execute ?? executePlannedMeetingAction;
  const verify = input.verify ?? verifyPlannedMeetingAction;
  const plan = planMeetingCommitments(input.commitments);
  const executions: MeetingActionExecution[] = [];

  for (const action of plan.actions) {
    const commitmentRowId = commitmentRows.get(action.commitmentId);

    if (!commitmentRowId) {
      throw new Error(`Commitment ${action.commitmentId} was not persisted before planning.`);
    }

    const approvalStatus = action.requiresApproval ? statusForApproval(input.approvals?.[action.id]) : "not_required";
    const plannedActionRow = plannedActions.create({
      action,
      approvalStatus,
      commitmentId: commitmentRowId,
      executionStatus: "pending",
      meetingId: meeting.id
    });

    const policy = evaluatePolicy({
      label: action.label,
      riskLevel: action.requiresApproval ? "external_side_effect" : "read_only",
      type: action.type
    });

    if (policy.status === "denied") {
      plannedActions.recordExecution(plannedActionRow.id, {
        status: "failed",
        verification: {
          observed: policy,
          passed: false,
          reason: policy.reason
        }
      });
      executions.push({
        actionId: action.id,
        commitmentId: action.commitmentId,
        failure: policy.reason,
        status: "failed"
      });
      continue;
    }

    if (policy.status === "approval_required") {
      const answer = input.approvals?.[action.id];

      if (!answer) {
        createApprovalRequest(`${action.id}_approval`, meeting.id, policy);
        plannedActions.recordExecution(plannedActionRow.id, { status: "waiting_for_approval" });
        executions.push({
          actionId: action.id,
          commitmentId: action.commitmentId,
          status: "waiting_for_approval"
        });
        continue;
      }

      const approval = decideApproval(createApprovalRequest(`${action.id}_approval`, meeting.id, policy), answer);
      plannedActions.updateApprovalStatus(plannedActionRow.id, approval.status);

      if (approval.status !== "approved") {
        plannedActions.recordExecution(plannedActionRow.id, { status: "rejected" });
        executions.push({
          actionId: action.id,
          commitmentId: action.commitmentId,
          status: "rejected"
        });
        continue;
      }
    }

    await executeAndVerify(action, {
      config: input.integrationConfig,
      execute,
      executions,
      plannedActionRowId: plannedActionRow.id,
      plannedActions,
      verify
    });
  }

  return {
    executions,
    meetingId: meeting.id
  };
}

async function executeAndVerify(
  action: PlannedMeetingAction,
  deps: {
    config?: MeetingActionExecutorConfig;
    execute: typeof executePlannedMeetingAction;
    verify: typeof verifyPlannedMeetingAction;
    plannedActions: PlannedMeetingActionRepository;
    plannedActionRowId: string;
    executions: MeetingActionExecution[];
  }
) {
  try {
    const result = await deps.execute(action, deps.config);
    deps.plannedActions.recordExecution(deps.plannedActionRowId, {
      externalId: result.externalId,
      status: "executed_unverified"
    });

    const verification = await deps.verify(action, result, deps.config);
    const status = verification.passed ? "verified" : "verification_failed";
    deps.plannedActions.recordExecution(deps.plannedActionRowId, {
      externalId: result.externalId,
      status,
      verification
    });
    deps.executions.push({
      actionId: action.id,
      commitmentId: action.commitmentId,
      externalId: result.externalId,
      status,
      verification
    });
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    deps.plannedActions.recordExecution(deps.plannedActionRowId, {
      status: "failed",
      verification: {
        observed: failure,
        passed: false,
        reason: failure
      }
    });
    deps.executions.push({
      actionId: action.id,
      commitmentId: action.commitmentId,
      failure,
      status: "failed"
    });
  }
}
