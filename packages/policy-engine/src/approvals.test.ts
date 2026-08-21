import assert from "node:assert/strict";
import { createApprovalRequest, decideApproval } from "./approvals.js";

const request = createApprovalRequest("approval_1", "task_1", {
  prompt: "Approve external action: Send connection request?",
  riskLevel: "external_side_effect",
  status: "approval_required"
});

assert.deepEqual(request, {
  id: "approval_1",
  prompt: "Approve external action: Send connection request?",
  riskLevel: "external_side_effect",
  status: "pending",
  taskId: "task_1"
});

assert.equal(decideApproval(request, "yes").status, "approved");
assert.equal(decideApproval(request, "no").status, "rejected");
