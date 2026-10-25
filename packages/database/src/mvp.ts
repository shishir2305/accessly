import { loadIdentity } from "./journeys";
import {
  findingFilters,
  type ScanResult,
  type FindingEdit,
  type VerificationInput,
  type ReproductionInput,
} from "@accessly/contracts";
import {
  assessTarget,
  canTransition,
  comparisonContext,
  explain,
  requiresHumanReview,
} from "@accessly/domain";
import {
  journeyRuns,
  getDb,
  findings,
  workspaces,
  runs,
  occurrences,
  findingEvents,
  reproductionAttempts,
  retests,
  verifications,
  savedViews,
  workspaceSettings,
  pilotFeedback,
  outbox,
  evidence,
  activity,
  eq,
  and,
  desc,
  sql,
} from "./index";
import { AppError } from "./errors";
type Executor = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update" | "delete" | "execute"
>;
export async function ownedWorkspace(actor: string) {
  const [ws] = await getDb()
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, actor));
  if (!ws) throw new AppError(404, "Workspace is unavailable.");
  return ws;
}
export async function ownedFinding(
  actor: string,
  id: string,
  db: Executor = getDb(),
) {
  const [row] = await db
    .select({ finding: findings })
    .from(findings)
    .innerJoin(workspaces, eq(findings.workspaceId, workspaces.id))
    .where(and(eq(findings.id, id), eq(workspaces.ownerId, actor)));
  if (!row) throw new AppError(404, "Finding is unavailable.");
  return row.finding;
}
async function ownedRun(actor: string, id: string) {
  const [row] = await getDb()
    .select({ run: runs })
    .from(runs)
    .innerJoin(workspaces, eq(runs.workspaceId, workspaces.id))
    .where(and(eq(runs.id, id), eq(workspaces.ownerId, actor)));
  if (!row) throw new AppError(404, "Run is unavailable.");
  return row.run;
}
function revision(current: number, expected: number) {
  if (current !== expected)
    throw new AppError(
      409,
      "This finding changed. Refresh it before saving your decision.",
    );
}
function event(
  db: Executor,
  f: typeof findings.$inferSelect,
  actor: string,
  kind: string,
  note: string,
  detail: object,
) {
  return db.insert(findingEvents).values({
    findingId: f.id,
    workspaceId: f.workspaceId,
    actorId: actor,
    kind,
    note,
    detail,
  });
}
export async function findingDetail(actor: string, id: string) {
  const f = await ownedFinding(actor, id);
  const db = getDb();
  const [observations, history, attempts, requests, decisions, feedback] =
    await Promise.all([
      db
        .select({ run: runs, element: occurrences.element })
        .from(occurrences)
        .innerJoin(runs, eq(occurrences.runId, runs.id))
        .where(eq(occurrences.findingId, id))
        .orderBy(desc(runs.createdAt)),
      db
        .select()
        .from(findingEvents)
        .where(eq(findingEvents.findingId, id))
        .orderBy(desc(findingEvents.createdAt)),
      db
        .select()
        .from(reproductionAttempts)
        .where(eq(reproductionAttempts.findingId, id))
        .orderBy(desc(reproductionAttempts.createdAt)),
      db
        .select()
        .from(retests)
        .where(eq(retests.findingId, id))
        .orderBy(desc(retests.createdAt)),
      db
        .select()
        .from(verifications)
        .where(eq(verifications.findingId, id))
        .orderBy(desc(verifications.createdAt)),
      db
        .select()
        .from(pilotFeedback)
        .where(eq(pilotFeedback.findingId, id))
        .orderBy(desc(pilotFeedback.createdAt)),
    ]);
  const execution = requests.length
    ? await db
        .select({ id: runs.id, status: runs.status, error: runs.error })
        .from(runs)
        .where(
          sql`${runs.id} in (select run_id from retests where finding_id=${id})`,
        )
    : [];
  return {
    ...f,
    originalJourney: observations.find((o) => o.run.id === f.originalRunId)?.run
      .result?.journey,
    explanation: explain(f.check),
    observations: observations.map((o) => ({
      id: o.run.id,
      status: o.run.status,
      context: o.run.context,
      createdAt: o.run.createdAt,
      element: o.element,
      mode: o.run.mode,
      journey: o.run.result?.journey,
    })),
    history,
    attempts,
    retests: requests.map((r) => ({
      ...r,
      executionStatus: execution.find((x) => x.id === r.runId)?.status,
      executionError: execution.find((x) => x.id === r.runId)?.error,
    })),
    verifications: decisions,
    feedback,
  };
}
export async function editFinding(
  actor: string,
  id: string,
  input: FindingEdit,
) {
  await ownedFinding(actor, id);
  return getDb().transaction(async (tx) => {
    const [f] = await tx
      .select()
      .from(findings)
      .where(eq(findings.id, id))
      .for("update");
    revision(f.revision, input.revision);
    const state = input.state ?? f.workState;
    if (!canTransition(f.workState, state))
      throw new AppError(
        409,
        "That lifecycle transition is not permitted. Resolution requires a verification record.",
      );
    const remedyNotes = input.remedyNotes ?? f.remedyNotes,
      remedyVersion = input.remedyVersion ?? f.remedyVersion;
    if (
      f.workState === "resolved" &&
      state === "resolved" &&
      (remedyNotes !== f.remedyNotes ||
        remedyVersion !== f.remedyVersion ||
        (input.assessment !== undefined && input.assessment !== f.assessment))
    )
      throw new AppError(
        409,
        "Move the finding into review before changing a verified remedy.",
      );
    if (
      state === "ready-for-verification" &&
      (!remedyNotes.trim() ||
        !remedyVersion.trim() ||
        remedyVersion === "unknown")
    )
      throw new AppError(
        400,
        "Record the remedy and the environment/application version containing it before verification.",
      );
    if (state === "verification-in-progress" && f.workState !== state)
      throw new AppError(
        400,
        "Start a finding-specific retest to begin verification.",
      );
    if (state === "closed-after-review" && !input.closureReason)
      throw new AppError(
        400,
        "A reviewed closure needs a specific false-positive, retirement, or applicability reason.",
      );
    const assessment =
      input.closureReason === "false-positive"
        ? "not-a-barrier"
        : (input.assessment ?? f.assessment);
    const [updated] = await tx
      .update(findings)
      .set({
        workState: state,
        assessment,
        remedyNotes,
        remedyVersion,
        steps: input.steps ?? f.steps,
        safeInputs: input.safeInputs ?? f.safeInputs,
        expectedOutcome: input.expectedOutcome ?? f.expectedOutcome,
        closureReason:
          state === "closed-after-review"
            ? (input.closureReason ?? f.closureReason)
            : null,
        revision: f.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(findings.id, id))
      .returning();
    await event(tx, f, actor, "edited", input.reason, {
      from: f.workState,
      to: state,
      assessment,
      closureReason: updated.closureReason,
      before: {
        remedyNotes: f.remedyNotes,
        remedyVersion: f.remedyVersion,
        steps: f.steps,
        safeInputs: f.safeInputs,
        expectedOutcome: f.expectedOutcome,
      },
      after: {
        remedyNotes,
        remedyVersion,
        steps: updated.steps,
        safeInputs: updated.safeInputs,
        expectedOutcome: updated.expectedOutcome,
      },
      context: f.context,
    });
    return updated;
  });
}
export async function addAttempt(
  actor: string,
  id: string,
  input: ReproductionInput,
) {
  const f = await ownedFinding(actor, id);
  if (input.context.url !== f.context.url)
    throw new AppError(
      400,
      "Record attempts against the finding page; describe blocked redirects in the notes.",
    );
  const [record] = await getDb()
    .insert(reproductionAttempts)
    .values({
      findingId: id,
      workspaceId: f.workspaceId,
      actorId: actor,
      ...input,
    })
    .returning();
  await event(getDb(), f, actor, "reproduction", input.notes, {
    attemptId: record.id,
    outcome: input.outcome,
    conditions: input.conditions,
    context: input.context,
  });
  return record;
}
export async function startRetest(
  actor: string,
  id: string,
  input: { revision: number; requestId: string; screenshot: boolean },
) {
  await ownedFinding(actor, id);
  return getDb().transaction(async (tx) => {
    const [f] = await tx
      .select()
      .from(findings)
      .where(eq(findings.id, id))
      .for("update");
    const [existing] = await tx
      .select()
      .from(retests)
      .where(eq(retests.id, input.requestId));
    if (existing) {
      if (existing.findingId !== id || existing.createdBy !== actor)
        throw new AppError(409, "Retest identifier already exists.");
      return existing;
    }
    revision(f.revision, input.revision);
    if (["resolved", "closed-after-review"].includes(f.workState))
      throw new AppError(
        409,
        "Review or reopen this finding before requesting remediation verification.",
      );
    if (
      !f.remedyNotes.trim() ||
      !f.remedyVersion.trim() ||
      f.remedyVersion === "unknown"
    )
      throw new AppError(
        400,
        "Record a remedy and application/environment version first.",
      );
    const originalId =
      f.originalRunId ??
      (
        await tx
          .select()
          .from(occurrences)
          .where(eq(occurrences.findingId, id))
          .limit(1)
      )[0]?.runId;
    const [baseline] = originalId
      ? await tx.select().from(runs).where(eq(runs.id, originalId))
      : [];
    if (!baseline?.result)
      throw new AppError(
        409,
        "The original assessment evidence is unavailable.",
      );
    const context = { ...baseline.context, appVersion: f.remedyVersion };
    const target = { rule: f.rule, locator: f.locator };
    let runId: string | undefined;
    let journeyRunId: string | undefined;
    if (baseline.result.journey) {
      const source = baseline.result.journey;
      const [original] = await tx
        .select()
        .from(journeyRuns)
        .where(eq(journeyRuns.runId, source.runId));
      const [parent] = await tx
        .select()
        .from(runs)
        .where(
          and(eq(runs.id, source.runId), eq(runs.workspaceId, f.workspaceId)),
        );
      if (!original || !parent)
        throw new AppError(
          409,
          "Original journey context is unavailable; use an appropriate recorded human review.",
        );
      if (input.screenshot)
        throw new AppError(
          400,
          "Journey screenshots/traces cannot honor all exclusions and are disabled.",
        );
      if (original.identityId)
        await loadIdentity(
          actor,
          original.identityId,
          f.applicationId,
          f.environmentId,
          original.definition.role,
        );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${f.workspaceId}))`,
      );
      const active = await tx
        .select()
        .from(runs)
        .where(
          and(
            eq(runs.workspaceId, f.workspaceId),
            sql`${runs.status} in ('queued','running')`,
          ),
        );
      if (
        active.length >= 5 ||
        active.some(
          (r) => r.environmentId === f.environmentId && r.mode === "journey",
        )
      )
        throw new AppError(
          409,
          "Wait for active journeys before replaying the original test context.",
        );
      journeyRunId = crypto.randomUUID();
      await tx.insert(runs).values({
        id: journeyRunId,
        workspaceId: f.workspaceId,
        applicationId: f.applicationId,
        environmentId: f.environmentId,
        createdBy: actor,
        mode: "journey",
        status: "queued",
        context: { ...parent.context, appVersion: f.remedyVersion },
      });
      await tx.insert(journeyRuns).values({
        runId: journeyRunId,
        journeyId: original.journeyId,
        revision: original.revision,
        definition: { ...original.definition, appVersion: f.remedyVersion },
        identityId: original.identityId,
        variationId: original.variationId,
        retestId: input.requestId,
        target: { ...target, stepId: source.stepId },
      });
      await tx
        .insert(outbox)
        .values({ runId: journeyRunId, payload: { kind: "journey" } });
    } else if (baseline.mode === "worker") {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${f.workspaceId}))`,
      );
      const active = await tx
        .select({ id: runs.id })
        .from(runs)
        .where(
          and(
            eq(runs.workspaceId, f.workspaceId),
            sql`${runs.status} in ('queued','running')`,
          ),
        );
      if (active.length >= 5)
        throw new AppError(
          429,
          "Five assessments are already queued or running.",
        );
      runId = crypto.randomUUID();
      await tx.insert(runs).values({
        id: runId,
        workspaceId: f.workspaceId,
        applicationId: f.applicationId,
        environmentId: f.environmentId,
        createdBy: actor,
        mode: "worker",
        status: "queued",
        context,
        evidenceState: input.screenshot ? "pending" : "none",
      });
      await tx.insert(outbox).values({
        runId,
        payload: {
          ownerId: actor,
          applicationId: f.applicationId,
          environmentId: f.environmentId,
          url: context.url,
          state: context.state,
          screenshot: input.screenshot,
          excludeSelectors: baseline.result.exclusions,
          retestId: input.requestId,
          target,
        },
      });
    }
    const [r] = await tx
      .insert(retests)
      .values({
        id: input.requestId,
        findingId: id,
        workspaceId: f.workspaceId,
        baselineRunId: baseline.id,
        journeyRunId,
        runId,
        createdBy: actor,
        mode: baseline.mode,
        context,
        target,
        remedyNotes: f.remedyNotes,
        remedyVersion: f.remedyVersion,
      })
      .returning();
    await tx
      .update(findings)
      .set({
        workState: "verification-in-progress",
        revision: f.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(findings.id, id));
    await event(
      tx,
      f,
      actor,
      "retest-requested",
      "A scoped reassessment was requested; no resolution is implied.",
      { retestId: r.id, runId, sourceRunId: baseline.id, context, target },
    );
    return r;
  });
}
export async function listRetests(actor: string) {
  const ws = await ownedWorkspace(actor);
  return getDb()
    .select({
      request: retests,
      title: findings.rule,
      applicationId: findings.applicationId,
      environmentId: findings.environmentId,
      exclusions: runs.result,
    })
    .from(retests)
    .innerJoin(findings, eq(retests.findingId, findings.id))
    .innerJoin(runs, eq(retests.baselineRunId, runs.id))
    .where(
      and(
        eq(retests.workspaceId, ws.id),
        eq(retests.status, "requested"),
        eq(retests.mode, "extension"),
      ),
    )
    .orderBy(desc(retests.createdAt))
    .limit(30)
    .then((rows) =>
      rows.map((r) => ({
        ...r.request,
        applicationId: r.applicationId,
        environmentId: r.environmentId,
        exclusions: r.exclusions?.exclusions ?? [],
        title: r.title,
      })),
    );
}
export async function getRetest(actor: string, id: string) {
  const ws = await ownedWorkspace(actor);
  const [r] = await getDb()
    .select()
    .from(retests)
    .where(and(eq(retests.id, id), eq(retests.workspaceId, ws.id)));
  if (!r) throw new AppError(404, "Retest is unavailable.");
  const f = await ownedFinding(actor, r.findingId);
  const baseline = await ownedRun(actor, r.baselineRunId);
  return {
    ...r,
    applicationId: f.applicationId,
    environmentId: f.environmentId,
    exclusions: baseline.result?.exclusions ?? [],
  };
}
// Runs and their retest linkage are accepted in the same transaction; retrying cannot lose the decision context.
export async function acceptAssessment(
  tx: Executor,
  actor: string,
  scan: ScanResult,
) {
  if (scan.retestId) {
    const [r] = await tx
      .select()
      .from(retests)
      .where(eq(retests.id, scan.retestId))
      .for("update");
    if (!r || r.createdBy !== actor)
      throw new AppError(404, "Retest is unavailable.");
    const [f] = await tx
      .select()
      .from(findings)
      .where(eq(findings.id, r.findingId));
    if (
      !f ||
      f.applicationId !== scan.applicationId ||
      f.environmentId !== scan.environmentId ||
      r.mode !== scan.mode
    )
      throw new AppError(
        403,
        "This result does not belong to the requested retest scope.",
      );
    if (r.runId && r.runId !== scan.clientScanId)
      throw new AppError(409, "This retest already belongs to another run.");
    if (r.status !== "completed") {
      const [baseline] = await tx
        .select()
        .from(runs)
        .where(eq(runs.id, r.baselineRunId));
      const assessment = assessTarget(baseline.result!, scan, r.target);
      if (Date.parse(scan.startedAt) < r.createdAt.getTime()) {
        assessment.outcome = "inconclusive";
        assessment.reasons.push("The scan predates the retest request");
      }
      await tx
        .update(retests)
        .set({ runId: scan.clientScanId, status: "completed", assessment })
        .where(eq(retests.id, r.id));
      await event(
        tx,
        f,
        actor,
        "retest-completed",
        "Reassessment evidence recorded. A verification decision is still required.",
        { retestId: r.id, runId: scan.clientScanId, ...assessment },
      );
    }
  }
  // Recurrence is evaluated against the accepted verification evidence, never mere absence in another run.
  const candidates = await tx
    .select()
    .from(findings)
    .where(
      and(
        eq(findings.applicationId, scan.applicationId),
        eq(findings.environmentId, scan.environmentId),
        eq(findings.workState, "resolved"),
      ),
    )
    .for("update");
  for (const f of candidates) {
    if (!f.lastVerificationId) continue;
    const [v] = await tx
      .select()
      .from(verifications)
      .where(eq(verifications.id, f.lastVerificationId));
    if (!v?.runId || Date.parse(scan.startedAt) <= v.createdAt.getTime())
      continue;
    const [verifiedRun] = await tx
      .select()
      .from(runs)
      .where(eq(runs.id, v.runId));
    if (!verifiedRun?.result) continue;
    const failure = scan.checks.some(
      (c) =>
        c.rule === f.rule &&
        c.outcome === "violation" &&
        c.elements.some((el) => el.locator === f.locator),
    );
    if (!failure) continue;
    const { blocking } = comparisonContext(verifiedRun.result, scan);
    if (
      v.method !== "automated-targeted" ||
      f.verificationRequirement === "human-review" ||
      requiresHumanReview(f.rule, f.check.outcome)
    )
      blocking.push("The accepted verification requires a fresh human review");
    if (blocking.length) {
      const prior = await tx
        .select({ id: findingEvents.id })
        .from(findingEvents)
        .where(
          and(
            eq(findingEvents.findingId, f.id),
            eq(findingEvents.kind, "recurrence-needs-review"),
            sql`${findingEvents.detail}->>'runId'=${scan.clientScanId}`,
          ),
        );
      if (!prior.length) {
        await tx
          .update(findings)
          .set({
            workState: "under-review",
            revision: f.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(findings.id, f.id));
        await event(
          tx,
          f,
          actor,
          "recurrence-needs-review",
          "A new failure needs review because its assessment context changed.",
          { runId: scan.clientScanId, reasons: blocking, verificationId: v.id },
        );
      }
      continue;
    }
    await tx
      .update(findings)
      .set({
        workState: "reopened",
        assessment: "confirmed",
        revision: f.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(findings.id, f.id));
    await event(
      tx,
      f,
      actor,
      "reopened",
      "Comparable automated evidence shows the verified barrier again.",
      {
        runId: scan.clientScanId,
        verificationId: v.id,
        previousVerificationRunId: v.runId,
      },
    );
  }
}
export async function recordVerification(
  actor: string,
  id: string,
  input: VerificationInput,
) {
  await ownedFinding(actor, id);
  return getDb().transaction(async (tx) => {
    const [f] = await tx
      .select()
      .from(findings)
      .where(eq(findings.id, id))
      .for("update");
    revision(f.revision, input.revision);
    if (["resolved", "closed-after-review"].includes(f.workState))
      throw new AppError(
        409,
        "This finding is already resolved or closed. Review it before another decision.",
      );
    const [r] = await tx
      .select()
      .from(retests)
      .where(and(eq(retests.id, input.retestId), eq(retests.findingId, id)))
      .for("update");
    if (!r) throw new AppError(404, "Retest is unavailable.");
    if (r.remedyVersion !== f.remedyVersion || r.remedyNotes !== f.remedyNotes)
      throw new AppError(
        409,
        "The remedy changed after this retest was requested. Request a new assessment.",
      );
    const reasons: string[] = [];
    let journeyAdjacentRequired = false;
    if (r.journeyRunId) {
      const [journey] = await tx
        .select()
        .from(journeyRuns)
        .where(eq(journeyRuns.runId, r.journeyRunId));
      journeyAdjacentRequired =
        journey?.report?.status !== "completed" ||
        !!journey?.report?.focus.some((f) => f.outcome === "differs");
      if (
        journey?.report?.focus.some((f) => f.outcome === "differs") &&
        input.method === "automated-targeted"
      )
        reasons.push(
          "Recorded focus differences require contextual human verification and adjacent behavior review",
        );
      if (
        journey?.report?.status !== "completed" &&
        input.method === "automated-targeted"
      )
        reasons.push(
          "The original journey did not complete; review blocked steps and relevant adjacent behavior before resolution",
        );
    }
    const manual = input.method !== "automated-targeted";
    const previous = await tx
      .select()
      .from(verifications)
      .where(eq(verifications.findingId, id))
      .orderBy(desc(verifications.createdAt));
    const adjacentRecord = previous.find(
      (v) =>
        (v.record as any).remedy?.version === f.remedyVersion &&
        (v.record as any).adjacentRequired,
    );
    const adjacentRequired =
      journeyAdjacentRequired ||
      input.adjacentRequired ||
      !!(
        adjacentRecord &&
        (adjacentRecord.record as any).adjacentOutcome !== "passed"
      );

    if (!input.contextConfirmed)
      reasons.push(
        "Original page, state, environment, and role require confirmation",
      );
    if (!input.identityConfirmed)
      reasons.push(
        "Element continuity or a reviewed replacement requires confirmation",
      );
    if (!input.capabilityPreserved)
      reasons.push("Preservation of required functionality is not confirmed");
    if (adjacentRequired && input.adjacentOutcome !== "passed")
      reasons.push(
        "Required adjacent behavior review is outstanding or failed",
      );
    if (adjacentRequired && !input.adjacentNotes.trim())
      reasons.push("Record adjacent behavior review conditions and evidence");
    if (f.assessment !== "confirmed")
      reasons.push(
        "Establish the original concern through review before resolution; use a reviewed closure for a false positive.",
      );
    if (!manual) {
      if (r.status !== "completed" || r.assessment?.outcome !== "passed")
        reasons.push(
          ...(r.assessment?.reasons ?? [
            "A comparable targeted passing assessment is required",
          ]),
        );
      if (
        r.assessment?.outcome &&
        r.assessment.outcome !== "passed" &&
        !reasons.length
      )
        reasons.push("Targeted assessment did not pass");
      if (
        f.verificationRequirement === "human-review" ||
        requiresHumanReview(f.rule, f.check.outcome)
      )
        reasons.push("The original concern requires human review");
    } else {
      if (
        !input.humanReviewComplete ||
        !input.reviewMethod.trim() ||
        !input.manualContext
      )
        reasons.push(
          "A completed human review, named method, and actual review context are required",
        );
      if (
        r.mode === "extension" &&
        (f.context.role === "unknown" || f.context.authentication === "unknown")
      )
        reasons.push(
          "Establish the original target role and authentication through review before resolution",
        );
      if (input.manualContext) {
        const c = input.manualContext,
          old = f.context;
        for (const key of [
          "url",
          "state",
          "role",
          "authentication",
          "viewport",
        ] as const)
          if (JSON.stringify(c[key]) !== JSON.stringify(old[key]))
            reasons.push(
              `Manual review ${key} differs from the original scope`,
            );
        if (c.appVersion !== f.remedyVersion)
          reasons.push(
            "Manual review version does not match the recorded remedy",
          );
      }
    }
    const resolved = input.outcome === "passed" && reasons.length === 0;
    const outcome = resolved
      ? "passed"
      : input.outcome === "passed"
        ? "needs-review"
        : input.outcome;
    const [v] = await tx
      .insert(verifications)
      .values({
        findingId: id,
        workspaceId: f.workspaceId,
        retestId: r.id,
        runId: r.runId,
        actorId: actor,
        method: input.method,
        outcome,
        resolved,
        record: {
          ...input,
          adjacentRequired,
          reasons,
          retestAssessment: r.assessment,
          remedy: { notes: f.remedyNotes, version: f.remedyVersion },
          scope: input.manualContext ?? r.context,
        },
      })
      .returning();
    const state = resolved
      ? "resolved"
      : input.outcome === "failed"
        ? "in-progress"
        : outcome === "needs-review"
          ? "under-review"
          : "ready-for-verification";
    await tx
      .update(findings)
      .set({
        workState: state,
        lastVerificationId: resolved ? v.id : f.lastVerificationId,
        revision: f.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(findings.id, id));
    await event(tx, f, actor, "verification", input.actualOutcome, {
      verificationId: v.id,
      retestId: r.id,
      runId: r.runId,
      method: input.method,
      outcome,
      resolved,
      reasons,
      from: f.workState,
      to: state,
    });
    return { ...v, reasons };
  });
}
export async function listFindings(actor: string, raw: unknown) {
  const ws = await ownedWorkspace(actor);
  const filter = findingFilters.parse(raw);
  const conditions = [eq(findings.workspaceId, ws.id)];
  if (filter.applicationId)
    conditions.push(eq(findings.applicationId, filter.applicationId));
  if (filter.state) conditions.push(eq(findings.workState, filter.state));
  if (filter.search)
    conditions.push(
      sql`(${findings.rule} ilike ${"%" + filter.search + "%"} or ${findings.context}->>'state' ilike ${"%" + filter.search + "%"})`,
    );
  if (filter.view === "open")
    conditions.push(
      sql`${findings.workState} not in ('resolved','closed-after-review')`,
    );
  if (filter.view === "awaiting-verification")
    conditions.push(
      sql`${findings.workState} in ('ready-for-verification','verification-in-progress')`,
    );
  if (["resolved", "closed-after-review"].includes(filter.view))
    conditions.push(eq(findings.workState, filter.view));
  const rows = await getDb()
    .select()
    .from(findings)
    .where(and(...conditions))
    .orderBy(desc(findings.updatedAt))
    .limit(200);
  const all = await getDb()
    .select({ state: findings.workState })
    .from(findings)
    .where(eq(findings.workspaceId, ws.id));
  return {
    items: rows,
    limit: 200,
    total: all.length,
    counts: {
      open: all.filter(
        (f) => !["resolved", "closed-after-review"].includes(f.state),
      ).length,
      awaitingVerification: all.filter((f) =>
        ["ready-for-verification", "verification-in-progress"].includes(
          f.state,
        ),
      ).length,
      resolved: all.filter((f) => f.state === "resolved").length,
      closedAfterReview: all.filter((f) => f.state === "closed-after-review")
        .length,
    },
  };
}
export async function compareRuns(
  actor: string,
  currentId: string,
  baselineId: string,
) {
  const [after, before] = await Promise.all([
    ownedRun(actor, currentId),
    ownedRun(actor, baselineId),
  ]);
  if (before.applicationId !== after.applicationId)
    throw new AppError(400, "Choose two runs of the same application.");
  if (!before.result)
    throw new AppError(400, "The baseline run has no assessment evidence.");
  const beforeRows = await getDb()
    .select({ finding: findings, element: occurrences.element })
    .from(occurrences)
    .innerJoin(findings, eq(occurrences.findingId, findings.id))
    .where(eq(occurrences.runId, before.id));
  const afterRows = await getDb()
    .select({ finding: findings, element: occurrences.element })
    .from(occurrences)
    .innerJoin(findings, eq(occurrences.findingId, findings.id))
    .where(eq(occurrences.runId, after.id));
  const comparison = after.result
    ? comparisonContext(before.result, after.result)
    : {
        blocking: ["The selected run did not produce assessment evidence"],
        changes: [],
      };
  const items = beforeRows.map(({ finding: f }) => {
    const observed = afterRows.some((r) => r.finding.id === f.id);
    const target = after.result
      ? assessTarget(before.result!, after.result, {
          rule: f.rule,
          locator: f.locator,
        })
      : null;
    return {
      id: f.id,
      rule: f.rule,
      title: f.check.help,
      category: observed
        ? "persistent"
        : target?.outcome === "passed"
          ? "selected-check-passed"
          : "not-assessed",
      reason: observed
        ? "Observed in both runs; context differences remain visible."
        : target?.outcome === "passed"
          ? "The original element passed the selected check. This is not a resolution decision."
          : target?.reasons.join("; ") ||
            "This occurrence was not explicitly reassessed; absence does not prove resolution.",
    };
  });
  for (const { finding: f } of afterRows)
    if (!beforeRows.some((r) => r.finding.id === f.id))
      items.push({
        id: f.id,
        rule: f.rule,
        title: f.check.help,
        category: "newly-observed",
        reason:
          "Newly observed in this comparison; introduction time is not established.",
      });
  return {
    baselineId,
    currentId,
    blocking: comparison.blocking,
    changes: comparison.changes,
    items,
  };
}
export async function manageViews(
  actor: string,
  action: "list" | "create" | "delete",
  input?: any,
) {
  const ws = await ownedWorkspace(actor);
  if (action === "list")
    return getDb()
      .select()
      .from(savedViews)
      .where(
        and(eq(savedViews.workspaceId, ws.id), eq(savedViews.ownerId, actor)),
      )
      .orderBy(desc(savedViews.createdAt));
  if (action === "delete") {
    await getDb()
      .delete(savedViews)
      .where(
        and(
          eq(savedViews.id, input.id),
          eq(savedViews.workspaceId, ws.id),
          eq(savedViews.ownerId, actor),
        ),
      );
    return { deleted: true };
  }
  const count = await getDb()
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(eq(savedViews.workspaceId, ws.id));
  if (count.length >= 30)
    throw new AppError(429, "This workspace already has 30 saved views.");
  return (
    await getDb()
      .insert(savedViews)
      .values({
        workspaceId: ws.id,
        ownerId: actor,
        name: input.name,
        filters: input.filters,
      })
      .returning()
  )[0];
}
export async function settings(
  actor: string,
  input?: { retentionDays: number | null; reason: string },
) {
  const ws = await ownedWorkspace(actor);
  if (input) {
    await getDb()
      .insert(workspaceSettings)
      .values({
        workspaceId: ws.id,
        retentionDays: input.retentionDays,
        updatedBy: actor,
      })
      .onConflictDoUpdate({
        target: workspaceSettings.workspaceId,
        set: {
          retentionDays: input.retentionDays,
          updatedBy: actor,
          updatedAt: new Date(),
        },
      });
    await getDb()
      .insert(activity)
      .values({
        workspaceId: ws.id,
        actorId: actor,
        action: `Evidence retention changed to ${input.retentionDays === null ? "manual deletion" : input.retentionDays + " days"}: ${input.reason}`,
      });
  }
  const [row] = await getDb()
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, ws.id));
  return {
    retentionDays: row?.retentionDays ?? null,
    limits: {
      concurrentWorkerRuns: 5,
      scanRequestsPerMinute: 20,
      evidenceBytes: 5 * 1024 * 1024,
      savedViews: 30,
    },
    backup:
      "Operator-created offline backups with integrity and isolated database restore checks are available via pnpm local:backup. Backups include credentials and private evidence; protect and delete them separately. No automatic encryption, off-machine backup, or recovery SLA is configured.",
  };
}
export async function feedback(
  actor: string,
  input: {
    findingId: string;
    usefulness: string;
    notes: string;
    activeMinutes: number | null;
  },
) {
  const f = await ownedFinding(actor, input.findingId);
  return (
    await getDb()
      .insert(pilotFeedback)
      .values({
        workspaceId: f.workspaceId,
        actorId: actor,
        ...input,
        activeMinutes:
          input.activeMinutes === null ? null : Math.round(input.activeMinutes),
      })
      .returning()
  )[0];
}
export async function expireEvidence() {
  const db = getDb();
  const candidates = await db
    .select({ image: evidence, policy: workspaceSettings })
    .from(evidence)
    .innerJoin(
      workspaceSettings,
      eq(evidence.workspaceId, workspaceSettings.workspaceId),
    )
    .where(
      and(
        eq(evidence.status, "ready"),
        sql`${workspaceSettings.retentionDays} is not null`,
        sql`${evidence.createdAt}<now()-(${workspaceSettings.retentionDays}*interval '1 day')`,
      ),
    )
    .limit(50);
  const { evidenceAccess } = await import("./service");
  for (const { image } of candidates) {
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, image.workspaceId));
    await evidenceAccess(ws.ownerId, image.id, true);
  }
}
