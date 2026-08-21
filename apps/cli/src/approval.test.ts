import assert from "node:assert/strict";
import { parseApprovalAnswer } from "./approval.js";

assert.equal(parseApprovalAnswer("y"), "yes");
assert.equal(parseApprovalAnswer("YES"), "yes");
assert.equal(parseApprovalAnswer("n"), "no");
assert.equal(parseApprovalAnswer(" no "), "no");

assert.throws(() => {
  parseApprovalAnswer("maybe");
});
