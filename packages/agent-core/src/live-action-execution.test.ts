import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CanonicalMeetingActionRepository,
  MeetingRepository,
  openStorage,
  runMigrations
} from "@yomeets/storage";
import type { PlannedMeetingAction } from "@yomeets/task-engine";
import { executeLiveMeetingActions } from "./live-action-execution.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-live-actions-")), "test.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "Live actions",
    transcript: ""
  });
  const actions = new CanonicalMeetingActionRepository(storage);
  const blocked = actions.create({
    description: "Fix auth timeout",
    evidence: [],
    meetingId: meeting.id,
    ownerRef: {
      speakerClusterId: "S2"
    },
    status: "needs_identity"
  });
  const ready = actions.create({
    deadline: "Friday",
    description: "Create migration issue",
    evidence: [],
    meetingId: meeting.id,
    ownerRef: {
      participantId: "participant_nitin",
      speakerClusterId: "S1"
    },
    status: "open"
  });
  const plannedActionId = `${ready.id}_github_issue`;
  const result = await executeLiveMeetingActions(storage, {
    approvals: {
      [plannedActionId]: "yes"
    },
    execute: async (action: PlannedMeetingAction) => ({
      externalId: "issue_77",
      provider: "github",
      raw: action.input
    }),
    meetingId: meeting.id,
    verify: async () => ({
      observed: {
        title: "Create migration issue"
      },
      passed: true
    })
  });
  const savedActions = actions.listForMeeting(meeting.id);

  assert.deepEqual(result.blockedActionIds, [blocked.id]);
  assert.equal(result.executions.length, 1);
  assert.equal(result.executions[0]?.status, "verified");
  assert.equal(savedActions.find((action) => action.id === ready.id)?.status, "completed");
  assert.equal(savedActions.find((action) => action.id === blocked.id)?.status, "needs_identity");
} finally {
  storage.sqlite.close();
}
