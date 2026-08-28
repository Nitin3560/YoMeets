import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedModelProvider } from "@yomeets/model-router";
import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingRepository,
  SpeakerClusterRepository,
  TranscriptSegmentRepository,
  openStorage,
  runMigrations
} from "@yomeets/storage";
import {
  LocalMeetingMemoryIndex,
  PostgresMemoryNotConfiguredError,
  PostgresPgvectorMemoryIndex,
  askYoMeets,
  loadMeetingMemory,
  searchMeetingMemory
} from "./memory.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-memory-")), "test.sqlite"));

runMigrations(storage);

try {
  const meetings = new MeetingRepository(storage);
  const first = meetings.create({
    title: "Week one",
    transcript: ""
  });
  const second = meetings.create({
    title: "Week two",
    transcript: ""
  });

  new SpeakerClusterRepository(storage).create({
    id: "S1",
    label: "S1",
    meetingId: second.id
  });
  new TranscriptSegmentRepository(storage).create({
    endMs: 2200,
    final: true,
    id: "seg_postgres",
    meetingId: second.id,
    sequence: 1,
    source: "fixture",
    speakerClusterId: "S1",
    startMs: 0,
    text: "Actually, let's switch to Postgres because Redis is not working out."
  });
  new MeetingDecisionRepository(storage).create({
    evidence: [{ clipEndMs: 2200, clipStartMs: 0, segmentId: "seg_postgres" }],
    meetingId: second.id,
    speakerRef: { speakerClusterId: "S1" },
    text: "Switch session storage to Postgres"
  });
  new CanonicalMeetingActionRepository(storage).create({
    deadline: "Friday",
    description: "Create migration issue",
    evidence: [{ clipEndMs: 3000, clipStartMs: 2300, segmentId: "seg_issue" }],
    meetingId: first.id,
    ownerRef: { participantId: "participant_nitin", speakerClusterId: "S2" },
    status: "open"
  });

  const records = loadMeetingMemory(storage);
  const postgres = searchMeetingMemory("Why did we switch to Postgres?", records);
  const mine = searchMeetingMemory("What is due Friday?", records);
  const answer = await askYoMeets(storage, {
    provider: new ScriptedModelProvider(["We switched to Postgres because Redis was not working out. Citation: seg_postgres."]),
    query: "Why did we switch to Postgres?"
  });

  assert.equal(records.some((record) => record.id === "seg_postgres"), true);
  assert.equal(postgres[0]?.meetingId, second.id);
  assert.equal(mine[0]?.kind, "action");
  assert.equal(answer.citations.some((record) => record.id === "seg_postgres"), true);
  assert.match(answer.answer, /Postgres/);

  const index = new LocalMeetingMemoryIndex(records);
  const indexed = await index.search("migration Friday");

  assert.equal(indexed[0]?.kind, "action");
  await assert.rejects(
    () => new PostgresPgvectorMemoryIndex("").search("anything"),
    PostgresMemoryNotConfiguredError
  );
} finally {
  storage.sqlite.close();
}
