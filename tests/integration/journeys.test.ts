import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { build } from "esbuild";
import {
  journeyDefinition,
  journeyStep,
  identityInput,
} from "../../packages/contracts/src/journeys";
import { seal, unseal } from "../../packages/database/src/journey-secrets";
import {
  replayJourney,
  JourneyStop,
  type ReplayOptions,
} from "../../apps/worker/src/journey-runner";
import {
  definition,
  fixtureOrigin,
  click,
  checkpoint,
  focus,
  key,
  byId,
} from "../journey-data";
import type { ScanResult } from "@accessly/contracts";
let server: ChildProcess | undefined,
  scannerSource = "";
beforeAll(async () => {
  try {
    await fetch(`${fixtureOrigin}/health`);
  } catch {
    server = spawn(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/server.ts"],
      { stdio: "ignore" },
    );
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${fixtureOrigin}/health`)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const result = await build({
    entryPoints: ["apps/extension/src/injected.ts"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
  });
  scannerSource = result.outputFiles![0].text;
});
afterAll(() => {
  server?.kill();
});
async function run(d = definition(), extra: Partial<ReplayOptions> = {}) {
  const scans: ScanResult[] = [];
  const report = await replayJourney({
    id: crypto.randomUUID(),
    journeyId: crypto.randomUUID(),
    revision: 1,
    applicationId: crypto.randomUUID(),
    environmentId: crypto.randomUUID(),
    definition: d,
    fixtureOrigin,
    scannerSource,
    identity: identityInput.parse({
      applicationId: crypto.randomUUID(),
      environmentId: crypto.randomUUID(),
      name: "Runtime fixtures",
      role: "public",
      dedicatedTestIdentity: true,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      inputs: { invalidPostal: "SECRET-INVALID-POSTAL" },
    }),
    isCancelled: async () => false,
    validateIdentity: async () => {},
    onProgress: async () => {},
    onCheckpoint: async (s) => {
      scans.push(s);
    },
    ...extra,
  });
  return { report, scans };
}
describe("journey trust boundaries", () => {
  it("rejects literal input values, duplicate step IDs, cross-origin navigation and mismatched grants", () => {
    expect(
      journeyStep.safeParse({
        id: "input",
        label: "input",
        action: "input",
        locator: byId("postal"),
        inputRef: "safe",
        value: "secret",
      }).success,
    ).toBe(false);
    expect(
      journeyDefinition.safeParse(
        definition({ startUrl: `${fixtureOrigin}/journey/good?token=private` }),
      ).success,
    ).toBe(false);
    const d = definition();
    d.steps.push(d.steps[0]);
    expect(journeyDefinition.safeParse(d).success).toBe(false);
    expect(
      journeyDefinition.safeParse(
        definition({
          steps: [
            {
              id: "out",
              label: "out",
              action: "navigate",
              url: "https://other.example/",
            },
            checkpoint("cp", "journey-ready"),
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      journeyDefinition.safeParse(
        definition({
          grants: [
            {
              stepId: "validate",
              effect: "delete",
              reason: "wrong scope",
              requests: [],
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });
  it("encrypts with a versioned key and tenant-bound authenticated data", () => {
    process.env.JOURNEY_SECRET_KEY_ID = "test";
    process.env.JOURNEY_SECRET_KEYS = JSON.stringify({
      test: Buffer.alloc(32, 11).toString("base64"),
    });
    const encrypted = seal(
      { password: "private-value" },
      "tenant:application:role",
    );
    expect(encrypted.sealed).not.toContain("private-value");
    expect(unseal(encrypted.sealed, "test", "tenant:application:role")).toEqual(
      { password: "private-value" },
    );
    expect(() =>
      unseal(encrypted.sealed, "test", "other-tenant:application:role"),
    ).toThrow();
    const tampered = Buffer.from(encrypted.sealed, "base64");
    tampered[tampered.length - 1] ^= 1;
    expect(() =>
      unseal(tampered.toString("base64"), "test", "tenant:application:role"),
    ).toThrow();
  });
  it("replays menu, disclosure, tabs, dialog, invalid input and recovery with real keyboard focus evidence", async () => {
    const { report, scans } = await run();
    expect(report.stop).toBeUndefined();
    expect(report.status).toBe("completed");
    expect(scans).toHaveLength(6);
    expect(report.focus.every((f) => f.outcome === "matches")).toBe(true);
    expect(
      report.focus.find((f) => f.phase === "restoration")?.keyboardSequence
        .length,
    ).toBeGreaterThan(0);
    expect(report.variations.every((v) => v.status === "not-assessed")).toBe(
      true,
    );
    expect(JSON.stringify({ report, scans })).not.toContain(
      "SECRET-INVALID-POSTAL",
    );
    expect(JSON.stringify({ report, scans })).not.toContain(
      "fixture-private-value-never-upload",
    );
    expect(
      report.suggestions.some((s) => s.kind === "invalid-input-and-recovery"),
    ).toBe(true);
  }, 45000);
  it("retains dialog and error-state findings plus their triggering sequence when recovery fails", async () => {
    const d = definition({
      startUrl: `${fixtureOrigin}/journey/broken`,
      steps: [
        click("open", "dialog-open"),
        focus("entry", "address-dialog", "within", "entry"),
        checkpoint("dialog", "address-dialog"),
        click("cancel", "cancel-dialog"),
        click("validate", "validate"),
        checkpoint("error", "error-state"),
        click("recover", "recovery"),
        {
          id: "expected",
          label: "Recovery expected",
          action: "assert",
          locator: byId("done"),
          state: "visible",
        },
      ],
    });
    const { report, scans } = await run(d);
    expect(report.status).toBe("incomplete");
    expect(report.stop?.stepId).toBe("expected");
    expect(scans).toHaveLength(2);
    expect(
      scans.every((s) =>
        s.checks.some(
          (c) => c.rule === "button-name" && c.outcome === "violation",
        ),
      ),
    ).toBe(true);
    expect(report.focus[0].outcome).toBe("differs");
    expect(report.focus[0].basis).toBe("pattern-guidance");
    expect(report.history.find((h) => h.stepId === "open")?.outcome).toBe(
      "completed",
    );
    expect(report.limitations).toContain(
      "Pointer-driven replay: keyboard operation was not assessed.",
    );
  });
  it("stops before an unapproved purchase and a submit mislabeled UI", async () => {
    for (const effect of ["purchase", "ui"] as const) {
      const { report, scans } = await run(
        definition({
          steps: [
            checkpoint("start", "journey-ready"),
            click("purchase", "consequential", effect),
          ],
        }),
      );
      expect(scans).toHaveLength(1);
      expect(report.stop?.stepId).toBe("purchase");
      expect(report.stop?.code).toMatch(
        /ACTION_NOT_AUTHORIZED|UNDECLARED_CONSEQUENTIAL_ACTION/,
      );
    }
  });
  it("honors an exact authorized test-setting POST and blocks undeclared network side effects", async () => {
    const steps = [
      click("write", "approved-write", "settings"),
      {
        id: "changed",
        label: "Observe setting",
        action: "assert" as const,
        locator: byId("write-status"),
        state: "visible" as const,
        text: "Test setting changed",
      },
      checkpoint("after", "journey-ready"),
    ];
    const d = definition({
      steps,
      isolation: "dedicated-test-account",
      grants: [
        {
          stepId: "write",
          effect: "settings",
          reason: "Disposable controlled test fixture",
          requests: [{ method: "POST", path: "/journey-write" }],
        },
      ],
    });
    expect((await run(d)).report.status).toBe("completed");
    const blocked = await run({
      ...d,
      grants: [{ ...d.grants[0], requests: [] }],
    });
    expect(blocked.report.status).toBe("incomplete");
    expect(blocked.report.stop?.code).toBe("NETWORK_ACTION_BOUNDARY");
  });
  it("keeps reached evidence on changed locator, unsupported check, excluded target, cancellation and revoked identity", async () => {
    for (const tail of [
      click("missing", "no-such-control"),
      {
        id: "unsupported",
        label: "Review screen reader",
        action: "unsupported" as const,
        reason: "Actual screen-reader evaluation needs a human.",
      },
      click("excluded", "private-input"),
    ]) {
      const { report, scans } = await run(
        definition({ steps: [checkpoint("start", "journey-ready"), tail] }),
      );
      expect(scans).toHaveLength(1);
      expect(report.status).toBe("incomplete");
      expect(report.stop?.stepId).toBe(tail.id);
    }
    const navigated = await run(
      definition({
        steps: [
          checkpoint("start", "journey-ready"),
          {
            id: "another-page",
            label: "Navigate to the correct fixture",
            action: "navigate",
            url: `${fixtureOrigin}/correct`,
          },
          click("changed", "does-not-exist"),
        ],
      }),
    );
    expect(navigated.report.stop?.stepId).toBe("changed");
    expect(navigated.report.history.at(-1)?.url).toBe(
      `${fixtureOrigin}/correct`,
    );
    let reached = false;
    const cancelled = await run(
      definition({
        steps: [checkpoint("start", "journey-ready"), key("next", "Tab")],
      }),
      {
        onCheckpoint: async () => {
          reached = true;
        },
        isCancelled: async () => reached,
      },
    );
    expect(cancelled.report.status).toBe("cancelled");
    expect(cancelled.report.checkpoints).toHaveLength(1);
    const changedScope = await run(undefined, {
      validateScope: async () => {
        throw new JourneyStop(
          "JOURNEY_VERSION_CHANGED",
          "Review current boundaries",
        );
      },
    });
    expect(changedScope.scans).toHaveLength(0);
    expect(changedScope.report.stop?.code).toBe("JOURNEY_VERSION_CHANGED");
    const revoked = await run(undefined, {
      validateIdentity: async () => {
        throw new Error("revoked");
      },
    });
    expect(revoked.report.stop?.code).toBe("IDENTITY_UNAVAILABLE");
  }, 45000);
  it("refuses protected coverage without the expected session and exact role marker", async () => {
    const { report, scans } = await run(
      definition({
        access: "protected",
        role: "customer",
        startUrl: `${fixtureOrigin}/journey/protected/good`,
        signedIn: { locator: byId("identity"), text: "Signed in as customer." },
      }),
    );
    expect(scans).toHaveLength(0);
    expect(report.status).toBe("incomplete");
    expect(report.stop?.code).toBe("AUTHENTICATION_BLOCKED");
  });
});
