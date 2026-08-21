import type { TaskIntent, TaskTarget } from "./intent.js";

export type TaskPlanStepType =
  | "NAVIGATE_TARGET"
  | "SEARCH"
  | "OPEN_PROFILE"
  | "VERIFY_TARGET"
  | "CONNECT"
  | "ADD_NOTE"
  | "SEND"
  | "VERIFY_PENDING";

export type TaskPlanStep = {
  id: string;
  type: TaskPlanStepType;
  targetIndex: number;
  label: string;
  input?: Record<string, string>;
};

export type TaskPlanDraft = {
  steps: TaskPlanStep[];
};

function targetLabel(target: TaskTarget) {
  return [target.name, target.company, target.school].filter(Boolean).join(" | ");
}

function addStep(
  steps: TaskPlanStep[],
  targetIndex: number,
  type: TaskPlanStepType,
  label: string,
  input?: Record<string, string>
) {
  const id = `target_${targetIndex + 1}_step_${steps.length + 1}`;
  const step = input ? { id, input, label, targetIndex, type } : { id, label, targetIndex, type };

  steps.push(step);
}

export function planTaskIntent(intent: TaskIntent): TaskPlanDraft {
  const steps: TaskPlanStep[] = [];

  intent.targets.forEach((target, targetIndex) => {
    addStep(steps, targetIndex, "NAVIGATE_TARGET", `Open people search for ${target.name}`);
    addStep(steps, targetIndex, "SEARCH", `Search ${targetLabel(target)}`, {
      query: targetLabel(target)
    });
    addStep(steps, targetIndex, "OPEN_PROFILE", `Open ${target.name}'s profile`);
    addStep(steps, targetIndex, "VERIFY_TARGET", `Verify profile matches ${target.name}`);

    if (intent.action.type === "connect") {
      addStep(steps, targetIndex, "CONNECT", `Start connection request for ${target.name}`);

      if (intent.action.message) {
        addStep(steps, targetIndex, "ADD_NOTE", `Add note for ${target.name}`, {
          message: intent.action.message
        });
      }

      addStep(steps, targetIndex, "SEND", `Send connection request to ${target.name}`);
      addStep(steps, targetIndex, "VERIFY_PENDING", `Verify request is pending for ${target.name}`);
    }
  });

  return { steps };
}
