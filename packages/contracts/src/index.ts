import { z } from "zod";
export const PROFILE = "wcag22aa-automated-v1";
export const SCANNER_VERSION = "0.2.0";
export const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
export const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
      );
    } catch {
      return false;
    }
  }, "Use an HTTP(S) address without embedded credentials");
export function safeUrl(value: string) {
  const u = new URL(value);
  u.username = "";
  u.password = "";
  u.search = "";
  u.hash = "";
  return u.toString();
}
export const applicationInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    environment: z.string().trim().min(1).max(80),
    origin: httpUrl.transform((s) => new URL(s).origin),
    pages: z.array(httpUrl.transform(safeUrl)).max(30).default([]),
  })
  .refine(
    (d) => d.pages.every((p) => new URL(p).origin === d.origin),
    "Saved pages must belong to the permitted origin",
  );
export const contextSchema = z.object({
  url: httpUrl.transform(safeUrl),
  title: z.string().max(160).default("Page title omitted"),
  state: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(80).default("unknown"),
  preconditions: z.string().max(2000).default(""),
  authentication: z.enum(["user-confirmed-signed-in", "signed-out", "unknown"]),
  viewport: z.object({
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
    deviceScale: z.number().positive().max(8),
  }),
  appVersion: z.string().max(100).default("unknown"),
});
export const boxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(0),
  height: z.number().finite().min(0),
});
export const locatorSchema = z
  .string()
  .max(1800)
  .regex(/^[a-z0-9:\-()> .]+$/i, "Only structural element paths are accepted");
