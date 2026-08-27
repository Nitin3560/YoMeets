import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Storage } from "./database.js";
import {
  actions,
  auditEvents,
  executionResults,
  meetingCommitments,
  meetings,
  plannedMeetingActions,
  taskIntents,
  taskPlans,
  tasks,
  verificationResults
} from "./schema.js";

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

export type CreateMeetingInput = {
  title?: string;
  transcript: string;
};

export class MeetingRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateMeetingInput) {
    const meeting = {
      createdAt: now(),
      id: randomUUID(),
      title: input.title ?? null,
      transcript: input.transcript,
      updatedAt: null
    };

    this.storage.db.insert(meetings).values(meeting).run();
    return meeting;
  }
}

export type CreateMeetingCommitmentInput = {
  meetingId: string;
  commitment: unknown;
  status?: string;
};

export class MeetingCommitmentRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateMeetingCommitmentInput) {
    const commitment = {
      commitmentJson: asJson(input.commitment),
      createdAt: now(),
      externalStatus: null,
      id: randomUUID(),
      meetingId: input.meetingId,
      status: input.status ?? "open",
      updatedAt: null
    };

    this.storage.db.insert(meetingCommitments).values(commitment).run();
    return commitment;
  }

  updateExternalStatus(id: string, externalStatus: string, status = "open") {
    this.storage.db
      .update(meetingCommitments)
      .set({
        externalStatus,
        status,
        updatedAt: now()
      })
      .where(eq(meetingCommitments.id, id))
      .run();
  }

  listOpen() {
    return this.storage.db.select().from(meetingCommitments).where(eq(meetingCommitments.status, "open")).all();
  }
}

export type CreatePlannedMeetingActionInput = {
  meetingId: string;
  commitmentId: string;
  action: {
    id?: string;
    type: string;
  };
  approvalStatus?: string;
  executionStatus?: string;
};

export class PlannedMeetingActionRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreatePlannedMeetingActionInput) {
    const action = {
      actionJson: asJson(input.action),
      actionType: input.action.type,
      approvalStatus: input.approvalStatus ?? "not_required",
      commitmentId: input.commitmentId,
      createdAt: now(),
      executionStatus: input.executionStatus ?? "pending",
      externalId: null,
      id: randomUUID(),
      meetingId: input.meetingId,
      plannedActionId: input.action.id ?? randomUUID(),
      updatedAt: null,
      verificationJson: null
    };

    this.storage.db.insert(plannedMeetingActions).values(action).run();
    return action;
  }

  updateApprovalStatus(id: string, approvalStatus: string) {
    this.storage.db
      .update(plannedMeetingActions)
      .set({
        approvalStatus,
        updatedAt: now()
      })
      .where(eq(plannedMeetingActions.id, id))
      .run();
  }

  recordExecution(id: string, execution: { status: string; externalId?: string; verification?: unknown }) {
    this.storage.db
      .update(plannedMeetingActions)
      .set({
        executionStatus: execution.status,
        externalId: execution.externalId ?? null,
        updatedAt: now(),
        verificationJson: execution.verification === undefined ? null : asJson(execution.verification)
      })
      .where(eq(plannedMeetingActions.id, id))
      .run();
  }

  findById(id: string) {
    return this.storage.db.select().from(plannedMeetingActions).where(eq(plannedMeetingActions.id, id)).get();
  }

  findByPlannedActionId(meetingId: string, plannedActionId: string) {
    return this.storage.db
      .select()
      .from(plannedMeetingActions)
      .where(and(eq(plannedMeetingActions.meetingId, meetingId), eq(plannedMeetingActions.plannedActionId, plannedActionId)))
      .get();
  }

  latestForCommitment(commitmentId: string) {
    return this.storage.db
      .select()
      .from(plannedMeetingActions)
      .where(eq(plannedMeetingActions.commitmentId, commitmentId))
      .orderBy(desc(plannedMeetingActions.createdAt))
      .limit(1)
      .get();
  }
}

export type CreateExecutionResultInput = {
  meetingId: string;
  plannedActionId: string;
  status: string;
  externalId?: string;
  result: unknown;
};

export class ExecutionResultRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateExecutionResultInput) {
    const result = {
      createdAt: now(),
      externalId: input.externalId ?? null,
      id: randomUUID(),
      meetingId: input.meetingId,
      plannedActionId: input.plannedActionId,
      resultJson: asJson(input.result),
      status: input.status,
      updatedAt: null
    };

    this.storage.db.insert(executionResults).values(result).run();
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
