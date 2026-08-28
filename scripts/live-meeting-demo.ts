import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FixtureAudioPipeline } from "../packages/audio-core/dist/index.js";
import {
  askYoMeets,
  loadMeetingMemory,
  reconcileMeeting,
  recordMeetingAudio,
  runLiveMeeting
} from "../packages/meeting-engine/dist/index.js";
import { ScriptedModelProvider } from "../packages/model-router/dist/index.js";
import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingParticipantRepository,
  MeetingRepository,
  openStorage,
  runMigrations
} from "../packages/storage/dist/index.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-live-demo-")), "demo.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "Engineering Sync",
    transcript: ""
  });

  new MeetingParticipantRepository(storage).create({
    id: "participant_nitin",
    meetingId: meeting.id,
    name: "Nitin"
  });
  new MeetingParticipantRepository(storage).create({
    id: "participant_sarah",
    meetingId: meeting.id,
    name: "Sarah"
  });

  recordMeetingAudio(storage, meeting.id, "/tmp/yomeets/engineering-sync.wav");

  const state = {
    lastProcessedAtMs: 0,
    lastProcessedSequence: 0
  };
  const firstAudio = new FixtureAudioPipeline([
    {
      speakerLabel: "S1",
      text: "Sarah, can you check the auth timeout?"
    },
    {
      speakerLabel: "S2",
      text: "Yeah, I'll fix it tomorrow."
    },
    {
      speakerLabel: "S3",
      text: "Let's keep Redis for now."
    }
  ]);

  const firstEvents = await runLiveMeeting({
    config: {
      maxUnprocessedSegments: 3
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
        },
        {
          evidenceEndMs: 5010,
          evidenceStartMs: 3260,
          speakerId: `${meeting.id}_S3`,
          text: "Keep Redis for now",
          type: "CREATE_DECISION"
        }
      ])
    ]),
    segments: firstAudio.stream(meeting.id),
    state,
    storage
  });
  const redisDecision = new MeetingDecisionRepository(storage).listForMeeting(meeting.id)[0];

  if (!redisDecision) {
    throw new Error("Redis decision was not created");
  }

  async function* secondWindow() {
    yield {
      confidence: 1,
      endMs: 2525,
      final: true,
      id: "sim_seg_4",
      meetingId: meeting.id,
      source: "fixture" as const,
      speakerLabel: "S1",
      startMs: 0,
      text: "Actually, let's switch to Postgres, Redis isn't working out."
    };
  }
  const secondEvents = await runLiveMeeting({
    config: {
      maxUnprocessedSegments: 1
    },
    meetingId: meeting.id,
    provider: new ScriptedModelProvider([
      JSON.stringify([
        {
          evidenceEndMs: 2525,
          evidenceStartMs: 0,
          speakerId: `${meeting.id}_S1`,
          supersedes: redisDecision.id,
          text: "Switch to Postgres because Redis is not working out",
          type: "CREATE_DECISION"
        }
      ])
    ]),
    segments: secondWindow(),
    state,
    storage
  });
  const events = [...firstEvents, ...secondEvents];

  const actions = new CanonicalMeetingActionRepository(storage).listForMeeting(meeting.id);
  const decisions = new MeetingDecisionRepository(storage).listForMeeting(meeting.id);
  const report = reconcileMeeting(storage, meeting.id);
  const answer = await askYoMeets(storage, {
    provider: new ScriptedModelProvider(["We switched to Postgres because Redis was not working out. Citation: sim_seg_4."]),
    query: "Why did we switch to Postgres?"
  });

  console.log("YoMeets live demo");
  console.log("=================");
  console.log(`Meeting: ${meeting.title}`);
  console.log(`Events: ${events.length}`);
  console.log("");
  console.log("Actions");
  for (const action of actions) {
    console.log(`- ${action.description} [${action.status}]`);
  }
  console.log("");
  console.log("Decisions");
  for (const decision of decisions) {
    console.log(`- ${decision.text}${decision.supersedes ? ` (supersedes ${decision.supersedes})` : ""}`);
  }
  console.log("");
  console.log("Reconciliation");
  console.log(`- unresolved actions: ${report.unresolvedActionIds.length}`);
  console.log(`- evidence clips: ${report.evidenceClips.length}`);
  console.log("");
  console.log("Ask YoMeets");
  console.log(answer.answer);
  console.log(`Citations: ${answer.citations.map((citation) => citation.id).join(", ")}`);
  console.log("");
  console.log(`Memory records: ${loadMeetingMemory(storage).length}`);
} finally {
  storage.sqlite.close();
}
