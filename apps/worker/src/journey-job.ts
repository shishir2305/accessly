import {
  getDb,
  journeyRuns,
  journeys,
  runs,
  eq,
  and,
  sql,
} from "@accessly/database";
import {
  loadIdentity,
  persistJourneyReport,
} from "../../../packages/database/src/journeys";
import { saveScan } from "../../../packages/database/src/service";
import { replayJourney, JourneyStop } from "./journey-runner";
export async function executeJourneyJob(id: string, scannerSource: string) {
  const [run] = await getDb().select().from(runs).where(eq(runs.id, id));
  const [jr] = await getDb()
    .select()
    .from(journeyRuns)
    .where(eq(journeyRuns.runId, id));
  if (
    !run ||
    !jr ||
    run.cancelled ||
    !["queued", "running"].includes(run.status)
  )
    return;
  // A crashed job may have performed side effects. Preserve evidence and never resume/repeat it.
  if (jr.report) {
    if (jr.report.status !== "running") return;
    await persistJourneyReport(id, {
      ...jr.report,
      status: "incomplete",
      finishedAt: new Date().toISOString(),
      stop: {
        stepId: jr.report.history.at(-1)?.stepId ?? "setup",
        code: "WORKER_INTERRUPTED",
        recovery:
          "Worker restarted. Earlier checkpoints are preserved; review test data before starting a new run. Actions were not automatically repeated.",
      },
    });
    return;
  }
  const claimed = await getDb()
    .update(runs)
    .set({ status: "running", updatedAt: new Date() })
    .where(
      and(
        eq(runs.id, id),
        eq(runs.status, "queued"),
        sql`${runs.cancelled}=false`,
      ),
    )
    .returning();
  if (!claimed.length) {
    // A pre-report crash is still potentially consequential. Do not replay it.
    if (run.status === "running")
      await getDb()
        .update(runs)
        .set({
          status: "partial",
          error:
            "WORKER_INTERRUPTED: Start a new reviewed journey run; no automatic action retry.",
        })
        .where(eq(runs.id, id));
    return;
  }
  const identity = async () =>
    jr.identityId
      ? loadIdentity(
          run.createdBy,
          jr.identityId,
          run.applicationId,
          run.environmentId,
          jr.definition.role,
        )
      : undefined;
  let material;
  try {
    material = await identity();
  } catch {
    /* runner produces a visible blocked outcome */
  }
  await replayJourney({
    id,
    journeyId: jr.journeyId,
    revision: jr.revision,
    applicationId: run.applicationId,
    environmentId: run.environmentId,
    definition: jr.definition,
    retest:
      jr.retestId && jr.target ? { id: jr.retestId, ...jr.target } : undefined,
    identity: material,
    variationId: jr.variationId ?? undefined,
    fixtureOrigin: process.env.WORKER_FIXTURE_ORIGIN,
    scannerSource,
    isCancelled: async () => {
      const [r] = await getDb()
        .select({ cancelled: runs.cancelled })
        .from(runs)
        .where(eq(runs.id, id));
      return !r || r.cancelled;
    },
    validateScope: async () => {
      const [current] = await getDb()
        .select()
        .from(journeys)
        .where(
          and(
            eq(journeys.id, jr.journeyId),
            eq(journeys.workspaceId, run.workspaceId),
          ),
        );
      if (!current || current.revision !== jr.revision)
        throw new JourneyStop(
          "JOURNEY_VERSION_CHANGED",
          "The journey definition or action boundaries changed. Review and replay the current version; original findings remain historical and may require contextual human verification.",
        );
    },
    validateIdentity: async () => {
      if (jr.identityId) await identity();
    },
    onCheckpoint: async (scan) => {
      await saveScan(run.createdBy, scan);
    },
    onProgress: (report) => persistJourneyReport(id, report),
  });
}
