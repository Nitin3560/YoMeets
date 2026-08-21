import assert from "node:assert/strict";
import { buildTaskChecklist, formatTaskChecklist } from "./checklist.js";

const trace = ["TASK_RECEIVED", "PARSED", "PLAN_CREATED", "COMPLETED"] as const;
const checklist = buildTaskChecklist([...trace], 2);

assert.deepEqual(checklist, [
  { completed: true, event: "TASK_RECEIVED" },
  { completed: true, event: "PARSED" },
  { completed: false, event: "PLAN_CREATED" },
  { completed: false, event: "COMPLETED" }
]);

assert.equal(formatTaskChecklist([...trace], 3), [
  "[x] TASK_RECEIVED",
  "[x] PARSED",
  "[x] PLAN_CREATED",
  "[ ] COMPLETED"
].join("\n"));
