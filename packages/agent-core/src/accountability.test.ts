import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MeetingCommitmentRepository, MeetingRepository, openStorage, runMigrations } from "@yomeets/storage";
import { formatOutstandingCommitments, loadOutstandingCommitments } from "./accountability.js";

const dir = mkdtempSync(join(tmpdir(), "yomeets-accountability-"));
const storage = openStorage(join(dir, "test.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "Last sync",
    transcript: "Nitin will investigate failed jobs by Friday."
  });
  const commitments = new MeetingCommitmentRepository(storage);
  const row = commitments.create({
    commitment: {
      due: "Friday",
      id: "commitment_1",
      owner: "Nitin",
      subject: "failed jobs",
      summary: "Nitin will investigate failed jobs",
      type: "investigation"
    },
    meetingId: meeting.id
  });

  const open = await loadOutstandingCommitments(storage);

  assert.equal(open.length, 1);
  assert.equal(formatOutstandingCommitments(open)[0], "Nitin: Nitin will investigate failed jobs due Friday");

  const checked = await loadOutstandingCommitments(storage, async () => "closed");
  const saved = commitments.listOpen();

  assert.equal(checked[0]?.commitmentId, row.id);
  assert.equal(checked[0]?.externalStatus, "closed");
  assert.equal(saved.length, 0);
} finally {
  storage.sqlite.close();
}
