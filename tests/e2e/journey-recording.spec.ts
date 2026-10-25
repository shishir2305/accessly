import { test, expect, chromium } from "@playwright/test";
import { randomBytes, createHash } from "node:crypto";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { identity, call } from "./helpers";
test("explicit recording survives popup closure and same-origin/SPA navigation, marks unsupported route inputs and omits all typed values, and ends at scope/expiry boundaries", async ({
  request,
}) => {
  const user = await identity();
  const verifier = randomBytes(32).toString("base64url"),
    challenge = createHash("sha256").update(verifier).digest("base64url");
  const extensionIdentity = JSON.parse(
    await readFile("apps/extension/identity.json", "utf8"),
  );
  const grant = await call(request, user.token, "extension/authorize", "POST", {
    challenge,
    extensionId: extensionIdentity.id,
  });
  expect(grant.ok()).toBe(true);
  const { code } = await grant.json();
  const exchange = await request.post(
    "http://127.0.0.1:3000/api/v1/extension/exchange",
    { data: { code, verifier } },
  );
  const connection = await exchange.json();
  const directory = await mkdtemp(
      path.join(tmpdir(), "accessly-journey-recording-"),
    ),
    extensionPath = path.join(directory, "extension");
  await cp("apps/extension/dist", extensionPath, { recursive: true });
  const manifest = JSON.parse(
    await readFile(path.join(extensionPath, "manifest.json"), "utf8"),
  );
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
    await worker.evaluate(
      (connection) => chrome.storage.local.set({ connection }),
      connection,
    );
    const id = new URL(worker.url()).host,
      popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    const target = await context.newPage();
    await target.goto("http://127.0.0.1:4174/login");
    await target.bringToFront();
    expect(
      await worker.evaluate(() => chrome.storage.local.get("recording")),
    ).toEqual({});
    let result = await popup.evaluate(() =>
      chrome.runtime.sendMessage({ type: "record-start" }),
    );
    expect(result.ok, result.error).toBe(true);
    await popup.close();
    await target
      .getByLabel("Email", { exact: true })
      .fill("PRIVATE-RECORDING@accessly.test");
    await target
      .getByLabel("Password", { exact: true })
      .fill("PRIVATE-RECORDING-PASSWORD");
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      target.getByRole("heading", { name: "Account settings" }),
    ).toBeVisible();
    await target.goto("http://127.0.0.1:4174/journey/good");
    await expect
      .poll(
        async () =>
          (
            await worker.evaluate(() =>
              chrome.storage.local.get<any>("recording"),
            )
          ).recording.steps.filter((s: any) => s.action === "navigate").length,
      )
      .toBeGreaterThanOrEqual(2);
    await target.getByRole("button", { name: "Edit address" }).click();
    await target.locator("#street").fill("PRIVATE-STREET-VALUE");
    await target.keyboard.press("Tab");
    await target.evaluate(() => history.pushState({}, "", "/journey/good/spa"));
    await expect
      .poll(async () =>
        (
          await worker.evaluate(() =>
            chrome.storage.local.get<any>("recording"),
          )
        ).recording.steps.some(
          (s: any) =>
            s.action === "navigate" && s.url.endsWith("/journey/good/spa"),
        ),
      )
      .toBe(true);
    await target.evaluate(() =>
      history.replaceState(
        {},
        "",
        "/journey/good?token=PRIVATE-RECORDING-ROUTE",
      ),
    );
    await expect
      .poll(async () =>
        (
          await worker.evaluate(() =>
            chrome.storage.local.get<any>("recording"),
          )
        ).recording.steps.some(
          (s: any) =>
            s.action === "unsupported" && s.reason.includes("Query/fragment"),
        ),
      )
      .toBe(true);

    const reopened = await context.newPage();
    await reopened.goto(`chrome-extension://${id}/popup.html`);
    result = await reopened.evaluate(() =>
      chrome.runtime.sendMessage({ type: "record-stop" }),
    );
    expect(result.ok).toBe(true);
    const draft = result.data;
    expect(draft.active).toBe(false);
    expect(draft.steps.some((s: any) => s.action === "input")).toBe(true);
    expect(draft.steps.some((s: any) => s.action === "key")).toBe(true);
    expect(JSON.stringify(draft)).not.toMatch(
      /PRIVATE-RECORDING|PRIVATE-STREET|fixture-private-value|password"\s*:/i,
    );
    const count = draft.steps.length;
    await target.locator("#street").fill("AFTER-STOP");
    expect(
      (await worker.evaluate(() => chrome.storage.local.get<any>("recording")))
        .recording.steps,
    ).toHaveLength(count);
    await reopened.getByText("Record a journey draft", { exact: true }).click();
    await expect(reopened.getByLabel("Reviewable draft steps")).toHaveValue(
      JSON.stringify(draft.steps, null, 2),
    );
    // Page JavaScript cannot send extension control messages or manufacture trusted recording events.
    await target.evaluate(() =>
      document
        .querySelector("#street")!
        .dispatchEvent(new Event("input", { bubbles: true })),
    );
    expect(
      (await worker.evaluate(() => chrome.storage.local.get<any>("recording")))
        .recording.steps,
    ).toHaveLength(count);
    await target.bringToFront();
    await reopened.evaluate(() =>
      chrome.runtime.sendMessage({ type: "record-start" }),
    );
    await worker.evaluate(async () => {
      const { recording } = await chrome.storage.local.get<any>("recording");
      await chrome.storage.local.set({
        recording: { ...recording, createdAt: Date.now() - 31 * 60000 },
      });
    });
    const expired = await reopened.evaluate(() =>
      chrome.runtime.sendMessage({ type: "record-status" }),
    );
    expect(expired.data.active).toBe(false);
    await target.bringToFront();
    await reopened.evaluate(() =>
      chrome.runtime.sendMessage({ type: "record-start" }),
    );
    await target.goto("http://127.0.0.1:3000/");
    await expect
      .poll(
        async () =>
          (
            await worker.evaluate(() =>
              chrome.storage.local.get<any>("recording"),
            )
          ).recording.active,
      )
      .toBe(false);
    await reopened.evaluate(() =>
      chrome.runtime.sendMessage({ type: "record-discard" }),
    );
    expect(
      await worker.evaluate(() => chrome.storage.local.get("recording")),
    ).toEqual({});
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
    await user.admin.auth.admin.deleteUser(user.id);
  }
});
