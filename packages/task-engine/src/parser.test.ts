import assert from "node:assert/strict";
import { ScriptedModelProvider } from "@yomeets/model-router";
import { parseTaskIntentWithModel } from "./parser.js";

const parsed = await parseTaskIntentWithModel(
  new ScriptedModelProvider([
    JSON.stringify({
      action: {
        type: "open_profile"
      },
      intent: "search_profile",
      targets: [{ name: "John Smith" }]
    })
  ]),
  "Search for John Smith"
);

assert.equal(parsed.status, "parsed");

const retried = await parseTaskIntentWithModel(
  new ScriptedModelProvider([
    "not json",
    JSON.stringify({
      action: {
        message: "Hello John.",
        type: "connect"
      },
      intent: "send_connection_request",
      targets: [{ name: "John Smith", company: "Google" }]
    })
  ]),
  "Send John a connection request"
);

assert.equal(retried.status, "parsed");

const failed = await parseTaskIntentWithModel(
  new ScriptedModelProvider(["not json", "{\"targets\":[]}"]),
  "Broken output"
);

assert.equal(failed.status, "failed");