export const elementSchema = z.object({
  locator: locatorSchema,
  description: z.string().max(300),
  summary: z.string().max(1200),
  box: boxSchema.nullable(),
  checks: z.array(z.string().max(100)).max(30),
});
export const checkSchema = z.object({
  rule: z.string().max(120),
  impact: z.enum(["minor", "moderate", "serious", "critical"]).nullable(),
  help: z.string().max(300),
  description: z.string().max(1000),
  helpUrl: z
    .string()
    .url()
    .max(500)
    .refine((u) => new URL(u).hostname === "dequeuniversity.com"),
  tags: z.array(z.string().max(100)).max(40),
  outcome: z.enum(["violation", "incomplete", "pass", "inapplicable"]),
  elements: z.array(elementSchema).max(300),
  nodeCount: z.number().int().nonnegative(),
});
export const targetSchema = z.object({
  rule: z.string().min(1).max(120),
  locator: locatorSchema,
});
export const targetObservationSchema = targetSchema.extend({
  present: z.boolean(),
  matchedCount: z.number().int().nonnegative(),
  outcome: z.enum([
    "pass",
    "violation",
    "incomplete",
    "inapplicable",
    "not-assessed",
  ]),
  tagName: z.string().max(80),
  visible: z.boolean(),
});
export const scanSchema = z.object({
  journey: z
    .object({
      runId: z.uuid(),
      journeyId: z.uuid(),
      revision: z.number().int().positive(),
      stepId: z.string().max(64),
    })
    .strict()
    .optional(),
  retestId: z.uuid().optional(),
  targetObservation: targetObservationSchema.optional(),
  clientScanId: z.uuid(),
  applicationId: z.uuid(),
  environmentId: z.uuid(),
  mode: z.enum(["extension", "worker"]),
  context: contextSchema,
  profile: z.literal(PROFILE),
  scannerVersion: z.literal(SCANNER_VERSION),
  engineVersion: z.string().max(40),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  completion: z.enum(["completed", "partial", "failed"]),
  checks: z.array(checkSchema).max(600),
  limitations: z.array(z.string().max(500)).max(60),
  exclusions: z.array(z.string().max(300)).max(30),
  error: z.string().max(500).optional(),
});
export type ScanResult = z.infer<typeof scanSchema>;
export type ScanContext = z.infer<typeof contextSchema>;
export type Check = z.infer<typeof checkSchema>;
export const workerInput = z.object({
  retestId: z.uuid().optional(),
  target: targetSchema.optional(),
  applicationId: z.uuid(),
  environmentId: z.uuid(),
  url: httpUrl.transform(safeUrl),
  state: z.string().min(1).max(120).default("Initial page"),
  screenshot: z.boolean().default(false),
  excludeSelectors: z.array(z.string().max(300)).max(20).default([]),
});
export const scanOptions = z.object({
  retestId: z.uuid().optional(),
  applicationId: z.uuid(),
  environmentId: z.uuid(),
  state: z.string().min(1).max(120),
  role: z.string().min(1).max(80),
  preconditions: z.string().max(2000),
  authentication: z.enum(["user-confirmed-signed-in", "signed-out", "unknown"]),
  excludeSelectors: z.array(z.string().max(300)).max(20),
  expectedProtected: z.boolean(),
  appVersion: z.string().max(100).default("unknown"),
});
export type ScanOptions = z.infer<typeof scanOptions>;
export const extensionMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("record-start") }),
  z.object({ type: z.literal("record-stop") }),
  z.object({ type: z.literal("record-status") }),
  z.object({ type: z.literal("record-discard") }),
  z.object({ type: z.literal("connect") }),
  z.object({ type: z.literal("disconnect") }),
  z.object({ type: z.literal("status") }),
  z.object({ type: z.literal("applications") }),
  z.object({ type: z.literal("retests") }),
  z.object({ type: z.literal("scan"), options: scanOptions }),
  z.object({ type: z.literal("capture") }),
  z.object({
    type: z.literal("upload"),
    image: z.string().max(7_000_000).optional(),
    description: z.string().max(1500).default(""),
    masked: z.boolean().default(false),
  }),
  z.object({ type: z.literal("discard") }),
  z.object({ type: z.literal("highlight"), locator: locatorSchema }),
]);
export const evidenceInput = z.object({
  data: z
    .string()
    .max(7_000_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
  description: z.string().trim().min(1).max(1500),
  masked: z.boolean().default(false),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
});
export type ApplicationInput = z.infer<typeof applicationInput>;

export const workStates = [
  "new",
  "under-review",
  "open",
  "in-progress",
  "ready-for-verification",
  "verification-in-progress",
  "resolved",
  "reopened",
  "closed-after-review",
] as const;
export const evidenceAssessments = [
  "confirmed",
  "suspected",
  "disputed",
  "inconclusive",
  "not-a-barrier",
] as const;
export const findingEdit = z.object({
  revision: z.number().int().nonnegative(),
  state: z
    .enum([
      "new",
      "under-review",
      "open",
      "in-progress",
      "ready-for-verification",
      "verification-in-progress",
      "closed-after-review",
    ])
    .optional(),
  assessment: z.enum(evidenceAssessments).optional(),
  reason: z.string().trim().min(1).max(2000),
  closureReason: z
    .enum(["false-positive", "retired-functionality", "not-applicable"])
    .optional(),
  remedyNotes: z.string().max(4000).optional(),
  remedyVersion: z.string().max(100).optional(),
  steps: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  safeInputs: z.string().max(2000).optional(),
  expectedOutcome: z.string().max(2000).optional(),
});
export const reproductionInput = z.object({
  outcome: z.enum(["reproduced", "not-reproduced", "blocked", "inconclusive"]),
  conditions: z.string().trim().min(1).max(3000),
  notes: z.string().trim().min(1).max(3000),
  context: contextSchema,
});
export const retestInput = z.object({
  revision: z.number().int().nonnegative(),
  requestId: z.uuid(),
  screenshot: z.boolean().default(false),
});
export const verificationInput = z.object({
  revision: z.number().int().nonnegative(),
  retestId: z.uuid(),
  method: z.enum([
    "automated-targeted",
    "manual-review",
    "assistive-technology",
  ]),
  outcome: z.enum(["passed", "failed", "inconclusive"]),
  conditions: z.string().trim().min(1).max(3000),
  actualOutcome: z.string().trim().min(1).max(3000),
  expectedOutcome: z.string().trim().min(1).max(3000),
  limitations: z.string().trim().min(1).max(3000),
  contextConfirmed: z.boolean(),
  identityConfirmed: z.boolean(),
  capabilityPreserved: z.boolean(),
  humanReviewComplete: z.boolean().default(false),
  manualContext: contextSchema.optional(),
  reviewMethod: z.string().max(2000).default(""),
  adjacentRequired: z.boolean().default(false),
  adjacentOutcome: z
    .enum(["not-required", "passed", "failed", "pending"])
    .default("not-required"),
  adjacentNotes: z.string().max(3000).default(""),
});
export const findingFilters = z.object({
  applicationId: z.uuid().optional(),
  state: z.enum(workStates).optional(),
  view: z
    .enum([
      "all",
      "open",
      "awaiting-verification",
      "resolved",
      "closed-after-review",
    ])
    .default("open"),
  search: z.string().max(100).default(""),
});
export const savedViewInput = z.object({
  name: z.string().trim().min(1).max(80),
  filters: findingFilters,
});
export const settingsInput = z.object({
  retentionDays: z.number().int().min(1).max(365).nullable(),
  reason: z.string().trim().min(1).max(2000),
});
export const feedbackInput = z.object({
  findingId: z.uuid(),
  usefulness: z.enum(["useful", "partly-useful", "not-yet-useful"]),
  notes: z.string().trim().min(1).max(3000),
  activeMinutes: z.number().min(0).max(100000).nullable(),
});
export type FindingEdit = z.infer<typeof findingEdit>;
export type VerificationInput = z.infer<typeof verificationInput>;
export type ReproductionInput = z.infer<typeof reproductionInput>;
