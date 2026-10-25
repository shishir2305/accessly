import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { scanSchema, type ApplicationInput } from "@accessly/contracts";
import { explain, fingerprint, requiresHumanReview } from "@accessly/domain";
import {
  journeyRuns,
  getDb,
  workspaces,
  applications,
  environments,
  runs,
  findings,
  occurrences,
  evidence,
  activity,
  outbox,
  extensionGrants,
  extensionSessions,
  and,
  eq,
  desc,
  lt,
  sql,
} from "./index";
import { AppError } from "./errors";
export { AppError } from "./errors";
import { acceptAssessment } from "./mvp";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function adminAuth() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function ownerWorkspace(ownerId: string) {
  const db = getDb();
  await db
    .insert(workspaces)
    .values({ ownerId, name: "My workspace" })
    .onConflictDoNothing();
  return (
    await db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId))
  )[0]!;
}
export async function listApps(ownerId: string) {
  const ws = await ownerWorkspace(ownerId);
  const db = getDb();
  const all = await db
    .select()
    .from(applications)
    .where(eq(applications.workspaceId, ws.id))
    .orderBy(desc(applications.createdAt));
  return Promise.all(
    all.map(async (a) => ({
      ...a,
      environments: await db
        .select()
        .from(environments)
        .where(eq(environments.applicationId, a.id)),
    })),
  );
}
export async function createApp(ownerId: string, input: ApplicationInput) {
  const ws = await ownerWorkspace(ownerId);
  return getDb().transaction(async (tx) => {
    const [app] = await tx
      .insert(applications)
      .values({ workspaceId: ws.id, name: input.name })
      .returning();
    const [env] = await tx
      .insert(environments)
      .values({
        applicationId: app.id,
        name: input.environment,
        origin: input.origin,
        pages: input.pages,
      })
      .returning();
    return { ...app, environments: [env] };
  });
}
export async function assertEnvironment(
  ownerId: string,
  applicationId: string,
  environmentId: string,
  url?: string,
) {
  const ws = await ownerWorkspace(ownerId);
  const [row] = await getDb()
    .select({ app: applications, env: environments })
    .from(applications)
    .innerJoin(environments, eq(environments.applicationId, applications.id))
    .where(
      and(
        eq(applications.workspaceId, ws.id),
        eq(applications.id, applicationId),
        eq(environments.id, environmentId),
      ),
    );
  if (!row)
    throw new AppError(404, "Application or environment is unavailable.");
  if (url && new URL(url).origin !== row.env.origin)
    throw new AppError(403, "This page is outside the permitted origin.");
  return { ...row, ws };
}
export async function accessibleRun(ownerId: string, id: string) {
  const ws = await ownerWorkspace(ownerId);
  const [run] = await getDb()
    .select()
    .from(runs)
    .where(and(eq(runs.id, id), eq(runs.workspaceId, ws.id)));
  if (!run) throw new AppError(404, "Run is unavailable.");
  return run;
}
export async function saveScan(ownerId: string, value: unknown) {
  const scan = scanSchema.parse(value);
  const { ws } = await assertEnvironment(
    ownerId,
    scan.applicationId,
    scan.environmentId,
    scan.context.url,
  );
  const db = getDb();
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(runs)
      .values({
        id: scan.clientScanId,
        workspaceId: ws.id,
        applicationId: scan.applicationId,
        environmentId: scan.environmentId,
        createdBy: ownerId,
        mode: scan.mode,
        status: scan.completion,
        context: scan.context,
        result: scan,
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) {
      const [existing] = await tx
        .select()
        .from(runs)
        .where(eq(runs.id, scan.clientScanId))
        .for("update");
      if (
        !existing ||
        existing.workspaceId !== ws.id ||
        existing.applicationId !== scan.applicationId ||
        existing.environmentId !== scan.environmentId ||
        existing.createdBy !== ownerId
      )
        throw new AppError(409, "Scan identifier already exists.");
      if (existing.result) {
        await acceptAssessment(tx, ownerId, existing.result);
        return existing;
      }
      if (existing.cancelled) return existing;
      await tx
        .update(runs)
        .set({ result: scan, status: scan.completion, updatedAt: new Date() })
        .where(eq(runs.id, scan.clientScanId));
    }
    for (const check of scan.checks.filter((c) =>
      ["violation", "incomplete"].includes(c.outcome),
    )) {
      for (const el of check.elements) {
        const fp = fingerprint(scan, check.rule, el.locator);
        const [f] = await tx
          .insert(findings)
          .values({
            workspaceId: ws.id,
            applicationId: scan.applicationId,
            environmentId: scan.environmentId,
            fingerprint: fp,
            originalRunId: scan.clientScanId,
            assessment:
              check.outcome === "incomplete" ? "suspected" : "confirmed",
            verificationRequirement: requiresHumanReview(
              check.rule,
              check.outcome,
            )
              ? "human-review"
              : "automated-with-context",
            rule: check.rule,
            locator: el.locator,
            outcome: check.outcome,
            check: { ...check, elements: [el] },
            context: scan.context,
          })
          .onConflictDoUpdate({
            target: findings.fingerprint,
            set: {
              lastSeen: new Date(),
            },
          })
          .returning();
        await tx
          .insert(occurrences)
          .values({ runId: scan.clientScanId, findingId: f.id, element: el })
          .onConflictDoNothing();
      }
    }
    if (scan.journey) {
      const [parent] = await tx
        .select()
        .from(runs)
        .where(
          and(eq(runs.id, scan.journey.runId), eq(runs.workspaceId, ws.id)),
        );
      const [journey] = await tx
        .select()
        .from(journeyRuns)
        .where(eq(journeyRuns.runId, scan.journey.runId))
        .for("update");
      if (
        !parent ||
        !journey ||
        scan.mode !== "worker" ||
        parent.createdBy !== ownerId ||
        parent.applicationId !== scan.applicationId ||
        parent.environmentId !== scan.environmentId ||
        journey.journeyId !== scan.journey.journeyId ||
        journey.revision !== scan.journey.revision
      )
        throw new AppError(
          403,
          "Checkpoint does not belong to this journey scope.",
        );
      if (
        journey.report &&
        !journey.report.checkpoints.some((c) => c.runId === scan.clientScanId)
      ) {
        await tx
          .update(journeyRuns)
          .set({
            report: {
              ...journey.report,
              checkpoints: [
                ...journey.report.checkpoints,
                {
                  stepId: scan.journey.stepId,
                  runId: scan.clientScanId,
                  state:
                    journey.definition.steps.find(
                      (s) =>
                        s.id === scan.journey!.stepId &&
                        s.action === "checkpoint",
                    )?.label ?? scan.context.state,
                  completion: scan.completion,
                },
              ],
            },
          })
          .where(eq(journeyRuns.runId, scan.journey.runId));
      }
    }
    await acceptAssessment(tx, ownerId, scan);
    await tx.insert(activity).values({
      workspaceId: ws.id,
      actorId: ownerId,
      runId: scan.clientScanId,
      action: "Scan result accepted; scope and original observation retained.",
    });
    return (
      await tx.select().from(runs).where(eq(runs.id, scan.clientScanId))
    )[0];
  });
}
export async function queueRun(
  ownerId: string,
  input: {
    applicationId: string;
    environmentId: string;
    url: string;
    state: string;
    screenshot: boolean;
    excludeSelectors: string[];
  },
) {
  const { ws } = await assertEnvironment(
    ownerId,
    input.applicationId,
    input.environmentId,
    input.url,
  );
  const id = crypto.randomUUID();
  const context = {
    url: input.url,
    title: "Page title omitted",
    state: input.state,
    role: "unknown",
    preconditions:
      "Public-page worker. No customer identity or session supplied.",
    authentication: "unknown" as const,
    viewport: { width: 1440, height: 1000, deviceScale: 1 },
    appVersion: "unknown",
  };
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ws.id}))`);
    const current = await tx
      .select({ id: runs.id })
      .from(runs)
      .where(
        and(
          eq(runs.workspaceId, ws.id),
          sql`${runs.status} in ('queued','running')`,
        ),
      );
    if (current.length >= 5)
      throw new AppError(
        429,
        "Five assessments are already queued or running. Wait or cancel one.",
      );
    const [r] = await tx
      .insert(runs)
      .values({
        id,
        workspaceId: ws.id,
        applicationId: input.applicationId,
        environmentId: input.environmentId,
        createdBy: ownerId,
        mode: "worker",
        status: "queued",
        evidenceState: input.screenshot ? "pending" : "none",
        context,
      })
      .returning();
    await tx
      .insert(outbox)
      .values({ runId: id, payload: { ...input, ownerId } });
    return r;
  });
}
export async function getRun(ownerId: string, id: string) {
  const run = await accessibleRun(ownerId, id);
  const [found, artifacts] = await Promise.all([
    getDb()
      .select({ finding: findings, element: occurrences.element })
      .from(occurrences)
      .innerJoin(findings, eq(findings.id, occurrences.findingId))
      .where(eq(occurrences.runId, id)),
    getDb().select().from(evidence).where(eq(evidence.runId, id)),
  ]);
  return {
    ...run,
    findings: found.map((r) => {
      const check =
        run.result?.checks.find(
          (c) =>
            c.rule === r.finding.rule &&
            c.elements.some((el) => el.locator === (r.element as any).locator),
        ) ?? r.finding.check;
      return {
        ...r.finding,
        outcome: check.outcome,
        context: run.context,
        check: { ...check, explanation: explain(check) },
        element: r.element,
      };
    }),
    evidence: artifacts.map(({ objectPath: _path, ...e }) => e),
  };
}
export async function listRuns(ownerId: string) {
  const ws = await ownerWorkspace(ownerId);
  return getDb()
    .select({
      id: runs.id,
      applicationId: runs.applicationId,
      status: runs.status,
      context: runs.context,
      mode: runs.mode,
      createdAt: runs.createdAt,
      error: runs.error,
    })
    .from(runs)
    .where(eq(runs.workspaceId, ws.id))
    .orderBy(desc(runs.createdAt))
    .limit(100);
}
export function pngDimensions(data: Buffer) {
  if (
    data.length > 5 * 1024 * 1024 ||
    data.length < 33 ||
    data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    data.subarray(12, 16).toString() !== "IHDR"
  )
    throw new AppError(400, "Evidence must be a PNG smaller than 5 MB.");
  const width = data.readUInt32BE(16),
    height = data.readUInt32BE(20);
  if (
    !width ||
    !height ||
    width > 10000 ||
    height > 10000 ||
    width * height > 32000000
  )
    throw new AppError(400, "Unsupported image dimensions.");
  return { width, height };
}
export async function uploadEvidence(
  ownerId: string,
  runId: string,
  input: {
    data: string;
    description: string;
    masked: boolean;
    width: number;
    height: number;
  },
) {
  const run = await accessibleRun(ownerId, runId);
  if (!run.result)
    throw new AppError(
      409,
      "A completed or partial assessment is required before evidence upload.",
    );
  const buffer = Buffer.from(input.data.split(",")[1] ?? "", "base64");
  const dims = pngDimensions(buffer);
  if (dims.width !== input.width || dims.height !== input.height)
    throw new AppError(400, "Evidence dimensions do not match the image.");
  const digest = createHash("sha256").update(buffer).digest("hex");
  // Commit the pending reference before network I/O so a crash leaves a cleanup target.
  const record = await getDb().transaction(async (tx) => {
    await tx.select().from(runs).where(eq(runs.id, runId)).for("update");
    const [existing] = await tx
      .select()
      .from(evidence)
      .where(eq(evidence.runId, runId));
    if (existing) {
      if (existing.status === "deleted")
        throw new AppError(
          409,
          "Evidence was deliberately deleted. Create a new assessment to attach new evidence.",
        );
      if (existing.digest !== digest)
        throw new AppError(
          409,
          "This run already has different screenshot evidence.",
        );
      return existing;
    }
    await tx
      .update(runs)
      .set({ evidenceState: "pending" })
      .where(eq(runs.id, runId));
    return (
      await tx
        .insert(evidence)
        .values({
          runId,
          workspaceId: run.workspaceId,
          objectPath: `${run.workspaceId}/${runId}/screenshot.png`,
          digest,
          description: input.description,
          masked: input.masked,
          width: dims.width,
          height: dims.height,
        })
        .returning()
    )[0];
  });
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(evidence)
      .where(eq(evidence.id, record.id))
      .for("update");
    if (current.status === "deleted")
      throw new AppError(
        409,
        "Evidence was deleted; it cannot be uploaded again.",
      );
    if (current.status === "ready") return { id: current.id };
    const { error } = await adminAuth()
      .storage.from("evidence")
      .upload(current.objectPath, buffer, {
        contentType: "image/png",
        upsert: true,
      });
    if (error)
      throw new AppError(
        503,
        "Evidence upload failed. The saved result is available; retry evidence separately.",
      );
    await tx
      .update(evidence)
      .set({ status: "ready" })
      .where(eq(evidence.id, current.id));
    await tx
      .update(runs)
      .set({ evidenceState: "ready", updatedAt: new Date() })
      .where(eq(runs.id, runId));
    return { id: current.id };
  });
}

export async function evidenceAccess(
  ownerId: string,
  id: string,
  remove = false,
) {
  const ws = await ownerWorkspace(ownerId);
  const [e] = await getDb()
    .select()
    .from(evidence)
    .where(and(eq(evidence.id, id), eq(evidence.workspaceId, ws.id)));
  if (!e) throw new AppError(404, "Evidence is unavailable.");
  const storage = adminAuth().storage.from("evidence");
  if (remove)
    return getDb().transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(evidence)
        .where(eq(evidence.id, id))
        .for("update");
      if (current.status === "deleted") return { deleted: true };
      const { error } = await storage.remove([current.objectPath]);
      if (error) throw new AppError(503, "Deletion could not complete; retry.");
      await tx
        .update(evidence)
        .set({ status: "deleted", deletedAt: new Date() })
        .where(eq(evidence.id, id));
      await tx
        .update(runs)
        .set({ evidenceState: "deleted" })
        .where(eq(runs.id, current.runId));
      await tx.insert(activity).values({
        workspaceId: ws.id,
        actorId: ownerId,
        runId: current.runId,
        action: "Screenshot evidence deleted. Historical finding retained.",
      });
      return { deleted: true };
    });
  if (e.status !== "ready")
    throw new AppError(410, "Evidence was removed or is not yet available.");
  const { data, error } = await storage.createSignedUrl(e.objectPath, 60);
  if (error) throw new AppError(503, "Evidence is temporarily unavailable.");
  return { url: data.signedUrl, expiresIn: 60 };
}
export async function grantExtension(ownerId: string, challenge: string) {
  const code = randomBytes(32).toString("base64url");
  await getDb()
    .insert(extensionGrants)
    .values({
      ownerId,
      codeHash: hash(code),
      challenge,
      expiresAt: new Date(Date.now() + 60000),
    });
  return code;
}
export async function exchangeExtension(code: string, verifier: string) {
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return getDb().transaction(async (tx) => {
    const [grant] = await tx
      .delete(extensionGrants)
      .where(
        and(
          eq(extensionGrants.codeHash, hash(code)),
          eq(extensionGrants.challenge, challenge),
          sql`${extensionGrants.expiresAt}>now()`,
        ),
      )
      .returning();
    if (!grant)
      throw new AppError(
        401,
        "Connection expired or could not be validated. Start again.",
      );
    const token = `ax_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + 8 * 3600000);
    await tx
      .insert(extensionSessions)
      .values({ ownerId: grant.ownerId, tokenHash: hash(token), expiresAt });
    return { token, expiresAt };
  });
}
export async function cleanup() {
  const db = getDb();
  await db
    .update(runs)
    .set({
      evidenceState: "failed",
      error:
        "Screenshot processing was interrupted. The accepted assessment remains available.",
    })
    .where(
      and(
        eq(runs.evidenceState, "pending"),
        sql`${runs.updatedAt}<now()-interval '5 minutes'`,
        sql`${runs.status} not in ('queued','running')`,
      ),
    );
  await db
    .delete(extensionGrants)
    .where(lt(extensionGrants.expiresAt, new Date()));
  await db
    .delete(extensionSessions)
    .where(lt(extensionSessions.expiresAt, new Date()));
  const stale = await db
    .select()
    .from(evidence)
    .where(
      and(
        sql`${evidence.status} in ('pending','failed')`,
        sql`${evidence.createdAt}<now()-interval '1 hour'`,
      ),
    );
  for (const e of stale) {
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, e.workspaceId));
    await evidenceAccess(ws.ownerId, e.id, true);
  }
}
