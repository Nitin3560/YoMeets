import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingRepository,
  MeetingQuestionRepository,
  type Storage
} from "@yomeets/storage";
import type { Evidence, MeetingAction, MeetingDecision } from "./types.js";

type StoredMeetingAction = ReturnType<CanonicalMeetingActionRepository["listForMeeting"]>[number];
type StoredMeetingDecision = ReturnType<MeetingDecisionRepository["listForMeeting"]>[number];

export type EvidenceClip = Evidence & {
  audioPath?: string;
};

export type ReconciliationReport = {
  duplicateActionGroups: string[][];
  openQuestionIds: string[];
  supersededDecisionIds: string[];
  unresolvedActionIds: string[];
  evidenceClips: EvidenceClip[];
};

export type AppliedReconciliation = ReconciliationReport & {
  completedDuplicateActionIds: string[];
  normalizedUnresolvedActionIds: string[];
};

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function evidenceFromJson(value: string) {
  return JSON.parse(value) as Evidence[];
}

function actionFromRow(row: StoredMeetingAction): MeetingAction {
  return {
    deadline: row.deadline ?? undefined,
    description: row.description,
    evidence: evidenceFromJson(row.evidenceJson),
    id: row.id,
    meetingId: row.meetingId,
    ownerRef: JSON.parse(row.ownerRefJson) as MeetingAction["ownerRef"],
    status: row.status as MeetingAction["status"]
  };
}

function decisionFromRow(row: StoredMeetingDecision): MeetingDecision {
  return {
    evidence: evidenceFromJson(row.evidenceJson),
    id: row.id,
    meetingId: row.meetingId,
    speakerRef: JSON.parse(row.speakerRefJson) as MeetingDecision["speakerRef"],
    supersedes: row.supersedes ?? undefined,
    text: row.text
  };
}

export function recordMeetingAudio(storage: Storage, meetingId: string, audioPath: string) {
  new MeetingRepository(storage).recordAudioPath(meetingId, audioPath);
}

export function evidenceClipsForMeeting(storage: Storage, meetingId: string): EvidenceClip[] {
  const meeting = new MeetingRepository(storage).findById(meetingId);
  const actionClips = new CanonicalMeetingActionRepository(storage)
    .listForMeeting(meetingId)
    .flatMap((action) => evidenceFromJson(action.evidenceJson));
  const decisionClips = new MeetingDecisionRepository(storage)
    .listForMeeting(meetingId)
    .flatMap((decision) => evidenceFromJson(decision.evidenceJson));
  const questionClips = new MeetingQuestionRepository(storage)
    .listForMeeting(meetingId)
    .flatMap((question) => evidenceFromJson(question.evidenceJson));

  return [...actionClips, ...decisionClips, ...questionClips].map((clip) => ({
    ...clip,
    audioPath: meeting?.audioPath ?? undefined
  }));
}

export function reconcileMeeting(storage: Storage, meetingId: string): ReconciliationReport {
  const actions = new CanonicalMeetingActionRepository(storage).listForMeeting(meetingId).map(actionFromRow);
  const decisions = new MeetingDecisionRepository(storage).listForMeeting(meetingId).map(decisionFromRow);
  const questions = new MeetingQuestionRepository(storage).listForMeeting(meetingId);
  const groupedActions = new Map<string, string[]>();

  for (const action of actions) {
    const key = normalizeText(action.description);
    groupedActions.set(key, [...groupedActions.get(key) ?? [], action.id]);
  }

  return {
    duplicateActionGroups: [...groupedActions.values()].filter((ids) => ids.length > 1),
    evidenceClips: evidenceClipsForMeeting(storage, meetingId),
    openQuestionIds: questions.filter((question) => question.status === "open").map((question) => question.id),
    supersededDecisionIds: decisions.flatMap((decision) => decision.supersedes ? [decision.supersedes] : []),
    unresolvedActionIds: actions
      .filter((action) => action.status === "needs_identity" || !action.ownerRef.participantId)
      .map((action) => action.id)
  };
}

function actionCompleteness(action: MeetingAction) {
  return (action.ownerRef.participantId ? 2 : 0) + (action.deadline ? 1 : 0) + action.evidence.length;
}

export function applyMeetingReconciliation(storage: Storage, meetingId: string): AppliedReconciliation {
  const report = reconcileMeeting(storage, meetingId);
  const actions = new CanonicalMeetingActionRepository(storage);
  const byId = new Map(actions.listForMeeting(meetingId).map((action) => [action.id, actionFromRow(action)]));
  const completedDuplicateActionIds: string[] = [];
  const normalizedUnresolvedActionIds: string[] = [];

  for (const group of report.duplicateActionGroups) {
    const ranked = group
      .map((id) => byId.get(id))
      .filter((action): action is MeetingAction => Boolean(action))
      .sort((first, second) => actionCompleteness(second) - actionCompleteness(first));
    const keep = ranked[0];

    for (const duplicate of ranked.slice(1)) {
      if (duplicate.id !== keep?.id && duplicate.status !== "completed") {
        actions.update(duplicate.id, { status: "completed" });
        completedDuplicateActionIds.push(duplicate.id);
      }
    }
  }

  for (const actionId of report.unresolvedActionIds) {
    const action = byId.get(actionId);

    if (action && action.status !== "needs_identity") {
      actions.update(actionId, { status: "needs_identity" });
      normalizedUnresolvedActionIds.push(actionId);
    }
  }

  return {
    ...reconcileMeeting(storage, meetingId),
    completedDuplicateActionIds,
    normalizedUnresolvedActionIds
  };
}
