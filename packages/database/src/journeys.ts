import { z } from "zod";
import {
  journeyInput,
  journeyRunInput,
  identityInput,
  type JourneyReport,
} from "../../contracts/src/journeys";
import {
  getDb,
  journeys,
  journeyVersions,
  journeyRuns,
  testIdentities,
  runs,
  outbox,
  activity,
  retests,
  eq,
  and,
  desc,
  sql,
} from "./index";
import {
  assertEnvironment,
  ownerWorkspace,
  accessibleRun,
  getRun,
  AppError,
} from "./service";
import { seal, unseal, identityAad } from "./journey-secrets";
export async function listJourneys(actor: string) {
  const ws = await ownerWorkspace(actor);
  return getDb()
    .select()
    .from(journeys)
    .where(eq(journeys.workspaceId, ws.id))
    .orderBy(desc(journeys.updatedAt));
}
export async function accessibleJourney(actor: string, id: string) {
  const ws = await ownerWorkspace(actor);
  const [row] = await getDb()
    .select()
    .from(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.workspaceId, ws.id)));
  if (!row) throw new AppError(404, "Journey is unavailable.");
  return row;
}
export async function journeyDetail(actor: string, id: string) {
  const row = await accessibleJourney(actor, id);
  const [versions, history] = await Promise.all([
    getDb()
      .select()
      .from(journeyVersions)
      .where(eq(journeyVersions.journeyId, id))
      .orderBy(desc(journeyVersions.revision)),
    getDb()
      .select({ run: runs, journey: journeyRuns })
      .from(journeyRuns)
      .innerJoin(runs, eq(runs.id, journeyRuns.runId))
      .where(
        and(
          eq(journeyRuns.journeyId, id),
          eq(runs.workspaceId, row.workspaceId),
        ),
      )
      .orderBy(desc(runs.createdAt))
      .limit(50),
  ]);
  return { ...row, versions, history };
}
export async function saveJourney(
  actor: string,
  value: z.infer<typeof journeyInput>,
  id?: string,
) {
  const input = journeyInput.parse(value);
  const { ws } = await assertEnvironment(
    actor,
    input.applicationId,
    input.environmentId,
    input.definition.startUrl,
  );
  if (id) await accessibleJourney(actor, id);
  return getDb().transaction(async (tx) => {
    let revision = 1;
    if (id) {
      const [old] = await tx
        .select()
        .from(journeys)
        .where(and(eq(journeys.id, id), eq(journeys.workspaceId, ws.id)))
        .for("update");
      if (
        !old ||
        old.applicationId !== input.applicationId ||
        old.environmentId !== input.environmentId
      )
        throw new AppError(
          409,
          "Journey application/environment cannot be changed. Create a separate journey.",
        );
      if (old.revision !== input.revision)
        throw new AppError(
          409,
          "Journey changed. Reload before saving a new version.",
        );
      revision = old.revision + 1;
    }
    const data = {
      workspaceId: ws.id,
      applicationId: input.applicationId,
      environmentId: input.environmentId,
      revision,
      definition: input.definition,
      updatedBy: actor,
      updatedAt: new Date(),
    };
    const [row] = id
      ? await tx
          .update(journeys)
          .set(data)
          .where(eq(journeys.id, id))
          .returning()
      : await tx.insert(journeys).values(data).returning();
    await tx.insert(journeyVersions).values({
      journeyId: row.id,
      revision,
      definition: input.definition,
      actorId: actor,
    });
    await tx.insert(activity).values({
      workspaceId: ws.id,
      actorId: actor,
      action: `Journey ${row.id} version ${revision} saved; historical scope retained.`,
    });
    return row;
  });
}
export async function listIdentities(actor: string) {
  const ws = await ownerWorkspace(actor);
  return getDb()
    .select({
      id: testIdentities.id,
      applicationId: testIdentities.applicationId,
      environmentId: testIdentities.environmentId,
      name: testIdentities.name,
      role: testIdentities.role,
      kind: testIdentities.kind,
      keyId: testIdentities.keyId,
      expiresAt: testIdentities.expiresAt,
      revokedAt: testIdentities.revokedAt,
    })
    .from(testIdentities)
    .where(eq(testIdentities.workspaceId, ws.id));
}
export async function createIdentity(
  actor: string,
  value: z.infer<typeof identityInput>,
) {
  const input = identityInput.parse(value);
  const { ws, env } = await assertEnvironment(
    actor,
    input.applicationId,
    input.environmentId,
    input.login?.url,
  );
  if (
    Date.parse(input.expiresAt) <= Date.now() ||
    Date.parse(input.expiresAt) > Date.now() + 30 * 86400000
  )
    throw new AppError(
      400,
      "Test identity expiry must be within the next 30 days.",
    );
  if (
    input.login &&
    (input.inputs[input.login.usernameRef] === undefined ||
      input.inputs[input.login.passwordRef] === undefined ||
      input.login.request.method !== "POST")
  )
    throw new AppError(
      400,
      "Login recipes require username/password references and an exact POST boundary.",
    );
  const origin = new URL(env.origin);
  if (
    input.session &&
    (input.session.origins.some((o) => o.origin !== env.origin) ||
      input.session.cookies.some(
        (c) =>
          c.domain !== origin.hostname ||
          c.path !== "/" ||
          (c.name.startsWith("__Host-") &&
            (!c.secure || origin.protocol !== "https:")),
      ))
  )
    throw new AppError(
      400,
      "Provision only host-scoped cookies and local storage for this exact environment. Domain-wide/sessionStorage/IndexedDB sessions are unsupported.",
    );
  const id = crypto.randomUUID();
  const scope = {
    id,
    workspaceId: ws.id,
    applicationId: input.applicationId,
    environmentId: input.environmentId,
    role: input.role,
  };
  const encrypted = seal(input, identityAad(scope));
  await getDb().transaction(async (tx) => {
    await tx.insert(testIdentities).values({
      ...scope,
      ...encrypted,
      name: input.name,
      kind: input.login
        ? "login-recipe"
        : input.session
          ? "provisioned-session"
          : "runtime-inputs",
      createdBy: actor,
      expiresAt: new Date(input.expiresAt),
    });
    await tx.insert(activity).values({
      workspaceId: ws.id,
      actorId: actor,
      action: `Dedicated test identity ${id} provisioned; secret values omitted.`,
    });
  });
  return { id, name: input.name, role: input.role, expiresAt: input.expiresAt };
}
export async function revokeIdentity(actor: string, id: string) {
  const ws = await ownerWorkspace(actor);
  const [row] = await getDb()
    .update(testIdentities)
    .set({ sealed: null, revokedAt: new Date() })
    .where(
      and(eq(testIdentities.id, id), eq(testIdentities.workspaceId, ws.id)),
    )
    .returning({ id: testIdentities.id });
  if (!row) throw new AppError(404, "Identity is unavailable.");
  await getDb()
    .insert(activity)
    .values({
      workspaceId: ws.id,
      actorId: actor,
      action: `Test identity ${id} revoked and encrypted material deleted. Offline backup copies require separate deletion.`,
    });
  return { revoked: true };
}
export async function loadIdentity(
  actor: string,
  id: string,
  applicationId: string,
  environmentId: string,
  role: string,
) {
  const ws = await ownerWorkspace(actor);
  const [row] = await getDb()
    .select()
    .from(testIdentities)
    .where(
      and(
        eq(testIdentities.id, id),
        eq(testIdentities.workspaceId, ws.id),
        eq(testIdentities.applicationId, applicationId),
        eq(testIdentities.environmentId, environmentId),
        eq(testIdentities.role, role),
      ),
    );
  if (
    !row ||
    !row.sealed ||
    row.revokedAt ||
    row.expiresAt.getTime() <= Date.now()
  )
    throw new AppError(409, "IDENTITY_UNAVAILABLE");
  return identityInput.parse(unseal(row.sealed, row.keyId, identityAad(row)));
}
export async function startJourney(
  actor: string,
  id: string,
  value: z.infer<typeof journeyRunInput>,
) {
  const input = journeyRunInput.parse(value),
    journey = await accessibleJourney(actor, id);
  if (input.revision !== journey.revision)
    throw new AppError(
      409,
      "Journey changed. Review the current version and action boundaries before replay.",
    );
  if (
    input.variationId &&
    !journey.definition.variations.some((v) => v.id === input.variationId)
  )
    throw new AppError(400, "Variation is unavailable.");
  if (journey.definition.access === "protected" && !input.identityId)
    throw new AppError(
      400,
      "Protected replay requires a dedicated configured test identity.",
    );
  if (input.identityId)
    await loadIdentity(
      actor,
      input.identityId,
      journey.applicationId,
      journey.environmentId,
      journey.definition.role,
    );
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${journey.workspaceId}))`,
    );
    const [existing] = await tx
      .select()
      .from(runs)
      .where(eq(runs.id, input.requestId));
    if (existing) {
      const [jr] = await tx
        .select()
        .from(journeyRuns)
        .where(eq(journeyRuns.runId, existing.id));
      if (
        existing.workspaceId !== journey.workspaceId ||
        jr?.journeyId !== id ||
        jr.revision !== input.revision ||
        jr.identityId !== (input.identityId ?? null) ||
        jr.variationId !== (input.variationId ?? null)
      )
        throw new AppError(
          409,
          "Run identifier already used for different scope.",
        );
      return existing;
    }
    const active = await tx
      .select()
      .from(runs)
      .where(
        and(
          eq(runs.workspaceId, journey.workspaceId),
          sql`${runs.status} in ('queued','running')`,
        ),
      );
    if (active.length >= 5)
      throw new AppError(
        429,
        "Five assessments are already active. Wait or cancel one.",
      );
    if (
      active.some(
        (r) =>
          r.environmentId === journey.environmentId && r.mode === "journey",
      )
    )
      throw new AppError(
        409,
        "A journey is already active in this environment. Run test data changes separately or configure an isolated environment.",
      );
    if (input.identityId) {
      const busy = await tx
        .select()
        .from(journeyRuns)
        .innerJoin(runs, eq(runs.id, journeyRuns.runId))
        .where(
          and(
            eq(journeyRuns.identityId, input.identityId),
            sql`${runs.status} in ('queued','running')`,
          ),
        );
      if (busy.length)
        throw new AppError(
          409,
          "This test identity is already in use. Wait or provision a separate test account.",
        );
    } else if (
      journey.definition.grants.length &&
      active.some(
        (r) =>
          r.environmentId === journey.environmentId && r.mode === "journey",
      )
    )
      throw new AppError(
        409,
        "State-changing tests in this environment must run separately.",
      );
    const [run] = await tx
      .insert(runs)
      .values({
        id: input.requestId,
        workspaceId: journey.workspaceId,
        applicationId: journey.applicationId,
        environmentId: journey.environmentId,
        createdBy: actor,
        mode: "journey",
        status: "queued",
        context: {
          url: journey.definition.startUrl,
          title: "Page title omitted",
          state: journey.definition.name,
          role: journey.definition.role,
          authentication: "unknown",
          preconditions: journey.definition.preconditions,
          appVersion: journey.definition.appVersion,
          viewport: { width: 1440, height: 1000, deviceScale: 1 },
        },
      })
      .returning();
    await tx.insert(journeyRuns).values({
      runId: run.id,
      journeyId: id,
      revision: journey.revision,
      definition: journey.definition,
      identityId: input.identityId,
      variationId: input.variationId,
    });
    await tx
      .insert(outbox)
      .values({ runId: run.id, payload: { kind: "journey" } });
    return run;
  });
}
export async function journeyRunDetail(actor: string, id: string) {
  const run = await accessibleRun(actor, id);
  const [jr] = await getDb()
    .select()
    .from(journeyRuns)
    .where(eq(journeyRuns.runId, run.id));
  if (!jr) throw new AppError(404, "Journey run is unavailable.");
  const checkpoints = await Promise.all(
    (jr.report?.checkpoints ?? []).map(async (c) => ({
      ...c,
      assessment: await getRun(actor, c.runId),
    })),
  );
  return { ...run, ...jr, checkpoints };
}
export async function persistJourneyReport(id: string, report: JourneyReport) {
  await getDb().transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(runs)
      .where(eq(runs.id, id))
      .for("update");
    const [jr] = await tx
      .select()
      .from(journeyRuns)
      .where(eq(journeyRuns.runId, id));
    if (run?.cancelled) {
      report = {
        ...report,
        status: "cancelled",
        stop: {
          stepId:
            report.stop?.stepId ?? report.history.at(-1)?.stepId ?? "setup",
          code: "CANCELLED",
          recovery:
            "Reached evidence is preserved. Review test data before a new replay.",
        },
      };
    }
    if (jr?.retestId && report.status !== "running") {
      const [retest] = await tx
        .select()
        .from(retests)
        .where(eq(retests.id, jr.retestId));
      if (retest && retest.status !== "completed")
        await tx
          .update(retests)
          .set({
            status: "incomplete",
            assessment: {
              outcome: "inconclusive",
              reasons: [
                "Original journey checkpoint was not reassessed",
                report.stop?.code ?? "Missing target checkpoint",
              ],
              changes: [],
            },
          })
          .where(eq(retests.id, retest.id));
    }
    await tx
      .update(journeyRuns)
      .set({ report })
      .where(eq(journeyRuns.runId, id));
    await tx
      .update(runs)
      .set({
        status: report.status === "incomplete" ? "partial" : report.status,
        error: report.stop
          ? `${report.stop.code}: ${report.stop.recovery}`
          : null,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, id));
  });
}
