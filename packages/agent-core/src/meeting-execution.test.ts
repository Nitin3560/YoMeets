import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStorage, PlannedMeetingActionRepository, runMigrations } from "@yomeets/storage";
import type { IntegrationResult, MeetingActionVerification } from "@yomeets/integrations";
import type { PlannedMeetingAction } from "@yomeets/task-engine";
import { runMeetingExecution } from "./meeting-execution.js";

const dir = mkdtempSync(join(tmpdir(), "yomeets-meeting-execution-"));
const storage = openStorage(join(dir, "test.sqlite"));

runMigrations(storage);

try {
  let executeCalls = 0;
  const commitment = {
    id: "commitment_1",
    owner: "nitin",
    summary: "Investigate failed jobs",
    type: "investigation" as const
  };

  const waiting = await runMeetingExecution(storage, {
    commitments: [commitment],
    execute: async () => {
      executeCalls += 1;
      return {
        externalId: "7",
        provider: "github",
        raw: {}
      };
    },
    title: "Ops review",
    transcript: "Nitin will investigate failed jobs."
  });

  assert.equal(waiting.executions[0]?.status, "waiting_for_approval");
  assert.equal(executeCalls, 0);

  const approvedCommitment = {
    ...commitment,
    id: "commitment_2"
  };
  const approved = await runMeetingExecution(storage, {
    approvals: {
      commitment_2_github_issue: "yes"
    },
    commitments: [approvedCommitment],
    execute: async (action) => {
      executeCalls += 1;
      return {
        externalId: "8",
        provider: "github",
        raw: {
          title: action.input.title
        }
      };
    },
    title: "Ops review",
    transcript: "Nitin will investigate failed jobs.",
    verify: async (
      action: PlannedMeetingAction,
      result: IntegrationResult
    ): Promise<MeetingActionVerification> => ({
      observed: {
        externalId: result.externalId,
        title: action.input.title
      },
      passed: true
    })
  });

  const actionRow = new PlannedMeetingActionRepository(storage).findByPlannedActionId(
    approved.meetingId,
    "commitment_2_github_issue"
  );

  assert.equal(approved.executions[0]?.status, "verified");
  assert.equal(approved.executions[0]?.externalId, "8");
  assert.equal(actionRow?.approvalStatus, "approved");
  assert.equal(actionRow?.executionStatus, "verified");
  assert.equal(JSON.parse(actionRow?.verificationJson ?? "{}").passed, true);
  assert.equal(executeCalls, 1);
} finally {
  storage.sqlite.close();
}
