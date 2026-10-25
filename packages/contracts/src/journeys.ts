import { z } from "zod";
import { httpUrl, safeUrl } from "./index";
const replayUrl = httpUrl
  .refine(
    (value) => !new URL(value).search && !new URL(value).hash,
    "Query/fragment-based routes are not supported for replay; use a dedicated safe test route. Query strings and fragments are never retained.",
  )
  .transform(safeUrl);
const text = z.string().trim().min(1).max(500);
const ref = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/);
export const journeyLocator = z.discriminatedUnion("by", [
  z.object({ by: z.literal("testId"), value: ref }).strict(),
  z.object({ by: z.literal("id"), value: ref }).strict(),
  z
    .object({
      by: z.literal("role"),
      value: z.enum([
        "button",
        "link",
        "dialog",
        "tab",
        "menuitem",
        "textbox",
        "heading",
        "alert",
        "status",
        "region",
      ]),
      name: text,
    })
    .strict(),
  z.object({ by: z.literal("label"), value: text }).strict(),
]);
const base = { id: ref, label: text };
export const effects = [
  "ui",
  "submission",
  "purchase",
  "message",
  "delete",
  "settings",
  "account",
] as const;
export const journeyStep = z.discriminatedUnion("action", [
  z
    .object({
      ...base,
      action: z.literal("navigate"),
      url: replayUrl,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("click"),
      locator: journeyLocator,
      effect: z.enum(effects),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("input"),
      locator: journeyLocator,
      inputRef: ref,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("select"),
      locator: journeyLocator,
      inputRef: ref,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("key"),
      key: z.enum([
        "Tab",
        "Shift+Tab",
        "Enter",
        "Space",
        "Escape",
        "ArrowDown",
        "ArrowUp",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ]),
      effect: z.enum(effects),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("assert"),
      locator: journeyLocator,
      state: z.enum(["visible", "hidden"]),
      text: text.optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("checkpoint"),
      locator: journeyLocator,
      state: text,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("focus"),
      locator: journeyLocator,
      expectation: z.enum(["on", "within", "outside"]),
      phase: z.enum(["entry", "movement", "exit", "restoration"]),
      basis: z.enum(["observation", "pattern-guidance"]),
    })
    .strict(),
  z
    .object({ ...base, action: z.literal("unsupported"), reason: text })
    .strict(),
]);
const requestBoundary = z
  .object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z
      .string()
      .regex(/^\/[a-zA-Z0-9/_\-.]*$/)
      .max(500),
  })
  .strict();
export const journeyDefinition = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(100),
    goal: text,
    preconditions: z.string().max(2000),
    role: z.string().trim().min(1).max(80),
    appVersion: z.string().max(100).default("unknown"),
    startUrl: replayUrl,
    access: z.enum(["public", "protected"]),
    expectedOutcome: text,
    signedIn: z.object({ locator: journeyLocator, text }).strict().optional(),
    isolation: z.enum(["read-only", "dedicated-test-account"]),
    grants: z
      .array(
        z
          .object({
            stepId: ref,
            effect: z.enum(effects).exclude(["ui"]),
            reason: text,
            requests: z.array(requestBoundary).max(10),
          })
          .strict(),
      )
      .max(40),
    steps: z.array(journeyStep).min(1).max(60),
    variations: z
      .array(
        z
          .object({ id: ref, name: text, stepIds: z.array(ref).min(1).max(60) })
          .strict(),
      )
      .max(15),
    excludeSelectors: z.array(z.string().min(1).max(300)).max(20).default([]),
    stepTimeoutMs: z.number().int().min(500).max(15000).default(5000),
  })
  .strict()
  .superRefine((d, ctx) => {
    const ids = d.steps.map((s) => s.id);
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (new Set(ids).size !== ids.length) issue("Step IDs must be unique.");
    if (!d.steps.some((s) => s.action === "checkpoint"))
      issue("Select at least one checkpoint.");
    if (d.access === "protected" && !d.signedIn)
      issue("Protected journeys require a signed-in role assertion.");
    for (const s of d.steps)
      if (
        s.action === "navigate" &&
        new URL(s.url).origin !== new URL(d.startUrl).origin
      )
        issue("Navigation must stay on the starting origin.");
    for (const v of d.variations) {
      if (new Set(v.stepIds).size !== v.stepIds.length)
        issue("Variation step IDs must be unique.");
      if (v.stepIds.some((id) => !ids.includes(id)))
        issue("Variation steps must exist.");
      if (
        !v.stepIds.some(
          (id) => d.steps.find((s) => s.id === id)?.action === "checkpoint",
        )
      )
        issue("Every variation must select a checkpoint.");
    }
    if (new Set(d.variations.map((v) => v.id)).size !== d.variations.length)
      issue("Variation IDs must be unique.");
    if (new Set(d.grants.map((g) => g.stepId)).size !== d.grants.length)
      issue("Each action may have one grant.");
    for (const g of d.grants) {
      const s = d.steps.find((s) => s.id === g.stepId);
      if (
        !s ||
        !(s.action === "click" || s.action === "key") ||
        s.effect !== g.effect
      )
        issue("Grants must match an explicit action and effect.");
      if (d.isolation !== "dedicated-test-account")
        issue("Consequential actions require isolated test data/accounts.");
    }
  });
