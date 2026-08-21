import assert from "node:assert/strict";
import { buildTaskTrace } from "./trace.js";

const trace = buildTaskTrace({
  steps: [
    { id: "target_1_step_1", label: "Open people search", targetIndex: 0, type: "NAVIGATE_TARGET" },
    { id: "target_1_step_2", label: "Search John Smith", targetIndex: 0, type: "SEARCH" },
    { id: "target_1_step_3", label: "Open John Smith", targetIndex: 0, type: "OPEN_PROFILE" },
    { id: "target_1_step_4", label: "Verify John Smith", targetIndex: 0, type: "VERIFY_TARGET" },
    { id: "target_1_step_5", label: "Connect", targetIndex: 0, type: "CONNECT" },
    { id: "target_1_step_6", label: "Add note", targetIndex: 0, type: "ADD_NOTE" },
    { id: "target_1_step_7", label: "Send", targetIndex: 0, type: "SEND" },
    { id: "target_1_step_8", label: "Verify pending", targetIndex: 0, type: "VERIFY_PENDING" }
  ]
});

assert.deepEqual(trace, [
  "TASK_RECEIVED",
  "PARSED",
  "PLAN_CREATED",
  "NAVIGATE",
  "SEARCH",
  "PROFILE_OPENED",
  "TARGET_VERIFIED",
  "CONNECT_CLICKED",
  "NOTE_DIALOG_OPENED",
  "MESSAGE_TYPED",
  "SEND_CLICKED",
  "PENDING_DETECTED",
  "COMPLETED"
]);
