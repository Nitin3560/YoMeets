import assert from "node:assert/strict";
import {
  formatModelBenchmarkSummary,
  runPhase5EndToEndDemo,
  runPhase1Benchmark,
  runPhase2FaultBenchmark,
  runPhase3SideEffectSafetyProof,
  runPhase4ModelBenchmark
} from "./index.js";
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

const safety = runPhase3SideEffectSafetyProof();

assert.equal(safety.rows.length, 4);

for (const row of safety.rows) {
  assert.equal(row.duplicate, false);
}

assert.deepEqual(
  safety.rows.map((row) => [row.crashPoint, row.sendCount, row.finalDbStatus, row.finalSiteStatus]),
  [
    ["before_approval", 0, "waiting_for_approval", "None"],
    ["after_approval_before_send", 1, "completed", "Sent"],
    ["after_send_before_confirmation", 1, "completed", "Sent"],
    ["after_action_result_before_task_status", 1, "completed", "Sent"]
  ]
);

const modelSummary = await runPhase4ModelBenchmark(["local"]);

assert.equal(modelSummary.rows[0]?.available, true);
assert.equal(modelSummary.rows[0]?.successRate, 1);
assert.equal(modelSummary.rows[0]?.invalidJsonRate, 0);
assert.match(formatModelBenchmarkSummary(modelSummary), /Provider/);

const demo = await runPhase5EndToEndDemo();

assert.equal(demo.verification, "passed");
assert.equal(demo.finalDbStatus, "completed");
assert.equal(demo.finalSiteStatus, "Sent");
assert.match(demo.steps.map((step) => step.text).join("\n"), /approval:/);
