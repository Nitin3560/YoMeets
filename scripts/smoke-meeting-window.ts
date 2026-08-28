import { processMeetingWindow } from "../packages/meeting-engine/dist/window-processor.js";
import type { MeetingStateSummary, Operation, TranscriptSegment } from "../packages/meeting-engine/dist/types.js";
import { GeminiModelProvider } from "../packages/model-router/dist/index.js";

function segment(input: {
  endMs: number;
  id: string;
  sequence: number;
  speakerClusterId: string;
  startMs: number;
  text: string;
}): TranscriptSegment {
  return {
    ...input,
    final: true,
    meetingId: "meeting_smoke",
    source: "smoke"
  };
}

function emptyState(): MeetingStateSummary {
  return {
    decisions: [],
    openActions: [],
    openQuestions: []
  };
}

function hasOperation(operations: Operation[], type: Operation["type"]) {
  return operations.some((operation) => operation.type === type);
}

const provider = new GeminiModelProvider();

const firstWindow = await processMeetingWindow({
  afterSequence: 0,
  currentState: emptyState(),
  meetingId: "meeting_smoke",
  provider,
  segments: [
    segment({
      endMs: 1800,
      id: "seg_1",
      sequence: 1,
      speakerClusterId: "S1",
      startMs: 0,
      text: "Sarah, can you check the auth timeout?"
    }),
    segment({
      endMs: 3600,
      id: "seg_2",
      sequence: 2,
      speakerClusterId: "S2",
      startMs: 1900,
      text: "Yeah, I'll fix it tomorrow."
    }),
    segment({
      endMs: 5200,
      id: "seg_3",
      sequence: 3,
      speakerClusterId: "S3",
      startMs: 3700,
      text: "Let's keep Redis for now."
    })
  ]
});

console.log("First window");
console.log(JSON.stringify(firstWindow, null, 2));

if (firstWindow.status !== "processed" || !hasOperation(firstWindow.operations, "CREATE_ACTION") || !hasOperation(firstWindow.operations, "CREATE_DECISION")) {
  process.exitCode = 1;
}

const secondWindow = await processMeetingWindow({
  afterSequence: 3,
  currentState: {
    decisions: [
      {
        id: "decision_redis",
        speakerId: "S3",
        text: "Keep Redis for now"
      }
    ],
    openActions: [],
    openQuestions: []
  },
  meetingId: "meeting_smoke",
  provider,
  segments: [
    segment({
      endMs: 9100,
      id: "seg_4",
      sequence: 4,
      speakerClusterId: "S1",
      startMs: 7000,
      text: "Actually, let's switch to Postgres, Redis isn't working out."
    })
  ]
});

console.log("Second window");
console.log(JSON.stringify(secondWindow, null, 2));

if (
  secondWindow.status !== "processed" ||
  !secondWindow.operations.some((operation) => operation.type === "CREATE_DECISION" && operation.supersedes === "decision_redis")
) {
  process.exitCode = 1;
}
