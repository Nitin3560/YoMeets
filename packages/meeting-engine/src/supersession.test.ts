import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedModelProvider } from "@yomeets/model-router";
import { MeetingDecisionRepository, MeetingRepository, openStorage, runMigrations } from "@yomeets/storage";
import { ingestTranscriptSegment, maybeProcessMeetingWindow } from "./ingest.js";
import type { SpeakerRef } from "./types.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-supersession-")), "test.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "Decision change",
    transcript: ""
  });
  const state = {
    lastProcessedAtMs: 0,
    lastProcessedSequence: 0
  };

  ingestTranscriptSegment(storage, {
    endMs: 1500,
    id: "seg_1",
    meetingId: meeting.id,
    sequence: 1,
    speakerLabel: "S3",
    startMs: 0,
    text: "Let's keep Redis for now."
  });
  const first = await maybeProcessMeetingWindow(storage, {
    config: {
      maxUnprocessedSegments: 1
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
          evidenceEndMs: 1500,
          evidenceStartMs: 0,
          speakerId: `${meeting.id}_S3`,
          text: "Keep Redis for now",
          type: "CREATE_DECISION"
        }
      ])
    ]),
    state
  });
  const firstDecision = first?.decisions[0];

  assert.ok(firstDecision);

  ingestTranscriptSegment(storage, {
    endMs: 3600,
    id: "seg_2",
    meetingId: meeting.id,
    sequence: 2,
    speakerLabel: "S1",
    startMs: 2100,
    text: "Actually, let's switch to Postgres, Redis isn't working out."
  });
  const second = await maybeProcessMeetingWindow(storage, {
    config: {
      maxUnprocessedSegments: 1
    },
    currentState: {
      decisions: [{ id: firstDecision.id, text: firstDecision.text }],
      openActions: [],
      openQuestions: []
    },
    meetingId: meeting.id,
    provider: new ScriptedModelProvider([
      JSON.stringify([
        {
          evidenceEndMs: 3600,
          evidenceStartMs: 2100,
          speakerId: `${meeting.id}_S1`,
          supersedes: firstDecision.id,
          text: "Switch to Postgres because Redis is not working out",
          type: "CREATE_DECISION"
        }
      ])
    ]),
    state
  });
  const decisions = new MeetingDecisionRepository(storage).listForMeeting(meeting.id);
  const changed = second?.decisions[0];

  assert.equal(decisions.length, 2);
  assert.equal(changed?.supersedes, firstDecision.id);
  assert.equal((JSON.parse(decisions[1]?.speakerRefJson ?? "{}") as SpeakerRef).speakerClusterId, `${meeting.id}_S1`);
} finally {
  storage.sqlite.close();
}
