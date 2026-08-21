import type { BrowserAction, PageObservation } from "@yomeets/browser-core";

export type LoopSample = {
  pageHash: string;
  actionHash: string;
};

export type LoopDecision =
  | {
      status: "continue";
    }
  | {
      status: "loop_detected";
      reason: "SAME_PAGE_AND_ACTION_REPEATED";
      repeats: number;
    };

function hashObservation(observation: PageObservation) {
  const elementNames = observation.elements
    .filter((element) => element.visible)
    .map((element) => `${element.role}:${element.name}:${element.enabled}`)
    .sort()
    .join("|");

  return `${observation.url}#${observation.title}#${elementNames}`;
}

function hashAction(action: BrowserAction) {
  return JSON.stringify(action);
}

export function createLoopSample(observation: PageObservation, action: BrowserAction): LoopSample {
  return {
    actionHash: hashAction(action),
    pageHash: hashObservation(observation)
  };
}

export function detectLoop(samples: LoopSample[], threshold = 3): LoopDecision {
  const latest = samples.at(-1);

  if (!latest) {
    return { status: "continue" };
  }

  let repeats = 0;

  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index];

    if (!sample || sample.actionHash !== latest.actionHash || sample.pageHash !== latest.pageHash) {
      break;
    }

    repeats += 1;
  }

  if (repeats >= threshold) {
    return {
      reason: "SAME_PAGE_AND_ACTION_REPEATED",
      repeats,
      status: "loop_detected"
    };
  }

  return { status: "continue" };
}
