CREATE TABLE "finding_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"note" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"finding_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"usefulness" text NOT NULL,
	"notes" text NOT NULL,
	"active_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reproduction_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"conditions" text NOT NULL,
	"notes" text NOT NULL,
	"context" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"finding_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"baseline_run_id" uuid NOT NULL,
	"run_id" uuid,
	"created_by" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"mode" text NOT NULL,
	"context" jsonb NOT NULL,
	"target" jsonb NOT NULL,
	"remedy_notes" text NOT NULL,
	"remedy_version" text NOT NULL,
	"assessment" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"retest_id" uuid NOT NULL,
	"run_id" uuid,
	"actor_id" uuid NOT NULL,
	"method" text NOT NULL,
	"outcome" text NOT NULL,
	"resolved" boolean NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"retention_days" integer,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "original_run_id" uuid;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "work_state" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "assessment" text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "verification_requirement" text DEFAULT 'automated-with-context' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "remedy_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "remedy_version" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "steps" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "safe_inputs" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "expected_outcome" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "closure_reason" text;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "last_verification_id" uuid;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "finding_events" ADD CONSTRAINT "finding_events_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_events" ADD CONSTRAINT "finding_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_feedback" ADD CONSTRAINT "pilot_feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_feedback" ADD CONSTRAINT "pilot_feedback_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproduction_attempts" ADD CONSTRAINT "reproduction_attempts_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproduction_attempts" ADD CONSTRAINT "reproduction_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_baseline_run_id_runs_id_fk" FOREIGN KEY ("baseline_run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_retest_id_retests_id_fk" FOREIGN KEY ("retest_id") REFERENCES "public"."retests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
UPDATE findings SET original_run_id=(SELECT occurrences.run_id FROM occurrences JOIN runs ON occurrences.run_id=runs.id WHERE occurrences.finding_id=findings.id ORDER BY runs.created_at ASC LIMIT 1);
--> statement-breakpoint
UPDATE findings SET assessment='suspected',verification_requirement='human-review' WHERE outcome='incomplete';
