export type TranscriptInput = {
  text: string;
  source?: "voice" | "typed";
};

export type NormalizedTranscript = {
  rawText: string;
  command: string;
  source: "voice" | "typed";
};

export function normalizeTranscript(input: TranscriptInput): NormalizedTranscript {
  const command = input.text.replace(/\s+/g, " ").trim();

  if (!command) {
    throw new Error("Transcript text is required");
  }

  return {
    command,
    rawText: input.text,
    source: input.source ?? "voice"
  };
}
