import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { identity, app, call, waitRun, signIn } from "./helpers";
test("public-page assessment, evidence isolation, deletion, idempotency, and protected boundaries", async ({
  page,
  request,
}) => {
  const owner = await identity(),
    other = await identity(),
    application = await app(request, owner.token);
  const environmentId = application.environments[0].id;
  const queued = await call(request, owner.token, "runs/public", "POST", {
    applicationId: application.id,
    environmentId,
    url: "http://127.0.0.1:4174/public",
    state: "Public initial page",
    screenshot: true,
    excludeSelectors: [".secret"],
  });
  expect(queued.ok()).toBe(true);
  let run = await waitRun(request, owner.token, (await queued.json()).id);
  await expect
    .poll(async () => {
      run = await (await call(request, owner.token, `runs/${run.id}`)).json();
      return run.evidenceState;
    })
    .toBe("ready");
  expect(run.status).toMatch(/completed|partial/);
  expect(run.findings.some((f: any) => f.rule === "button-name")).toBe(true);
  expect(run.evidence.some((e: any) => e.status === "ready")).toBe(true);
  expect((await call(request, other.token, `runs/${run.id}`)).status()).toBe(
    404,
  );
  const e = run.evidence.find((e: any) => e.status === "ready");
  expect((await call(request, other.token, `evidence/${e.id}`)).status()).toBe(
    404,
  );
  const link = await (
    await call(request, owner.token, `evidence/${e.id}`)
  ).json();
  expect(link.expiresIn).toBe(60);
  expect((await request.get(link.url)).ok()).toBe(true);
  await signIn(page, owner);
  await page.goto(`/runs/${run.id}`);
  await expect(
    page.getByRole("heading", { name: "Public initial page" }),
  ).toBeVisible();
  await page
    .getByText("Buttons must have discernible text", { exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Rule-based remedy guidance" }).first(),
  ).toBeVisible();
  const accessible = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    accessible.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/phase1-results.png",
    fullPage: true,
  });
  expect(
    (await call(request, owner.token, `evidence/${e.id}`, "DELETE")).ok(),
  ).toBe(true);
  expect((await call(request, owner.token, `evidence/${e.id}`)).status()).toBe(
    410,
  );
  const retained = await (
    await call(request, owner.token, `runs/${run.id}`)
  ).json();
  expect(retained.findings.length).toBe(run.findings.length);
  expect((await request.get(link.url)).status()).toBeGreaterThanOrEqual(400);
  const secret = JSON.stringify(run);
  expect(secret).not.toContain("fixture-private-value-never-upload");
  expect(secret).not.toContain("objectPath");
  const blocked = await call(request, owner.token, "runs/public", "POST", {
    applicationId: application.id,
    environmentId,
    url: "http://127.0.0.1:4174/redirect-private",
  });
  const blockedRun = await waitRun(
    request,
    owner.token,
    (await blocked.json()).id,
  );
  expect(blockedRun.status).toBe("failed");
  expect(blockedRun.result).toBeNull();
  const protectedResponse = await call(
    request,
    owner.token,
    "runs/public",
    "POST",
    {
      applicationId: application.id,
      environmentId,
      url: "http://127.0.0.1:4174/protected",
    },
  );
  const protectedRun = await waitRun(
    request,
    owner.token,
    (await protectedResponse.json()).id,
  );
  expect(protectedRun.status).toBe("failed");
  expect(protectedRun.error).toContain("sign-in");
  const correct = await call(request, owner.token, "runs/public", "POST", {
    applicationId: application.id,
    environmentId,
    url: "http://127.0.0.1:4174/correct",
  });
  const correctRun = await waitRun(
    request,
    owner.token,
    (await correct.json()).id,
  );
  expect(
    correctRun.findings.filter((f: any) => f.outcome === "violation"),
  ).toEqual([]);
});
test("PKCE connection grants are single-use, challenge-bound, and revocable", async ({
  request,
}) => {
  const user = await identity();
  const verifier = crypto.randomUUID() + crypto.randomUUID(),
    challenge = createHash("sha256").update(verifier).digest("base64url");
  const response = await call(
    request,
    user.token,
    "extension/authorize",
    "POST",
    { challenge, extensionId: process.env.EXTENSION_ID },
  );
  expect(response.ok()).toBe(true);
  const { code } = await response.json();
  const bad = await request.post("/api/v1/extension/exchange", {
    data: { code, verifier: "x".repeat(64) },
  });
  expect(bad.status()).toBe(401);
  const good = await request.post("/api/v1/extension/exchange", {
    data: { code, verifier },
  });
  expect(good.ok()).toBe(true);
  const connection = await good.json();
  expect(
    (
      await request.post("/api/v1/extension/exchange", {
        data: { code, verifier },
      })
    ).status(),
  ).toBe(401);
  expect((await call(request, connection.token, "applications")).ok()).toBe(
    true,
  );
  expect(
    (await call(request, connection.token, "extension/session", "DELETE")).ok(),
  ).toBe(true);
  expect((await call(request, connection.token, "applications")).status()).toBe(
    401,
  );
});
test("current signed-in state saves once and remains scoped across retries and roles", async ({
  page,
  request,
}) => {
  const owner = await identity(),
    application = await app(request, owner.token);
  await page.goto("http://127.0.0.1:4174/protected");
  await expect(
    page.getByRole("heading", { name: "Sign in to the fixture" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("test@fixture.local");
  await page.getByLabel("Password", { exact: true }).fill("test-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Edit address" }).click();
  const source = await build({
    entryPoints: ["apps/extension/src/injected.ts"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
  });
  await page.addScriptTag({ content: source.outputFiles![0].text });
  const result = await page.evaluate(
    async (input) => (window as any).__accesslyScan(input),
    {
      clientScanId: crypto.randomUUID(),
      applicationId: application.id,
      environmentId: application.environments[0].id,
      mode: "extension",
      context: {
        url: "http://127.0.0.1:4174/protected?token=private",
        title: "Page title omitted",
        state: "Address dialog open",
        role: "customer",
        preconditions: "Sign in and select Edit address",
        authentication: "user-confirmed-signed-in",
        appVersion: "fixture-v1",
        viewport: { width: 1280, height: 720, deviceScale: 1 },
      },
      excludeSelectors: [".secret"],
    },
  );
  expect(JSON.stringify(result)).not.toContain(
    "fixture-private-value-never-upload",
  );
  const first = await call(request, owner.token, "runs", "POST", result),
    retry = await call(request, owner.token, "runs", "POST", result);
  expect(first.ok()).toBe(true);
  expect(retry.ok()).toBe(true);
  expect((await first.json()).id).toBe((await retry.json()).id);
  const saved = await (
    await call(request, owner.token, `runs/${result.clientScanId}`)
  ).json();
  expect(saved.context.authentication).toBe("user-confirmed-signed-in");
  expect(saved.context.state).toBe("Address dialog open");
  expect(saved.findings.some((f: any) => f.rule === "button-name")).toBe(true);
  expect(saved.evidence).toEqual([]);
  const roleResult = {
    ...result,
    clientScanId: crypto.randomUUID(),
    context: { ...result.context, role: "admin" },
  };
  expect(
    (await call(request, owner.token, "runs", "POST", roleResult)).ok(),
  ).toBe(true);
  const second = await (
    await call(request, owner.token, `runs/${roleResult.clientScanId}`)
  ).json();
  expect(second.findings[0].id).not.toBe(saved.findings[0].id);
});
