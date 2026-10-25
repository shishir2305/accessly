import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { identity, app, call, waitRun, signIn } from "./helpers";
async function detail(request: any, user: any, id: string) {
  const response = await call(request, user.token, `findings/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function update(request: any, user: any, id: string, data: any) {
  const response = await call(
    request,
    user.token,
    `findings/${id}`,
    "POST",
    data,
  );
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function scan(request: any, user: any, application: any, url: string) {
  const response = await call(request, user.token, "runs/public", "POST", {
    applicationId: application.id,
    environmentId: application.environments[0].id,
    url,
  });
  expect(response.ok()).toBe(true);
  return waitRun(request, user.token, (await response.json()).id);
}
async function retest(request: any, user: any, f: any) {
  const response = await call(
    request,
    user.token,
    `findings/${f.id}/retests`,
    "POST",
    { revision: f.revision, requestId: crypto.randomUUID() },
  );
  expect(response.ok(), await response.text()).toBe(true);
  const r = await response.json();
  if (r.runId) await waitRun(request, user.token, r.runId);
  const current = await detail(request, user, f.id);
  return {
    request: current.retests.find((x: any) => x.id === r.id),
    finding: current,
  };
}
function decision(f: any, r: any, patch: any = {}) {
  return {
    revision: f.revision,
    retestId: r.id,
    method: "automated-targeted",
    outcome: "passed",
    conditions:
      "Same fixture state, role, viewport and engine; repaired local build v2.",
    expectedOutcome:
      "The save control has a meaningful accessible name and saves the profile.",
    actualOutcome:
      "The named Save profile button remains operable and the selected check passed.",
    limitations:
      "Scoped to this current state and selected automated check; no full conformance claim.",
    contextConfirmed: true,
    identityConfirmed: true,
    capabilityPreserved: true,
    adjacentRequired: false,
    ...patch,
  };
}

test("MVP remediation, failed and passing retests, adjacent review, verification, comparison, and recurrence", async ({
  page,
  request,
}) => {
  const owner = await identity(),
    application = await app(request, owner.token),
    url = `http://127.0.0.1:4174/mvp/${crypto.randomUUID()}`;
  const original = await scan(request, owner, application, url);
  expect(original.status).toBe("completed");
  const id = original.findings.find((f: any) => f.rule === "button-name").id;
  let f = await detail(request, owner, id);
  expect(f.workState).toBe("new");
  f = await update(request, owner, id, {
    revision: f.revision,
    state: "in-progress",
    assessment: "confirmed",
    reason: "Implement a meaningful save-control name.",
    remedyNotes:
      "Added Save profile as the accessible button name; retain the existing save action.",
    remedyVersion: "v2",
    steps: ["Open profile settings", "Locate the save profile control"],
    expectedOutcome: "A meaningful name identifies the save control.",
  });
  const blockedResolution = await call(
    request,
    owner.token,
    `findings/${id}`,
    "POST",
    {
      revision: f.revision,
      state: "resolved",
      reason: "Attempted direct closure",
    },
  );
  expect(blockedResolution.status()).toBe(400);
  const attempt = await call(
    request,
    owner.token,
    `findings/${id}/attempts`,
    "POST",
    {
      outcome: "reproduced",
      conditions: "Original public fixture state",
      notes: "The save control is present without a name.",
      context: original.context,
    },
  );
  expect(attempt.ok()).toBe(true);
  let pair = await retest(request, owner, f);
  expect(pair.request.assessment.outcome).toBe("failed");
  let response = await call(
    request,
    owner.token,
    `findings/${id}/verifications`,
    "POST",
    decision(pair.finding, pair.request),
  );
  expect(response.ok()).toBe(true);
  expect((await response.json()).resolved).toBe(false);
  await page.goto(url);
  await page
    .getByRole("button", { name: "Apply accessible name", exact: true })
    .click();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved.");
  f = await detail(request, owner, id);
  pair = await retest(request, owner, f);
  expect(pair.request.assessment.outcome).toBe("passed");
  expect(pair.finding.workState).toBe("verification-in-progress");
  const pending = decision(pair.finding, pair.request, {
    adjacentRequired: true,
    adjacentOutcome: "pending",
    adjacentNotes: "Confirm the save action still reports success.",
  });
  response = await call(
    request,
    owner.token,
    `findings/${id}/verifications`,
    "POST",
    pending,
  );
  expect((await response.json()).resolved).toBe(false);
  f = await detail(request, owner, id);
  expect(f.workState).toBe("under-review");
  const broad = await scan(request, owner, application, url);
  const absent = await (
    await call(
      request,
      owner.token,
      `runs/${broad.id}/compare?baseline=${original.id}`,
    )
  ).json();
  expect(absent.items.find((i: any) => i.id === id).category).toBe(
    "not-assessed",
  );
  expect((await detail(request, owner, id)).workState).not.toBe("resolved");
  const targeted = await (
    await call(
      request,
      owner.token,
      `runs/${pair.request.runId}/compare?baseline=${original.id}`,
    )
  ).json();
  expect(targeted.items.find((i: any) => i.id === id).category).toBe(
    "selected-check-passed",
  );
  expect(targeted.changes).toContain("Application version changed");
  const verified = decision(f, pair.request, {
    adjacentRequired: true,
    adjacentOutcome: "passed",
    adjacentNotes:
      "Activated Save profile and confirmed Profile saved. in the live status region.",
  });
  const results = await Promise.all([
    call(
      request,
      owner.token,
      `findings/${id}/verifications`,
      "POST",
      verified,
    ),
    call(
      request,
      owner.token,
      `findings/${id}/verifications`,
      "POST",
      verified,
    ),
  ]);
  expect(results.map((r) => r.status()).sort()).toEqual([200, 409]);
  f = await detail(request, owner, id);
  expect(f.workState).toBe("resolved");
  expect(f.verifications.filter((v: any) => v.resolved)).toHaveLength(1);
  expect(f.verifications[0].record.limitations).toContain("Scoped");
  await signIn(page, owner);
  await page.goto(`/findings/${id}`);
  await expect(
    page.getByRole("heading", { name: "Record verification" }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Verification history" })
    .scrollIntoViewIfNeeded();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({ path: "artifacts/mvp-finding.png", fullPage: true });
  const feedback = await call(request, owner.token, "feedback", "POST", {
    findingId: id,
    usefulness: "useful",
    notes:
      "Controlled local acceptance exercise: the recorded steps reproduced the missing name and scoped verification completed.",
    activeMinutes: null,
  });
  expect(feedback.ok()).toBe(true);
  const view = await call(request, owner.token, "views", "POST", {
    name: "Verified fixture findings",
    filters: { view: "resolved", applicationId: application.id },
  });
  expect(view.ok()).toBe(true);
  await page.goto("/findings");
  await expect(
    page.getByRole("button", {
      name: "Verified fixture findings",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Verified fixture findings", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Buttons must have discernible text" }),
  ).toBeVisible();
  await page.goto(url);
  await page
    .getByRole("button", { name: "Reintroduce missing name", exact: true })
    .click();
  await scan(request, owner, application, url);
  f = await detail(request, owner, id);
  expect(f.workState).toBe("reopened");
  expect(
    f.history.some(
      (e: any) =>
        e.kind === "reopened" &&
        e.detail.verificationId === f.lastVerificationId,
    ),
  ).toBe(true);
  expect(f.attempts).toHaveLength(1);
  expect(f.steps).toHaveLength(2);
});

test("missing and hidden elements cannot close findings; reviewed retirement is separate from a verified repair", async ({
  page,
  request,
}) => {
  const owner = await identity(),
    application = await app(request, owner.token),
    url = `http://127.0.0.1:4174/mvp/${crypto.randomUUID()}`;
  const source = await scan(request, owner, application, url);
  let f = await detail(
    request,
    owner,
    source.findings.find((f: any) => f.rule === "button-name").id,
  );
  f = await update(request, owner, f.id, {
    revision: f.revision,
    state: "ready-for-verification",
    reason: "Test removal boundary.",
    remedyNotes: "Proposed removal of control needs functional review.",
    remedyVersion: "v2",
  });
  await page.goto(url);
  await page
    .getByRole("button", { name: "Retire save feature", exact: true })
    .click();
  let pair = await retest(request, owner, f);
  expect(pair.request.assessment.outcome).toBe("inconclusive");
  const response = await call(
    request,
    owner.token,
    `findings/${f.id}/verifications`,
    "POST",
    decision(pair.finding, pair.request),
  );
  expect((await response.json()).resolved).toBe(false);
  f = await detail(request, owner, f.id);
  expect(f.workState).not.toBe("resolved");
  await page
    .getByRole("button", { name: "Hide save control", exact: true })
    .click();
  pair = await retest(request, owner, f);
  expect(pair.request.assessment.outcome).toBe("inconclusive");
  f = await detail(request, owner, f.id);
  f = await update(request, owner, f.id, {
    revision: f.revision,
    state: "closed-after-review",
    closureReason: "retired-functionality",
    reason:
      "The local fixture intentionally retired the feature; this is not a verified repair.",
  });
  expect(f.workState).toBe("closed-after-review");
  const list = await (
    await call(request, owner.token, "findings?view=all")
  ).json();
  expect(list.counts.resolved).toBe(0);
  expect(list.counts.closedAfterReview).toBe(1);
});

test("finding edits, retests, history, verification, and saved views remain tenant scoped", async ({
  request,
}) => {
  const owner = await identity(),
    other = await identity(),
    application = await app(request, owner.token);
  await app(request, other.token);
  const source = await scan(
    request,
    owner,
    application,
    `http://127.0.0.1:4174/mvp/${crypto.randomUUID()}`,
  );
  let f = await detail(request, owner, source.findings[0].id);
  expect((await call(request, other.token, `findings/${f.id}`)).status()).toBe(
    404,
  );
  expect(
    (
      await call(request, other.token, `findings/${f.id}`, "POST", {
        revision: f.revision,
        state: "open",
        reason: "Cross-tenant attempt",
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await call(request, other.token, `findings/${f.id}/attempts`, "POST", {
        outcome: "blocked",
        conditions: "Cross-tenant attempt",
        notes: "Must be denied",
        context: source.context,
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await call(request, other.token, `findings/${f.id}/retests`, "POST", {
        revision: f.revision,
        requestId: crypto.randomUUID(),
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await call(
        request,
        other.token,
        `runs/${source.id}/compare?baseline=${source.id}`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await call(request, other.token, "feedback", "POST", {
        findingId: f.id,
        usefulness: "not-yet-useful",
        notes: "Cross-tenant feedback must be denied",
        activeMinutes: null,
      })
    ).status(),
  ).toBe(404);
  f = await update(request, owner, f.id, {
    revision: f.revision,
    state: "ready-for-verification",
    reason: "Prepare authorized retest.",
    remedyNotes: "Add the meaningful button name.",
    remedyVersion: "v2",
  });
  const pair = await retest(request, owner, f);
  expect(
    (await call(request, other.token, `retests/${pair.request.id}`)).status(),
  ).toBe(404);
  expect(
    (
      await call(
        request,
        other.token,
        `findings/${f.id}/verifications`,
        "POST",
        decision(pair.finding, pair.request),
      )
    ).status(),
  ).toBe(404);
  const view = await (
    await call(request, owner.token, "views", "POST", {
      name: "Private view",
      filters: { view: "open" },
    })
  ).json();
  await call(request, other.token, `views/${view.id}`, "DELETE");
  expect(
    (await (await call(request, owner.token, "views")).json()).some(
      (v: any) => v.id === view.id,
    ),
  ).toBe(true);
});

test("required review cannot be bypassed by unchecking confirmations or editing a stale remedy", async ({
  page,
  request,
}) => {
  const owner = await identity(),
    application = await app(request, owner.token),
    url = `http://127.0.0.1:4174/mvp/${crypto.randomUUID()}`;
  const source = await scan(request, owner, application, url);
  let f = await detail(
    request,
    owner,
    source.findings.find((x: any) => x.rule === "button-name").id,
  );
  f = await update(request, owner, f.id, {
    revision: f.revision,
    state: "ready-for-verification",
    reason: "Controlled contract test",
    remedyNotes: "Name the Save profile control.",
    remedyVersion: "v2",
  });
  await page.goto(url);
  await page
    .getByRole("button", { name: "Apply accessible name", exact: true })
    .click();
  let pair = await retest(request, owner, f);
  for (const patch of [
    { contextConfirmed: false },
    { identityConfirmed: false },
    { capabilityPreserved: false },
    {
      adjacentRequired: true,
      adjacentOutcome: "pending",
      adjacentNotes: "Review Save profile action",
    },
    { adjacentRequired: false },
  ]) {
    f = await detail(request, owner, f.id);
    const response = await call(
      request,
      owner.token,
      `findings/${f.id}/verifications`,
      "POST",
      decision(f, pair.request, patch),
    );
    expect(response.ok(), await response.text()).toBe(true);
    expect((await response.json()).resolved).toBe(false);
  }
  f = await detail(request, owner, f.id);
  f = await update(request, owner, f.id, {
    revision: f.revision,
    reason: "Remedy changed after the retest.",
    remedyVersion: "v3",
  });
  expect(
    (
      await call(
        request,
        owner.token,
        `findings/${f.id}/verifications`,
        "POST",
        decision(f, pair.request),
      )
    ).status(),
  ).toBe(409);
  pair = await retest(request, owner, f);
  const wrongManual = await call(
    request,
    owner.token,
    `findings/${f.id}/verifications`,
    "POST",
    decision(pair.finding, pair.request, {
      method: "manual-review",
      humanReviewComplete: true,
      reviewMethod:
        "Simulated review API contract fixture; not human acceptance evidence",
      manualContext: { ...f.context, role: "different-role", appVersion: "v3" },
    }),
  );
  expect((await wrongManual.json()).resolved).toBe(false);
  f = await detail(request, owner, f.id);
  const absentReview = await call(
    request,
    owner.token,
    `findings/${f.id}/verifications`,
    "POST",
    decision(f, pair.request, { method: "manual-review" }),
  );
  expect((await absentReview.json()).resolved).toBe(false);
  // A review-oriented original concern cannot be closed by an unrelated automated pass.
  const publicRun = await scan(
    request,
    owner,
    application,
    "http://127.0.0.1:4174/public",
  );
  let image = await detail(
    request,
    owner,
    publicRun.findings.find((x: any) => x.rule === "image-alt").id,
  );
  expect(image.verificationRequirement).toBe("human-review");
  image = await update(request, owner, image.id, {
    revision: image.revision,
    state: "ready-for-verification",
    reason: "Controlled review boundary",
    remedyNotes: "Determine image purpose and appropriate alternative.",
    remedyVersion: "v2",
  });
  const imageRetest = await retest(request, owner, image);
  const response = await call(
    request,
    owner.token,
    `findings/${image.id}/verifications`,
    "POST",
    decision(imageRetest.finding, imageRetest.request),
  );
  const result = await response.json();
  expect(result.resolved).toBe(false);
  expect(result.reasons).toContain(
    "The original concern requires human review",
  );
});

test("an inaccessible or login-redirected retest remains failed and cannot close original findings", async ({
  request,
  page,
}) => {
  const owner = await identity(),
    application = await app(request, owner.token),
    url = `http://127.0.0.1:4174/mvp/${crypto.randomUUID()}`;
  const source = await scan(request, owner, application, url);
  let f = await detail(
    request,
    owner,
    source.findings.find((x: any) => x.rule === "button-name").id,
  );
  f = await update(request, owner, f.id, {
    revision: f.revision,
    state: "ready-for-verification",
    reason: "Controlled inaccessible-state test",
    remedyNotes:
      "Intended name correction must be assessed in the original page.",
    remedyVersion: "v2",
  });
  expect((await request.post(`${url}/expire`)).ok()).toBe(true);
  const pair = await retest(request, owner, f);
  expect(pair.request.executionStatus).toBe("failed");
  expect(pair.request.assessment).toBe(null);
  const response = await call(
    request,
    owner.token,
    `findings/${f.id}/verifications`,
    "POST",
    decision(pair.finding, pair.request),
  );
  expect((await response.json()).resolved).toBe(false);
  f = await detail(request, owner, f.id);
  expect(f.workState).not.toBe("resolved");
  expect(f.originalRunId).toBe(source.id);
  await signIn(page, owner);
  await page.goto(`/findings/${f.id}`);
  await expect(
    page.getByText(
      "The target redirected to another origin or sign-in state.",
      { exact: false },
    ),
  ).toBeVisible();
});
