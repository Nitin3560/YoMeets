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
  pendingApproval?: unknown;
  failure?: string;
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
