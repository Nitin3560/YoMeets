import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Storage } from "./database.js";
import { actions, auditEvents, taskIntents, taskPlans, tasks, verificationResults } from "./schema.js";

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

  updateStatus(id: string, status: string) {
    this.storage.db
      .update(tasks)
      .set({
        status,
        updatedAt: now()
      })
      .where(eq(tasks.id, id))
      .run();
  }
}

export type CreateTaskIntentInput = {
  taskId: string;
  intent: unknown;
};

export class TaskIntentRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateTaskIntentInput) {
    const intent = {
      createdAt: now(),
      id: randomUUID(),
      intentJson: asJson(input.intent),
      taskId: input.taskId,
      updatedAt: null
    };

    this.storage.db.insert(taskIntents).values(intent).run();
    return intent;
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

export type CreateVerificationResultInput = {
  taskId: string;
  actionId?: string;
  result: unknown;
};

export class VerificationResultRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateVerificationResultInput) {
    const result = {
      actionId: input.actionId ?? null,
      createdAt: now(),
      id: randomUUID(),
      resultJson: asJson(input.result),
      taskId: input.taskId,
      updatedAt: null
    };

    this.storage.db.insert(verificationResults).values(result).run();
    return result;
  }
}

export type CreateTaskPlanInput = {
  taskId: string;
  plan: unknown;
};

export class TaskPlanRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateTaskPlanInput) {
    const latest = this.latestForTask(input.taskId);
    const plan = {
      createdAt: now(),
      id: randomUUID(),
      planJson: asJson(input.plan),
      taskId: input.taskId,
      updatedAt: null,
      version: (latest?.version ?? 0) + 1
    };

    this.storage.db.insert(taskPlans).values(plan).run();
    return plan;
  }

  latestForTask(taskId: string) {
    return this.storage.db
      .select()
      .from(taskPlans)
      .where(eq(taskPlans.taskId, taskId))
      .orderBy(desc(taskPlans.version))
      .limit(1)
      .get();
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
