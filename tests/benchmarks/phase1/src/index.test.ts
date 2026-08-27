import assert from "node:assert/strict";
import { runPhase1Benchmark, runPhase2FaultBenchmark } from "./index.js";
import { benchmarkTasks } from "./tasks.js";

const summary = await runPhase1Benchmark({ retries: 0 });

assert.equal(summary.total, benchmarkTasks.length);
assert.equal(summary.total >= 20, true);
assert.equal(summary.failed, 0);
assert.equal(summary.passRate, 1);

const faultSummary = await runPhase2FaultBenchmark({ retries: 1 });
const byFault = new Map(faultSummary.faults.map((fault) => [fault.fault, fault]));

assert.equal(byFault.get("dom_missing_element")?.recoveryRate, 1);
assert.equal(byFault.get("dom_stale_element")?.recoveryRate, 1);
assert.equal(byFault.get("network_timeout")?.recoveryRate, 1);
assert.equal(byFault.get("malformed_model_json")?.recoveryRate, 1);
assert.equal(byFault.get("partial_side_effect")?.recoveryRate, 1);
assert.equal(byFault.get("extension_disconnect")?.recoveryRate, 3 / 24);
assert.equal(byFault.get("duplicate_action")?.recoveryRate, 14 / 24);
