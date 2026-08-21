CREATE TABLE `tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `raw_command` text NOT NULL,
  `status` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text
);
--> statement-breakpoint
CREATE TABLE `task_intents` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `intent_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `version` integer NOT NULL,
  `plan_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_targets` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `target_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `observations` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `page_version` integer NOT NULL,
  `observation_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `actions` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `request_id` text NOT NULL,
  `action_json` text NOT NULL,
  `result_json` text,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verification_results` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `action_id` text,
  `result_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`action_id`) REFERENCES `actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approvals` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `risk_level` text NOT NULL,
  `status` text NOT NULL,
  `prompt` text NOT NULL,
  `decided_at` text,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text,
  `event_type` text NOT NULL,
  `payload_json` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
