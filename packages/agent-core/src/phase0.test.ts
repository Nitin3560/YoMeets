import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalHeuristicModelProvider } from "@yomeets/model-router";
import { openStorage, runMigrations } from "@yomeets/storage";
import { runPhase0Task } from "./phase0.js";

const dir = mkdtempSync(join(tmpdir(), "yomeets-phase0-"));
const storage = openStorage(join(dir, "phase0.sqlite"));

runMigrations(storage);

try {
  const result = await runPhase0Task(
    storage,
    new LocalHeuristicModelProvider(),
    "Find John Smith at Google and send a connection request with 'Hello John.'"
  );
  const task = storage.sqlite
    .prepare("SELECT status FROM tasks WHERE id = ?")
    .get(result.taskId) as { status: string } | undefined;
  const counts = storage.sqlite
    .prepare(
      [
        "SELECT",
        "(SELECT COUNT(*) FROM task_intents) AS intents,",
        "(SELECT COUNT(*) FROM task_plans) AS plans,",
        "(SELECT COUNT(*) FROM actions) AS actions,",
        "(SELECT COUNT(*) FROM verification_results) AS verifications"
      ].join(" ")
    )
    .get() as { intents: number; plans: number; actions: number; verifications: number };

  assert.equal(result.status, "completed");
  assert.equal(result.verificationPassed, true);
  assert.equal(task?.status, "completed");
  assert.deepEqual(counts, {
    actions: 1,
    intents: 1,
    plans: 1,
    verifications: 1
  });
  assert.equal(result.trace.at(-1), "COMPLETED");
} finally {
  storage.sqlite.close();
}
