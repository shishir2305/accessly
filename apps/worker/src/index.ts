import { executeJourneyJob } from "./journey-job";
import { expireEvidence } from "../../../packages/database/src/mvp";
import { maskImage } from "./evidence";
import { Worker, Queue } from "bullmq";
import { Redis } from "ioredis";
import { chromium } from "playwright";
import { build } from "esbuild";
import {
  getDb,
  runs,
  outbox,
  testIdentities,
  eq,
  and,
  sql,
} from "@accessly/database";
import { scanSchema, workerInput } from "@accessly/contracts";
import {
  saveScan,
  uploadEvidence,
  cleanup,
} from "../../../packages/database/src/service";
import { startProxy, resolveTarget } from "./network";
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const queue = new Queue("assessments", { connection: redis });
let scannerSource = "";
async function scanner() {
  if (!scannerSource) {
    const bundled = await build({
      entryPoints: ["apps/extension/src/injected.ts"],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: "chrome120",
    });
    scannerSource = bundled.outputFiles![0].text;
  }
  return scannerSource;
}
export async function dispatch() {
  const pending = await getDb()
    .select()
    .from(outbox)
    .where(
      sql`${outbox.dispatchedAt} is null or ${outbox.dispatchedAt}<now()-interval '20 seconds'`,
    )
    .limit(30);
  for (const row of pending) {
    try {
      const [run] = await getDb()
        .select()
        .from(runs)
        .where(eq(runs.id, row.runId));
      if (
        !run ||
        run.cancelled ||
        run.result ||
        ["failed", "cancelled", "partial", "completed"].includes(run.status)
      ) {
        await getDb()
          .update(outbox)
          .set({ dispatchedAt: new Date() })
          .where(eq(outbox.runId, row.runId));
        continue;
      }
      const existing = await queue.getJob(row.runId);
      if (existing && (row.payload as any).kind === "journey") {
        const state = await existing.getState();
        if (
          ["failed", "completed"].includes(state) &&
          ["queued", "running"].includes(run.status)
        ) {
          if (run.status === "running") await executeJourneyJob(run.id, "");
          else
            await getDb()
              .update(runs)
              .set({
                status: "partial",
                error:
                  "QUEUE_INTERRUPTED: Review the journey and start a new run. No automatic action retry.",
              })
              .where(eq(runs.id, run.id));
          continue;
        }
      }
      if (existing) {
        await getDb()
          .update(outbox)
          .set({ dispatchedAt: new Date() })
          .where(eq(outbox.runId, row.runId));
        continue;
      }
      await queue.add(
        "scan",
        { runId: row.runId, ...(row.payload as object) },
        {
          jobId: row.runId,
          attempts: (row.payload as any).kind === "journey" ? 1 : 2,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      );
      await getDb()
        .update(outbox)
        .set({ dispatchedAt: new Date() })
        .where(eq(outbox.runId, row.runId));
    } catch {
      console.error(
        JSON.stringify({ event: "queue_dispatch_failed", runId: row.runId }),
      );
    }
  }
}
const worker = new Worker(
  "assessments",
  async (job) => {
    if (job.data.kind === "journey")
      return executeJourneyJob(job.data.runId as string, await scanner());
    const input = workerInput.parse(job.data);
    const runId = job.data.runId as string;
    const [run] = await getDb().select().from(runs).where(eq(runs.id, runId));
    if (!run || run.cancelled || run.result) return;
    await getDb()
      .update(runs)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(runs.id, runId));
    const fixture =
      process.env.WORKER_FIXTURE_ORIGIN &&
      new URL(input.url).origin === process.env.WORKER_FIXTURE_ORIGIN
        ? process.env.WORKER_FIXTURE_ORIGIN
        : undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    let proxy: Awaited<ReturnType<typeof startProxy>> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancellation: ReturnType<typeof setInterval> | undefined;
    try {
      await resolveTarget(new URL(input.url), fixture);
      proxy = await startProxy(fixture);
      browser = await chromium.launch({
        headless: true,
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            ([key, value]) =>
              [
                "PATH",
                "LANG",
                "LC_ALL",
                "TMPDIR",
                "SYSTEMROOT",
                "WINDIR",
              ].includes(key) && value !== undefined,
          ),
        ) as Record<string, string>,
        chromiumSandbox: process.platform === "linux",
        proxy: { server: proxy.url, bypass: "<-loopback>" },
        args: [
          "--disable-quic",
          "--disable-background-networking",
          "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
          "--disable-features=WebRtcHideLocalIpsWithMdns",
          "--js-flags=--max-old-space-size=256",
        ],
      });
      timer = setTimeout(() => void browser?.close(), 60000);
      cancellation = setInterval(() => {
        void getDb()
          .select({ cancelled: runs.cancelled })
          .from(runs)
          .where(eq(runs.id, runId))
          .then(([r]) => {
            if (r?.cancelled) void browser?.close();
          });
      }, 1000);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        serviceWorkers: "block",
        acceptDownloads: false,
        permissions: [],
        ignoreHTTPSErrors: false,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      let blockedRequests = 0;
      await page.routeWebSocket("**/*", (socket) => {
        blockedRequests++;
        socket.close();
      });
      await page.route("**/*", async (route) => {
        try {
          const request = route.request();
          if (!["GET", "HEAD"].includes(request.method())) {
            blockedRequests++;
            return route.abort("blockedbyclient");
          }
          await resolveTarget(new URL(request.url()), fixture);
          return route.continue();
        } catch {
          blockedRequests++;
          return route.abort("blockedbyclient");
        }
      });
      await page.goto(input.url, { waitUntil: "load", timeout: 25000 });
      let stable = true;
      await page
        .waitForLoadState("networkidle", { timeout: 5000 })
        .catch(() => {
          stable = false;
        });
      const reached = page.url();
      if (
        new URL(reached).origin !== new URL(input.url).origin ||
        /\/(login|sign-in|signin|auth)(\/|$)/i.test(new URL(reached).pathname)
      )
        throw new Error("ACCESS_CONTEXT_CHANGED");
      await page.addScriptTag({ content: await scanner() });
      const raw = await page.evaluate(
        async (payload) => {
          return (window as any).__accesslyScan(payload);
        },
        {
          clientScanId: runId,
          retestId: input.retestId,
          target: input.target,
          applicationId: input.applicationId,
          environmentId: input.environmentId,
          context: { ...run.context, url: reached },
          mode: "worker",
          excludeSelectors: input.excludeSelectors,
        },
      );
      const scan = scanSchema.parse(raw);
      if (!stable) {
        scan.completion = "partial";
        scan.limitations.push(
          "Network did not become idle within the readiness window. Late content may not be assessed.",
        );
      }
      if (blockedRequests) {
        scan.completion = "partial";
        scan.limitations.push(
          `${blockedRequests} network request(s) were blocked by assessment safety boundaries; associated content was not assessed.`,
        );
      }
      await saveScan(run.createdBy, scan);
      if (input.screenshot) {
        const masks = await page
          .locator(
            input.excludeSelectors.length
              ? input.excludeSelectors.join(",")
              : "[data-accessly-no-match]",
          )
          .all();
        if (page.url() !== reached) throw new Error("EVIDENCE_STATE_CHANGED");
        const fresh = () =>
          page.evaluate(
            () =>
              JSON.stringify((window as any).__accesslyEvidenceState?.()) ===
              JSON.stringify((window as any).__accesslyScanStamp),
          );
        if (!(await fresh())) throw new Error("EVIDENCE_STATE_CHANGED");
        if (masks.length > 1000) throw new Error("EVIDENCE_EXCLUSION_LIMIT");
        const boxes = (
          await Promise.all(masks.map((locator) => locator.boundingBox()))
        ).filter((box) => box !== null);
        const rawImage = await page.screenshot({
          type: "png",
          fullPage: false,
          caret: "initial",
          animations: "allow",
        });
        const image = await maskImage(rawImage, boxes);
        if (!(await fresh())) throw new Error("EVIDENCE_STATE_CHANGED");
        await uploadEvidence(run.createdBy, runId, {
          data: "data:image/png;base64," + image.toString("base64"),
          description: `Visible viewport of ${scan.context.state}. Page text may be sensitive. ${input.excludeSelectors.length} exclusion selector(s) masked.`,
          masked: input.excludeSelectors.length > 0,
          width: 1440,
          height: 1000,
        });
      }
      console.log(
        JSON.stringify({ event: "scan_saved", runId, status: scan.completion }),
      );
    } catch (error) {
      const [current] = await getDb()
        .select()
        .from(runs)
        .where(eq(runs.id, runId));
      if (current?.result) {
        await getDb()
          .update(runs)
          .set({
            evidenceState: "failed",
            error:
              "Screenshot could not be captured or uploaded. Assessment results are preserved.",
            updatedAt: new Date(),
          })
          .where(eq(runs.id, runId));
        return;
      }
      if (current?.cancelled) return;
      const code =
        error instanceof Error &&
        ["NETWORK_POLICY", "ACCESS_CONTEXT_CHANGED"].includes(error.message)
          ? error.message
          : "ASSESSMENT_INTERRUPTED";
      await getDb()
        .update(runs)
        .set({
          status:
            job.attemptsMade + 1 >= 2 || code !== "ASSESSMENT_INTERRUPTED"
              ? "failed"
              : "queued",
          error:
            code === "NETWORK_POLICY"
              ? "Network policy blocked a private, reserved, or unsupported address. Use the extension for private applications."
              : code === "ACCESS_CONTEXT_CHANGED"
                ? "The target redirected to another origin or sign-in state. This page was not assessed."
                : "Assessment interrupted by navigation, timeout, or browser failure. Retry after confirming readiness.",
          updatedAt: new Date(),
        })
        .where(and(eq(runs.id, runId), sql`${runs.cancelled}=false`));
      if (code === "ASSESSMENT_INTERRUPTED") throw new Error(code);
    } finally {
      if (timer) clearTimeout(timer);
      if (cancellation) clearInterval(cancellation);
      await browser?.close().catch(() => {});
      await proxy?.close();
    }
  },
  {
    connection: redis,
    concurrency: Math.max(
      1,
      Math.min(4, Number(process.env.WORKER_CONCURRENCY) || 2),
    ),
    lockDuration: 90000,
  },
);
worker.on("error", () =>
  console.error(
    JSON.stringify({ event: "worker_error", code: "QUEUE_CONNECTION" }),
  ),
);
worker.on("failed", (job) =>
  console.error(
    JSON.stringify({
      event: "job_attempt_failed",
      runId: job?.id,
      attempt: job?.attemptsMade,
    }),
  ),
);
let dispatching = false;
const timer = setInterval(() => {
  if (dispatching) return;
  dispatching = true;
  void dispatch()
    .catch(() =>
      console.error(JSON.stringify({ event: "outbox_recovery_failed" })),
    )
    .finally(() => {
      dispatching = false;
    });
}, 2000);
const cleanupTimer = setInterval(
  () =>
    void cleanup()
      .then(() => expireEvidence())
      .then(() =>
        getDb()
          .update(testIdentities)
          .set({ sealed: null })
          .where(
            sql`${testIdentities.expiresAt}<now() and ${testIdentities.sealed} is not null`,
          ),
      )
      .catch(() => {}),
  60000,
);
await dispatch();
console.log(
  "Accessly worker ready. Public network policy enforced; exact configured local fixture is the only exception.",
);
async function stop() {
  clearInterval(timer);
  clearInterval(cleanupTimer);
  await worker.close();
  await queue.close();
  await redis.quit();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
