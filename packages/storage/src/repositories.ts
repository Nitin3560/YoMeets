import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Storage } from "./database.js";
import { actions, auditEvents, tasks } from "./schema.js";

function now() {
  return new Date().toISOString();
}

function asJson(value: unknown) {
  return JSON.stringify(value);
}

export type CreateTaskInput = {
  rawCommand: string;
  status?: string;
};

export class TaskRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateTaskInput) {
    const task = {
      createdAt: now(),
      id: randomUUID(),
      rawCommand: input.rawCommand,
      status: input.status ?? "received",
      updatedAt: null
    };

    this.storage.db.insert(tasks).values(task).run();
    return task;
  }

  findById(id: string) {
    return this.storage.db.select().from(tasks).where(eq(tasks.id, id)).get();
  }
}

export type CreateActionInput = {
  taskId: string;
  requestId: string;
  action: unknown;
};

export class ActionRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateActionInput) {
    const action = {
      actionJson: asJson(input.action),
      createdAt: now(),
      id: randomUUID(),
      requestId: input.requestId,
      resultJson: null,
      taskId: input.taskId,
      updatedAt: null
    };

    this.storage.db.insert(actions).values(action).run();
    return action;
  }

  recordResult(id: string, result: unknown) {
    this.storage.db
      .update(actions)
      .set({
        resultJson: asJson(result),
        updatedAt: now()
      })
      .where(eq(actions.id, id))
      .run();
  }
}

export class AuditWriter {
  constructor(private readonly storage: Storage) {}

  write(eventType: string, payload?: unknown, taskId?: string) {
    const event = {
      createdAt: now(),
      eventType,
      id: randomUUID(),
      payloadJson: payload === undefined ? null : asJson(payload),
      taskId: taskId ?? null
    };

    this.storage.db.insert(auditEvents).values(event).run();
    return event;
  }
}
