import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FixtureAudioPipeline } from "@yomeets/audio-core";
import { ScriptedModelProvider } from "@yomeets/model-router";
import {
  CanonicalMeetingActionRepository,
  MeetingParticipantRepository,
  MeetingRepository,
  SpeakerClusterRepository,
  TranscriptSegmentRepository,
  openStorage,
  runMigrations
} from "@yomeets/storage";
import { runLiveMeeting } from "./live-meeting.js";
import type { OwnerRef } from "./types.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-live-meeting-")), "test.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "Live meeting",
    transcript: ""
  });
  new MeetingParticipantRepository(storage).create({
    id: "participant_sarah",
    meetingId: meeting.id,
    name: "Sarah"
  });

  const audio = new FixtureAudioPipeline([
    {
      speakerLabel: "S1",
      text: "Sarah, can you check the auth timeout?"
    },
    {
      speakerLabel: "S2",
      text: "Yeah, I'll fix it tomorrow."
    }
  ]);
  const events = await runLiveMeeting({
    config: {
      maxUnprocessedSegments: 2
    },
    meetingId: meeting.id,
    provider: new ScriptedModelProvider([
      JSON.stringify([
        {
          deadline: "tomorrow",
          description: "Fix auth timeout",
          evidenceEndMs: 2755,
          evidenceStartMs: 1505,
          ownerSpeakerId: `${meeting.id}_S2`,
          type: "CREATE_ACTION"
        }
      ])
    ]),
    segments: audio.stream(meeting.id),
    storage
  });

  const actions = new CanonicalMeetingActionRepository(storage).listForMeeting(meeting.id);
  const clusters = new SpeakerClusterRepository(storage).listForMeeting(meeting.id);
  const segments = new TranscriptSegmentRepository(storage).listForMeeting(meeting.id);
  const ownerRef = JSON.parse(actions[0]?.ownerRefJson ?? "{}") as OwnerRef;

  assert.equal(events.filter((event) => event.type === "segment_ingested").length, 2);
  assert.equal(events.some((event) => event.type === "window_processed"), true);
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.status, "needs_identity");
  assert.equal(ownerRef.speakerClusterId, `${meeting.id}_S2`);
  assert.equal(clusters.find((cluster) => cluster.id === `${meeting.id}_S2`)?.resolutionStatus, "likely");
  assert.equal(segments.length, 2);
} finally {
  storage.sqlite.close();
}
