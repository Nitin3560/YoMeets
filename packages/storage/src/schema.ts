import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at")
};

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  rawCommand: text("raw_command").notNull(),
  status: text("status").notNull(),
  ...timestamps
});

export const taskIntents = sqliteTable("task_intents", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  intentJson: text("intent_json").notNull(),
  ...timestamps
});

export const taskPlans = sqliteTable("task_plans", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  version: integer("version").notNull(),
  planJson: text("plan_json").notNull(),
  ...timestamps
});

export const taskTargets = sqliteTable("task_targets", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  targetJson: text("target_json").notNull(),
  ...timestamps
});

export const observations = sqliteTable("observations", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  pageVersion: integer("page_version").notNull(),
  observationJson: text("observation_json").notNull(),
  ...timestamps
});

export const actions = sqliteTable("actions", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  requestId: text("request_id").notNull(),
  actionJson: text("action_json").notNull(),
  resultJson: text("result_json"),
  ...timestamps
});

export const verificationResults = sqliteTable("verification_results", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  actionId: text("action_id").references(() => actions.id),
  resultJson: text("result_json").notNull(),
  ...timestamps
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  riskLevel: text("risk_level").notNull(),
  status: text("status").notNull(),
  prompt: text("prompt").notNull(),
  decidedAt: text("decided_at"),
  ...timestamps
});

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  title: text("title"),
  transcript: text("transcript").notNull(),
  ...timestamps
});

export const meetingCommitments = sqliteTable("meeting_commitments", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull().references(() => meetings.id),
  commitmentJson: text("commitment_json").notNull(),
  status: text("status").notNull(),
  externalStatus: text("external_status"),
  ...timestamps
});

export const plannedMeetingActions = sqliteTable("planned_meeting_actions", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull().references(() => meetings.id),
  commitmentId: text("commitment_id").notNull().references(() => meetingCommitments.id),
  plannedActionId: text("planned_action_id").notNull(),
  actionType: text("action_type").notNull(),
  actionJson: text("action_json").notNull(),
  approvalStatus: text("approval_status").notNull(),
  executionStatus: text("execution_status").notNull(),
  externalId: text("external_id"),
  verificationJson: text("verification_json"),
  ...timestamps
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json"),
  createdAt: text("created_at").notNull()
});
