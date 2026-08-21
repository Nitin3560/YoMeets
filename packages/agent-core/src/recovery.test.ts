import assert from "node:assert/strict";
import { checkpointForFailure, checkpointForLoop } from "./recovery.js";

assert.deepEqual(checkpointForFailure({ class: "STRUCTURAL", code: "STALE_ELEMENT_REFERENCE", message: "Stale" }), {
  reason: "STRUCTURAL_FAILURE",
  type: "reobserve_and_replan"
});

assert.deepEqual(checkpointForFailure({ class: "UNKNOWN_COMMIT", code: "UNKNOWN_COMMIT", message: "Maybe sent" }), {
  reason: "UNKNOWN_COMMIT",
  type: "verify_external_state"
});

assert.deepEqual(checkpointForFailure({ class: "AUTH", code: "SESSION_EXPIRED", message: "Login required" }), {
  reason: "AUTH_FAILURE",
  type: "fail"
});

assert.equal(checkpointForLoop({ status: "continue" }), undefined);
assert.deepEqual(
  checkpointForLoop({
    reason: "SAME_PAGE_AND_ACTION_REPEATED",
    repeats: 3,
    status: "loop_detected"
  }),
  {
    reason: "LOOP_DETECTED",
    type: "reobserve_and_replan"
  }
);
