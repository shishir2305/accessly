import { test, expect, chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { identity, app, call, waitRun, signIn } from "./helpers";
import {
  definition,
  fixtureOrigin,
  byId,
  checkpoint,
  click,
  focus,
} from "../journey-data";
import {
  getDb,
  testIdentities,
  journeyRuns,
  runs,
  outbox,
  eq,
} from "@accessly/database";
async function create(request: any, token: string, application: any, d: any) {
  const response = await call(request, token, "journeys", "POST", {
    applicationId: application.id,
    environmentId: application.environments[0].id,
    definition: d,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function provision(
  request: any,
  token: string,
  application: any,
  role = "public",
  extra = {},
) {
  const response = await call(request, token, "test-identities", "POST", {
    applicationId: application.id,
    environmentId: application.environments[0].id,
    name: "Disposable local account",
    role,
    dedicatedTestIdentity: true,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    inputs: {
      invalidPostal: "PRIVATE-INVALID-POSTAL",
      username: "phase3-fixture@accessly.test",
      password: "PRIVATE-PHASE3-PASSWORD",
    },
    ...extra,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function start(request: any, token: string, j: any, extra = {}) {
  const response = await call(request, token, `journeys/${j.id}/runs`, "POST", {
    requestId: crypto.randomUUID(),
    revision: j.revision,
    ...extra,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function detail(request: any, token: string, id: string) {
  await waitRun(request, token, id);
  const response = await call(request, token, `journey-runs/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
test("public keyboard journey, checkpoints, variations, immutable versions and tenant-scoped results", async ({
  request,
  page,
}) => {
  const user = await identity(),
    other = await identity(),
    application = await app(request, user.token);
  try {
    for (const table of [
      "journeys",
      "journey_versions",
      "journey_runs",
      "test_identities",
    ]) {
      const direct = await request.get(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=*`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${user.token}`,
          },
        },
      );
      expect([401, 403]).toContain(direct.status());
    }
    const j = await create(request, user.token, application, definition());
    const configured = await provision(request, user.token, application);
    const run = await start(request, user.token, j, {
      identityId: configured.id,
    });
    const concurrent = await call(
      request,
      user.token,
      `journeys/${j.id}/runs`,
      "POST",
      {
        requestId: crypto.randomUUID(),
        revision: 1,
        identityId: configured.id,
      },
    );
    expect(concurrent.status()).toBe(409);
    const r = await detail(request, user.token, run.id);
    expect(r.report.stop, JSON.stringify(r.report)).toBeUndefined();
    expect(r.status).toBe("completed");
    expect(r.checkpoints).toHaveLength(6);
    expect(r.report.focus.every((f: any) => f.outcome === "matches")).toBe(
      true,
    );
    expect(
      r.report.variations.every((v: any) => v.status === "not-assessed"),
    ).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(
      /PRIVATE-INVALID-POSTAL|PRIVATE-PHASE3-PASSWORD/,
    );
    const branch = await start(request, user.token, j, {
      identityId: configured.id,
      variationId: "invalid-recovery",
    });
    const variation = await detail(request, user.token, branch.id);
    expect(variation.status, JSON.stringify(variation.report)).toBe(
      "completed",
    );
    expect(
      variation.report.variations.find((v: any) => v.id === "invalid-recovery")
        .status,
    ).toBe("assessed");
    for (const path of [
      `journeys/${j.id}`,
      `journey-runs/${run.id}`,
      `runs/${run.id}`,
      `runs/${r.checkpoints[0].runId}`,
    ])
      expect((await call(request, other.token, path)).status()).toBe(404);
    expect(
      await (await call(request, other.token, "test-identities")).json(),
    ).toEqual([]);
    expect(
      (
        await call(
          request,
          other.token,
          `test-identities/${configured.id}`,
          "DELETE",
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await call(request, other.token, `journeys/${j.id}/runs`, "POST", {
          requestId: crypto.randomUUID(),
          revision: 1,
        })
      ).status(),
    ).toBe(404);
    const edited = await call(request, user.token, `journeys/${j.id}`, "POST", {
      applicationId: application.id,
      environmentId: application.environments[0].id,
      revision: 1,
      definition: { ...j.definition, name: "Reviewed address journey" },
    });
    expect(edited.ok()).toBe(true);
    const stale = await call(
      request,
      user.token,
      `journeys/${j.id}/runs`,
      "POST",
      { requestId: crypto.randomUUID(), revision: 1 },
    );
    expect(stale.status()).toBe(409);
    const historical = await (
      await call(request, user.token, `journey-runs/${run.id}`)
    ).json();
    expect(historical.definition.name).toBe(j.definition.name);
    expect(historical.revision).toBe(1);
    await signIn(page, user);
    await page.goto(`/runs/${run.id}`);
    await expect(
      page.getByRole("heading", { name: /Address and error recovery/ }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.goto(`/journeys/${j.id}`);
    await expect(page.getByLabel("Journey name", { exact: true })).toHaveValue(
      "Reviewed address journey",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await user.admin.auth.admin.deleteUser(user.id);
    await other.admin.auth.admin.deleteUser(other.id);
  }
});
test("authenticated login recipe and provisioned session require the intended role; secrets expire and can be revoked", async ({
  request,
}) => {
  const user = await identity(),
    application = await app(request, user.token);
  try {
    const d = definition({
      access: "protected",
      role: "customer",
      startUrl: `${fixtureOrigin}/journey/protected/good`,
      signedIn: { locator: byId("identity"), text: "Signed in as customer." },
      steps: [
        click("dialog-open", "dialog-open"),
        checkpoint("dialog", "address-dialog"),
        click("cancel", "cancel-dialog"),
        focus("restored", "dialog-open", "on", "restoration"),
        checkpoint("end", "journey-ready"),
      ],
    });
    const j = await create(request, user.token, application, d);
    const configured = await provision(
      request,
      user.token,
      application,
      "customer",
      {
        login: {
          url: `${fixtureOrigin}/login`,
          username: byId("login-email"),
          usernameRef: "username",
          password: byId("login-password"),
          passwordRef: "password",
          submit: byId("login-submit"),
          request: { method: "POST", path: "/login" },
        },
      },
    );
    const r = await detail(
      request,
      user.token,
      (await start(request, user.token, j, { identityId: configured.id })).id,
    );
    expect(r.status, JSON.stringify(r.report)).toBe("completed");
    expect(
      r.checkpoints.every(
        (c: any) =>
          c.assessment.context.role === "customer" &&
          c.assessment.context.authentication === "user-confirmed-signed-in",
      ),
    ).toBe(true);
    const stored = (
      await getDb()
        .select()
        .from(testIdentities)
        .where(eq(testIdentities.id, configured.id))
    )[0];
    expect(stored.sealed).not.toContain("PRIVATE-PHASE3-PASSWORD");
    expect(
      JSON.stringify(
        await (await call(request, user.token, "test-identities")).json(),
      ),
    ).not.toMatch(/sealed|PRIVATE-PHASE3-PASSWORD|usernameRef/);
    const sessionContext = await chromium.launch();
    const ctx = await sessionContext.newContext();
    const p = await ctx.newPage();
    await p.goto(`${fixtureOrigin}/login`);
    await p.getByLabel("Email", { exact: true }).fill("session@accessly.test");
    await p.getByLabel("Password", { exact: true }).fill("test-session-only");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    const session = await ctx.storageState();
    await sessionContext.close();
    const explicit = await provision(
      request,
      user.token,
      application,
      "customer",
      { session },
    );
    const sessionRun = await detail(
      request,
      user.token,
      (await start(request, user.token, j, { identityId: explicit.id })).id,
    );
    expect(sessionRun.status).toBe("completed");
    const wrong = await create(request, user.token, application, {
      ...d,
      name: "Wrong role assertion",
      signedIn: { locator: byId("identity"), text: "Signed in as admin." },
    });
    const failedRole = await detail(
      request,
      user.token,
      (await start(request, user.token, wrong, { identityId: explicit.id })).id,
    );
    expect(failedRole.report.stop.code).toBe("ROLE_CHECKPOINT_NOT_REACHED");
    expect(failedRole.checkpoints).toHaveLength(0);
    const expiredSession = await provision(
      request,
      user.token,
      application,
      "customer",
      { session: { cookies: [], origins: [] } },
    );
    const expired = await detail(
      request,
      user.token,
      (await start(request, user.token, j, { identityId: expiredSession.id }))
        .id,
    );
    expect(expired.report.stop.code).toBe("AUTHENTICATION_BLOCKED");
    expect(expired.checkpoints).toHaveLength(0);
    await getDb()
      .update(testIdentities)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(testIdentities.id, configured.id));
    expect(
      (
        await call(request, user.token, `journeys/${j.id}/runs`, "POST", {
          requestId: crypto.randomUUID(),
          revision: 1,
          identityId: configured.id,
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await call(
          request,
          user.token,
          `test-identities/${explicit.id}`,
          "DELETE",
        )
      ).ok(),
    ).toBe(true);
    expect(
      (
        await getDb()
          .select()
          .from(testIdentities)
          .where(eq(testIdentities.id, explicit.id))
      )[0].sealed,
    ).toBeNull();
    expect(
      (
        await call(request, user.token, `journeys/${j.id}/runs`, "POST", {
          requestId: crypto.randomUUID(),
          revision: 1,
          identityId: explicit.id,
        })
      ).status(),
    ).toBe(409);
  } finally {
    await user.admin.auth.admin.deleteUser(user.id);
  }
});
test("blocked journey retains dialog/error evidence and targeted retests replay the original sequence", async ({
  request,
  page,
}) => {
  const user = await identity(),
    application = await app(request, user.token);
  try {
    const j = await create(
      request,
      user.token,
      application,
      definition({
        startUrl: `${fixtureOrigin}/journey/broken`,
        steps: [
          click("open", "dialog-open"),
          focus("entry", "address-dialog", "within", "entry"),
          checkpoint("dialog", "address-dialog"),
          click("cancel", "cancel-dialog"),
          click("validation", "validate"),
          checkpoint("error", "error-state"),
          click("recover", "recovery"),
          {
            id: "recovered",
            label: "Expected recovered state",
            action: "assert",
            locator: byId("done"),
            state: "visible",
          },
        ],
      }),
    );
    const run = await start(request, user.token, j),
      r = await detail(request, user.token, run.id);
    expect(r.status).toBe("partial");
    expect(r.report.stop.stepId).toBe("recovered");
    expect(r.checkpoints).toHaveLength(2);
    expect(r.report.focus[0].outcome).toBe("differs");
    const f = r.checkpoints[0].assessment.findings.find(
      (f: any) => f.rule === "button-name",
    );
    expect(f).toBeTruthy();
    const edited = await call(request, user.token, `findings/${f.id}`, "POST", {
      revision: f.revision,
      state: "ready-for-verification",
      reason: "Ready to reassess original dialog",
      remedyNotes: "Check original dialog name in the controlled fixture",
      remedyVersion: "fixture-v2",
    });
    expect(edited.ok()).toBe(true);
    const after = await edited.json();
    const retry = await call(
      request,
      user.token,
      `findings/${f.id}/retests`,
      "POST",
      {
        revision: after.revision,
        requestId: crypto.randomUUID(),
        screenshot: false,
      },
    );
    expect(retry.ok(), await retry.text()).toBe(true);
    const retest = await retry.json();
    expect(retest.journeyRunId).toBeTruthy();
    const rerun = await detail(request, user.token, retest.journeyRunId);
    expect(rerun.checkpoints).toHaveLength(2);
    expect(rerun.report.stop.stepId).toBe("recovered");
    const targeted = await (
      await call(request, user.token, `retests/${retest.id}`)
    ).json();
    expect(targeted.status).toBe("completed");
    expect(targeted.assessment.outcome).toBe("failed");
    const revised = await call(
      request,
      user.token,
      `journeys/${j.id}`,
      "POST",
      {
        applicationId: application.id,
        environmentId: application.environments[0].id,
        revision: 1,
        definition: {
          ...j.definition,
          name: "Changed authorized journey version",
        },
      },
    );
    expect(revised.ok()).toBe(true);
    const currentFinding = await (
      await call(request, user.token, `findings/${f.id}`)
    ).json();
    const staleReplay = await call(
      request,
      user.token,
      `findings/${f.id}/retests`,
      "POST",
      {
        revision: currentFinding.revision,
        requestId: crypto.randomUUID(),
        screenshot: false,
      },
    );
    expect(staleReplay.ok()).toBe(true);
    const staleRequest = await staleReplay.json();
    const staleRun = await detail(
      request,
      user.token,
      staleRequest.journeyRunId,
    );
    expect(staleRun.report.stop.code).toBe("JOURNEY_VERSION_CHANGED");
    expect(staleRun.checkpoints).toHaveLength(0);
    const inconclusive = await (
      await call(request, user.token, `retests/${staleRequest.id}`)
    ).json();
    expect(inconclusive.status).toBe("incomplete");
    expect(inconclusive.assessment.outcome).toBe("inconclusive");
    await signIn(page, user);
    await page.goto(`/runs/${run.id}`);
    await expect(page.getByText(/Stopped at/)).toContainText("recovered");
    await expect(
      page.getByRole("link", {
        name: "Inspect checkpoint checks and findings",
      }),
    ).toHaveCount(2);
  } finally {
    await user.admin.auth.admin.deleteUser(user.id);
  }
});
test("action boundary, unsupported checks, cancellation and lost dispatch preserve explicit incomplete outcomes", async ({
  request,
}) => {
  const user = await identity(),
    application = await app(request, user.token);
  try {
    for (const step of [
      click("order", "consequential", "purchase"),
      click("changed", "does-not-exist"),
      {
        id: "unsupported",
        label: "Actual screen reader",
        action: "unsupported",
        reason: "A human evaluator must perform this check.",
      },
    ]) {
      const j = await create(
        request,
        user.token,
        application,
        definition({
          steps: [checkpoint("initial", "journey-ready"), step as any],
        }),
      );
      const r = await detail(
        request,
        user.token,
        (await start(request, user.token, j)).id,
      );
      expect(r.status).toBe("partial");
      expect(r.report.stop.stepId).toBe(step.id);
      expect(r.checkpoints).toHaveLength(1);
    }
    const j = await create(
      request,
      user.token,
      application,
      definition({
        steps: [
          checkpoint("initial", "journey-ready"),
          click("missing", "does-not-exist"),
        ],
      }),
    );
    const run = await start(request, user.token, j);
    await call(request, user.token, `runs/${run.id}/cancel`, "POST");
    const cancelled = await detail(request, user.token, run.id);
    expect(cancelled.status).toBe("cancelled");
    const recovered = await start(request, user.token, j);
    await getDb()
      .update(outbox)
      .set({ dispatchedAt: null })
      .where(eq(outbox.runId, recovered.id));
    const r = await detail(request, user.token, recovered.id);
    expect(r.checkpoints).toHaveLength(1);
    const checkpointRun = r.checkpoints[0].runId;
    await getDb()
      .update(outbox)
      .set({ dispatchedAt: null })
      .where(eq(outbox.runId, recovered.id));
    await new Promise((r) => setTimeout(r, 2500));
    expect(
      (await detail(request, user.token, recovered.id)).checkpoints[0].runId,
    ).toBe(checkpointRun);
    const history = await (
      await call(request, user.token, `journeys/${j.id}`)
    ).json();
    expect(
      history.history.filter((h: any) => h.run.id === recovered.id),
    ).toHaveLength(1);
    // Simulate a dead worker after a side effect; the executor must mark it incomplete without replay.
    const abandoned = await start(request, user.token, j);
    await getDb()
      .update(runs)
      .set({ status: "running" })
      .where(eq(runs.id, abandoned.id));
    await getDb()
      .update(journeyRuns)
      .set({
        report: {
          runnerVersion: "1",
          status: "running",
          startedAt: new Date().toISOString(),
          history: [
            {
              stepId: "safe-change",
              action: "click",
              outcome: "completed",
              at: new Date().toISOString(),
              url: j.definition.startUrl,
            },
          ],
          checkpoints: [],
          focus: [],
          variations: [],
          suggestions: [],
          limitations: [],
        },
      })
      .where(eq(journeyRuns.runId, abandoned.id));
    const { executeJourneyJob } =
      await import("../../apps/worker/src/journey-job");
    await executeJourneyJob(abandoned.id, "");
    const stopped = await detail(request, user.token, abandoned.id);
    expect(stopped.report.stop.code).toBe("WORKER_INTERRUPTED");
    expect(stopped.report.history).toHaveLength(1);
  } finally {
    await user.admin.auth.admin.deleteUser(user.id);
  }
});

test("keyboard web authoring, saved replay and identity provisioning are usable from the journey workspace", async ({
  request,
  page,
}) => {
  const user = await identity();
  await app(request, user.token);
  try {
    await signIn(page, user);
    await page.getByRole("link", { name: "Journeys", exact: true }).click();
    await page
      .getByLabel("Journey name", { exact: true })
      .fill("Web authored journey");
    await page
      .getByLabel("Task goal", { exact: true })
      .fill("Inspect the initial address state");
    await page
      .getByLabel("Expected task outcome", { exact: true })
      .fill("Address journey is visible");
    await page
      .getByLabel("Starting URL", { exact: true })
      .fill(`${fixtureOrigin}/journey/good`);
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await page
      .getByLabel("Locator value", { exact: true })
      .fill("journey-ready");
    await page
      .getByRole("button", { name: "Save journey", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/journeys\/[a-f0-9-]+$/);
    await expect(
      page.getByRole("button", { name: "Replay saved journey", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Replay saved journey", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+$/);
    await expect(page.getByRole("status")).toContainText(
      "Execution: completed",
      { timeout: 30000 },
    );
    await page
      .getByRole("link", {
        name: "Review journey, versions and action boundaries",
      })
      .click();
    const form = page
      .getByRole("button", { name: "Provision test identity", exact: true })
      .locator("..");
    await form
      .getByLabel("Identity name", { exact: true })
      .fill("Web test account");
    await form.getByLabel("Identity role", { exact: true }).fill("customer");
    const date = new Date(Date.now() + 3600000);
    await form
      .getByLabel("Expires within 30 days")
      .fill(
        new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
      );
    await form
      .getByLabel("Login URL", { exact: true })
      .fill(`${fixtureOrigin}/login`);
    await form.getByLabel("Username input ID").fill("login-email");
    await form.getByLabel("Password input ID").fill("login-password");
    await form.getByLabel("Sign-in button ID").fill("login-submit");
    await form
      .getByLabel("Test username", { exact: true })
      .fill("web-account@accessly.test");
    await form
      .getByLabel("Test password", { exact: true })
      .fill("PRIVATE-WEB-TEST-PASSWORD");
    await form.getByRole("checkbox").check();
    await form
      .getByRole("button", { name: "Provision test identity", exact: true })
      .click();
    await expect(
      page.getByText(
        "Dedicated test identity provisioned. Secret values cannot be read back through the API.",
      ),
    ).toBeVisible();
    await expect(form.getByLabel("Test password", { exact: true })).toHaveValue(
      "",
    );
    await page
      .getByRole("button", { name: "Revoke Web test account", exact: true })
      .click();
    await expect(
      page.getByText(/Web test account · customer · revoked/),
    ).toBeVisible();
  } finally {
    await user.admin.auth.admin.deleteUser(user.id);
  }
});

test("a passing targeted checkpoint cannot resolve a barrier when the original journey remains incomplete", async ({
  request,
}) => {
  const user = await identity(),
    application = await app(request, user.token),
    url = `${fixtureOrigin}/mvp/${crypto.randomUUID()}`;
  try {
    const j = await create(
      request,
      user.token,
      application,
      definition({
        startUrl: url,
        steps: [
          checkpoint("profile", "profile-save"),
          {
            id: "adjacent",
            label: "Unsupported adjacent check",
            action: "unsupported",
            reason: "Actual screen-reader feedback requires a human evaluator.",
          },
        ],
      }),
    );
    const initial = await detail(
      request,
      user.token,
      (await start(request, user.token, j)).id,
    );
    const f = initial.checkpoints[0].assessment.findings.find(
      (f: any) => f.rule === "button-name",
    );
    expect(f).toBeTruthy();
    const update = await call(request, user.token, `findings/${f.id}`, "POST", {
      revision: f.revision,
      state: "ready-for-verification",
      reason: "Add an accessible name",
      remedyNotes: "Keep the save action and add Save profile text",
      remedyVersion: "v2",
    });
    expect(update.ok()).toBe(true);
    const edited = await update.json();
    expect((await request.post(`${url}/repair`)).ok()).toBe(true);
    const retry = await call(
      request,
      user.token,
      `findings/${f.id}/retests`,
      "POST",
      {
        revision: edited.revision,
        requestId: crypto.randomUUID(),
        screenshot: false,
      },
    );
    expect(retry.ok()).toBe(true);
    const retest = await retry.json();
    await detail(request, user.token, retest.journeyRunId);
    const targeted = await (
      await call(request, user.token, `retests/${retest.id}`)
    ).json();
    expect(targeted.assessment.outcome).toBe("passed");
    const finding = await (
      await call(request, user.token, `findings/${f.id}`)
    ).json();
    const decision = await call(
      request,
      user.token,
      `findings/${f.id}/verifications`,
      "POST",
      {
        revision: finding.revision,
        retestId: retest.id,
        method: "automated-targeted",
        outcome: "passed",
        conditions: "Same original journey checkpoint and role",
        actualOutcome: "Save profile has its accessible name",
        expectedOutcome: "Name and action retained",
        limitations: "Adjacent screen-reader check did not run",
        contextConfirmed: true,
        identityConfirmed: true,
        capabilityPreserved: true,
        adjacentRequired: false,
        adjacentOutcome: "not-required",
      },
    );
    expect(decision.ok(), await decision.text()).toBe(true);
    const recorded = await decision.json();
    expect(recorded.resolved).toBe(false);
    const final = await (
      await call(request, user.token, `findings/${f.id}`)
    ).json();
    expect(final.workState).not.toBe("resolved");
    expect(JSON.stringify(final.verifications)).toMatch(
      /journey did not complete|adjacent behavior review/,
    );
  } finally {
    await user.admin.auth.admin.deleteUser(user.id);
  }
});
