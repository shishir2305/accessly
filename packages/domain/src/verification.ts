import type { ScanResult } from "@accessly/contracts";
export function comparisonContext(before: ScanResult, after: ScanResult) {
  const blocking: string[] = [],
    changes: string[] = [];
  const same = (key: string, a: unknown, b: unknown, block = true) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      (block ? blocking : changes).push(`${key} changed`);
    }
  };
  same("Application", before.applicationId, after.applicationId);
  same("Environment", before.environmentId, after.environmentId);
  same("Page", before.context.url, after.context.url);
  same("State", before.context.state, after.context.state);
  same(
    "Journey checkpoint/version",
    before.journey
      ? {
          journeyId: before.journey.journeyId,
          revision: before.journey.revision,
          stepId: before.journey.stepId,
        }
      : null,
    after.journey
      ? {
          journeyId: after.journey.journeyId,
          revision: after.journey.revision,
          stepId: after.journey.stepId,
        }
      : null,
  );
  same("Role", before.context.role, after.context.role);
  same(
    "Authentication context",
    before.context.authentication,
    after.context.authentication,
  );
  same("Viewport", before.context.viewport, after.context.viewport);
  same("Execution mode", before.mode, after.mode);
  same("Rule profile", before.profile, after.profile);
  same("Engine version", before.engineVersion, after.engineVersion);
  same("Scanner version", before.scannerVersion, after.scannerVersion);
  same(
    "Exclusions",
    [...before.exclusions].sort(),
    [...after.exclusions].sort(),
  );
  same(
    "Application version",
    before.context.appVersion,
    after.context.appVersion,
    false,
  );
  same(
    "Preconditions",
    before.context.preconditions,
    after.context.preconditions,
    false,
  );
  if (
    after.mode === "extension" &&
    (after.context.role === "unknown" ||
      after.context.authentication === "unknown")
  )
    blocking.push("Target role or authentication is unknown");
  if (after.completion !== "completed")
    blocking.push("Assessment did not complete");
  if (Date.parse(after.startedAt) < Date.parse(before.finishedAt))
    blocking.push("Reassessment predates the original observation");
  return { blocking, changes };
}
export function assessTarget(
  before: ScanResult,
  after: ScanResult,
  target: { rule: string; locator: string },
) {
  const { blocking, changes } = comparisonContext(before, after);
  const t = after.targetObservation;
  const reasons = [...blocking];
  if (!t || t.rule !== target.rule || t.locator !== target.locator)
    reasons.push("The original target was not explicitly reassessed");
  if (t && (!t.present || t.matchedCount !== 1 || !t.visible))
    reasons.push("The original element is missing, hidden, or ambiguous");
  if (t && ["not-assessed", "inapplicable"].includes(t.outcome))
    reasons.push("The original rule was not assessed on this element");
  const outcome = reasons.length
    ? "inconclusive"
    : t?.outcome === "violation"
      ? "failed"
      : t?.outcome === "incomplete"
        ? "needs-review"
        : "passed";
  return { outcome, reasons, changes };
}
const transitions: Record<string, string[]> = {
  new: ["under-review", "open", "in-progress", "ready-for-verification"],
  "under-review": ["open", "in-progress", "ready-for-verification"],
  open: ["under-review", "in-progress", "ready-for-verification"],
  "in-progress": ["under-review", "open", "ready-for-verification"],
  "ready-for-verification": ["under-review", "in-progress"],
  "verification-in-progress": [
    "under-review",
    "in-progress",
    "ready-for-verification",
  ],
  resolved: ["under-review"],
  reopened: ["under-review", "open", "in-progress", "ready-for-verification"],
  "closed-after-review": ["under-review"],
};
export function canTransition(from: string, to: string) {
  return (
    from === to ||
    (to === "closed-after-review" && from !== "resolved") ||
    (transitions[from] ?? []).includes(to)
  );
}

export function requiresHumanReview(rule: string, outcome: string) {
  return (
    outcome === "incomplete" ||
    ![
      "button-name",
      "link-name",
      "label",
      "aria-required-attr",
      "aria-valid-attr",
      "aria-valid-attr-value",
      "duplicate-id-aria",
    ].includes(rule)
  );
}
