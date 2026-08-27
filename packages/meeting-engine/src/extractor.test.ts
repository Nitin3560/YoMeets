import assert from "node:assert/strict";
import { ScriptedModelProvider } from "@yomeets/model-router";
import { extractCommitments } from "./extractor.js";

const transcript = "Nitin, can you check the auth timeout by 2026-08-30?";
const provider = new ScriptedModelProvider([
  "{ broken json",
  JSON.stringify([
    {
      actionType: "create_issue",
      confidence: 0.91,
      deadline: "2026-08-30",
      description: "Check the auth timeout",
      id: "commitment_1",
      owner: "Nitin",
      sourceQuote: "Nitin, can you check the auth timeout by 2026-08-30?",
      timestamp: "line 1"
    }
  ])
]);

const result = await extractCommitments(transcript, provider);

assert.equal(result.status, "extracted");

if (result.status === "extracted") {
  assert.equal(result.commitments.length, 1);
  assert.equal(result.commitments[0]?.owner, "Nitin");
  assert.equal(result.commitments[0]?.actionType, "create_issue");
}

const failed = await extractCommitments("Nope", new ScriptedModelProvider(["{}", "{}"]));

assert.equal(failed.status, "failed");
