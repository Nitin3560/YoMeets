import assert from "node:assert/strict";
import { decideRetry } from "./retry.js";

const limits = {
  maxRetriesPerAction: 4
};

assert.deepEqual(decideRetry({ class: "TRANSIENT", code: "TIMEOUT", message: "Timed out" }, 0, limits), {
  delayMs: 1000,
  nextAttempt: 1,
  status: "retry"
});

assert.deepEqual(decideRetry({ class: "TRANSIENT", code: "TIMEOUT", message: "Timed out" }, 3, limits), {
  delayMs: 8000,
  nextAttempt: 4,
  status: "retry"
});

assert.deepEqual(decideRetry({ class: "TRANSIENT", code: "TIMEOUT", message: "Timed out" }, 4, limits), {
  reason: "RETRY_LIMIT_REACHED",
  status: "stop"
});

assert.deepEqual(decideRetry({ class: "STRUCTURAL", code: "STALE_ELEMENT_REFERENCE", message: "Stale" }, 0, limits), {
  reason: "REOBSERVE_AND_REPLAN",
  status: "recover"
});

assert.deepEqual(decideRetry({ class: "UNKNOWN_COMMIT", code: "UNKNOWN_COMMIT", message: "Maybe sent" }, 0, limits), {
  reason: "VERIFY_EXTERNAL_STATE_BEFORE_RETRY",
  status: "inspect_commit"
});

assert.deepEqual(decideRetry({ class: "AUTH", code: "SESSION_EXPIRED", message: "Login required" }, 0, limits), {
  reason: "AUTH_FAILURE",
  status: "stop"
});
