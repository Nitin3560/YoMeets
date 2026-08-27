import assert from "node:assert/strict";
import { extractMeetingCommitments } from "./commitment-extractor.js";

const result = extractMeetingCommitments(
  "Quick sync. Nitin will investigate failed jobs by Friday. Sarah will send the recap to Priya by tomorrow. We decided to keep drafts approval-gated."
);

assert.equal(result.commitments.length, 3);
assert.equal(result.commitments[0]?.type, "investigation");
assert.equal(result.commitments[0]?.owner, "Nitin");
assert.equal(result.commitments[0]?.due, "Friday");
assert.equal(result.commitments[1]?.type, "follow_up_message");
assert.equal(result.commitments[1]?.recipient, "Priya");
assert.equal(result.commitments[2]?.type, "decision_record");
