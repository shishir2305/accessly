import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  integer,
} from "drizzle-orm/pg-core";
import type { ScanResult, Check, ScanContext } from "@accessly/contracts";
const time = (n: string) =>
  timestamp(n, { withTimezone: true }).defaultNow().notNull();
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: time("created_at"),
});
export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  createdAt: time("created_at"),
});
export const environments = pgTable("environments", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  pages: jsonb("pages").$type<string[]>().notNull(),
  createdAt: time("created_at"),
});
export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id),
    createdBy: uuid("created_by").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    context: jsonb("context").$type<ScanContext>().notNull(),
    result: jsonb("result").$type<ScanResult>(),
    error: text("error"),
    evidenceState: text("evidence_state").notNull().default("none"),
    cancelled: boolean("cancelled").notNull().default(false),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [index("runs_workspace_created").on(t.workspaceId, t.createdAt)],
);
export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environments.id),
  fingerprint: text("fingerprint").notNull().unique(),
  rule: text("rule").notNull(),
  locator: text("locator").notNull(),
  outcome: text("outcome").notNull(),
  check: jsonb("check").$type<Check>().notNull(),
  context: jsonb("context").$type<ScanContext>().notNull(),
  firstSeen: time("first_seen"),
  lastSeen: time("last_seen"),
  originalRunId: uuid("original_run_id"),
  workState: text("work_state").notNull().default("new"),
  assessment: text("assessment").notNull().default("confirmed"),
  verificationRequirement: text("verification_requirement")
    .notNull()
    .default("automated-with-context"),
  remedyNotes: text("remedy_notes").notNull().default(""),
  remedyVersion: text("remedy_version").notNull().default(""),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  safeInputs: text("safe_inputs").notNull().default(""),
  expectedOutcome: text("expected_outcome").notNull().default(""),
  closureReason: text("closure_reason"),
  revision: integer("revision").notNull().default(0),
  lastVerificationId: uuid("last_verification_id"),
  updatedAt: time("updated_at"),
});
export const occurrences = pgTable(
  "occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    findingId: uuid("finding_id")
      .notNull()
      .references(() => findings.id),
    element: jsonb("element").notNull(),
  },
  (t) => [uniqueIndex("occurrence_run_finding").on(t.runId, t.findingId)],
);
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    objectPath: text("object_path").notNull(),
    digest: text("digest").notNull(),
    description: text("description").notNull(),
    masked: boolean("masked").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    status: text("status").notNull().default("pending"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: time("created_at"),
  },
  (t) => [uniqueIndex("evidence_one_per_run").on(t.runId)],
);
export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  actorId: uuid("actor_id").notNull(),
  runId: uuid("run_id").references(() => runs.id),
  action: text("action").notNull(),
  createdAt: time("created_at"),
});
export const outbox = pgTable("outbox", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => runs.id),
  payload: jsonb("payload").notNull(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  createdAt: time("created_at"),
});
export const extensionGrants = pgTable("extension_grants", {
  codeHash: text("code_hash").primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  challenge: text("challenge").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const extensionSessions = pgTable("extension_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: time("created_at"),
});

export const findingEvents = pgTable("finding_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  actorId: uuid("actor_id").notNull(),
  kind: text("kind").notNull(),
  note: text("note").notNull(),
  detail: jsonb("detail").notNull(),
  createdAt: time("created_at"),
});
export const reproductionAttempts = pgTable("reproduction_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  actorId: uuid("actor_id").notNull(),
  outcome: text("outcome").notNull(),
  conditions: text("conditions").notNull(),
  notes: text("notes").notNull(),
  context: jsonb("context").$type<ScanContext>().notNull(),
  createdAt: time("created_at"),
});
export const retests = pgTable("retests", {
  journeyRunId: uuid("journey_run_id"),
  id: uuid("id").primaryKey(),
  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  baselineRunId: uuid("baseline_run_id")
    .notNull()
    .references(() => runs.id),
  runId: uuid("run_id").references(() => runs.id),
  createdBy: uuid("created_by").notNull(),
  status: text("status").notNull().default("requested"),
  mode: text("mode").notNull(),
  context: jsonb("context").$type<ScanContext>().notNull(),
  target: jsonb("target").$type<{ rule: string; locator: string }>().notNull(),
  remedyNotes: text("remedy_notes").notNull(),
  remedyVersion: text("remedy_version").notNull(),
  assessment: jsonb("assessment").$type<{
    outcome: string;
    reasons: string[];
    changes: string[];
  }>(),
  createdAt: time("created_at"),
});
export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  retestId: uuid("retest_id")
    .notNull()
    .references(() => retests.id),
  runId: uuid("run_id").references(() => runs.id),
  actorId: uuid("actor_id").notNull(),
  method: text("method").notNull(),
  outcome: text("outcome").notNull(),
  resolved: boolean("resolved").notNull(),
  record: jsonb("record").notNull(),
  createdAt: time("created_at"),
});
export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  createdAt: time("created_at"),
});
export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id),
  retentionDays: integer("retention_days"),
  updatedBy: uuid("updated_by").notNull(),
  updatedAt: time("updated_at"),
});
export const pilotFeedback = pgTable("pilot_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id),
  actorId: uuid("actor_id").notNull(),
  usefulness: text("usefulness").notNull(),
  notes: text("notes").notNull(),
  activeMinutes: integer("active_minutes"),
  createdAt: time("created_at"),
});

export const journeys = pgTable("journeys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environments.id),
  revision: integer("revision").notNull(),
  definition: jsonb("definition")
    .$type<import("../../contracts/src/journeys").JourneyDefinition>()
    .notNull(),
  updatedBy: uuid("updated_by").notNull(),
  createdAt: time("created_at"),
  updatedAt: time("updated_at"),
});
export const journeyVersions = pgTable(
  "journey_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => journeys.id),
    revision: integer("revision").notNull(),
    definition: jsonb("definition")
      .$type<import("../../contracts/src/journeys").JourneyDefinition>()
      .notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [uniqueIndex("journey_revision_unique").on(t.journeyId, t.revision)],
);
export const testIdentities = pgTable("test_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environments.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  kind: text("kind").notNull(),
  keyId: text("key_id").notNull(),
  sealed: text("sealed"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull(),
  createdAt: time("created_at"),
});
export const journeyRuns = pgTable("journey_runs", {
  retestId: uuid("retest_id"),
  target: jsonb("target").$type<{
    rule: string;
    locator: string;
    stepId: string;
  }>(),
  runId: uuid("run_id")
    .primaryKey()
    .references(() => runs.id),
  journeyId: uuid("journey_id")
    .notNull()
    .references(() => journeys.id),
  revision: integer("revision").notNull(),
  definition: jsonb("definition")
    .$type<import("../../contracts/src/journeys").JourneyDefinition>()
    .notNull(),
  identityId: uuid("identity_id").references(() => testIdentities.id),
  variationId: text("variation_id"),
  report:
    jsonb("report").$type<
      import("../../contracts/src/journeys").JourneyReport
    >(),
});
