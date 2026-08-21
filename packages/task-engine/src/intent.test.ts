import assert from "node:assert/strict";
import { parseTaskIntent } from "./intent.js";

const validIntent = parseTaskIntent({
  action: {
    message: "Hello John.",
    type: "connect"
  },
  intent: "send_connection_request",
  targets: [
    {
      company: "Google",
      name: "John Smith",
      school: "UTA"
    }
  ]
});

assert.equal(validIntent.targets[0]?.name, "John Smith");

assert.throws(() => {
  parseTaskIntent({
    action: {
      type: "connect"
    },
    intent: "send_connection_request",
    targets: []
  });
});

assert.throws(() => {
  parseTaskIntent({
    action: {
      type: "unknown"
    },
    intent: "send_connection_request",
    targets: [{ name: "John Smith" }]
  });
});
