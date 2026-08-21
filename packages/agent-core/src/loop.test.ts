import assert from "node:assert/strict";
import type { BrowserAction, PageObservation } from "@yomeets/browser-core";
import { createLoopSample, detectLoop } from "./loop.js";

const observation: PageObservation = {
  elements: [
    {
      bounds: { height: 20, width: 100, x: 0, y: 0 },
      enabled: true,
      name: "Search",
      ref: "e_1",
      role: "button",
      visible: true
    }
  ],
  observedAt: "2026-08-21T00:00:00.000Z",
  pageVersion: 1,
  title: "People",
  url: "http://localhost:3000"
};

const action: BrowserAction = {
  pageVersion: 1,
  ref: "e_1",
  type: "click"
};

const sample = createLoopSample(observation, action);

assert.equal(sample.pageHash.includes("People"), true);
assert.equal(detectLoop([sample, sample]).status, "continue");
assert.deepEqual(detectLoop([sample, sample, sample]), {
  reason: "SAME_PAGE_AND_ACTION_REPEATED",
  repeats: 3,
  status: "loop_detected"
});

const changed = createLoopSample({ ...observation, pageVersion: 2, title: "Profile" }, action);

assert.equal(detectLoop([sample, sample, changed]).status, "continue");
