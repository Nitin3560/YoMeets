CREATE TABLE IF NOT EXISTS `meeting_participants` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL,
  `name` text NOT NULL,
  `resolution_status` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `speaker_clusters` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL,
  `label` text NOT NULL,
  `resolved_participant_id` text,
  `resolution_status` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`resolved_participant_id`) REFERENCES `meeting_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `transcript_segments` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL,
  `speaker_cluster_id` text NOT NULL,
  `participant_id` text,
  `start_ms` integer NOT NULL,
  `end_ms` integer NOT NULL,
  `text` text NOT NULL,
  `final` integer NOT NULL,
  `source` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`speaker_cluster_id`) REFERENCES `speaker_clusters`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`participant_id`) REFERENCES `meeting_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meeting_actions` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL,
  `description` text NOT NULL,
  `owner_ref_json` text NOT NULL,
  `deadline` text,
  `status` text NOT NULL,
  `evidence_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meeting_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL,
  `text` text NOT NULL,
  `speaker_ref_json` text NOT NULL,
  `evidence_json` text NOT NULL,
  `supersedes` text,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meeting_questions` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL,
  `text` text NOT NULL,
  `status` text NOT NULL,
  `evidence_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action
);
