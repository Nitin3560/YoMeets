import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedModelProvider } from "@yomeets/model-router";
import { openStorage, runMigrations } from "@yomeets/storage";
import { runMeetingPipeline } from "./executor.js";
import type { Commitment } from "./types.js";

const dir = mkdtempSync(join(tmpdir(), "yomeets-meeting-pipeline-"));
const storage = openStorage(join(dir, "test.sqlite"));
const commitment: Commitment = {
  actionType: "create_issue",
  confidence: 0.95,
  deadline: "2026-09-14",
  description: "Investigate the failed CI job",
  id: "commitment_1",
  owner: "Nitin",
  sourceQuote: "Nitin will investigate the failed CI job by 2026-09-14.",
  timestamp: "sentence 1"
};

runMigrations(storage);

try {
  let createdIssues = 0;
  const result = await runMeetingPipeline(storage, {
    approve: async () => "yes",
    integrations: {
      createDraft: async () => {
        throw new Error("unexpected draft");
      },
      createIssue: async (action) => {
        createdIssues += 1;
        return {
          externalId: "42",
          provider: "github",
          raw: action
        };
      },
      createOrUpdateEvent: async () => {
        throw new Error("unexpected event");
      },
      getDraft: async () => ({}),
      getEvent: async () => ({}),
      getIssue: async () => ({
        title: "the failed CI job"
      })
    },
    provider: new ScriptedModelProvider([JSON.stringify([commitment])]),
    title: "Release prep",
    transcript: "Nitin will investigate the failed CI job by 2026-09-14."
  });

  assert.equal(result.actions[0]?.status, "verified");
  assert.equal(result.actions[0]?.externalId, "42");
  assert.equal(createdIssues, 1);

  const rejected = await runMeetingPipeline(storage, {
    approve: async () => "no",
    integrations: {
      createDraft: async () => {
        throw new Error("unexpected draft");
      },
      createIssue: async () => {
        throw new Error("should not create issue");
      },
      createOrUpdateEvent: async () => {
        throw new Error("unexpected event");
      },
      getDraft: async () => ({}),
      getEvent: async () => ({}),
      getIssue: async () => ({})
    },
    provider: new ScriptedModelProvider([JSON.stringify([commitment])]),
    transcript: "Nitin will investigate the failed CI job by 2026-09-14."
  });

  assert.equal(rejected.actions[0]?.status, "rejected");
} finally {
  storage.sqlite.close();
}
