import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PostgresPgvectorMemoryIndex,
  loadMeetingMemory
} from "../packages/meeting-engine/dist/index.js";
import {
  MeetingDecisionRepository,
  MeetingRepository,
  SpeakerClusterRepository,
  TranscriptSegmentRepository,
  openStorage,
  runMigrations
} from "../packages/storage/dist/index.js";

const connectionString = process.env.YOMEETS_POSTGRES_URL;

if (!connectionString) {
  throw new Error("YOMEETS_POSTGRES_URL is required");
}

const sqlite = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-postgres-memory-")), "test.sqlite"));
const index = new PostgresPgvectorMemoryIndex(connectionString);

runMigrations(sqlite);

try {
  const meeting = new MeetingRepository(sqlite).create({
    title: "Postgres memory smoke",
    transcript: ""
  });

  new SpeakerClusterRepository(sqlite).create({
    id: `${meeting.id}_S1`,
    label: "S1",
    meetingId: meeting.id
  });
  new TranscriptSegmentRepository(sqlite).create({
    endMs: 2200,
    final: true,
    id: `${meeting.id}_seg_1`,
    meetingId: meeting.id,
    sequence: 1,
    source: "fixture",
    speakerClusterId: `${meeting.id}_S1`,
    startMs: 0,
    text: "Actually, let's switch to Postgres because Redis is not working out."
  });
  new MeetingDecisionRepository(sqlite).create({
    evidence: [{ clipEndMs: 2200, clipStartMs: 0, segmentId: `${meeting.id}_seg_1` }],
    meetingId: meeting.id,
    speakerRef: { speakerClusterId: `${meeting.id}_S1` },
    text: "Switch session storage to Postgres"
  });

  await index.migrate();
  await index.upsert(loadMeetingMemory(sqlite));

  const results = await index.search("Why did we move away from Redis?", 3);

  console.log(`Postgres memory records: ${results.length}`);

  for (const result of results) {
    console.log(`${result.kind}: ${result.text}`);
  }

  if (!results.some((result) => result.text.toLowerCase().includes("postgres"))) {
    process.exitCode = 1;
  }
} finally {
  await index.close();
  sqlite.sqlite.close();
}
