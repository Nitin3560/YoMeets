import assert from "node:assert/strict";
import { evaluatePolicy, type PolicyAction } from "./index.js";

const readOnly: PolicyAction = {
  label: "Observe page",
  riskLevel: "read_only",
  type: "OBSERVE"
};

assert.equal(evaluatePolicy(readOnly).status, "allowed");

const reversible: PolicyAction = {
  label: "Type draft note",
  riskLevel: "reversible",
  type: "TYPE"
};

assert.equal(evaluatePolicy(reversible).status, "allowed");

const external = evaluatePolicy({
  label: "Send connection request",
  riskLevel: "external_side_effect",
  type: "SEND"
});

assert.equal(external.status, "approval_required");

if (external.status === "approval_required") {
  assert.match(external.prompt, /Send connection request/);
}

const highRisk = evaluatePolicy({
  label: "Enter payment details",
  riskLevel: "high_risk",
  type: "PAY"
});

assert.equal(highRisk.status, "denied");
