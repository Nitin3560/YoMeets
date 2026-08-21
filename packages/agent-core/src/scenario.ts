import type { ModelProvider } from "@yomeets/model-router";
import { parseTaskIntentWithModel, planTaskIntent, type TaskIntent, type TaskPlanDraft } from "@yomeets/task-engine";
import { buildTaskTrace, type TaskTraceEvent } from "./trace.js";

export type ScenarioPreview =
  | {
      status: "completed";
      command: string;
      intent: TaskIntent;
      plan: TaskPlanDraft;
      trace: TaskTraceEvent[];
    }
  | {
      status: "failed";
      command: string;
      reason: string;
      error: string;
    };

export async function previewScenario(command: string, provider: ModelProvider): Promise<ScenarioPreview> {
  const parsed = await parseTaskIntentWithModel(provider, command);

  if (parsed.status === "failed") {
    return {
      command,
      error: parsed.error,
      reason: parsed.reason,
      status: "failed"
    };
  }

  const plan = planTaskIntent(parsed.intent);

  return {
    command,
    intent: parsed.intent,
    plan,
    status: "completed",
    trace: buildTaskTrace(plan)
  };
}
