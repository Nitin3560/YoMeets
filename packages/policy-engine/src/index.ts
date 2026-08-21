export type RiskLevel = "read_only" | "reversible" | "external_side_effect" | "high_risk";

export type PolicyDecision =
  | {
      status: "allowed";
      riskLevel: RiskLevel;
    }
  | {
      status: "approval_required";
      riskLevel: RiskLevel;
      prompt: string;
    }
  | {
      status: "denied";
      riskLevel: RiskLevel;
      reason: string;
    };

export type PolicyAction = {
  type: string;
  label: string;
  riskLevel: RiskLevel;
};

export function evaluatePolicy(action: PolicyAction): PolicyDecision {
  if (action.riskLevel === "read_only" || action.riskLevel === "reversible") {
    return {
      riskLevel: action.riskLevel,
      status: "allowed"
    };
  }

  if (action.riskLevel === "external_side_effect") {
    return {
      prompt: `Approve external action: ${action.label}?`,
      riskLevel: action.riskLevel,
      status: "approval_required"
    };
  }

  return {
    reason: "High-risk actions are outside local V1 scope.",
    riskLevel: action.riskLevel,
    status: "denied"
  };
}
