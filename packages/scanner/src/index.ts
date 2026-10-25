import axe, { type AxeResults, type Result } from "axe-core";
import {
  PROFILE,
  SCANNER_VERSION,
  tags,
  type Check,
  type ScanContext,
  type ScanResult,
} from "@accessly/contracts";
export { PROFILE, SCANNER_VERSION, tags };
export function structuralPath(element: Element): string {
  const steps: string[] = [];
  let e: Element | null = element;
  while (e && steps.length < 18) {
    const tag = e.tagName.toLowerCase();
    if (!/^[a-z0-9-]+$/.test(tag)) return "html";
    const peers = e.parentElement
      ? Array.from(e.parentElement.children).filter(
          (c) => c.tagName === e!.tagName,
        )
      : [e];
    steps.unshift(
      peers.length > 1 ? `${tag}:nth-of-type(${peers.indexOf(e) + 1})` : tag,
    );
    e = e.parentElement;
  }
  return steps.join(" > ");
}
export function normalize(
  raw: AxeResults,
  elementFor: (node: Result["nodes"][number]) => Element | null,
): Check[] {
  return (
    ["violations", "incomplete", "passes", "inapplicable"] as const
  ).flatMap((kind) =>
    raw[kind].map((r) => ({
      rule: r.id,
      impact: r.impact ?? null,
      help: r.help,
      description: r.description,
      helpUrl: r.helpUrl,
      tags: r.tags,
      outcome: (
        {
          violations: "violation",
          incomplete: "incomplete",
          passes: "pass",
          inapplicable: "inapplicable",
        } as const
      )[kind],
      nodeCount: r.nodes.length,
      elements:
        kind === "passes" || kind === "inapplicable"
          ? []
          : r.nodes.slice(0, 300).map((n) => {
              const e = elementFor(n);
              const b = e?.getBoundingClientRect();
              return {
                locator: e ? structuralPath(e) : "html",
                description: e
                  ? `${e.tagName.toLowerCase()} element; page text omitted`
                  : "Element unavailable in supported document",
                summary: r.description,
                checks: [...n.any, ...n.all, ...n.none]
                  .map((c) => c.id)
                  .slice(0, 30),
                box: b
                  ? { x: b.x, y: b.y, width: b.width, height: b.height }
                  : null,
              };
            }),
    })),
  );
}
export async function scanDocument(input: {
  clientScanId: string;
  applicationId: string;
  environmentId: string;
  context: ScanContext;
  mode: "extension" | "worker";
  excludeSelectors: string[];
  retestId?: string;
  target?: { rule: string; locator: string };
}): Promise<ScanResult> {
  if (document.querySelectorAll("*").length > 30000)
    throw new Error(
      "This document exceeds the supported 30,000-element scan limit. Narrow the assessed page or use a smaller fixture.",
    );
  const start = new Date().toISOString();
  const originalUrl = location.href;
  const root = document.documentElement;
  let changed = false;
  const observer = new MutationObserver((list) => {
    if (
      list.some(
        (m) =>
          m.type === "childList" ||
          (m.type === "attributes" &&
            !["style", "data-accessly"].includes(m.attributeName ?? "")),
      )
    )
      changed = true;
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true });
  const frames = document.querySelectorAll("iframe,frame").length;
  const shadows = Array.from(document.querySelectorAll("*")).filter(
    (e) => e.shadowRoot,
  );
  const exclusions = [
    ...input.excludeSelectors,
    "iframe",
    "frame",
    ...shadows.map(structuralPath),
    "[data-accessly-overlay]",
  ];
  for (const selector of input.excludeSelectors)
    document.querySelectorAll(selector);
  try {
    const results = await axe.run(
      {
        include: [document.documentElement],
        exclude: exclusions.map((s) => [s]),
      },
      {
        runOnly: { type: "tag", values: tags },
        iframes: false,
        resultTypes: ["violations", "incomplete", "passes", "inapplicable"],
        selectors: true,
        elementRef: true,
      },
    );
    return build(results);
  } finally {
    observer.disconnect();
  }
  function build(raw: AxeResults): ScanResult {
    const limitations = [
      "Only selected automated WCAG-related checks were evaluated. Human review remains necessary.",
      "Only the reached top-level state was scanned. Keyboard transitions and complete journeys were not evaluated.",
      "Closed shadow roots cannot be identified or assessed reliably.",
      "Page text, HTML, input values, query strings, and fragments are omitted.",
    ];
    if (
      raw.violations.some((r) => r.nodes.length > 300) ||
      raw.incomplete.some((r) => r.nodes.length > 300)
    )
      limitations.push(
        "Occurrence evidence is limited to the first 300 elements per rule. Additional affected targets were not retained.",
      );
    if (frames)
      limitations.push(
        `${frames} frame(s) excluded; embedded content was not assessed.`,
      );
    if (shadows.length)
      limitations.push(
        `${shadows.length} open shadow root(s) excluded from initial supported scope.`,
      );
    if (changed || location.href !== originalUrl)
      limitations.push(
        "Document changed during assessment. Results are partial; reach a stable state and scan again.",
      );
    if (document.readyState !== "complete")
      limitations.push(
        "Document had not completed loading at scan time; late content may be absent.",
      );
    const checks = normalize(raw, (n) => {
      const ref = (n as any).element as Element | undefined;
      if (ref) return ref;
      try {
        const s = n.target[0];
        return typeof s === "string" ? document.querySelector(s) : null;
      } catch {
        return null;
      }
    });
    const evidenceWindow = window as any;
    evidenceWindow.__accesslyEvidenceObserver?.disconnect();
    let revision = 0;
    const guard = new MutationObserver(() => revision++);
    guard.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    evidenceWindow.__accesslyEvidenceObserver = guard;
    evidenceWindow.__accesslyEvidenceState = () => ({
      url: location.href,
      timeOrigin: performance.timeOrigin,
      revision,
      scrollX,
      scrollY,
      width: innerWidth,
      height: innerHeight,
    });
    evidenceWindow.__accesslyScanStamp =
      evidenceWindow.__accesslyEvidenceState();
    let targetObservation: ScanResult["targetObservation"];
    if (input.target) {
      const matches = document.querySelectorAll(input.target.locator);
      const element = matches.length === 1 ? matches[0] : null;
      const rect = element?.getBoundingClientRect();
      const visible =
        !!element &&
        !!rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(element).visibility !== "hidden" &&
        !element.closest('[hidden],[aria-hidden="true"],[inert]');
      let outcome:
        | "pass"
        | "violation"
        | "incomplete"
        | "inapplicable"
        | "not-assessed" = "not-assessed";
      for (const [kind, value] of [
        ["passes", "pass"],
        ["incomplete", "incomplete"],
        ["violations", "violation"],
      ] as const) {
        const rule = raw[kind].find((rule) => rule.id === input.target!.rule);
        if (
          element &&
          rule?.nodes.some((node) => {
            const ref = (node as any).element;
            return (
              ref === element ||
              (typeof node.target[0] === "string" &&
                document.querySelector(node.target[0]) === element)
            );
          })
        )
          outcome = value;
      }
      if (
        outcome === "not-assessed" &&
        raw.inapplicable.some((rule) => rule.id === input.target!.rule)
      )
        outcome = "inapplicable";
      targetObservation = {
        ...input.target,
        present: matches.length > 0,
        matchedCount: matches.length,
        outcome,
        tagName: element?.tagName.toLowerCase() ?? "unknown",
        visible,
      };
    }
    return {
      ...input,
      targetObservation,
      profile: PROFILE,
      scannerVersion: SCANNER_VERSION,
      engineVersion: raw.testEngine.version,
      startedAt: start,
      finishedAt: new Date().toISOString(),
      completion:
        changed ||
        location.href !== originalUrl ||
        document.readyState !== "complete"
          ? "partial"
          : "completed",
      checks,
      limitations,
      exclusions: input.excludeSelectors,
    };
  }
}
