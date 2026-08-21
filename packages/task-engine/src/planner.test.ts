import assert from "node:assert/strict";
import { planTaskIntent } from "./planner.js";

const searchPlan = planTaskIntent({
  action: {
    type: "open_profile"
  },
  intent: "search_profile",
  targets: [{ company: "Google", name: "John Smith" }]
});

assert.deepEqual(
  searchPlan.steps.map((step) => step.type),
  ["NAVIGATE_TARGET", "SEARCH", "OPEN_PROFILE", "VERIFY_TARGET"]
);
assert.equal(searchPlan.steps[1]?.input?.query, "John Smith | Google");

const connectionPlan = planTaskIntent({
  action: {
    message: "Great to meet you.",
    type: "connect"
  },
  intent: "send_connection_request",
  targets: [{ name: "Maya Patel" }]
});

assert.deepEqual(
  connectionPlan.steps.map((step) => step.type),
  [
    "NAVIGATE_TARGET",
    "SEARCH",
    "OPEN_PROFILE",
    "VERIFY_TARGET",
    "CONNECT",
    "ADD_NOTE",
    "SEND",
    "VERIFY_PENDING"
  ]
);
assert.equal(connectionPlan.steps[5]?.input?.message, "Great to meet you.");

const multiTargetPlan = planTaskIntent({
  action: {
    type: "connect"
  },
  intent: "send_connection_request",
  targets: [{ name: "Ava Lee" }, { name: "Noah Kim" }]
});

assert.equal(multiTargetPlan.steps.length, 14);
assert.equal(multiTargetPlan.steps[0]?.targetIndex, 0);
assert.equal(multiTargetPlan.steps[7]?.targetIndex, 1);
assert.equal(multiTargetPlan.steps[7]?.id, "target_2_step_8");
