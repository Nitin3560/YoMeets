import type { ModelProvider } from "@yomeets/model-router";
import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingQuestionRepository,
  MeetingRepository,
  TranscriptSegmentRepository,
  type Storage
} from "@yomeets/storage";
import type { Evidence } from "./types.js";

export type MeetingMemoryKind = "action" | "decision" | "question" | "transcript";

export type MeetingMemoryRecord = {
  id: string;
  kind: MeetingMemoryKind;
  meetingId: string;
  text: string;
  evidence: Evidence[];
};

export type AskYoMeetsResult = {
  answer: string;
  citations: MeetingMemoryRecord[];
};

function tokenize(text: string) {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function evidenceFromJson(value: string) {
  return JSON.parse(value) as Evidence[];
}

function scoreRecord(queryTokens: Set<string>, record: MeetingMemoryRecord) {
  const recordTokens = tokenize(record.text);
  let score = 0;

  for (const token of queryTokens) {
    if (recordTokens.has(token)) {
      score += 1;
    }
  }

  if (record.kind === "decision") {
    score += 0.2;
  }

  return score;
}

export function loadMeetingMemory(storage: Storage, meetingId?: string): MeetingMemoryRecord[] {
  const meetingIds = meetingId ? [meetingId] : new MeetingRepository(storage).listAll().map((meeting) => meeting.id);
  const records: MeetingMemoryRecord[] = [];

  for (const id of meetingIds) {
    records.push(...new CanonicalMeetingActionRepository(storage).listForMeeting(id).map((action) => ({
      evidence: evidenceFromJson(action.evidenceJson),
      id: action.id,
      kind: "action" as const,
      meetingId: id,
      text: `${action.description} ${action.deadline ?? ""} ${action.status}`
    })));
    records.push(...new MeetingDecisionRepository(storage).listForMeeting(id).map((decision) => ({
      evidence: evidenceFromJson(decision.evidenceJson),
      id: decision.id,
      kind: "decision" as const,
      meetingId: id,
      text: decision.text
    })));
    records.push(...new MeetingQuestionRepository(storage).listForMeeting(id).map((question) => ({
      evidence: evidenceFromJson(question.evidenceJson),
      id: question.id,
      kind: "question" as const,
      meetingId: id,
      text: `${question.text} ${question.status}`
    })));
    records.push(...new TranscriptSegmentRepository(storage).listForMeeting(id).map((segment) => ({
      evidence: [
        {
          clipEndMs: segment.endMs,
          clipStartMs: segment.startMs,
          segmentId: segment.id
        }
      ],
      id: segment.id,
      kind: "transcript" as const,
      meetingId: id,
      text: segment.text
    })));
  }

  return records;
}

export function searchMeetingMemory(query: string, records: MeetingMemoryRecord[], limit = 5) {
  const queryTokens = tokenize(query);

  return records
    .map((record) => ({
      record,
      score: scoreRecord(queryTokens, record)
    }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((item) => item.record);
}

export async function askYoMeets(
  storage: Storage,
  input: {
    meetingId?: string;
    provider: ModelProvider;
    query: string;
  }
): Promise<AskYoMeetsResult> {
  const citations = searchMeetingMemory(input.query, loadMeetingMemory(storage, input.meetingId));
  const response = await input.provider.complete({
    system: [
      "Answer questions about meeting memory.",
      "Use only the provided records.",
      "If the records are insufficient, say what is missing.",
      "Mention citation ids inline using their record ids."
    ].join("\n"),
    user: JSON.stringify({
      query: input.query,
      records: citations
    })
  });

  return {
    answer: response.text.trim(),
    citations
  };
}
