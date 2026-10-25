import { describe, it, expect } from "vitest";
import {
  assessTarget,
  canTransition,
  requiresHumanReview,
  comparisonContext,
} from "../../packages/domain/src/verification";
import {
  PROFILE,
  SCANNER_VERSION,
  type ScanResult,
} from "../../packages/contracts/src";
function run(patch: Partial<ScanResult> = {}): ScanResult {
  return {
    clientScanId: "00000000-0000-4000-8000-000000000001",
    applicationId: "00000000-0000-4000-8000-000000000002",
    environmentId: "00000000-0000-4000-8000-000000000003",
    mode: "extension",
    context: {
      url: "http://fixture.test/account",
      state: "Dialog open",
      role: "customer",
      authentication: "user-confirmed-signed-in",
      title: "Page title omitted",
      preconditions: "Open address dialog",
      appVersion: "v1",
      viewport: { width: 1280, height: 720, deviceScale: 1 },
    },
    profile: PROFILE,
    scannerVersion: SCANNER_VERSION,
    engineVersion: "4.14.0",
    startedAt: "2026-10-25T01:00:00.000Z",
    finishedAt: "2026-10-25T01:00:01.000Z",
    completion: "completed",
    checks: [],
    limitations: [],
    exclusions: [],
    ...patch,
  };
}
const target = { rule: "button-name", locator: "html > body > button" };
const reassessed = () =>
  run({
    startedAt: "2026-10-25T01:01:00.000Z",
    finishedAt: "2026-10-25T01:01:01.000Z",
    targetObservation: {
      ...target,
      present: true,
      matchedCount: 1,
      visible: true,
      outcome: "pass",
      tagName: "button",
    },
  });
describe("evidence needed for verification", () => {
  it("requires human review for incomplete and contextual or unknown rules", () => {
    expect(requiresHumanReview("button-name", "violation")).toBe(false);
    for (const rule of ["image-alt", "color-contrast", "unknown-rule"])
      expect(requiresHumanReview(rule, "violation")).toBe(true);
    expect(requiresHumanReview("button-name", "incomplete")).toBe(true);
  });

  it("accepts a comparable, explicit target pass while disclosing the remedy version change", () => {
    const after = reassessed();
    after.context = { ...after.context, appVersion: "v2" };
    expect(assessTarget(run(), after, target)).toEqual({
      outcome: "passed",
      reasons: [],
      changes: ["Application version changed"],
    });
  });
  it.each(["role", "state", "url", "authentication", "viewport"] as const)(
    "keeps changed %s inconclusive",
    (key) => {
      const after = reassessed();
      (after.context as any)[key] =
        key === "viewport"
          ? { width: 390, height: 844, deviceScale: 1 }
          : "different";
      expect(assessTarget(run(), after, target).outcome).toBe("inconclusive");
    },
  );
  it.each(["partial", "failed"] as const)(
    "does not accept a %s scan as a pass",
    (completion) =>
      expect(
        assessTarget(run(), { ...reassessed(), completion }, target).outcome,
      ).toBe("inconclusive"),
  );
  it.each([
    { present: false },
    { visible: false },
    { matchedCount: 2 },
    { outcome: "inapplicable" },
    { outcome: "not-assessed" },
  ])(
    "requires a present, visible, unambiguous and assessed target: %j",
    (patch) => {
      const after = reassessed();
      Object.assign(after.targetObservation!, patch);
      expect(assessTarget(run(), after, target).outcome).toBe("inconclusive");
    },
  );
  it("does not treat a clean broad rescan as proof that the original element passed", () => {
    const after = reassessed();
    delete after.targetObservation;
    expect(assessTarget(run(), after, target).outcome).toBe("inconclusive");
  });
  it("distinguishes continuing failure and review candidates", () => {
    const after = reassessed();
    after.targetObservation!.outcome = "violation";
    expect(assessTarget(run(), after, target).outcome).toBe("failed");
    after.targetObservation!.outcome = "incomplete";
    expect(assessTarget(run(), after, target).outcome).toBe("needs-review");
  });
  it("discloses engine, mode, exclusion and profile differences", () => {
    const after = reassessed();
    after.engineVersion = "other";
    after.mode = "worker";
    after.exclusions = [".secret"];
    expect(comparisonContext(run(), after).blocking).toEqual(
      expect.arrayContaining([
        "Engine version changed",
        "Execution mode changed",
        "Exclusions changed",
      ]),
    );
  });
  it("does not allow direct resolution or unsupported reopening through generic lifecycle changes", () => {
    expect(canTransition("in-progress", "resolved")).toBe(false);
    expect(canTransition("resolved", "reopened")).toBe(false);
    expect(canTransition("resolved", "under-review")).toBe(true);
    expect(canTransition("new", "closed-after-review")).toBe(true);
  });
});
