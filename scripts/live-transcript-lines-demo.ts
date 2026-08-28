import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LiveTranscriptLinePipeline } from "../packages/audio-core/dist/index.js";
import { loadMeetingMemory, runLiveMeeting } from "../packages/meeting-engine/dist/index.js";
import { ScriptedModelProvider } from "../packages/model-router/dist/index.js";
import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingParticipantRepository,
  MeetingRepository,
  openStorage,
  runMigrations
} from "../packages/storage/dist/index.js";

const filePath = process.argv[2];
const defaultLines = [
  "00:01 S1: Sarah, can you check the auth timeout?",
  "00:04 S2: Yeah, I'll fix it tomorrow.",
  "00:08 S3: Let's keep Redis for now."
];
const lines = filePath ? readFileSync(filePath, "utf8").split(/\r?\n/) : defaultLines;
const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-lines-demo-")), "demo.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: filePath ?? "Live transcript lines",
    transcript: lines.join("\n")
  });

  for (const name of ["Nitin", "Sarah", "John"]) {
    new MeetingParticipantRepository(storage).create({
      meetingId: meeting.id,
      name
    });
  }

  const events = await runLiveMeeting({
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
          evidenceEndMs: 9085,
          evidenceStartMs: 8000,
          speakerId: `${meeting.id}_S3`,
          text: "Keep Redis for now",
          type: "CREATE_DECISION"
        }
      ])
    ]),
    segments: new LiveTranscriptLinePipeline(lines).stream(meeting.id),
    storage
  });

  console.log(`Meeting: ${meeting.id}`);
  console.log(`Events: ${events.length}`);
  console.log(`Actions: ${new CanonicalMeetingActionRepository(storage).listForMeeting(meeting.id).length}`);
  console.log(`Decisions: ${new MeetingDecisionRepository(storage).listForMeeting(meeting.id).length}`);
  console.log(`Memory records: ${loadMeetingMemory(storage).length}`);
} finally {
  storage.sqlite.close();
}
