ALTER TABLE "journey_runs" ADD COLUMN "retest_id" uuid;--> statement-breakpoint
ALTER TABLE "journey_runs" ADD COLUMN "target" jsonb;--> statement-breakpoint
ALTER TABLE "retests" ADD COLUMN "journey_run_id" uuid;