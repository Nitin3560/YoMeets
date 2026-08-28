import {
  executePlannedMeetingAction,
  verifyPlannedMeetingAction,
  type MeetingActionExecutorConfig
} from "@yomeets/integrations";
import { createApprovalRequest, decideApproval, evaluatePolicy, type ApprovalAnswer } from "@yomeets/policy-engine";
import {
  CanonicalMeetingActionRepository,
  MeetingCommitmentRepository,
  PlannedMeetingActionRepository,
  type Storage
} from "@yomeets/storage";
import { planMeetingCommitments, type MeetingCommitment, type PlannedMeetingAction } from "@yomeets/task-engine";
import type { MeetingActionExecution } from "./meeting-execution.js";

export type ExecuteLiveMeetingActionsInput = {
  meetingId: string;
  approvals?: Record<string, ApprovalAnswer>;
  integrationConfig?: MeetingActionExecutorConfig;
  execute?: typeof executePlannedMeetingAction;
  verify?: typeof verifyPlannedMeetingAction;
};

export type ExecuteLiveMeetingActionsResult = {
  blockedActionIds: string[];
  executions: MeetingActionExecution[];
};

function toCommitment(action: ReturnType<CanonicalMeetingActionRepository["listForMeeting"]>[number]): MeetingCommitment | undefined {
  const ownerRef = JSON.parse(action.ownerRefJson) as { participantId?: string; speakerClusterId: string };

  if (action.status === "needs_identity" || !ownerRef.participantId) {
    return undefined;
  }

  return {
    context: action.evidenceJson,
    due: action.deadline ?? undefined,
    id: action.id,
    owner: ownerRef.participantId,
    subject: action.description,
    summary: action.description,
    type: "investigation"
  };
}

function statusForApproval(answer: ApprovalAnswer | undefined) {
  if (answer === "yes") {
    return "approved";
  }

  if (answer === "no") {
    return "rejected";
  }

  return "pending";
}

export async function executeLiveMeetingActions(
  storage: Storage,
  input: ExecuteLiveMeetingActionsInput
): Promise<ExecuteLiveMeetingActionsResult> {
  const canonicalActions = new CanonicalMeetingActionRepository(storage);
  const meetingCommitments = new MeetingCommitmentRepository(storage);
  const plannedRows = new PlannedMeetingActionRepository(storage);
  const execute = input.execute ?? executePlannedMeetingAction;
  const verify = input.verify ?? verifyPlannedMeetingAction;
  const blockedActionIds: string[] = [];
  const commitments: MeetingCommitment[] = [];

  for (const action of canonicalActions.listForMeeting(input.meetingId).filter((item) => item.status === "open" || item.status === "needs_identity")) {
    const commitment = toCommitment(action);

    if (!commitment) {
      blockedActionIds.push(action.id);
      continue;
    }

    commitments.push(commitment);
  }

  const plan = planMeetingCommitments(commitments);
  const executions: MeetingActionExecution[] = [];

  for (const action of plan.actions) {
    const commitmentRow = meetingCommitments.create({
      commitment: commitments.find((commitment) => commitment.id === action.commitmentId),
      meetingId: input.meetingId
    });
    const approvalStatus = action.requiresApproval ? statusForApproval(input.approvals?.[action.id]) : "not_required";
    const plannedActionRow = plannedRows.create({
      action,
      approvalStatus,
      commitmentId: commitmentRow.id,
      executionStatus: "pending",
      meetingId: input.meetingId
    });
    const policy = evaluatePolicy({
      label: action.label,
      riskLevel: action.requiresApproval ? "external_side_effect" : "read_only",
      type: action.type
    });

    if (policy.status === "denied") {
      plannedRows.recordExecution(plannedActionRow.id, {
        status: "failed",
        verification: { observed: policy, passed: false, reason: policy.reason }
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
      const approval = input.approvals?.[action.id];

      if (!approval) {
        createApprovalRequest(`${action.id}_approval`, input.meetingId, policy);
        plannedRows.recordExecution(plannedActionRow.id, { status: "waiting_for_approval" });
        executions.push({
          actionId: action.id,
          commitmentId: action.commitmentId,
          status: "waiting_for_approval"
        });
        continue;
      }

      const decision = decideApproval(createApprovalRequest(`${action.id}_approval`, input.meetingId, policy), approval);
      plannedRows.updateApprovalStatus(plannedActionRow.id, decision.status);

      if (decision.status !== "approved") {
        plannedRows.recordExecution(plannedActionRow.id, { status: "rejected" });
        executions.push({
          actionId: action.id,
          commitmentId: action.commitmentId,
          status: "rejected"
        });
        continue;
      }
    }

    await executeOne(action, {
      canonicalActions,
      execute,
      executions,
      input,
      plannedActionRowId: plannedActionRow.id,
      plannedRows,
      verify
    });
  }

  return {
    blockedActionIds,
    executions
  };
}

async function executeOne(
  action: PlannedMeetingAction,
  deps: {
    canonicalActions: CanonicalMeetingActionRepository;
    execute: typeof executePlannedMeetingAction;
    executions: MeetingActionExecution[];
    input: ExecuteLiveMeetingActionsInput;
    plannedActionRowId: string;
    plannedRows: PlannedMeetingActionRepository;
    verify: typeof verifyPlannedMeetingAction;
  }
) {
  try {
    deps.canonicalActions.update(action.commitmentId, { status: "in_progress" });
    const result = await deps.execute(action, deps.input.integrationConfig);
    deps.plannedRows.recordExecution(deps.plannedActionRowId, {
      externalId: result.externalId,
      status: "executed_unverified"
    });

    const verification = await deps.verify(action, result, deps.input.integrationConfig);
    const status = verification.passed ? "verified" : "verification_failed";
    deps.plannedRows.recordExecution(deps.plannedActionRowId, {
      externalId: result.externalId,
      status,
      verification
    });
    deps.canonicalActions.update(action.commitmentId, {
      status: verification.passed ? "completed" : "open"
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

    deps.plannedRows.recordExecution(deps.plannedActionRowId, {
      status: "failed",
      verification: {
        observed: failure,
        passed: false,
        reason: failure
      }
    });
    deps.canonicalActions.update(action.commitmentId, { status: "open" });
    deps.executions.push({
      actionId: action.id,
      commitmentId: action.commitmentId,
      failure,
      status: "failed"
    });
  }
}
