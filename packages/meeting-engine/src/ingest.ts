import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  SpeakerClusterRepository,
  TranscriptSegmentRepository,
  type Storage
} from "@yomeets/storage";
import type { Evidence, MeetingAction, MeetingDecision, TranscriptSegment } from "./types.js";

export type IngestTranscriptSegmentInput = {
  id?: string;
  meetingId: string;
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  final?: boolean;
  source?: string;
};

export type IngestTranscriptSegmentResult = {
  segment: TranscriptSegment;
  actions: MeetingAction[];
  decisions: MeetingDecision[];
};

function sentenceAction(text: string) {
  const request = text.match(/can you check the (.+?)[?.]?$/i);

  return request?.[1]?.trim();
}

function responseAction(text: string, previousTopic: string | undefined) {
  if (!previousTopic) {
    return undefined;
  }

  if (!/\b(i'll|i will)\s+(fix|check|handle|do)\b/i.test(text)) {
    return undefined;
  }

  return `Fix ${previousTopic}`;
}

function responseDeadline(text: string) {
  if (/\btomorrow\b/i.test(text)) {
    return "tomorrow";
  }

  return undefined;
}

function decisionText(text: string) {
  const match = text.match(/^let's\s+(.+?)[.]?$/i);

  if (!match?.[1]) {
    return undefined;
  }

  return `${match[1][0]?.toUpperCase() ?? ""}${match[1].slice(1)}`;
}

function evidence(segment: TranscriptSegment): Evidence[] {
  return [
    {
      clipEndMs: segment.endMs,
      clipStartMs: segment.startMs,
      segmentId: segment.id
    }
  ];
}

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

export function ingestTranscriptSegment(storage: Storage, input: IngestTranscriptSegmentInput): IngestTranscriptSegmentResult {
  const cluster = ensureSpeakerCluster(storage, input.meetingId, input.speakerLabel);
  const segments = new TranscriptSegmentRepository(storage);
  const actions = new CanonicalMeetingActionRepository(storage);
  const decisions = new MeetingDecisionRepository(storage);
  const segment = segments.create({
    endMs: input.endMs,
    final: input.final ?? true,
    id: input.id,
    meetingId: input.meetingId,
    source: input.source ?? "diarized_test",
    speakerClusterId: cluster.id,
    startMs: input.startMs,
    text: input.text
  });
  const canonicalSegment: TranscriptSegment = {
    ...segment,
    final: segment.final === 1,
    participantId: segment.participantId ?? undefined
  };
  const previousSegments = segments.listForMeeting(input.meetingId).filter((item) => item.id !== segment.id);
  const previousTopic = previousSegments.map((item) => sentenceAction(item.text)).filter(Boolean).at(-1);
  const actionDescription = responseAction(input.text, previousTopic);
  const createdActions: MeetingAction[] = [];
  const createdDecisions: MeetingDecision[] = [];

  if (actionDescription) {
    const stored = actions.create({
      deadline: responseDeadline(input.text),
      description: actionDescription,
      evidence: evidence(canonicalSegment),
      meetingId: input.meetingId,
      ownerRef: {
        speakerClusterId: cluster.id
      },
      status: "needs_identity"
    });

    createdActions.push({
      deadline: stored.deadline ?? undefined,
      description: stored.description,
      evidence: JSON.parse(stored.evidenceJson) as Evidence[],
      id: stored.id,
      meetingId: stored.meetingId,
      ownerRef: JSON.parse(stored.ownerRefJson) as MeetingAction["ownerRef"],
      status: stored.status as MeetingAction["status"]
    });
  }

  const decision = decisionText(input.text);

  if (decision) {
    const stored = decisions.create({
      evidence: evidence(canonicalSegment),
      meetingId: input.meetingId,
      speakerRef: {
        speakerClusterId: cluster.id
      },
      text: decision
    });

    createdDecisions.push({
      evidence: JSON.parse(stored.evidenceJson) as Evidence[],
      id: stored.id,
      meetingId: stored.meetingId,
      speakerRef: JSON.parse(stored.speakerRefJson) as MeetingDecision["speakerRef"],
      text: stored.text
    });
  }

  return {
    actions: createdActions,
    decisions: createdDecisions,
    segment: canonicalSegment
  };
}
