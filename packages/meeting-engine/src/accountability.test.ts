import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MeetingCommitmentRepository,
  MeetingRepository,
  PlannedMeetingActionRepository,
  openStorage,
  runMigrations
} from "@yomeets/storage";
import {
  formatMeetingOutstandingCommitments,
  loadMeetingOutstandingCommitments,
  loadStoredMeetingCommitments
} from "./accountability.js";
import type { Commitment } from "./types.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-meeting-accountability-")), "test.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "First meeting",
    transcript: "Nitin will investigate the API timeout by 2026-09-09."
  });
  const commitment: Commitment = {
    actionType: "create_issue",
    confidence: 0.95,
    deadline: "2026-09-09",
    description: "Investigate the API timeout",
    id: "commitment_1",
    owner: "Nitin",
    sourceQuote: "Nitin will investigate the API timeout by 2026-09-09.",
    timestamp: "sentence 1"
  };
  const commitmentRow = new MeetingCommitmentRepository(storage).create({
    commitment,
    meetingId: meeting.id
  });

  const plannedActions = new PlannedMeetingActionRepository(storage);
  const planned = plannedActions.create({
    action: {
      id: "commitment_1_github_issue",
      type: "github_issue"
    },
    approvalStatus: "approved",
    commitmentId: commitmentRow.id,
    executionStatus: "verified",
    meetingId: meeting.id
  });
  plannedActions.recordExecution(planned.id, {
    externalId: "42",
    status: "verified"
  });

  const stored = loadStoredMeetingCommitments(storage);

  assert.equal(stored.length, 1);
  assert.equal(formatMeetingOutstandingCommitments(stored)[0]?.includes("Investigate the API timeout"), true);

  const checked = await loadMeetingOutstandingCommitments(storage, {
    getDraft: async () => ({}),
    getEvent: async () => ({}),
    getIssue: async () => ({ state: "closed" })
  });

  assert.equal(checked[0]?.status, "completed");
  assert.equal(checked[0]?.externalStatus, "closed");
} finally {
  storage.sqlite.close();
}
