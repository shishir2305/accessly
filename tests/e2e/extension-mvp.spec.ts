import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { identity, app, call } from "./helpers";
test("authenticated packaged extension: remedy form, changed-role retest, correct-state verification form, recurrence", async ({
  request,
}) => {
  test.setTimeout(150000);
  const user = await identity(),
    application = await app(request, user.token);
  const directory = await mkdtemp(
      path.join(tmpdir(), "accessly-mvp-extension-"),
    ),
    extensionPath = path.join(directory, "extension");
  await cp("apps/extension/dist", extensionPath, { recursive: true });
  const manifest = JSON.parse(
    await readFile(path.join(extensionPath, "manifest.json"), "utf8"),
  );
  // Only the controlled fixture is added to the temporary headless harness. Real activeTab acceptance remains a human gate.
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
      viewport: { width: 1280, height: 720 },
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  );
  context.setDefaultTimeout(15000);
  try {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host,
      popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    const authPromise = context.waitForEvent("page");
    await popup
      .getByRole("button", { name: "Connect to Accessly", exact: true })
      .click();
    const auth = await authPromise;
    await auth.getByLabel("Email address").fill(user.email);
    await auth.getByLabel("Password", { exact: true }).fill(user.password);
    await auth.getByRole("button", { name: "Sign in →", exact: true }).click();
    await auth
      .getByRole("button", { name: "Connect to Accessly", exact: true })
      .click();
    await expect(
      popup.getByRole("heading", { name: "Assess the current page" }),
    ).toBeVisible();
    const target = await context.newPage(),
      url = `http://127.0.0.1:4174/mvp/protected/${crypto.randomUUID()}`;
    await target.goto(url);
    await target
      .getByLabel("Email", { exact: true })
      .fill("fixture@test.local");
    await target.getByLabel("Password", { exact: true }).fill("fixture-only");
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await target.goto(url);
    const options = {
      applicationId: application.id,
      environmentId: application.environments[0].id,
      state: "Profile settings",
      role: "customer",
      preconditions: "Sign in as customer, open Profile settings",
      authentication: "user-confirmed-signed-in",
      excludeSelectors: [],
      expectedProtected: true,
      appVersion: "v1",
    };
    async function assess(extra: object = {}) {
      await target.bringToFront();
      const result = await popup.evaluate(
        (options) => chrome.runtime.sendMessage({ type: "scan", options }),
        { ...options, ...extra },
      );
      expect(result.ok, result.error).toBe(true);
      await expect(
        popup.getByRole("heading", { name: "Review before uploading" }),
      ).toBeVisible();
      const state = await popup.evaluate(() =>
        chrome.storage.local.get<Record<string, any>>("pending"),
      );
      await popup
        .getByRole("button", { name: "Upload reviewed result" })
        .click();
      await expect(
        popup.getByRole("link", { name: "Open latest result in Accessly" }),
      ).toHaveAttribute(
        "href",
        `http://127.0.0.1:3000/runs/${state.pending.id}`,
      );
      const saved = await call(request, user.token, `runs/${state.pending.id}`);
      expect(saved.ok(), await saved.text()).toBe(true);
      return saved.json();
    }
    const source = await assess();
    const findingId = source.findings.find(
      (f: any) => f.rule === "button-name",
    ).id;
    const web = await context.newPage();
    await web.goto(`http://127.0.0.1:3000/findings/${findingId}`);
    await web
      .getByRole("combobox", { name: "Work state" })
      .selectOption("in-progress");
    await web
      .getByLabel("Remedy notes", { exact: true })
      .fill(
        "Controlled fixture: add Save profile accessible name and preserve the save action.",
      );
    await web.getByLabel("Version containing the remedy").fill("v2");
    await web
      .getByLabel("Expected accessible outcome")
      .fill("Save profile is named and activates the profile save action.");
    await web
      .getByLabel("Manual reproduction steps")
      .fill(
        "Sign into the fixture as customer\nOpen Profile settings\nLocate the save control",
      );
    await web
      .getByLabel("Reason for this change")
      .fill(
        "Local automated acceptance exercise; implement the scoped remedy.",
      );
    await web.getByRole("button", { name: "Save remediation details" }).focus();
    await web.keyboard.press("Enter");
    await expect(web.getByRole("status")).toContainText(
      "Remediation details saved",
    );
    await target
      .getByRole("button", { name: "Apply accessible name", exact: true })
      .click();
    await target
      .getByRole("button", { name: "Save profile", exact: true })
      .focus();
    await target.keyboard.press("Enter");
    await expect(target.getByRole("status")).toContainText("Profile saved.");
    async function requestRetest() {
      await web
        .getByRole("button", { name: "Request targeted retest" })
        .click();
      await expect(web.getByRole("status")).toContainText("Retest requested");
      const f = await (
        await call(request, user.token, `findings/${findingId}`)
      ).json();
      const r = f.retests[0];
      await expect(
        popup
          .getByLabel("Finding-specific retest")
          .locator(`option[value="${r.id}"]`),
      ).toBeAttached();
      await popup.getByLabel("Finding-specific retest").selectOption(r.id);
      await expect(
        popup.getByLabel("State label", { exact: true }),
      ).toHaveValue("Profile settings");
      await expect(
        popup.getByLabel("Application version", { exact: true }),
      ).toHaveValue("v2");
      return r;
    }
    let r = await requestRetest();
    await assess({ retestId: r.id, appVersion: "v2", role: "admin" });
    let f = await (
      await call(request, user.token, `findings/${findingId}`)
    ).json();
    expect(f.retests[0].assessment.outcome).toBe("inconclusive");
    expect(f.retests[0].assessment.reasons).toContain("Role changed");
    expect(f.workState).not.toBe("resolved");
    await web.getByRole("button", { name: "Refresh finding" }).click();
    r = await requestRetest();
    const passing = await assess({ retestId: r.id, appVersion: "v2" });
    expect(passing.result.targetObservation.outcome).toBe("pass");
    await web.getByRole("button", { name: "Refresh finding" }).click();
    await expect(
      web.getByLabel("Reassessment request").locator("option").first(),
    ).toContainText("passed");
    await web
      .getByLabel("Verification conditions")
      .fill(
        "Controlled local acceptance: same signed-in customer page, state and viewport; fixture v2.",
      );
    await web
      .getByLabel("Actual behavior observed")
      .fill(
        "The selected button-name check passed. Keyboard Enter activated Save profile and reported Profile saved.",
      );
    await web
      .getByLabel("Verification limitations")
      .fill(
        "Automated controlled fixture exercise; no human screen-reader acceptance or full conformance claim.",
      );
    await web.getByLabel("I confirmed the original application").check();
    await web.getByLabel("I confirmed element continuity").check();
    await web
      .getByLabel("The remedy preserves the required capability")
      .check();
    await web
      .getByLabel("This remedy requires adjacent behavior review")
      .check();
    await web.getByLabel("Adjacent behavior outcome").selectOption("passed");
    await web
      .getByLabel("Adjacent behavior evidence and conditions")
      .fill(
        "The Save profile button remained keyboard operable using Enter and updated the success status.",
      );
    const axe = await new AxeBuilder({ page: web })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      axe.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await web
      .getByRole("button", { name: "Record verification decision" })
      .focus();
    await web.keyboard.press("Enter");
    await expect(
      web.getByText("Work: resolved", { exact: true }),
    ).toBeVisible();
    f = await (await call(request, user.token, `findings/${findingId}`)).json();
    expect(f.verifications[0].resolved).toBe(true);
    expect(f.verifications[0].record.scope.authentication).toBe(
      "user-confirmed-signed-in",
    );
    expect(f.steps).toHaveLength(3);
    await web.bringToFront();
    await web.evaluate(() => window.scrollTo(0, 0));
    await web.screenshot({
      path: "artifacts/mvp-authenticated-verification.png",
      fullPage: true,
    });
    await web.setViewportSize({ width: 390, height: 844 });
    expect(
      await web.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await web.bringToFront();
    await web.evaluate(() => window.scrollTo(0, 0));
    await web.screenshot({ path: "artifacts/mvp-finding-mobile.png" });
    await web
      .getByRole("heading", { name: "Verification history" })
      .scrollIntoViewIfNeeded();
    await expect(
      web.getByRole("heading", { name: "Finding workspace", exact: true }),
    ).not.toBeInViewport();
    await web.screenshot({ path: "artifacts/mvp-verification-mobile.png" });
    await target
      .getByRole("button", { name: "Reintroduce missing name", exact: true })
      .click();
    await assess({ appVersion: "v2" });
    f = await (await call(request, user.token, `findings/${findingId}`)).json();
    expect(f.workState).toBe("reopened");
    expect(
      f.history.find((e: any) => e.kind === "reopened").detail.verificationId,
    ).toBe(f.lastVerificationId);
    expect(
      await target.evaluate(() => typeof (window as any).chrome?.storage),
    ).toBe("undefined");
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
