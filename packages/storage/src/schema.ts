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

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json"),
  createdAt: text("created_at").notNull()
});
