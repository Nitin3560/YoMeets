import type { TaskTraceEvent } from "./trace.js";

export type ChecklistItem = {
  event: TaskTraceEvent;
  completed: boolean;
};

export function buildTaskChecklist(trace: TaskTraceEvent[], completedCount = trace.length): ChecklistItem[] {
  return trace.map((event, index) => ({
    completed: index < completedCount,
    event
  }));
}

export function formatTaskChecklist(trace: TaskTraceEvent[], completedCount = trace.length) {
  return buildTaskChecklist(trace, completedCount)
    .map((item) => `${item.completed ? "[x]" : "[ ]"} ${item.event}`)
    .join("\n");
}
