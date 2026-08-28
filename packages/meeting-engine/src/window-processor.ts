import type { ModelProvider } from "@yomeets/model-router";
import { OperationListSchema, type MeetingStateSummary, type Operation, type TranscriptSegment } from "./types.js";

export type ProcessMeetingWindowInput = {
  meetingId: string;
  afterSequence: number;
  segments: TranscriptSegment[];
  currentState: MeetingStateSummary;
  provider: ModelProvider;
};

export type ProcessMeetingWindowResult =
  | {
      operations: Operation[];
      status: "processed";
    }
  | {
      error: string;
      reason: "MEETING_WINDOW_FAILED";
      status: "failed";
    };

const systemPrompt = [
  "You process live engineering meeting transcript windows.",
  "Return JSON only: an array of operations.",
  "Never return a full meeting extraction. Return only state transitions for the new segments.",
  "Emit IGNORE for small talk, acknowledgements, status with no new commitment, and non-substantive turns.",
  "Use current state to update or supersede existing items instead of duplicating them.",
  "If a new decision contradicts a prior decision, return CREATE_DECISION with supersedes set to that decision id.",
  "For commitments, attach ownership to the speaker who accepts or commits to the work, not the person asking.",
  "Use ownerSpeakerId and speakerId values exactly as segment speakerClusterId values.",
  "Set evidenceStartMs and evidenceEndMs to the smallest span covering the supporting segment."
].join("\n");

function userPrompt(input: ProcessMeetingWindowInput) {
  return JSON.stringify({
    afterSequence: input.afterSequence,
    currentState: input.currentState,
    meetingId: input.meetingId,
    segments: input.segments
  });
}

function parseJson(text: string) {
  return JSON.parse(text) as unknown;
}

function canonicalOperationType(type: unknown) {
  if (typeof type !== "string") {
    return type;
  }

  return type.trim().replace(/[\s-]+/g, "_").toUpperCase();
}

function normalizeOperationJson(value: unknown): unknown {
  const operations = typeof value === "object" && value !== null && "operations" in value
    ? (value as { operations?: unknown }).operations
    : value;

  if (!Array.isArray(operations)) {
    return operations;
  }

  return operations.map((operation) => {
    if (typeof operation !== "object" || operation === null || !("type" in operation)) {
      return operation;
    }

    return {
      ...operation,
      type: canonicalOperationType((operation as { type?: unknown }).type)
    };
  });
}

function validateReferences(operations: Operation[], state: MeetingStateSummary) {
  const actionIds = new Set(state.openActions.map((action) => action.id));
  const questionIds = new Set(state.openQuestions.map((question) => question.id));
  const decisionIds = new Set(state.decisions.map((decision) => decision.id));

  for (const operation of operations) {
    if (operation.type === "UPDATE_ACTION" && !actionIds.has(operation.actionId)) {
      throw new Error(`Unknown actionId ${operation.actionId}`);
    }

    if (operation.type === "RESOLVE_QUESTION" && !questionIds.has(operation.questionId)) {
      throw new Error(`Unknown questionId ${operation.questionId}`);
    }

    if (operation.type === "CREATE_DECISION" && operation.supersedes && !decisionIds.has(operation.supersedes)) {
      throw new Error(`Unknown supersedes decision ${operation.supersedes}`);
    }
  }
}

export async function processMeetingWindow(input: ProcessMeetingWindowInput): Promise<ProcessMeetingWindowResult> {
  let lastError = "Unknown meeting window processing failure";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await input.provider.complete({
        system: systemPrompt,
        user: userPrompt(input)
      });

      if (process.env.YOMEETS_DEBUG_MODEL) {
        console.error(response.text);
      }

      const operations = OperationListSchema.parse(normalizeOperationJson(parseJson(response.text)));

      validateReferences(operations, input.currentState);

      return {
        operations,
        status: "processed"
      };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    error: lastError,
    reason: "MEETING_WINDOW_FAILED",
    status: "failed"
  };
}
