import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openStorage, runMigrations } from "./database.js";
import {
  ActionRepository,
  TaskIntentRepository,
  TaskPlanRepository,
  TaskRepository,
  VerificationResultRepository
} from "./repositories.js";

const dir = mkdtempSync(join(tmpdir(), "yomeets-storage-"));
const storage = openStorage(join(dir, "test.sqlite"));

runMigrations(storage);

try {
  const tasks = new TaskRepository(storage);
  const intents = new TaskIntentRepository(storage);
  const plans = new TaskPlanRepository(storage);
  const actions = new ActionRepository(storage);
  const verifications = new VerificationResultRepository(storage);
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

  const intent = intents.create({
    intent: {
      intent: "send_connection_request"
    },
    taskId: task.id
  });
  const action = actions.create({
    action: {
      type: "click"
    },
    requestId: "request_1",
    taskId: task.id
  });
  const verification = verifications.create({
    actionId: action.id,
    result: {
      passed: true
    },
    taskId: task.id
  });

  tasks.updateStatus(task.id, "completed");

  assert.equal(JSON.parse(intent.intentJson).intent, "send_connection_request");
  assert.equal(JSON.parse(verification.resultJson).passed, true);
  assert.equal(tasks.findById(task.id)?.status, "completed");
} finally {
  storage.sqlite.close();
}
