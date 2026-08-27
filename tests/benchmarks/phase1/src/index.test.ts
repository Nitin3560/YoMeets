import assert from "node:assert/strict";
import { runPhase1Benchmark } from "./index.js";
import { benchmarkTasks } from "./tasks.js";

const summary = await runPhase1Benchmark({ retries: 0 });

assert.equal(summary.total, benchmarkTasks.length);
assert.equal(summary.total >= 20, true);
assert.equal(summary.failed, 0);
assert.equal(summary.passRate, 1);
