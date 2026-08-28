import { randomUUID } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import type { Storage } from "./database.js";
import {
  actions,
  auditEvents,
  executionResults,
  meetingActions,
  meetingCommitments,
  meetingDecisions,
  meetingParticipants,
  meetingQuestions,
  meetings,
  plannedMeetingActions,
  speakerClusters,
  taskIntents,
  taskPlans,
  tasks,
  transcriptSegments,
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

export type CreateMeetingParticipantInput = {
  id?: string;
  meetingId: string;
  name: string;
  resolutionStatus?: string;
};

export class MeetingParticipantRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateMeetingParticipantInput) {
    const participant = {
      createdAt: now(),
      id: input.id ?? randomUUID(),
      meetingId: input.meetingId,
      name: input.name,
      resolutionStatus: input.resolutionStatus ?? "confirmed",
      updatedAt: null
    };

    this.storage.db.insert(meetingParticipants).values(participant).run();
    return participant;
  }

  listForMeeting(meetingId: string) {
    return this.storage.db.select().from(meetingParticipants).where(eq(meetingParticipants.meetingId, meetingId)).all();
  }
}

export type CreateSpeakerClusterInput = {
  id?: string;
  meetingId: string;
  label: string;
  resolvedParticipantId?: string;
  resolutionStatus?: string;
};

export class SpeakerClusterRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateSpeakerClusterInput) {
    const cluster = {
      createdAt: now(),
      id: input.id ?? randomUUID(),
      label: input.label,
      meetingId: input.meetingId,
      resolutionStatus: input.resolutionStatus ?? "unknown",
      resolvedParticipantId: input.resolvedParticipantId ?? null,
      updatedAt: null
    };

    this.storage.db.insert(speakerClusters).values(cluster).run();
    return cluster;
  }

  findByLabel(meetingId: string, label: string) {
    return this.storage.db
      .select()
      .from(speakerClusters)
      .where(and(eq(speakerClusters.meetingId, meetingId), eq(speakerClusters.label, label)))
      .get();
  }

  listForMeeting(meetingId: string) {
    return this.storage.db.select().from(speakerClusters).where(eq(speakerClusters.meetingId, meetingId)).all();
  }

  findById(id: string) {
    return this.storage.db.select().from(speakerClusters).where(eq(speakerClusters.id, id)).get();
  }

  updateResolution(id: string, input: { resolvedParticipantId?: string | null; resolutionStatus: string }) {
    this.storage.db
      .update(speakerClusters)
      .set({
        resolutionStatus: input.resolutionStatus,
        resolvedParticipantId: input.resolvedParticipantId ?? null,
        updatedAt: now()
      })
      .where(eq(speakerClusters.id, id))
      .run();
  }
}

export type CreateTranscriptSegmentInput = {
  id?: string;
  meetingId: string;
  speakerClusterId: string;
  participantId?: string;
  startMs: number;
  endMs: number;
  text: string;
  final: boolean;
  source: string;
  sequence?: number;
};

export class TranscriptSegmentRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateTranscriptSegmentInput) {
    const segment = {
      createdAt: now(),
      endMs: input.endMs,
      final: input.final ? 1 : 0,
      id: input.id ?? randomUUID(),
      meetingId: input.meetingId,
      participantId: input.participantId ?? null,
      source: input.source,
      speakerClusterId: input.speakerClusterId,
      startMs: input.startMs,
      text: input.text,
      sequence: input.sequence ?? input.startMs,
      updatedAt: null
    };

    this.storage.db.insert(transcriptSegments).values(segment).run();
    return segment;
  }

  listForMeeting(meetingId: string) {
    return this.storage.db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.meetingId, meetingId))
      .orderBy(transcriptSegments.startMs)
      .all();
  }

  listAfterSequence(meetingId: string, sequence: number) {
    return this.storage.db
      .select()
      .from(transcriptSegments)
      .where(and(eq(transcriptSegments.meetingId, meetingId), gt(transcriptSegments.sequence, sequence)))
      .orderBy(transcriptSegments.sequence)
      .all();
  }

  updateParticipantForSpeakerCluster(speakerClusterId: string, participantId: string) {
    this.storage.db
      .update(transcriptSegments)
      .set({
        participantId,
        updatedAt: now()
      })
      .where(eq(transcriptSegments.speakerClusterId, speakerClusterId))
      .run();
  }
}