export const journeyInput = z
  .object({
    applicationId: z.uuid(),
    environmentId: z.uuid(),
    revision: z.number().int().nonnegative().optional(),
    definition: journeyDefinition,
  })
  .strict();
export const journeyRunInput = z
  .object({
    requestId: z.uuid(),
    revision: z.number().int().positive(),
    identityId: z.uuid().optional(),
    variationId: ref.optional(),
  })
  .strict();
export const storageStateSchema = z
  .object({
    cookies: z
      .array(
        z
          .object({
            name: z.string().min(1).max(200),
            value: z.string().max(10000),
            domain: z.string().max(253),
            path: z.string().max(500),
            expires: z.number(),
            httpOnly: z.boolean(),
            secure: z.boolean(),
            sameSite: z.enum(["Strict", "Lax", "None"]),
          })
          .strict(),
      )
      .max(100),
    origins: z
      .array(
        z
          .object({
            origin: httpUrl,
            localStorage: z
              .array(
                z
                  .object({
                    name: z.string().max(200),
                    value: z.string().max(10000),
                  })
                  .strict(),
              )
              .max(100),
          })
          .strict(),
      )
      .max(1),
  })
  .strict();
export const identityInput = z
  .object({
    applicationId: z.uuid(),
    environmentId: z.uuid(),
    name: z.string().trim().min(1).max(100),
    role: z.string().trim().min(1).max(80),
    dedicatedTestIdentity: z.literal(true),
    expiresAt: z.iso.datetime(),
    inputs: z
      .record(ref, z.string().max(10000))
      .refine((v) => Object.keys(v).length <= 30)
      .default({}),
    session: storageStateSchema.optional(),
    login: z
      .object({
        url: replayUrl,
        username: journeyLocator,
        usernameRef: ref,
        password: journeyLocator,
        passwordRef: ref,
        submit: journeyLocator,
        request: requestBoundary,
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (d) => !(d.session && d.login),
    "Choose a login recipe or provisioned session, not both.",
  );
export type JourneyDefinition = z.infer<typeof journeyDefinition>;
export type JourneyStep = z.infer<typeof journeyStep>;
export type JourneyLocator = z.infer<typeof journeyLocator>;
export type IdentityInput = z.infer<typeof identityInput>;
export type JourneyReport = {
  runnerVersion: "1";
  status: "running" | "completed" | "incomplete" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  stop?: { stepId: string; code: string; recovery: string };
  history: {
    stepId: string;
    action: string;
    outcome: "completed" | "blocked";
    at: string;
    url: string;
    focus?: string;
  }[];
  checkpoints: {
    stepId: string;
    runId: string;
    state: string;
    completion: string;
  }[];
  focus: {
    stepId: string;
    phase: string;
    expected: string;
    observed: string;
    outcome: "matches" | "differs";
    basis: string;
    keyboardSequence: string[];
  }[];
  variations: {
    id: string;
    name: string;
    status: "assessed" | "partially-assessed" | "not-assessed";
  }[];
  suggestions: { kind: string; reason: string; status: "unreviewed" }[];
  limitations: string[];
};
