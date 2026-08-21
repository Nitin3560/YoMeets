import type { ClassifiedFailure } from "./failures.js";
import type { LoopDecision } from "./loop.js";

export type RecoveryCheckpoint =
  | {
      type: "reobserve_and_replan";
      reason: "STRUCTURAL_FAILURE" | "LOOP_DETECTED";
    }
  | {
      type: "verify_external_state";
      reason: "UNKNOWN_COMMIT";
    }
  | {
      type: "fail";
      reason: string;
    };

export function checkpointForFailure(failure: ClassifiedFailure): RecoveryCheckpoint {
  if (failure.class === "STRUCTURAL") {
    return {
      reason: "STRUCTURAL_FAILURE",
      type: "reobserve_and_replan"
    };
  }

  if (failure.class === "UNKNOWN_COMMIT") {
    return {
      reason: "UNKNOWN_COMMIT",
      type: "verify_external_state"
    };
  }

  return {
    reason: `${failure.class}_FAILURE`,
    type: "fail"
  };
}

export function checkpointForLoop(decision: LoopDecision): RecoveryCheckpoint | undefined {
  if (decision.status === "continue") {
    return undefined;
  }

  return {
    reason: "LOOP_DETECTED",
    type: "reobserve_and_replan"
  };
}
