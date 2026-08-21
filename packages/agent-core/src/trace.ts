import type { TaskPlanDraft, TaskPlanStep } from "@yomeets/task-engine";

export type TaskTraceEvent =
  | "TASK_RECEIVED"
  | "PARSED"
  | "PLAN_CREATED"
  | "NAVIGATE"
  | "SEARCH"
  | "PROFILE_OPENED"
  | "TARGET_VERIFIED"
  | "CONNECT_CLICKED"
  | "NOTE_DIALOG_OPENED"
  | "MESSAGE_TYPED"
  | "SEND_CLICKED"
  | "PENDING_DETECTED"
  | "COMPLETED";

function eventsForStep(step: TaskPlanStep): TaskTraceEvent[] {
  switch (step.type) {
    case "NAVIGATE_TARGET":
      return ["NAVIGATE"];
    case "SEARCH":
      return ["SEARCH"];
    case "OPEN_PROFILE":
      return ["PROFILE_OPENED"];
    case "VERIFY_TARGET":
      return ["TARGET_VERIFIED"];
    case "CONNECT":
      return ["CONNECT_CLICKED"];
    case "ADD_NOTE":
      return ["NOTE_DIALOG_OPENED", "MESSAGE_TYPED"];
    case "SEND":
      return ["SEND_CLICKED"];
    case "VERIFY_PENDING":
      return ["PENDING_DETECTED"];
  }

  throw new Error(`Unsupported plan step: ${step.type satisfies never}`);
}

export function buildTaskTrace(plan: TaskPlanDraft): TaskTraceEvent[] {
  return ["TASK_RECEIVED", "PARSED", "PLAN_CREATED", ...plan.steps.flatMap(eventsForStep), "COMPLETED"];
}
