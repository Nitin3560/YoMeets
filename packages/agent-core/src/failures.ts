import type { ActionResult } from "@yomeets/browser-core";

export type FailureClass = "TRANSIENT" | "STRUCTURAL" | "POLICY" | "AUTH" | "UNKNOWN_COMMIT" | "FATAL";

export type ClassifiedFailure = {
  class: FailureClass;
  code: string;
  message: string;
};

const structuralCodes = new Set(["STALE_ELEMENT_REFERENCE", "ELEMENT_NOT_FOUND", "OBSERVE_FAILED"]);
const authCodes = new Set(["AUTH_REQUIRED", "SESSION_EXPIRED"]);
const transientCodes = new Set(["ACTION_FAILED", "NETWORK_ERROR", "TIMEOUT"]);
const unknownCommitCodes = new Set(["UNKNOWN_COMMIT"]);

export function classifyFailure(code: string, message = code): ClassifiedFailure {
  if (unknownCommitCodes.has(code)) {
    return { class: "UNKNOWN_COMMIT", code, message };
  }

  if (authCodes.has(code)) {
    return { class: "AUTH", code, message };
  }

  if (structuralCodes.has(code)) {
    return { class: "STRUCTURAL", code, message };
  }

  if (transientCodes.has(code)) {
    return { class: "TRANSIENT", code, message };
  }

  if (code.startsWith("POLICY_")) {
    return { class: "POLICY", code, message };
  }

  return { class: "FATAL", code, message };
}

export function classifyActionResult(result: ActionResult): ClassifiedFailure | undefined {
  if (result.status === "completed") {
    return undefined;
  }

  return classifyFailure(result.error?.code ?? "ACTION_FAILED", result.error?.message ?? "Action failed");
}
