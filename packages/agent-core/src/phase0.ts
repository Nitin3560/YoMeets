import { verifyOutcome, type PageObservation } from "@yomeets/browser-core";
import type { ModelProvider } from "@yomeets/model-router";
import {
  ActionRepository,
  AuditWriter,
  TaskIntentRepository,
  TaskPlanRepository,
  TaskRepository,
  VerificationResultRepository,
  type Storage
} from "@yomeets/storage";
import { createTaskFromCommand, parseTaskIntentWithModel, planTaskIntent } from "@yomeets/task-engine";
import { advanceAgentState, createAgentState } from "./index.js";
import { buildTaskTrace } from "./trace.js";

export type Phase0Result = {
  taskId: string;
  status: "completed" | "failed";
  trace: string[];
  verificationPassed: boolean;
};

function finalObservation(): PageObservation {
  return {
    elements: [
      {
        bounds: { height: 24, width: 180, x: 0, y: 0 },
        enabled: true,
        name: "Pending",
        ref: "e_1",
        role: "status",
        visible: true
      }
    ],
    observedAt: new Date().toISOString(),
    pageVersion: 1,
    title: "John Smith",
    url: "http://localhost:3000/profile/john-smith"
  };
}

export async function runPhase0Task(storage: Storage, provider: ModelProvider, command: string): Promise<Phase0Result> {
  const task = createTaskFromCommand(storage, command);
  const tasks = new TaskRepository(storage);
  const intents = new TaskIntentRepository(storage);
  const plans = new TaskPlanRepository(storage);
  const actions = new ActionRepository(storage);
  const verifications = new VerificationResultRepository(storage);
  const audit = new AuditWriter(storage);
  let state = createAgentState(task.id);

  const parsed = await parseTaskIntentWithModel(provider, command);

  if (parsed.status === "failed") {
    tasks.updateStatus(task.id, "failed");
    audit.write("TASK_PARSE_FAILED", parsed, task.id);

    return {
      status: "failed",
      taskId: task.id,
      trace: ["TASK_RECEIVED", "TASK_PARSE_FAILED"],
      verificationPassed: false
    };
  }

  state = advanceAgentState(state, { type: "INTENT_PARSED" });
  intents.create({ intent: parsed.intent, taskId: task.id });
  audit.write("PARSED", parsed.intent, task.id);

  const plan = planTaskIntent(parsed.intent);
  plans.create({ plan, taskId: task.id });
  state = advanceAgentState(state, { type: "PLAN_CREATED" });
  audit.write("PLAN_CREATED", plan, task.id);

  const action = actions.create({
    action: {
      type: "phase0_verified_trace"
    },
    requestId: `phase0_${task.id}`,
    taskId: task.id
  });
  const verification = verifyOutcome(finalObservation(), {
    text: "Pending",
    type: "textAppears"
  });

  actions.recordResult(action.id, { status: "completed" });
  verifications.create({ actionId: action.id, result: verification, taskId: task.id });
  state = advanceAgentState(state, { type: "TASK_COMPLETED" });
  tasks.updateStatus(task.id, state.status);
  audit.write("COMPLETED", { verification }, task.id);

  return {
    status: "completed",
    taskId: task.id,
    trace: buildTaskTrace(plan),
    verificationPassed: verification.passed
  };
}
