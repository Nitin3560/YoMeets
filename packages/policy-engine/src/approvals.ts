import type { PolicyDecision } from "./index.js";

export type ApprovalRequest = {
  id: string;
  taskId: string;
  riskLevel: "external_side_effect";
  prompt: string;
  status: "pending" | "approved" | "rejected";
};

export type ApprovalAnswer = "yes" | "no";

export function createApprovalRequest(
  id: string,
  taskId: string,
  decision: Extract<PolicyDecision, { status: "approval_required" }>
): ApprovalRequest {
  if (decision.riskLevel !== "external_side_effect") {
    throw new Error("Only external side-effect actions can request approval");
  }

  return {
    id,
    prompt: decision.prompt,
    riskLevel: decision.riskLevel,
    status: "pending",
    taskId
  };
}

export function decideApproval(request: ApprovalRequest, answer: ApprovalAnswer): ApprovalRequest {
  return {
    ...request,
    status: answer === "yes" ? "approved" : "rejected"
  };
}
