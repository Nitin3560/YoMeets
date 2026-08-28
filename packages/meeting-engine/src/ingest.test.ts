import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingParticipantRepository,
  MeetingRepository,
  SpeakerClusterRepository,
  openStorage,
  runMigrations
} from "@yomeets/storage";
import { ScriptedModelProvider } from "@yomeets/model-router";
import { applyOperations, ingestTranscriptSegment, maybeProcessMeetingWindow } from "./ingest.js";
import type { Evidence, OwnerRef, SpeakerRef } from "./types.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-canonical-meeting-")), "test.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "Auth sync",
    transcript: ""
  });
  const participants = new MeetingParticipantRepository(storage);

  for (const name of ["Nitin", "Sarah", "John"]) {
    participants.create({
      meetingId: meeting.id,
      name,
      resolutionStatus: "confirmed"
    });
  }

  ingestTranscriptSegment(storage, {
    endMs: 1800,
    id: "seg_1",
    meetingId: meeting.id,
    sequence: 1,
    speakerLabel: "S1",
    startMs: 0,
    text: "Sarah, can you check the auth timeout?"
  });
  ingestTranscriptSegment(storage, {
    endMs: 3600,
    id: "seg_2",
    meetingId: meeting.id,
    sequence: 2,
    speakerLabel: "S2",
    startMs: 1900,
    text: "Yeah, I'll fix it tomorrow."
  });
  ingestTranscriptSegment(storage, {
    endMs: 5200,
    id: "seg_3",
    meetingId: meeting.id,
    sequence: 3,
    speakerLabel: "S3",
    startMs: 3700,
    text: "Let's keep Redis for now."
  });
  const applied = await maybeProcessMeetingWindow(storage, {
    config: {
      maxUnprocessedSegments: 3
    },
    currentState: {
      decisions: [],
      openActions: [],
      openQuestions: []
    },
    meetingId: meeting.id,
    provider: new ScriptedModelProvider([
      JSON.stringify([
        {
          deadline: "tomorrow",
          description: "Fix auth timeout",
          evidenceEndMs: 3600,
          evidenceStartMs: 1900,
          ownerSpeakerId: `${meeting.id}_S2`,
          type: "CREATE_ACTION"
        },
        {
          evidenceEndMs: 5200,
          evidenceStartMs: 3700,
          speakerId: `${meeting.id}_S3`,
          text: "Keep Redis for now",
          type: "CREATE_DECISION"
        }
      ])
    ]),
    state: {
      lastProcessedAtMs: 0,
      lastProcessedSequence: 0
    }
  });

  const clusters = new SpeakerClusterRepository(storage).listForMeeting(meeting.id);
  const actions = new CanonicalMeetingActionRepository(storage).listForMeeting(meeting.id);
  const decisions = new MeetingDecisionRepository(storage).listForMeeting(meeting.id);

  assert.deepEqual(clusters.map((cluster) => cluster.label).sort(), ["S1", "S2", "S3"]);
  assert.deepEqual(clusters.map((cluster) => cluster.resolutionStatus), ["unknown", "unknown", "unknown"]);

  assert.equal(applied?.actions.length, 1);
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.description, "Fix auth timeout");
  assert.equal(actions[0]?.deadline, "tomorrow");
  assert.equal((JSON.parse(actions[0]?.ownerRefJson ?? "{}") as OwnerRef).speakerClusterId, `${meeting.id}_S2`);
  assert.equal((JSON.parse(actions[0]?.evidenceJson ?? "[]") as Evidence[])[0]?.segmentId, "seg_2");

  assert.equal(applied?.decisions.length, 1);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0]?.text, "Keep Redis for now");
  assert.equal((JSON.parse(decisions[0]?.speakerRefJson ?? "{}") as SpeakerRef).speakerClusterId, `${meeting.id}_S3`);
  assert.equal((JSON.parse(decisions[0]?.evidenceJson ?? "[]") as Evidence[])[0]?.segmentId, "seg_3");

  const duplicate = applyOperations(storage, meeting.id, [
    {
      deadline: "tomorrow",
      description: "Fix auth timeout.",
      evidenceEndMs: 3600,
      evidenceStartMs: 1900,
      ownerSpeakerId: `${meeting.id}_S2`,
      type: "CREATE_ACTION"
    }
  ], []);

  assert.equal(duplicate.actions.length, 0);
  assert.equal(new CanonicalMeetingActionRepository(storage).listForMeeting(meeting.id).length, 1);
} finally {
  storage.sqlite.close();
}
