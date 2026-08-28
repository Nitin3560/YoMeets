import {
  CanonicalMeetingActionRepository,
  MeetingParticipantRepository,
  SpeakerClusterRepository,
  TranscriptSegmentRepository,
  type Storage
} from "@yomeets/storage";
import type { OwnerRef, SpeakerIdentityResolution, SpeakerResolutionStatus } from "./types.js";

export type ResolveSpeakerIdentitiesInput = {
  meetingId: string;
  localMic?: {
    participantId: string;
    speakerClusterId: string;
  };
};

export type ConfirmSpeakerIdentityInput = {
  meetingId: string;
  speakerClusterId: string;
  participantId: string;
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function addressedParticipantId(text: string, participants: Array<{ id: string; name: string }>) {
  const firstToken = text.trim().split(/[\s,]+/)[0]?.toLowerCase();

  if (!firstToken) {
    return undefined;
  }

  return participants.find((participant) => normalizeName(participant.name).split(/\s+/)[0] === firstToken)?.id;
}

function acceptsWork(text: string) {
  return /\b(i'll|i will|i can|i'll handle|i can handle|yeah|sure|okay)\b/i.test(text);
}

function rowStatus(status: string): SpeakerResolutionStatus {
  if (status === "likely" || status === "confirmed") {
    return status;
  }

  return "unknown";
}

function toResolution(input: {
  speakerClusterId: string;
  participantId?: string | null;
  participantName?: string;
  status: SpeakerResolutionStatus;
  confidence: number;
  reason: SpeakerIdentityResolution["reason"];
  evidenceSegmentIds?: string[];
}): SpeakerIdentityResolution {
  return {
    confidence: input.confidence,
    evidenceSegmentIds: input.evidenceSegmentIds ?? [],
    participantId: input.participantId ?? undefined,
    participantName: input.participantName,
    reason: input.reason,
    speakerClusterId: input.speakerClusterId,
    status: input.status
  };
}

function updateActionsForConfirmedSpeaker(storage: Storage, meetingId: string, speakerClusterId: string, participantId: string) {
  const actions = new CanonicalMeetingActionRepository(storage);

  for (const action of actions.listForMeeting(meetingId)) {
    const ownerRef = JSON.parse(action.ownerRefJson) as OwnerRef;

    if (ownerRef.speakerClusterId !== speakerClusterId) {
      continue;
    }

    actions.updateOwnerRef(action.id, {
      ...ownerRef,
      participantId
    }, action.status === "needs_identity" ? "open" : action.status);
  }
}

export function confirmSpeakerIdentity(storage: Storage, input: ConfirmSpeakerIdentityInput): SpeakerIdentityResolution {
  const participants = new MeetingParticipantRepository(storage);
  const clusters = new SpeakerClusterRepository(storage);
  const segments = new TranscriptSegmentRepository(storage);
  const participant = participants.listForMeeting(input.meetingId).find((item) => item.id === input.participantId);
  const cluster = clusters.findById(input.speakerClusterId);

  if (!participant) {
    throw new Error(`Unknown participant ${input.participantId}`);
  }

  if (!cluster || cluster.meetingId !== input.meetingId) {
    throw new Error(`Unknown speaker cluster ${input.speakerClusterId}`);
  }

  clusters.updateResolution(input.speakerClusterId, {
    resolutionStatus: "confirmed",
    resolvedParticipantId: input.participantId
  });
  segments.updateParticipantForSpeakerCluster(input.speakerClusterId, input.participantId);
  updateActionsForConfirmedSpeaker(storage, input.meetingId, input.speakerClusterId, input.participantId);

  return toResolution({
    confidence: 1,
    participantId: participant.id,
    participantName: participant.name,
    reason: "manual",
    speakerClusterId: input.speakerClusterId,
    status: "confirmed"
  });
}

export function resolveSpeakerIdentities(storage: Storage, input: ResolveSpeakerIdentitiesInput): SpeakerIdentityResolution[] {
  const participants = new MeetingParticipantRepository(storage).listForMeeting(input.meetingId);
  const clusters = new SpeakerClusterRepository(storage);
  const segments = new TranscriptSegmentRepository(storage).listForMeeting(input.meetingId);
  const results: SpeakerIdentityResolution[] = [];

  if (input.localMic) {
    const participant = participants.find((item) => item.id === input.localMic?.participantId);

    if (participant) {
      clusters.updateResolution(input.localMic.speakerClusterId, {
        resolutionStatus: "confirmed",
        resolvedParticipantId: participant.id
      });
      new TranscriptSegmentRepository(storage).updateParticipantForSpeakerCluster(input.localMic.speakerClusterId, participant.id);
      updateActionsForConfirmedSpeaker(storage, input.meetingId, input.localMic.speakerClusterId, participant.id);
      results.push(toResolution({
        confidence: 1,
        participantId: participant.id,
        participantName: participant.name,
        reason: "local_mic",
        speakerClusterId: input.localMic.speakerClusterId,
        status: "confirmed"
      }));
    }
  }

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];

    if (!segment || !next || segment.speakerClusterId === next.speakerClusterId || !acceptsWork(next.text)) {
      continue;
    }

    const participantId = addressedParticipantId(segment.text, participants);
    const participant = participants.find((item) => item.id === participantId);

    if (!participant) {
      continue;
    }

    const cluster = clusters.findById(next.speakerClusterId);

    if (!cluster || cluster.resolutionStatus === "confirmed") {
      continue;
    }

    clusters.updateResolution(next.speakerClusterId, {
      resolutionStatus: "likely",
      resolvedParticipantId: participant.id
    });
    results.push(toResolution({
      confidence: 0.72,
      evidenceSegmentIds: [segment.id, next.id],
      participantId: participant.id,
      participantName: participant.name,
      reason: "direct_address",
      speakerClusterId: next.speakerClusterId,
      status: "likely"
    }));
  }

  const byCluster = new Map(results.map((result) => [result.speakerClusterId, result]));

  for (const cluster of clusters.listForMeeting(input.meetingId)) {
    if (!byCluster.has(cluster.id)) {
      const participant = participants.find((item) => item.id === cluster.resolvedParticipantId);
      results.push(toResolution({
        confidence: cluster.resolutionStatus === "confirmed" ? 1 : cluster.resolutionStatus === "likely" ? 0.72 : 0,
        participantId: cluster.resolvedParticipantId,
        participantName: participant?.name,
        reason: rowStatus(cluster.resolutionStatus) === "unknown" ? "unknown" : "manual",
        speakerClusterId: cluster.id,
        status: rowStatus(cluster.resolutionStatus)
      }));
    }
  }

  return results.sort((first, second) => first.speakerClusterId.localeCompare(second.speakerClusterId));
}
