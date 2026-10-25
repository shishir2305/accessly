import {
  journeyInput,
  journeyRunInput,
  identityInput,
} from "../../../../../../../packages/contracts/src/journeys";
import {
  listJourneys,
  journeyDetail,
  saveJourney,
  startJourney,
  listIdentities,
  createIdentity,
  revokeIdentity,
  journeyRunDetail,
} from "../../../../../../../packages/database/src/journeys";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applicationInput,
  scanSchema,
  workerInput,
  evidenceInput,
  findingEdit,
  reproductionInput,
  retestInput,
  verificationInput,
  savedViewInput,
  settingsInput,
  feedbackInput,
  findingFilters,
} from "@accessly/contracts";
import { getDb, runs, extensionSessions, eq, and } from "@accessly/database";
import {
  AppError,
  listApps,
  createApp,
  listRuns,
  getRun,
  saveScan,
  queueRun,
  accessibleRun,
  uploadEvidence,
  evidenceAccess,
  grantExtension,
  exchangeExtension,
  hash,
} from "../../../../../../../packages/database/src/service";
import {
  findingDetail,
  editFinding,
  addAttempt,
  startRetest,
  listRetests,
  getRetest,
  recordVerification,
  listFindings,
  compareRuns,
  manageViews,
  settings,
  feedback,
} from "../../../../../../../packages/database/src/mvp";
import { authenticate, body, limited } from "../../../../lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = z.uuid();
function headers(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = [
    process.env.WEB_ORIGIN,
    `chrome-extension://${process.env.EXTENSION_ID}`,
  ];
  return {
    "Cache-Control": "no-store",
    ...(origin && allowed.includes(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          Vary: "Origin",
        }
      : {}),
  };
}
export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: headers(request) });
}
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const h = headers(request);
  try {
    const path = (await context.params).path;
    const method = request.method;
    let result: unknown;
    if (path.join("/") === "health" && method === "GET")
      return NextResponse.json({ status: "ok", phase: 3 }, { headers: h });
    if (path.join("/") === "extension/exchange" && method === "POST") {
      const input = z
        .object({
          code: z.string().min(40).max(100),
          verifier: z.string().min(43).max(128),
        })
        .parse(await body(request, 2000));
      await limited(`exchange:${hash(input.code)}`, 8);
      result = await exchangeExtension(input.code, input.verifier);
      return NextResponse.json(result, { headers: h });
    }
    const actor = await authenticate(request);
    await limited(actor, 180);
    if (path[0] === "applications" && path.length === 1) {
      if (method === "GET") result = await listApps(actor);
      else if (method === "POST")
        result = await createApp(
          actor,
          applicationInput.parse(await body(request, 20000)),
        );
    }
    if (path[0] === "runs") {
      if (path.length === 1 && method === "GET") result = await listRuns(actor);
      if (path.length === 1 && method === "POST") {
        await limited(`scan:${actor}`, 20);
        const scan = scanSchema.parse(await body(request));
        if (scan.mode !== "extension")
          throw new AppError(
            403,
            "Only extension results can be submitted through this endpoint.",
          );
        result = await saveScan(actor, scan);
      }
      if (path[1] === "public" && method === "POST") {
        await limited(`scan:${actor}`, 20);
        const input = workerInput.parse(await body(request, 20000));
        const fixture = process.env.WORKER_FIXTURE_ORIGIN;
        if (
          new URL(input.url).hostname === "localhost" ||
          /^127\./.test(new URL(input.url).hostname)
        ) {
          if (!fixture || new URL(input.url).origin !== fixture)
            throw new AppError(
              400,
              "Private/local applications must be scanned through the extension.",
            );
        }
        result = await queueRun(actor, input);
      }
      if (path.length === 2 && path[1] !== "public" && method === "GET")
        result = await getRun(actor, uuid.parse(path[1]));
      if (path[2] === "cancel" && method === "POST") {
        const r = await accessibleRun(actor, uuid.parse(path[1]));
        if (["queued", "running"].includes(r.status))
          await getDb()
            .update(runs)
            .set({
              cancelled: true,
              status: "cancelled",
              updatedAt: new Date(),
            })
            .where(eq(runs.id, r.id));
        result = { cancelled: true };
      }
      if (path[2] === "retry" && method === "POST") {
        const r = await accessibleRun(actor, uuid.parse(path[1]));
        if (r.mode === "journey" || r.result?.journey)
          throw new AppError(
            400,
            "Review the journey version and start a new replay from its workspace. Checkpoints cannot resume side effects automatically.",
          );
        if (r.mode !== "worker")
          throw new AppError(400, "Use the extension to retry a tab scan.");
        result = await queueRun(actor, {
          applicationId: r.applicationId,
          environmentId: r.environmentId,
          url: r.context.url,
          state: r.context.state,
          screenshot: false,
          excludeSelectors: r.result?.exclusions ?? [],
        });
      }
      if (path[2] === "evidence" && method === "POST")
        result = await uploadEvidence(
          actor,
          uuid.parse(path[1]),
          evidenceInput.parse(await body(request)),
        );
    }
    if (
      path[0] === "evidence" &&
      path.length === 2 &&
      (method === "GET" || method === "DELETE")
    )
      result = await evidenceAccess(
        actor,
        uuid.parse(path[1]),
        method === "DELETE",
      );

    if (path[0] === "journeys") {
      if (path.length === 1 && method === "GET")
        result = await listJourneys(actor);
      if (path.length === 1 && method === "POST")
        result = await saveJourney(
          actor,
          journeyInput.parse(await body(request, 100000)),
        );
      if (path.length === 2 && method === "GET")
        result = await journeyDetail(actor, uuid.parse(path[1]));
      if (path.length === 2 && method === "POST")
        result = await saveJourney(
          actor,
          journeyInput.parse(await body(request, 100000)),
          uuid.parse(path[1]),
        );
      if (path.length === 3 && path[2] === "runs" && method === "POST") {
        await limited(`scan:${actor}`, 20);
        result = await startJourney(
          actor,
          uuid.parse(path[1]),
          journeyRunInput.parse(await body(request, 3000)),
        );
      }
    }
    if (path[0] === "journey-runs" && path.length === 2 && method === "GET")
      result = await journeyRunDetail(actor, uuid.parse(path[1]));
    if (path[0] === "test-identities") {
      if (path.length === 1 && method === "GET")
        result = await listIdentities(actor);
      if (path.length === 1 && method === "POST") {
        if (request.headers.get("authorization")?.startsWith("Bearer ax_"))
          throw new AppError(
            403,
            "Provision secrets through the signed-in web account.",
          );
        result = await createIdentity(
          actor,
          identityInput.parse(await body(request, 100000)),
        );
      }
      if (path.length === 2 && method === "DELETE")
        result = await revokeIdentity(actor, uuid.parse(path[1]));
    }
    const query = new URL(request.url).searchParams;
    if (path[0] === "findings") {
      if (path.length === 1 && method === "GET")
        result = await listFindings(
          actor,
          findingFilters.parse(Object.fromEntries(query)),
        );
      if (path.length === 2) {
        const id = uuid.parse(path[1]);
        if (method === "GET") result = await findingDetail(actor, id);
        if (method === "POST")
          result = await editFinding(
            actor,
            id,
            findingEdit.parse(await body(request, 30000)),
          );
      }
      if (path.length === 3 && method === "POST") {
        const id = uuid.parse(path[1]);
        if (path[2] === "attempts")
          result = await addAttempt(
            actor,
            id,
            reproductionInput.parse(await body(request, 15000)),
          );
        if (path[2] === "retests") {
          await limited(`scan:${actor}`, 20);
          result = await startRetest(
            actor,
            id,
            retestInput.parse(await body(request, 3000)),
          );
        }
        if (path[2] === "verifications")
          result = await recordVerification(
            actor,
            id,
            verificationInput.parse(await body(request, 25000)),
          );
      }
    }
    if (path[0] === "retests" && method === "GET") {
      if (path.length === 1) result = await listRetests(actor);
      if (path.length === 2)
        result = await getRetest(actor, uuid.parse(path[1]));
    }
    if (
      path[0] === "runs" &&
      path.length === 3 &&
      path[2] === "compare" &&
      method === "GET"
    )
      result = await compareRuns(
        actor,
        uuid.parse(path[1]),
        uuid.parse(query.get("baseline")),
      );
    if (path[0] === "views") {
      if (path.length === 1 && method === "GET")
        result = await manageViews(actor, "list");
      if (path.length === 1 && method === "POST")
        result = await manageViews(
          actor,
          "create",
          savedViewInput.parse(await body(request, 3000)),
        );
      if (path.length === 2 && method === "DELETE")
        result = await manageViews(actor, "delete", {
          id: uuid.parse(path[1]),
        });
    }
    if (path.join("/") === "settings") {
      if (method === "GET") result = await settings(actor);
      if (method === "POST")
        result = await settings(
          actor,
          settingsInput.parse(await body(request, 4000)),
        );
    }
    if (path.join("/") === "feedback" && method === "POST")
      result = await feedback(
        actor,
        feedbackInput.parse(await body(request, 6000)),
      );
    if (path.join("/") === "extension/authorize" && method === "POST") {
      if (request.headers.get("authorization")?.startsWith("Bearer ax_"))
        throw new AppError(403, "Use the web account to connect an extension.");
      const input = z
        .object({
          challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          extensionId: z.literal(process.env.EXTENSION_ID!),
        })
        .parse(await body(request, 2000));
      result = { code: await grantExtension(actor, input.challenge) };
    }
    if (path.join("/") === "extension/session" && method === "DELETE") {
      const token = request.headers.get("authorization")!.slice(7);
      await getDb()
        .delete(extensionSessions)
        .where(
          and(
            eq(extensionSessions.tokenHash, hash(token)),
            eq(extensionSessions.ownerId, actor),
          ),
        );
      result = { disconnected: true };
    }
    if (result === undefined)
      throw new AppError(404, "Endpoint is unavailable.");
    return NextResponse.json(result, { headers: h });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: "Some values are invalid.",
          details: error.issues
            .map((i) => ({ path: i.path.join("."), message: i.message }))
            .slice(0, 8),
        },
        { status: 400, headers: h },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: h },
      );
    console.error(
      JSON.stringify({
        event: "api_error",
        code: "INTERNAL",
        requestId: crypto.randomUUID(),
      }),
    );
    return NextResponse.json(
      {
        error:
          "The service is temporarily unavailable. Check local services and retry.",
      },
      { status: 503, headers: h },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE };
