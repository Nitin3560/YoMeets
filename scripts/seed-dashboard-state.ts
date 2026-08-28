import { LiveTranscriptLinePipeline } from "../packages/audio-core/dist/index.js";
import {
  confirmSpeakerIdentity,
  recordMeetingAudio,
  runLiveMeeting
} from "../packages/meeting-engine/dist/index.js";
import { ScriptedModelProvider } from "../packages/model-router/dist/index.js";
import {
  MeetingDecisionRepository,
  MeetingParticipantRepository,
  MeetingRepository,
  openStorage,
  runMigrations
} from "../packages/storage/dist/index.js";

const storage = openStorage();

runMigrations(storage);

try {
  const meetings = new MeetingRepository(storage);
  const meeting = meetings.create({
    title: "Engineering Sync Demo",
    transcript: [
      "00:01 S1: Sarah, can you check the auth timeout?",
      "00:04 S2: Yeah, I'll fix it tomorrow.",
      "00:08 S3: Let's keep Redis for now.",
      "00:12 S1: Actually, let's switch to Postgres, Redis isn't working out."
    ].join("\n")
  });
  const participants = new MeetingParticipantRepository(storage);
  const sarah = participants.create({
    id: `${meeting.id}_participant_sarah`,
    meetingId: meeting.id,
    name: "Sarah"
  });

  participants.create({
    id: `${meeting.id}_participant_nitin`,
    meetingId: meeting.id,
    name: "Nitin"
  });
  recordMeetingAudio(storage, meeting.id, "/tmp/yomeets/engineering-sync-demo.wav");

  async function* secondWindow() {
    yield {
      confidence: 1,
      endMs: 13_925,
      final: true,
      id: "line_seg_4",
      meetingId: meeting.id,
      source: "live_transcript" as const,
      speakerLabel: "S1",
      startMs: 12_000,
      text: "Actually, let's switch to Postgres, Redis isn't working out."
    };
  }

  await runLiveMeeting({
    config: {
      maxUnprocessedSegments: 3
    },
    meetingId: meeting.id,
    provider: new ScriptedModelProvider([
      JSON.stringify([
        {
          deadline: "tomorrow",
          description: "Fix auth timeout",
          evidenceEndMs: 4000,
          evidenceStartMs: 1000,
          ownerSpeakerId: `${meeting.id}_S2`,
          type: "CREATE_ACTION"
        },
        {
          evidenceEndMs: 12_000,
          evidenceStartMs: 8000,
          speakerId: `${meeting.id}_S3`,
          text: "Keep Redis for now",
          type: "CREATE_DECISION"
        }
      ])
    ]),
    segments: new LiveTranscriptLinePipeline([
      "00:01 S1: Sarah, can you check the auth timeout?",
      "00:04 S2: Yeah, I'll fix it tomorrow.",
      "00:08 S3: Let's keep Redis for now."
    ], meeting.id).stream(meeting.id),
    storage
  });

  const firstDecision = new MeetingDecisionRepository(storage).listForMeeting(meeting.id)[0];

  await runLiveMeeting({
    config: {
      maxUnprocessedSegments: 1
    },
    meetingId: meeting.id,
    provider: new ScriptedModelProvider([
      JSON.stringify([
        {
          evidenceEndMs: 13_925,
          evidenceStartMs: 12_000,
          speakerId: `${meeting.id}_S1`,
          supersedes: firstDecision?.id,
          text: "Switch to Postgres because Redis is not working out",
          type: "CREATE_DECISION"
        }
      ])
    ]),
    segments: secondWindow(),
    state: {
      lastProcessedAtMs: 12_000,
      lastProcessedSequence: 3
    },
    storage
  });

  confirmSpeakerIdentity(storage, {
    meetingId: meeting.id,
    participantId: sarah.id,
    speakerClusterId: `${meeting.id}_S2`
  });

  console.log(`Seeded meeting ${meeting.id}`);
  console.log("Run: pnpm --filter @yomeets/cli dev");
  console.log("Open: apps/desktop/index.html");
} finally {
  storage.sqlite.close();
}
