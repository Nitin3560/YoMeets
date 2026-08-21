import assert from "node:assert/strict";
import { ScriptedModelProvider } from "@yomeets/model-router";
import { previewScenario } from "./scenario.js";

const preview = await previewScenario(
  "Find John Smith and send a connection request with 'Hello John.'",
  new ScriptedModelProvider([
    JSON.stringify({
      action: {
        message: "Hello John.",
        type: "connect"
      },
      intent: "send_connection_request",
      targets: [{ company: "Google", name: "John Smith", school: "UTA" }]
    })
  ])
);

assert.equal(preview.status, "completed");

if (preview.status === "completed") {
  assert.equal(preview.intent.targets[0]?.name, "John Smith");
  assert.equal(preview.plan.steps.length, 8);
  assert.deepEqual(preview.trace, [
    "TASK_RECEIVED",
    "PARSED",
    "PLAN_CREATED",
    "NAVIGATE",
    "SEARCH",
    "PROFILE_OPENED",
    "TARGET_VERIFIED",
    "CONNECT_CLICKED",
    "NOTE_DIALOG_OPENED",
    "MESSAGE_TYPED",
    "SEND_CLICKED",
    "PENDING_DETECTED",
    "COMPLETED"
  ]);
}

const failed = await previewScenario("Broken task", new ScriptedModelProvider(["not json", "{\"targets\":[]}"]));

assert.equal(failed.status, "failed");
