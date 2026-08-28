import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingQuestionRepository,
  SpeakerClusterRepository,
  TranscriptSegmentRepository,
  type Storage
} from "@yomeets/storage";
import type { ModelProvider } from "@yomeets/model-router";
import type {
  Evidence,
  MeetingAction,
  MeetingDecision,
  MeetingQuestion,
  MeetingStateSummary,
  Operation,
  TranscriptSegment
} from "./types.js";
import { processMeetingWindow } from "./window-processor.js";

export type IngestTranscriptSegmentInput = {
  id?: string;
  meetingId: string;
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  sequence?: number;
  final?: boolean;
  source?: string;
};

export type IngestTranscriptSegmentResult = {
  segment: TranscriptSegment;
};

export type ApplyOperationsResult = {
  actions: MeetingAction[];
  decisions: MeetingDecision[];
  questions: MeetingQuestion[];
  resolvedQuestionIds: string[];
  updatedActionIds: string[];
};

export type MeetingWindowTriggerState = {
  lastProcessedSequence: number;
  lastProcessedAtMs: number;
};

export type MeetingWindowTriggerConfig = {
  maxUnprocessedSegments?: number;
  maxUnprocessedMs?: number;
};

export type MaybeProcessMeetingWindowInput = {
  meetingId: string;
  state: MeetingWindowTriggerState;
  currentState: MeetingStateSummary;
  provider: ModelProvider;
  nowMs?: number;
  config?: MeetingWindowTriggerConfig;
};

function ensureSpeakerCluster(storage: Storage, meetingId: string, label: string) {
  const clusters = new SpeakerClusterRepository(storage);
  const existing = clusters.findByLabel(meetingId, label);

  return existing ?? clusters.create({
    id: `${meetingId}_${label}`,
    label,
    meetingId,
    resolutionStatus: "unknown"
  });
}

function toTranscriptSegment(segment: {
  id: string;
  meetingId: string;
  speakerClusterId: string;
  participantId: string | null;
  startMs: number;
  endMs: number;
  text: string;
  final: number;
  source: string;
  sequence: number;
}): TranscriptSegment {
  return {
    ...segment,
    final: segment.final === 1,
    participantId: segment.participantId ?? undefined
  };
}

function evidenceForOperation(operation: Extract<Operation, { evidenceStartMs: number; evidenceEndMs: number }>, segments: TranscriptSegment[]): Evidence[] {
  const segment = segments.find((item) => item.startMs <= operation.evidenceStartMs && item.endMs >= operation.evidenceEndMs) ?? segments[0];

  if (!segment) {
    return [];
  }

  return [
    {
      clipEndMs: operation.evidenceEndMs,
      clipStartMs: operation.evidenceStartMs,
      segmentId: segment.id
    }
  ];
}

function actionFromRow(row: ReturnType<CanonicalMeetingActionRepository["create"]>): MeetingAction {
  return {
    deadline: row.deadline ?? undefined,
    description: row.description,
    evidence: JSON.parse(row.evidenceJson) as Evidence[],
    id: row.id,
    meetingId: row.meetingId,
    ownerRef: JSON.parse(row.ownerRefJson) as MeetingAction["ownerRef"],
    status: row.status as MeetingAction["status"]
  };
}

function decisionFromRow(row: ReturnType<MeetingDecisionRepository["create"]>): MeetingDecision {
  return {
    evidence: JSON.parse(row.evidenceJson) as Evidence[],
    id: row.id,
    meetingId: row.meetingId,
    speakerRef: JSON.parse(row.speakerRefJson) as MeetingDecision["speakerRef"],
    supersedes: row.supersedes ?? undefined,
    text: row.text
  };
}

function questionFromRow(row: ReturnType<MeetingQuestionRepository["create"]>): MeetingQuestion {
  return {
    evidence: JSON.parse(row.evidenceJson) as Evidence[],
    id: row.id,
    meetingId: row.meetingId,
    status: row.status as MeetingQuestion["status"],
    text: row.text
  };
}

