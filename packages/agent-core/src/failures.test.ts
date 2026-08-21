import assert from "node:assert/strict";
import { classifyActionResult, classifyFailure } from "./failures.js";

assert.equal(classifyFailure("NETWORK_ERROR").class, "TRANSIENT");
assert.equal(classifyFailure("STALE_ELEMENT_REFERENCE").class, "STRUCTURAL");
assert.equal(classifyFailure("POLICY_DENIED").class, "POLICY");
assert.equal(classifyFailure("SESSION_EXPIRED").class, "AUTH");
assert.equal(classifyFailure("UNKNOWN_COMMIT").class, "UNKNOWN_COMMIT");
assert.equal(classifyFailure("BROKEN_INVARIANT").class, "FATAL");

assert.equal(
  classifyActionResult({
    error: {
      code: "TIMEOUT",
      message: "Timed out"
    },
    status: "failed"
  })?.class,
  "TRANSIENT"
);

assert.equal(
  classifyActionResult({
    status: "completed"
  }),
  undefined
);
