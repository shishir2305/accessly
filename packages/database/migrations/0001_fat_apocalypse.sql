ALTER TABLE "evidence" ADD COLUMN "digest" text DEFAULT 'legacy-unhashed' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence" ALTER COLUMN "digest" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_one_per_run" ON "evidence" USING btree ("run_id");