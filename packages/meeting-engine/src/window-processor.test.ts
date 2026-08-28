import assert from "node:assert/strict";
import { ScriptedModelProvider } from "@yomeets/model-router";
import { processMeetingWindow } from "./window-processor.js";
import type { MeetingStateSummary, TranscriptSegment } from "./types.js";

const segments: TranscriptSegment[] = [
  {
    endMs: 3600,
    final: true,
    id: "seg_2",
    meetingId: "meeting_1",
    sequence: 2,
    source: "test",
    speakerClusterId: "S2",
    startMs: 1900,
    text: "Yeah, I'll fix it tomorrow."
  }
];
const state: MeetingStateSummary = {
  decisions: [{ id: "decision_1", text: "Keep Redis for now" }],
  openActions: [{ description: "Fix auth timeout", id: "action_1", status: "open" }],
  openQuestions: [{ id: "question_1", status: "open", text: "How do we roll out?" }]
};

const retried = await processMeetingWindow({
  afterSequence: 1,
  currentState: state,
  meetingId: "meeting_1",
  provider: new ScriptedModelProvider([
    "{ broken json",
    JSON.stringify([
      {
        deadline: "tomorrow",
        description: "Fix auth timeout",
        evidenceEndMs: 3600,
        evidenceStartMs: 1900,
        ownerSpeakerId: "S2",
        type: "CREATE_ACTION"
      }
    ])
  ]),
  segments
});

assert.equal(retried.status, "processed");

if (retried.status === "processed") {
  assert.equal(retried.operations[0]?.type, "CREATE_ACTION");
}

const rejected = await processMeetingWindow({
  afterSequence: 2,
  currentState: state,
  meetingId: "meeting_1",
  provider: new ScriptedModelProvider([
    JSON.stringify([{ actionId: "missing_action", status: "completed", type: "UPDATE_ACTION" }]),
    JSON.stringify([{ questionId: "missing_question", type: "RESOLVE_QUESTION" }])
  ]),
  segments
});

assert.equal(rejected.status, "failed");
