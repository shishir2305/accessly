import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { queueRun } from "../../packages/database/src/service";
import { getDb, outbox, eq, closeDb } from "../../packages/database/src";
import { identity, app, call, waitRun } from "./helpers";
test.afterAll(() => closeDb());
test("missing queue dispatch recovers from durable Postgres state and cancellation stays distinct", async ({
  request,
}) => {
  const owner = await identity(),
    application = await app(request, owner.token);
  const run = await queueRun(owner.id, {
    applicationId: application.id,
    environmentId: application.environments[0].id,
    url: "http://127.0.0.1:4174/correct",
    state: "Recovered dispatch",
    screenshot: false,
    excludeSelectors: [],
  });
  // Simulate a committed dispatch marker whose Redis job was lost.
  await getDb()
    .update(outbox)
    .set({ dispatchedAt: new Date(Date.now() - 60000) })
    .where(eq(outbox.runId, run.id));
  const recovered = await waitRun(request, owner.token, run.id);
  expect(recovered.status).toMatch(/completed|partial/);
  expect(recovered.result).toBeTruthy();
  const response = await call(request, owner.token, "runs/public", "POST", {
    applicationId: application.id,
    environmentId: application.environments[0].id,
    url: "http://127.0.0.1:4174/correct",
  });
  const queued = await response.json();
  expect(
    (await call(request, owner.token, `runs/${queued.id}/cancel`, "POST")).ok(),
  ).toBe(true);
  const cancelled = await waitRun(request, owner.token, queued.id);
  expect(cancelled.status).toBe("cancelled");
  expect(cancelled.result).toBeNull();
});
test("private subresources never reach internal services and remain a visible coverage gap", async ({
  request,
}) => {
  let hits = 0;
  const internal = createServer((_request, response) => {
    hits++;
    response.end("private");
  });
  await new Promise<void>((resolve) =>
    internal.listen(4175, "127.0.0.1", resolve),
  );
  try {
    const owner = await identity(),
      application = await app(request, owner.token);
    const response = await call(request, owner.token, "runs/public", "POST", {
      applicationId: application.id,
      environmentId: application.environments[0].id,
      url: "http://127.0.0.1:4174/private-resource",
    });
    const run = await waitRun(request, owner.token, (await response.json()).id);
    expect(hits).toBe(0);
    expect(run.status).toBe("partial");
    expect(run.result.limitations.join(" ")).toContain(
      "network request(s) were blocked",
    );
  } finally {
    await new Promise<void>((resolve) => internal.close(() => resolve()));
  }
});
