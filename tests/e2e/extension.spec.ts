import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { identity, app, call } from "./helpers";
test("packaged extension connects interactively, scans a signed-in tab, survives popup closure, uploads once, and disconnects", async ({
  request,
}) => {
  const user = await identity(),
    application = await app(request, user.token);
  const directory = await mkdtemp(
    path.join(tmpdir(), "accessly-extension-test-"),
  );
  const extensionPath = path.join(directory, "extension");
  await cp("apps/extension/dist", extensionPath, { recursive: true });
  const manifest = JSON.parse(
    await readFile(path.join(extensionPath, "manifest.json"), "utf8"),
  );
  // Headless tests cannot click Chrome's toolbar to grant activeTab. The harness grants only the controlled fixture origin.
  manifest.host_permissions.push("http://127.0.0.1:4174/*");
  await writeFile(
    path.join(extensionPath, "manifest.json"),
    JSON.stringify(manifest),
  );
  const context = await chromium.launchPersistentContext(
    path.join(directory, "profile"),
    {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  );
  try {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    expect(id).toBe(process.env.EXTENSION_ID);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    const authPagePromise = context.waitForEvent("page");
    await popup
      .getByRole("button", { name: "Connect to Accessly", exact: true })
      .click();
    const authPage = await authPagePromise;
    await authPage.getByLabel("Email address").fill(user.email);
    await authPage.getByLabel("Password", { exact: true }).fill(user.password);
    await authPage
      .getByRole("button", { name: "Sign in →", exact: true })
      .click();
    await authPage
      .getByRole("button", { name: "Connect to Accessly", exact: true })
      .click();
    await expect(
      popup.getByRole("heading", { name: "Assess the current page" }),
    ).toBeVisible();
    const target = await context.newPage();
    await target.goto("http://127.0.0.1:4174/protected");
    await target
      .getByLabel("Email", { exact: true })
      .fill("fixture@test.local");
    await target.getByLabel("Password", { exact: true }).fill("fixture-only");
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await target.getByRole("button", { name: "Edit address" }).click();
    const options = {
      applicationId: application.id,
      environmentId: application.environments[0].id,
      state: "Address dialog open",
      role: "customer",
      preconditions: "Sign in, then open Edit address",
      authentication: "user-confirmed-signed-in",
      excludeSelectors: [".secret"],
      expectedProtected: true,
      appVersion: "test-fixture",
    };
    await target.bringToFront();
    const response = await popup.evaluate(
      (options) => chrome.runtime.sendMessage({ type: "scan", options }),
      options,
    );
    expect(response.ok, response.error).toBe(true);
    await popup.close();
    const recovered = await context.newPage();
    await recovered.goto(`chrome-extension://${id}/popup.html`);
    await expect(
      recovered.getByRole("heading", { name: "Review before uploading" }),
    ).toBeVisible();
    await expect(
      recovered.getByText("Address dialog open", { exact: true }),
    ).toBeVisible();
    const state = await recovered.evaluate(() =>
      chrome.storage.local.get<Record<string, any>>(["pending", "connection"]),
    );
    expect(state.pending.result.context.authentication).toBe(
      "user-confirmed-signed-in",
    );
    expect(JSON.stringify(state.pending.result)).not.toContain(
      "fixture-private-value-never-upload",
    );
    const ax = await new AxeBuilder({ page: recovered })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      ax.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await context.setOffline(true);
    await recovered
      .getByRole("button", { name: "Upload reviewed result" })
      .click();
    await expect(recovered.getByRole("alert")).toBeVisible();
    expect(
      (
        await recovered.evaluate(() =>
          chrome.storage.local.get<Record<string, any>>("pending"),
        )
      ).pending.status,
    ).toBe("retry");
    await context.setOffline(false);
    await expect(
      recovered.getByRole("link", { name: "Open latest result in Accessly" }),
    ).toBeVisible();
    const saved = await (
      await call(request, user.token, `runs/${state.pending.id}`)
    ).json();
    expect(saved.status).toMatch(/completed|partial/);
    expect(saved.context.state).toBe("Address dialog open");
    expect(saved.findings.some((f: any) => f.rule === "button-name")).toBe(
      true,
    );
    // The page never receives the connection token; storage is restricted to trusted extension contexts.
    expect(
      await target.evaluate(() => typeof (window as any).chrome?.storage),
    ).toBe("undefined");
    await target.goto("http://127.0.0.1:4174/login");
    await target.bringToFront();
    const wrong = await recovered.evaluate(
      (options) => chrome.runtime.sendMessage({ type: "scan", options }),
      options,
    );
    expect(wrong.ok).toBe(false);
    expect(wrong.error).toContain("sign-in page");
    await recovered
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await expect(
      recovered.getByRole("heading", { name: "Connect your workspace" }),
    ).toBeVisible();
    expect(
      (await call(request, state.connection.token, "applications")).status(),
    ).toBe(401);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
