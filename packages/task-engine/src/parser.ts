import type { ModelProvider } from "@yomeets/model-router";
import { TaskIntentSchema, type TaskIntent } from "./intent.js";

export type ParseTaskIntentResult =
  | {
    status: "parsed";
    intent: TaskIntent;
  }
  | {
    status: "failed";
    reason: "TASK_PARSE_FAILED";
    error: string;
  };

const systemPrompt = [
  "You parse local browser automation tasks.",
  "Return JSON only.",
  "Schema: { intent, targets, action }.",
  "intent is search_profile or send_connection_request.",
  "action.type is open_profile or connect."
].join("\n");

function buildUserPrompt(rawCommand: string) {
  return `Raw task: ${rawCommand}`;
}

function parseJson(text: string) {
  return JSON.parse(text) as unknown;
}

export async function parseTaskIntentWithModel(
  provider: ModelProvider,
  rawCommand: string
): Promise<ParseTaskIntentResult> {
  let lastError = "Unknown parse failure";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await provider.complete({
        system: systemPrompt,
        user: buildUserPrompt(rawCommand)
      });
      const intent = TaskIntentSchema.parse(parseJson(response.text));

      return {
        intent,
        status: "parsed"
      };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    error: lastError,
    reason: "TASK_PARSE_FAILED",
    status: "failed"
  };
}
