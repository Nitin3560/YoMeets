import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openStorage, runMigrations } from "./database.js";
import { TaskPlanRepository, TaskRepository } from "./repositories.js";

const dir = mkdtempSync(join(tmpdir(), "yomeets-storage-"));
const storage = openStorage(join(dir, "test.sqlite"));

runMigrations(storage);

try {
  const tasks = new TaskRepository(storage);
  const plans = new TaskPlanRepository(storage);
  const task = tasks.create({
    rawCommand: "Connect with John Smith"
  });

  const first = plans.create({
    plan: {
      steps: [{ id: "step_1", type: "SEARCH" }]
    },
    taskId: task.id
  });
  const second = plans.create({
    plan: {
      steps: [{ id: "step_1", type: "SEARCH" }, { id: "step_2", type: "CONNECT" }]
    },
    taskId: task.id
  });
  const latest = plans.latestForTask(task.id);

  assert.equal(first.version, 1);
  assert.equal(second.version, 2);
  assert.equal(latest?.id, second.id);
  assert.equal(JSON.parse(latest?.planJson ?? "{}").steps.length, 2);
} finally {
  storage.sqlite.close();
}
