CREATE TABLE IF NOT EXISTS `meetings` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text,
  `transcript` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meeting_commitments` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL,
  `commitment_json` text NOT NULL,
  `status` text NOT NULL,
  `external_status` text,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `planned_meeting_actions` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL,
  `commitment_id` text NOT NULL,
  `planned_action_id` text NOT NULL,
  `action_type` text NOT NULL,
  `action_json` text NOT NULL,
  `approval_status` text NOT NULL,
  `execution_status` text NOT NULL,
  `external_id` text,
  `verification_json` text,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`commitment_id`) REFERENCES `meeting_commitments`(`id`) ON UPDATE no action ON DELETE no action
);
