import assert from "node:assert/strict";
import { createAgentState } from "./index.js";

const started = createAgentState("task_1", 1000);

assert.equal(started.status, "received");
assert.equal(started.limits.maxAgentSteps, 50);
assert.equal(started.limits.maxModelCalls, 20);
assert.equal(started.startedAtMs, 1000);
assert.equal(started.updatedAtMs, 1000);
