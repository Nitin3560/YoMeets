import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingQuestionRepository,
  MeetingRepository,
  openStorage,
  runMigrations
} from "@yomeets/storage";
import { applyMeetingReconciliation, evidenceClipsForMeeting, reconcileMeeting, recordMeetingAudio } from "./reconciliation.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-reconciliation-")), "test.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "Reconcile",
    transcript: ""
  });
  const actions = new CanonicalMeetingActionRepository(storage);
  const decisions = new MeetingDecisionRepository(storage);
  const questions = new MeetingQuestionRepository(storage);

  recordMeetingAudio(storage, meeting.id, "/tmp/yomeets/reconcile.wav");
  const unresolved = actions.create({
    description: "Fix auth timeout",
    evidence: [{ clipEndMs: 2000, clipStartMs: 1000, segmentId: "seg_1" }],
    meetingId: meeting.id,
    ownerRef: { speakerClusterId: "S2" },
    status: "needs_identity"
  });
  const richer = actions.create({
    description: "Fix auth timeout.",
    evidence: [{ clipEndMs: 2500, clipStartMs: 2100, segmentId: "seg_2" }],
    meetingId: meeting.id,
    ownerRef: { participantId: "participant_sarah", speakerClusterId: "S2" },
    status: "open"
  });
  const firstDecision = decisions.create({
    evidence: [{ clipEndMs: 3300, clipStartMs: 3000, segmentId: "seg_3" }],
    meetingId: meeting.id,
    speakerRef: { speakerClusterId: "S3" },
    text: "Keep Redis"
  });
  decisions.create({
    evidence: [{ clipEndMs: 4400, clipStartMs: 4000, segmentId: "seg_4" }],
    meetingId: meeting.id,
    speakerRef: { speakerClusterId: "S1" },
    supersedes: firstDecision.id,
    text: "Switch to Postgres"
  });
  questions.create({
    evidence: [{ clipEndMs: 5200, clipStartMs: 5000, segmentId: "seg_5" }],
    meetingId: meeting.id,
    text: "What is the rollout plan?"
  });

  const clips = evidenceClipsForMeeting(storage, meeting.id);
  const report = reconcileMeeting(storage, meeting.id);

  assert.equal(clips[0]?.audioPath, "/tmp/yomeets/reconcile.wav");
  assert.equal(report.duplicateActionGroups.length, 1);
  assert.equal(report.duplicateActionGroups[0]?.length, 2);
  assert.equal(report.unresolvedActionIds.length, 1);
  assert.deepEqual(report.supersededDecisionIds, [firstDecision.id]);
  assert.equal(report.openQuestionIds.length, 1);

  const applied = applyMeetingReconciliation(storage, meeting.id);
  const rows = actions.listForMeeting(meeting.id);

  assert.equal(applied.completedDuplicateActionIds.includes(unresolved.id), true);
  assert.equal(rows.find((action) => action.id === unresolved.id)?.status, "completed");
  assert.equal(rows.find((action) => action.id === richer.id)?.status, "open");
} finally {
  storage.sqlite.close();
}
