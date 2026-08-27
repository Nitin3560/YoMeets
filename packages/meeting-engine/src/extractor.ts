import type { ModelProvider } from "@yomeets/model-router";
import { CommitmentListSchema, type Commitment } from "./types.js";

export type ExtractCommitmentsResult =
  | {
      commitments: Commitment[];
      status: "extracted";
    }
  | {
      error: string;
      reason: "COMMITMENT_EXTRACTION_FAILED";
      status: "failed";
    };

const systemPrompt = [
  "You extract commitments from engineering meeting transcripts.",
  "Return JSON only: an array of commitments.",
  "Each commitment must include id, owner, actionType, description, deadline, sourceQuote, timestamp, and confidence.",
  "actionType must be one of create_issue, schedule_event, send_email, record_decision.",
  "Use the raw spoken owner name. If no owner is clear, use an empty string and lower confidence.",
  "Use ISO dates for deadline when the transcript gives a date. Use null when no deadline is stated.",
  "Vague suggestions are commitments only when they imply follow-up; give them low confidence.",
  "Questions can assign ownership, for example 'Nitin, can you check auth?' means owner is Nitin.",
  "Resolve backward references within the same transcript using the full transcript.",
  "Pure chit-chat should return an empty array."
].join("\n");

function buildUserPrompt(transcript: string) {
  return [
    "Transcript:",
    transcript,
    "",
    "Extract only actionable commitments and decisions with provenance."
  ].join("\n");
}

function parseJson(text: string) {
  return JSON.parse(text) as unknown;
}

export async function extractCommitments(
  transcript: string,
  provider: ModelProvider
): Promise<ExtractCommitmentsResult> {
  let lastError = "Unknown commitment extraction failure";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await provider.complete({
        system: systemPrompt,
        user: buildUserPrompt(transcript)
      });
      const commitments = CommitmentListSchema.parse(parseJson(response.text));

      return {
        commitments,
        status: "extracted"
      };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    error: lastError,
    reason: "COMMITMENT_EXTRACTION_FAILED",
    status: "failed"
  };
}
