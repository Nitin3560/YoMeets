import type { Storage } from "@yomeets/storage";
import { AuditWriter, TaskRepository } from "@yomeets/storage";

export function createTaskFromCommand(storage: Storage, rawCommand: string) {
  const command = rawCommand.trim();

  if (!command) {
    throw new Error("Task command is required");
  }

  const tasks = new TaskRepository(storage);
  const audit = new AuditWriter(storage);
  const task = tasks.create({
    rawCommand: command,
    status: "received"
  });

  audit.write("TASK_RECEIVED", { rawCommand: command }, task.id);
  return task;
}