export type CreateCanonicalMeetingActionInput = {
  id?: string;
  meetingId: string;
  description: string;
  ownerRef: unknown;
  deadline?: string | null;
  status?: string;
  evidence: unknown;
};

export class CanonicalMeetingActionRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateCanonicalMeetingActionInput) {
    const action = {
      createdAt: now(),
      deadline: input.deadline ?? null,
      description: input.description,
      evidenceJson: asJson(input.evidence),
      id: input.id ?? randomUUID(),
      meetingId: input.meetingId,
      ownerRefJson: asJson(input.ownerRef),
      status: input.status ?? "open",
      updatedAt: null
    };

    this.storage.db.insert(meetingActions).values(action).run();
    return action;
  }

  listForMeeting(meetingId: string) {
    return this.storage.db.select().from(meetingActions).where(eq(meetingActions.meetingId, meetingId)).all();
  }

  update(id: string, input: { status?: string; description?: string }) {
    const updates: { description?: string; status?: string; updatedAt: string } = {
      updatedAt: now()
    };

    if (input.description !== undefined) {
      updates.description = input.description;
    }

    if (input.status !== undefined) {
      updates.status = input.status;
    }

    this.storage.db
      .update(meetingActions)
      .set(updates)
      .where(eq(meetingActions.id, id))
      .run();
  }

  updateOwnerRef(id: string, ownerRef: unknown, status?: string) {
    this.storage.db
      .update(meetingActions)
      .set({
        ownerRefJson: asJson(ownerRef),
        status: status ?? "open",
        updatedAt: now()
      })
      .where(eq(meetingActions.id, id))
      .run();
  }
}

export type CreateMeetingDecisionInput = {
  id?: string;
  meetingId: string;
  text: string;
  speakerRef: unknown;
  evidence: unknown;
  supersedes?: string;
};

export class MeetingDecisionRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateMeetingDecisionInput) {
    const decision = {
      createdAt: now(),
      evidenceJson: asJson(input.evidence),
      id: input.id ?? randomUUID(),
      meetingId: input.meetingId,
      speakerRefJson: asJson(input.speakerRef),
      supersedes: input.supersedes ?? null,
      text: input.text,
      updatedAt: null
    };

    this.storage.db.insert(meetingDecisions).values(decision).run();
    return decision;
  }

  listForMeeting(meetingId: string) {
    return this.storage.db.select().from(meetingDecisions).where(eq(meetingDecisions.meetingId, meetingId)).all();
  }
}

export type CreateMeetingQuestionInput = {
  id?: string;
  meetingId: string;
  text: string;
  status?: string;
  evidence: unknown;
};

export class MeetingQuestionRepository {
  constructor(private readonly storage: Storage) {}

  create(input: CreateMeetingQuestionInput) {
    const question = {
      createdAt: now(),
      evidenceJson: asJson(input.evidence),
      id: input.id ?? randomUUID(),
      meetingId: input.meetingId,
      status: input.status ?? "open",
      text: input.text,
      updatedAt: null
    };

    this.storage.db.insert(meetingQuestions).values(question).run();
    return question;
  }

  listForMeeting(meetingId: string) {
    return this.storage.db.select().from(meetingQuestions).where(eq(meetingQuestions.meetingId, meetingId)).all();
  }

  resolve(id: string) {
    this.storage.db
      .update(meetingQuestions)
      .set({
        status: "resolved",
        updatedAt: now()
      })
      .where(eq(meetingQuestions.id, id))
      .run();
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
