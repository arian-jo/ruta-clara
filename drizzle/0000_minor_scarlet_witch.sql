CREATE TABLE `day_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`service_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`started_at` text,
	`paused_at` text,
	`closed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `day_plans_service_date_idx` ON `day_plans` (`service_date`);--> statement-breakpoint
CREATE INDEX `day_plans_status_idx` ON `day_plans` (`status`);--> statement-breakpoint
CREATE TABLE `latest_positions` (
	`device_id` text PRIMARY KEY NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`accuracy` real,
	`device_time` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stops` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`client_label` text NOT NULL,
	`destination_address` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`window_start` text NOT NULL,
	`window_end` text NOT NULL,
	`planned_service_minutes` integer DEFAULT 60 NOT NULL,
	`manual_delay_minutes` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`public_token_hash` text NOT NULL,
	`public_token_ciphertext` text NOT NULL,
	`public_token_iv` text NOT NULL,
	`revoked_at` text,
	`arrived_at` text,
	`completed_at` text,
	`eta_at` text,
	`eta_source` text,
	`eta_updated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `day_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stops_plan_sequence_idx` ON `stops` (`plan_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `stops_public_token_hash_idx` ON `stops` (`public_token_hash`);