export function ingestTranscriptSegment(storage: Storage, input: IngestTranscriptSegmentInput): IngestTranscriptSegmentResult {
  const cluster = ensureSpeakerCluster(storage, input.meetingId, input.speakerLabel);
  const segment = new TranscriptSegmentRepository(storage).create({
    endMs: input.endMs,
    final: input.final ?? true,
    id: input.id,
    meetingId: input.meetingId,
    sequence: input.sequence,
    source: input.source ?? "diarized_test",
    speakerClusterId: cluster.id,
    startMs: input.startMs,
    text: input.text
  });

  return {
    segment: toTranscriptSegment(segment)
  };
}

export function applyOperations(
  storage: Storage,
  meetingId: string,
  ops: Operation[],
  segments: TranscriptSegment[]
): ApplyOperationsResult {
  const actions = new CanonicalMeetingActionRepository(storage);
  const decisions = new MeetingDecisionRepository(storage);
  const questions = new MeetingQuestionRepository(storage);
  const createdActions: MeetingAction[] = [];
  const createdDecisions: MeetingDecision[] = [];
  const createdQuestions: MeetingQuestion[] = [];
  const resolvedQuestionIds: string[] = [];
  const updatedActionIds: string[] = [];

  for (const operation of ops) {
    if (operation.type === "CREATE_ACTION") {
      createdActions.push(actionFromRow(actions.create({
        deadline: operation.deadline,
        description: operation.description,
        evidence: evidenceForOperation(operation, segments),
        meetingId,
        ownerRef: {
          speakerClusterId: operation.ownerSpeakerId
        },
        status: "needs_identity"
      })));
      continue;
    }

    if (operation.type === "CREATE_DECISION") {
      createdDecisions.push(decisionFromRow(decisions.create({
        evidence: evidenceForOperation(operation, segments),
        meetingId,
        speakerRef: {
          speakerClusterId: operation.speakerId
        },
        supersedes: operation.supersedes,
        text: operation.text
      })));
      continue;
    }

    if (operation.type === "CREATE_QUESTION") {
      createdQuestions.push(questionFromRow(questions.create({
        evidence: evidenceForOperation(operation, segments),
        meetingId,
        status: "open",
        text: operation.text
      })));
      continue;
    }

    if (operation.type === "UPDATE_ACTION") {
      actions.update(operation.actionId, {
        description: operation.description,
        status: operation.status
      });
      updatedActionIds.push(operation.actionId);
      continue;
    }

    if (operation.type === "RESOLVE_QUESTION") {
      questions.resolve(operation.questionId);
      resolvedQuestionIds.push(operation.questionId);
    }
  }

  return {
    actions: createdActions,
    decisions: createdDecisions,
    questions: createdQuestions,
    resolvedQuestionIds,
    updatedActionIds
  };
}

export async function maybeProcessMeetingWindow(
  storage: Storage,
  input: MaybeProcessMeetingWindowInput
): Promise<ApplyOperationsResult | undefined> {
  const config = {
    maxUnprocessedMs: input.config?.maxUnprocessedMs ?? 15_000,
    maxUnprocessedSegments: input.config?.maxUnprocessedSegments ?? 3
  };
  const nowMs = input.nowMs ?? Date.now();
  const segments = new TranscriptSegmentRepository(storage)
    .listAfterSequence(input.meetingId, input.state.lastProcessedSequence)
    .map(toTranscriptSegment);
  const shouldProcess =
    segments.length >= config.maxUnprocessedSegments || nowMs - input.state.lastProcessedAtMs >= config.maxUnprocessedMs;

  if (!shouldProcess || segments.length === 0) {
    return undefined;
  }

  const processed = await processMeetingWindow({
    afterSequence: input.state.lastProcessedSequence,
    currentState: input.currentState,
    meetingId: input.meetingId,
    provider: input.provider,
    segments
  });

  if (processed.status === "failed") {
    throw new Error(processed.error);
  }

  const result = applyOperations(storage, input.meetingId, processed.operations, segments);

  input.state.lastProcessedSequence = Math.max(...segments.map((segment) => segment.sequence));
  input.state.lastProcessedAtMs = nowMs;

  return result;
}
