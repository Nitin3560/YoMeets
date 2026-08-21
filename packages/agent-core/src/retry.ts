import type { AgentLimits } from "./index.js";
import type { ClassifiedFailure } from "./failures.js";

export type RetryDecision =
  | {
      status: "retry";
      delayMs: number;
      nextAttempt: number;
    }
  | {
      status: "recover";
      reason: "REOBSERVE_AND_REPLAN";
    }
  | {
      status: "inspect_commit";
      reason: "VERIFY_EXTERNAL_STATE_BEFORE_RETRY";
    }
  | {
      status: "stop";
      reason: string;
    };

const backoffMs = [1000, 2000, 4000, 8000];

export function decideRetry(
  failure: ClassifiedFailure,
  attempt: number,
  limits: Pick<AgentLimits, "maxRetriesPerAction">
): RetryDecision {
  if (failure.class === "STRUCTURAL") {
    return {
      reason: "REOBSERVE_AND_REPLAN",
      status: "recover"
    };
  }

  if (failure.class === "UNKNOWN_COMMIT") {
    return {
      reason: "VERIFY_EXTERNAL_STATE_BEFORE_RETRY",
      status: "inspect_commit"
    };
  }

  if (failure.class !== "TRANSIENT") {
    return {
      reason: `${failure.class}_FAILURE`,
      status: "stop"
    };
  }

  if (attempt >= limits.maxRetriesPerAction) {
    return {
      reason: "RETRY_LIMIT_REACHED",
      status: "stop"
    };
  }

  return {
    delayMs: backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? backoffMs[backoffMs.length - 1],
    nextAttempt: attempt + 1,
    status: "retry"
  };
}
