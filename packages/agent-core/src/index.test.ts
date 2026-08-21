import assert from "node:assert/strict";
import { advanceAgentState, createAgentState } from "./index.js";

const started = createAgentState("task_1", 1000);

assert.equal(started.status, "received");
assert.equal(started.limits.maxAgentSteps, 50);
assert.equal(started.limits.maxModelCalls, 20);
assert.equal(started.startedAtMs, 1000);
assert.equal(started.updatedAtMs, 1000);

const parsed = advanceAgentState(started, { type: "INTENT_PARSED" }, 1001);
const planned = advanceAgentState(parsed, { type: "PLAN_CREATED" }, 1002);

assert.equal(parsed.status, "parsed");
assert.equal(parsed.modelCalls, 1);
assert.equal(planned.status, "planned");

const running = advanceAgentState(
  planned,
  {
    action: {
      label: "Observe current page",
      riskLevel: "read_only",
      type: "OBSERVE"
    },
    type: "ACTION_PROPOSED"
  },
  1003
);

assert.equal(running.status, "running");

const waiting = advanceAgentState(
  running,
  {
    action: {
      label: "Send connection request",
      riskLevel: "external_side_effect",
      type: "SEND"
    },
    type: "ACTION_PROPOSED"
  },
  1004
);

assert.equal(waiting.status, "waiting_for_approval");
assert.equal(waiting.pendingApproval?.decision.status, "approval_required");

const approved = advanceAgentState(waiting, { type: "APPROVAL_GRANTED" }, 1005);
const verified = advanceAgentState(approved, { type: "ACTION_VERIFIED" }, 1006);

assert.equal(approved.status, "running");
assert.equal(approved.pendingApproval, undefined);
assert.equal(verified.stepIndex, 1);

const denied = advanceAgentState(
  planned,
  {
    action: {
      label: "Enter payment details",
      riskLevel: "high_risk",
      type: "PAY"
    },
    type: "ACTION_PROPOSED"
  },
  1007
);

assert.equal(denied.status, "failed");

const limited = advanceAgentState(
  {
    ...started,
    agentSteps: 50
  },
  { type: "PLAN_CREATED" },
  1008
);

assert.equal(limited.status, "failed");
assert.equal(limited.failure, "AGENT_STEP_LIMIT_REACHED");
