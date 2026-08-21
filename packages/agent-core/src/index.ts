import { evaluatePolicy, type PolicyAction, type PolicyDecision } from "@yomeets/policy-engine";
export { buildTaskChecklist, formatTaskChecklist, type ChecklistItem } from "./checklist.js";
export { classifyActionResult, classifyFailure, type ClassifiedFailure, type FailureClass } from "./failures.js";
export { previewScenario, type ScenarioPreview } from "./scenario.js";
export { decideRetry, type RetryDecision } from "./retry.js";
export { buildTaskTrace, type TaskTraceEvent } from "./trace.js";

export type AgentStatus =
  | "received"
  | "parsed"
  | "planned"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentLimits = {
  maxAgentSteps: number;
  maxModelCalls: number;
  maxRetriesPerAction: number;
  maxTaskRuntimeMs: number;
};

export type AgentState = {
  taskId: string;
  status: AgentStatus;
  stepIndex: number;
  agentSteps: number;
  modelCalls: number;
  retriesForCurrentAction: number;
  startedAtMs: number;
  updatedAtMs: number;
  limits: AgentLimits;
  pendingApproval?: {
    action: PolicyAction;
    decision: Extract<PolicyDecision, { status: "approval_required" }>;
  };
  failure?: string;
};

export type AgentEvent =
  | {
      type: "INTENT_PARSED";
      modelCalls?: number;
    }
  | {
      type: "PLAN_CREATED";
    }
  | {
      type: "ACTION_PROPOSED";
      action: PolicyAction;
    }
  | {
      type: "APPROVAL_GRANTED";
    }
  | {
      type: "ACTION_VERIFIED";
    }
  | {
      type: "TASK_COMPLETED";
    }
  | {
      type: "TASK_CANCELLED";
    }
  | {
      type: "TASK_FAILED";
      reason: string;
    };

export const defaultAgentLimits: AgentLimits = {
  maxAgentSteps: 50,
  maxModelCalls: 20,
  maxRetriesPerAction: 3,
  maxTaskRuntimeMs: 10 * 60 * 1000
};

export function createAgentState(taskId: string, nowMs = Date.now()): AgentState {
  return {
    agentSteps: 0,
    limits: defaultAgentLimits,
    modelCalls: 0,
    retriesForCurrentAction: 0,
    startedAtMs: nowMs,
    status: "received",
    stepIndex: 0,
    taskId,
    updatedAtMs: nowMs
  };
}

function withUpdate(state: AgentState, updates: Partial<AgentState>, nowMs: number): AgentState {
  return {
    ...state,
    ...updates,
    updatedAtMs: nowMs
  };
}

function limitFailure(state: AgentState, nowMs: number) {
  if (state.agentSteps > state.limits.maxAgentSteps) {
    return withUpdate(state, { failure: "AGENT_STEP_LIMIT_REACHED", status: "failed" }, nowMs);
  }

  if (state.modelCalls > state.limits.maxModelCalls) {
    return withUpdate(state, { failure: "MODEL_CALL_LIMIT_REACHED", status: "failed" }, nowMs);
  }

  if (nowMs - state.startedAtMs > state.limits.maxTaskRuntimeMs) {
    return withUpdate(state, { failure: "TASK_RUNTIME_LIMIT_REACHED", status: "failed" }, nowMs);
  }

  return undefined;
}

export function advanceAgentState(state: AgentState, event: AgentEvent, nowMs = Date.now()): AgentState {
  if (state.status === "completed" || state.status === "failed" || state.status === "cancelled") {
    return state;
  }

  const countedState = withUpdate(
    state,
    {
      agentSteps: state.agentSteps + 1,
      modelCalls: state.modelCalls + (event.type === "INTENT_PARSED" ? event.modelCalls ?? 1 : 0)
    },
    nowMs
  );
  const failedByLimit = limitFailure(countedState, nowMs);

  if (failedByLimit) {
    return failedByLimit;
  }

  switch (event.type) {
    case "INTENT_PARSED":
      return withUpdate(countedState, { status: "parsed" }, nowMs);
    case "PLAN_CREATED":
      return withUpdate(countedState, { status: "planned" }, nowMs);
    case "ACTION_PROPOSED": {
      const decision = evaluatePolicy(event.action);

      if (decision.status === "denied") {
        return withUpdate(countedState, { failure: decision.reason, status: "failed" }, nowMs);
      }

      if (decision.status === "approval_required") {
        return withUpdate(
          countedState,
          {
            pendingApproval: {
              action: event.action,
              decision
            },
            status: "waiting_for_approval"
          },
          nowMs
        );
      }

      return withUpdate(countedState, { status: "running" }, nowMs);
    }
    case "APPROVAL_GRANTED":
      return withUpdate(countedState, { pendingApproval: undefined, status: "running" }, nowMs);
    case "ACTION_VERIFIED":
      return withUpdate(countedState, { stepIndex: countedState.stepIndex + 1, status: "running" }, nowMs);
    case "TASK_COMPLETED":
      return withUpdate(countedState, { status: "completed" }, nowMs);
    case "TASK_CANCELLED":
      return withUpdate(countedState, { status: "cancelled" }, nowMs);
    case "TASK_FAILED":
      return withUpdate(countedState, { failure: event.reason, status: "failed" }, nowMs);
  }
}
