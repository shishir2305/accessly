import { createHash } from "node:crypto";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { scanSchema, safeUrl, type ScanResult } from "@accessly/contracts";
import {
  journeyDefinition,
  type JourneyDefinition,
  type JourneyLocator,
  type JourneyReport,
  type IdentityInput,
  type JourneyStep,
} from "../../../packages/contracts/src/journeys";
import { resolveTarget, startProxy } from "./network";
export class JourneyStop extends Error {
  constructor(
    public code: string,
    public recovery: string,
  ) {
    super(code);
  }
}
export function locate(page: Page, locator: JourneyLocator): Locator {
  if (locator.by === "id") return page.locator(`[id="${locator.value}"]`);
  if (locator.by === "testId") return page.getByTestId(locator.value);
  if (locator.by === "label")
    return page.getByLabel(locator.value, { exact: true });
  return page.getByRole(locator.value, { name: locator.name, exact: true });
}
const dangerous =
  /\b(delete|destroy|purchase|checkout|pay|place.?order|send|publish|submit|register|subscribe|unsubscribe|logout|sign.?out|save|update|confirm|create)\b/i;
function inferredEffect(value: string): string {
  if (/delete|destroy/i.test(value)) return "delete";
  if (/purchase|checkout|pay|place.?order/i.test(value)) return "purchase";
  if (/send|publish/i.test(value)) return "message";
  if (/register|create.?account/i.test(value)) return "account";
  if (/save|update|settings/i.test(value)) return "settings";
  return "submission";
}
function childId(run: string, step: string) {
  const hash = createHash("sha256").update(`${run}:${step}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export interface ReplayOptions {
  id: string;
  journeyId: string;
  revision: number;
  applicationId: string;
  environmentId: string;
  definition: JourneyDefinition;
  variationId?: string;
  fixtureOrigin?: string;
  retest?: { id: string; rule: string; locator: string; stepId: string };
  scannerSource: string;
  identity?: IdentityInput;
  isCancelled: () => Promise<boolean>;
  validateIdentity: () => Promise<void>;
  validateScope?: () => Promise<void>;
  onCheckpoint: (scan: ScanResult) => Promise<void>;
  onProgress: (report: JourneyReport) => Promise<void>;
}
export async function replayJourney(
  options: ReplayOptions,
): Promise<JourneyReport> {
  const d = journeyDefinition.parse(options.definition);
  const selected = d.variations.find((v) => v.id === options.variationId);
  const steps = selected
    ? selected.stepIds.map((id) => d.steps.find((s) => s.id === id)!)
    : d.steps;
  const report: JourneyReport = {
    runnerVersion: "1",
    status: "running",
    startedAt: new Date().toISOString(),
    history: [],
    checkpoints: [],
    focus: [],
    suggestions: [],
    variations: d.variations.map((v) => ({
      id: v.id,
      name: v.name,
      status: "not-assessed",
    })),
    limitations: [
      "Only the selected explicit steps, role and top-level states are assessed. Other branches, frames, shadow roots and all possible application states remain unassessed.",
      "Focus observations and pattern guidance are not established WCAG failures or actual screen-reader tests. Focus visibility and task usability need human review.",
      "Raw Playwright traces, screenshots, DOM snapshots and network bodies are disabled because secret/exclusion redaction cannot be guaranteed. Minimized action and focus histories are retained.",
      "Runtime fill/select steps use programmatic input, not keyboard typing. Only the recorded explicit key sequences establish keyboard observations.",
      "Action effects are user-declared. Use authorized disposable test accounts/data; arbitrary application side effects cannot be inferred completely.",
    ],
  };
  if (!steps.some((s) => s.action === "key"))
    report.limitations.push(
      "Pointer-driven replay: keyboard operation was not assessed.",
    );
  let browser: Browser | undefined,
    proxy: Awaited<ReturnType<typeof startProxy>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined,
    polling: ReturnType<typeof setInterval> | undefined;
  let currentId = "authentication",
    currentStep: JourneyStep | undefined,
    authPhase = false,
    requestBlocked = false,
    guardCode = "",
    timedOut = false,
    cancelled = false,
    identityInvalid = false;
  let reachedUrl = safeUrl(d.startUrl);
  const origin = new URL(d.startUrl).origin;
  const progress = () => options.onProgress(structuredClone(report));
  async function guard() {
    if (await options.isCancelled()) {
      cancelled = true;
      throw new JourneyStop(
        "CANCELLED",
        "Review reached checkpoints before starting a new replay.",
      );
    }
    try {
      await options.validateScope?.();
    } catch (error) {
      if (error instanceof JourneyStop) throw error;
      throw new JourneyStop(
        "CONTROL_UNAVAILABLE",
        "Scope authorization could not be checked. Restore the local service before starting a new replay.",
      );
    }
    try {
      await options.validateIdentity();
    } catch {
      throw new JourneyStop(
        "IDENTITY_UNAVAILABLE",
        "Provision or renew an authorized test identity and start a new replay. MFA and unattended renewal are unsupported.",
      );
    }
    if (guardCode)
      throw new JourneyStop(
        guardCode,
        "Review the action boundary, locator or unsupported browser behavior. Start a new replay after correcting it.",
      );
  }
  try {
    await guard();
    await resolveTarget(new URL(d.startUrl), options.fixtureOrigin);
    proxy = await startProxy(options.fixtureOrigin);
    browser = await chromium.launch({
      headless: true,
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          ([k, v]) =>
            [
              "PATH",
              "LANG",
              "LC_ALL",
              "TMPDIR",
              "SYSTEMROOT",
              "WINDIR",
            ].includes(k) && v !== undefined,
        ),
      ) as Record<string, string>,
      chromiumSandbox: process.platform === "linux",
      proxy: { server: proxy.url, bypass: "<-loopback>" },
      args: [
        "--disable-quic",
        "--disable-background-networking",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--js-flags=--max-old-space-size=256",
      ],
    });
    timer = setTimeout(() => {
      timedOut = true;
      void browser?.close();
    }, 120000);
    polling = setInterval(() => {
      void (async () => {
        if (await options.isCancelled()) {
          cancelled = true;
          await browser?.close();
        }
        try {
          await options.validateScope?.();
        } catch (error) {
          guardCode =
            error instanceof JourneyStop ? error.code : "CONTROL_UNAVAILABLE";
          await browser?.close();
        }
        try {
          await options.validateIdentity();
        } catch {
          identityInvalid = true;
          await browser?.close();
        }
      })().catch(() => {
        guardCode = "CONTROL_UNAVAILABLE";
        void browser?.close();
      });
    }, 1000);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: "block",
      acceptDownloads: false,
      permissions: [],
      storageState: options.identity?.session,
    });
    context.on("page", (p) => {
      if (context.pages().length > 1) {
        guardCode = "POPUP_UNSUPPORTED";
        void p.close();
      }
    });
    // tsx preserves callback names using this inert helper inside serialized browser callbacks.
    // It records no page data and is installed before navigation in every fresh context.
    await context.addInitScript(
      "if (typeof globalThis.__name !== 'function') Object.defineProperty(globalThis, '__name', { value: (fn) => fn, configurable: true });",
    );
    const page = await context.newPage();
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && /^https?:/.test(frame.url()))
        reachedUrl = safeUrl(frame.url());
    });
    page.setDefaultTimeout(d.stepTimeoutMs);
    page.setDefaultNavigationTimeout(Math.min(20000, d.stepTimeoutMs * 2));
    page.on("dialog", (dialog) => {
      guardCode = "NATIVE_DIALOG_UNSUPPORTED";
      void dialog.dismiss();
    });
    page.on("download", (download) => {
      guardCode = "DOWNLOAD_BLOCKED";
      void download.cancel();
    });
    await context.routeWebSocket("**/*", (socket) => {
      requestBlocked = true;
      socket.close();
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      try {
        const url = new URL(request.url());
        await resolveTarget(url, options.fixtureOrigin);
        // Authenticated cookies and runtime inputs must never travel to another origin.
        if (url.origin !== origin) throw new Error("scope");
        const method = request.method(),
          path = decodeURIComponent(url.pathname);
        const grant = d.grants.find((g) => g.stepId === currentStep?.id);
        const loginRequest = authPhase && options.identity?.login?.request;
        const allowedWrite = loginRequest
          ? method === loginRequest.method && path === loginRequest.path
          : grant?.requests.some((r) => r.method === method && r.path === path);
        if (
          (!["GET", "HEAD"].includes(method) || dangerous.test(path)) &&
          !allowedWrite
        )
          throw new Error("action");
        await route.continue();
      } catch {
        requestBlocked = true;
        if (
          request.isNavigationRequest() ||
          !["GET", "HEAD"].includes(request.method())
        )
          guardCode = "NETWORK_ACTION_BOUNDARY";
        await route.abort("blockedbyclient");
      }
    });
    async function ready() {
      await page.waitForLoadState("domcontentloaded");
      await page.locator("body").waitFor({ state: "visible" });
      // Require bounded DOM stability without assuming network-idle establishes readiness.
      const stable = await page.evaluate(
        async (timeout) => {
          return new Promise<boolean>((resolve) => {
            let quiet: ReturnType<typeof setTimeout>;
            const observer = new MutationObserver(() => {
              clearTimeout(quiet);
              quiet = setTimeout(finish, 150);
            });
            const deadline = setTimeout(() => {
              observer.disconnect();
              clearTimeout(quiet);
              resolve(false);
            }, timeout);
            function finish() {
              clearTimeout(deadline);
              observer.disconnect();
              resolve(true);
            }
            observer.observe(document.documentElement, {
              subtree: true,
              childList: true,
              attributes: true,
              characterData: true,
            });
            quiet = setTimeout(finish, 150);
          });
        },
        Math.min(2000, d.stepTimeoutMs),
      );
      if (!stable)
        throw new JourneyStop(
          "READINESS_UNSTABLE",
          "The page kept changing. Add an application readiness assertion or retry after it stabilizes.",
        );
      if (new URL(page.url()).origin !== origin)
        throw new JourneyStop(
          "SCOPE_CHANGED",
          "Return to the permitted environment.",
        );
      await guard();
    }
    async function roleAssertion() {
      if (d.access !== "protected") return;
      if (
        !d.signedIn ||
        /\/(login|sign-in|signin|auth|mfa|challenge)(\/|$)/i.test(
          new URL(page.url()).pathname,
        )
      )
        throw new JourneyStop(
          "AUTHENTICATION_BLOCKED",
          "Restore the intended test session/role. Login redirects and MFA are not protected coverage.",
        );
      const marker = locate(page, d.signedIn.locator);
      try {
        await marker.waitFor({ state: "visible" });
        if (
          (await marker.count()) !== 1 ||
          (await marker.innerText()).trim() !== d.signedIn.text
        )
          throw new Error();
      } catch {
        throw new JourneyStop(
          "ROLE_CHECKPOINT_NOT_REACHED",
          "Confirm the configured signed-in marker and intended role; renew the test session if necessary.",
        );
      }
    }
    if (d.access === "protected" && !options.identity)
      throw new JourneyStop(
        "IDENTITY_REQUIRED",
        "Provision a dedicated test identity before protected replay.",
      );
    if (options.identity?.login) {
      const login = options.identity.login;
      authPhase = true;
      await page.goto(login.url, { waitUntil: "domcontentloaded" });
      for (const [target, ref] of [
        [login.username, login.usernameRef],
        [login.password, login.passwordRef],
      ] as const) {
        const value = options.identity.inputs[ref];
        if (value === undefined)
          throw new JourneyStop(
            "INPUT_REFERENCE_MISSING",
            "Provision the required runtime input reference.",
          );
        await locate(page, target).fill(value);
      }
      await locate(page, login.submit).click();
      await ready();
      authPhase = false;
    }
    await page.goto(d.startUrl, { waitUntil: "domcontentloaded" });
    await ready();
    await roleAssertion();
    // Prove exclusion selectors can be honored before performing any user journey action.
    try {
      for (const selector of d.excludeSelectors)
        await page.locator(selector).count();
    } catch {
      throw new JourneyStop(
        "INVALID_EXCLUSION",
        "Correct the evidence exclusion selector before replay.",
      );
    }
    currentId = "start";
    await progress();
    const keyboard: string[] = [];
    async function safeAction(
      step: Extract<JourneyStep, { action: "click" | "key" }>,
    ) {
      const grant = d.grants.find((g) => g.stepId === step.id);
      if (
        step.effect !== "ui" &&
        (!grant ||
          grant.effect !== step.effect ||
          d.isolation !== "dedicated-test-account")
      )
        throw new JourneyStop(
          "ACTION_NOT_AUTHORIZED",
          "Review this exact consequential step and authorize its effect and requests using isolated test data, or leave it unassessed.",
        );
      let target: Locator | undefined;
      if (step.action === "click") target = locate(page, step.locator);
      else if (["Enter", "Space"].includes(step.key))
        target = page.locator(":focus");
      if (target && (await target.count()) === 1) {
        if (
          d.excludeSelectors.length &&
          (await target.evaluate(
            (el, selectors) =>
              selectors.some((s) => el.matches(s) || !!el.closest(s)),
            d.excludeSelectors,
          ))
        )
          throw new JourneyStop(
            "EXCLUDED_TARGET",
            "Keyboard focus reached an excluded region. Review scope before interacting.",
          );
        const info = await target.evaluate((element) => {
          const el = element as HTMLInputElement;
          const button = el.closest("button,input,a");
          const form = el.closest("form");
          return {
            description: [
              button?.textContent,
              button?.getAttribute("aria-label"),
              button?.getAttribute("href"),
              button?.getAttribute("type"),
              form?.getAttribute("action"),
            ]
              .filter(Boolean)
              .join(" "),
            submit:
              !!form &&
              ((el.tagName === "BUTTON" &&
                (!el.type || el.type === "submit")) ||
                (el.tagName === "INPUT" && el.type === "submit")),
            dialog: form?.method === "dialog",
            editable:
              el.isContentEditable ||
              ["INPUT", "TEXTAREA"].includes(el.tagName),
          };
        });
        const submits =
          (info.submit && !info.dialog) ||
          (step.action === "key" && step.key === "Enter" && info.editable);
        if (
          (dangerous.test(info.description) || submits) &&
          step.effect === "ui"
        )
          throw new JourneyStop(
            "UNDECLARED_CONSEQUENTIAL_ACTION",
            "The rendered control may submit or change data. Review its effect and authorize the exact step before replay.",
          );
        if (
          step.effect !== "ui" &&
          dangerous.test(info.description) &&
          inferredEffect(info.description) !== step.effect &&
          inferredEffect(info.description) !== "submission"
        )
          throw new JourneyStop(
            "ACTION_EFFECT_CHANGED",
            "The control now appears to perform a different consequential action. Review its locator and authorization.",
          );
      }
    }
    async function discover() {
      const candidates: JourneyReport["suggestions"] = [];
      const branches = await page.evaluate((exclusions) => {
        const visible = (el: Element) =>
          !exclusions.some((s) => el.matches(s) || !!el.closest(s));
        return {
          form: [...document.forms].some(visible),
          dialog: [...document.querySelectorAll('dialog,[role="dialog"]')].some(
            visible,
          ),
          expansion: [
            ...document.querySelectorAll('[aria-expanded], [role="tab"]'),
          ].some(visible),
        };
      }, d.excludeSelectors);
      if (branches.form)
        candidates.push({
          kind: "invalid-input-and-recovery",
          reason:
            "A form was present. Review an invalid input branch and recovery using safe test data.",
          status: "unreviewed",
        });
      if (branches.dialog)
        candidates.push({
          kind: "cancel-and-escape",
          reason:
            "A dialog was present. Review cancellation, Escape and focus restoration as separate selected checks.",
          status: "unreviewed",
        });
      if (branches.expansion)
        candidates.push({
          kind: "alternate-widget-state",
          reason:
            "A disclosure/tab state was present. Other branches may need an explicit variation.",
          status: "unreviewed",
        });
      for (const candidate of candidates)
        if (!report.suggestions.some((s) => s.kind === candidate.kind))
          report.suggestions.push(candidate);
    }
    for (const step of steps) {
      currentId = step.id;
      currentStep = step;
      await guard();
      if (d.access === "protected") await roleAssertion();
      try {
        if (
          "locator" in step &&
          (step.action !== "assert" || step.state !== "hidden")
        ) {
          const target = locate(page, step.locator);
          if ((await target.count()) > 1)
            throw new JourneyStop(
              "LOCATOR_AMBIGUOUS",
              "Use a unique stable locator; this step matched multiple controls.",
            );
          await target.waitFor({
            state:
              step.action === "focus" && step.expectation === "outside"
                ? "attached"
                : "visible",
          });
          if (
            d.excludeSelectors.length &&
            (await target.evaluate(
              (el, exclusions) =>
                exclusions.some((s) => el.matches(s) || !!el.closest(s)),
              d.excludeSelectors,
            ))
          )
            throw new JourneyStop(
              "EXCLUDED_TARGET",
              "This step targets an excluded region. Revise the scope explicitly before replay.",
            );
        }
        switch (step.action) {
          case "navigate":
            await page.goto(step.url, { waitUntil: "domcontentloaded" });
            keyboard.length = 0;
            break;
          case "click":
            await safeAction(step);
            await locate(page, step.locator).click();
            keyboard.length = 0;
            break;
          case "input":
          case "select": {
            keyboard.length = 0;
            const value = options.identity?.inputs[step.inputRef];
            if (value === undefined)
              throw new JourneyStop(
                "INPUT_REFERENCE_MISSING",
                "Provision the named runtime input; unrestricted literal values are never recorded in steps.",
              );
            if (step.action === "input")
              await locate(page, step.locator).fill(value);
            else await locate(page, step.locator).selectOption(value);
            break;
          }
          case "key":
            await safeAction(step);
            await page.keyboard.press(step.key);
            keyboard.push(step.key);
            break;
          case "assert": {
            const target = locate(page, step.locator);
            await target.waitFor({ state: step.state });
            if (step.text && (await target.innerText()).trim() !== step.text)
              throw new JourneyStop(
                "EXPECTED_OUTCOME_NOT_REACHED",
                "The expected state text differs. Review the application and readiness assertion.",
              );
            break;
          }
          case "checkpoint": {
            await ready();
            await roleAssertion();
            await page.addScriptTag({ content: options.scannerSource });
            const scan = scanSchema.parse(
              await page.evaluate(
                async (payload) => (window as any).__accesslyScan(payload),
                {
                  clientScanId: childId(options.id, step.id),
                  retestId:
                    options.retest?.stepId === step.id
                      ? options.retest.id
                      : undefined,
                  target:
                    options.retest?.stepId === step.id
                      ? {
                          rule: options.retest.rule,
                          locator: options.retest.locator,
                        }
                      : undefined,
                  applicationId: options.applicationId,
                  environmentId: options.environmentId,
                  mode: "worker",
                  excludeSelectors: d.excludeSelectors,
                  context: {
                    url: safeUrl(page.url()),
                    title: "Page title omitted",
                    state:
                      `J:${options.journeyId} v${options.revision} ${step.id}`.slice(
                        0,
                        120,
                      ),
                    role: d.role,
                    preconditions: d.preconditions,
                    authentication:
                      d.access === "protected"
                        ? "user-confirmed-signed-in"
                        : "signed-out",
                    appVersion: d.appVersion,
                    viewport: { width: 1440, height: 1000, deviceScale: 1 },
                  },
                },
              ),
            );
            scan.journey = {
              runId: options.id,
              journeyId: options.journeyId,
              revision: options.revision,
              stepId: step.id,
            };
            scan.limitations = scan.limitations.filter(
              (l) => !l.includes("journey"),
            );
            scan.limitations.push(
              `Journey ${options.id}, version ${options.revision}, checkpoint ${step.id}: ${step.state}. Only this reached state was scanned; transition/focus results are separate.`,
            );
            if (requestBlocked) {
              scan.completion = "partial";
              scan.limitations.push(
                "Network safety boundaries blocked content. Associated content remains unassessed.",
              );
            }
            await discover();
            await options.onCheckpoint(scan);
            report.checkpoints.push({
              stepId: step.id,
              runId: scan.clientScanId,
              state: step.state,
              completion: scan.completion,
            });
            break;
          }
          case "focus": {
            const target = locate(page, step.locator);
            const matches = await target.evaluate(
              (el, expectation) =>
                expectation === "on"
                  ? document.activeElement === el
                  : expectation === "within"
                    ? el.contains(document.activeElement)
                    : !el.contains(document.activeElement),
              step.expectation,
            );
            const observed = await focusPath(page, d.excludeSelectors);
            report.focus.push({
              stepId: step.id,
              phase: step.phase,
              expected: step.expectation,
              observed,
              outcome: matches ? "matches" : "differs",
              basis: step.basis,
              keyboardSequence: [...keyboard],
            });
            // A mismatch is evidence to review, not proof of a standards violation or a clean pass.
            if (!matches)
              report.limitations.push(
                `Focus ${step.phase} differed at ${step.id}; review the recorded observation and intended pattern.`,
              );
            break;
          }
          case "unsupported":
            throw new JourneyStop("UNSUPPORTED_CHECK", step.reason);
        }
        await ready();
        if (d.access === "protected") await roleAssertion();
        report.history.push({
          stepId: step.id,
          action: step.action,
          outcome: "completed",
          at: new Date().toISOString(),
          url: safeUrl(page.url()),
          focus: await focusPath(page, d.excludeSelectors),
        });
        await progress();
      } catch (error) {
        if (error instanceof JourneyStop) throw error;
        throw new JourneyStop(
          "STEP_NOT_REACHED",
          "The locator, expected state or readiness changed, or the operation timed out. Review this exact step and replay from the start with safe test data.",
        );
      }
    }
    await discover();
    report.status =
      report.checkpoints.length &&
      !report.checkpoints.some((c) => c.completion !== "completed") &&
      !requestBlocked
        ? "completed"
        : "incomplete";
    if (report.status === "incomplete")
      report.stop = {
        stepId: currentId,
        code: "PARTIAL_CHECKPOINT_COVERAGE",
        recovery:
          "Review blocked content and checkpoint limitations. Unassessed states remain unknown.",
      };
  } catch (error) {
    const stop = cancelled
      ? new JourneyStop(
          "CANCELLED",
          "Review preserved checkpoints. A new replay starts from the beginning.",
        )
      : identityInvalid
        ? new JourneyStop(
            "IDENTITY_UNAVAILABLE",
            "Renew or provision the dedicated identity. Reached checkpoint evidence is preserved.",
          )
        : guardCode
          ? new JourneyStop(
              guardCode,
              "Review the configured browser and action boundary; blocked content remains unassessed.",
            )
          : timedOut
            ? new JourneyStop(
                "RUN_TIMEOUT",
                "The bounded run duration was exceeded. Split the journey or review readiness.",
              )
            : error instanceof JourneyStop
              ? error
              : new JourneyStop(
                  "AUTHENTICATION_OR_START_BLOCKED",
                  "Confirm authorized access, session validity, supported login recipe, role marker and readiness. MFA/SSO challenges and unattended renewal are unsupported.",
                );
    report.status = stop.code === "CANCELLED" ? "cancelled" : "incomplete";
    report.stop = {
      stepId: currentId,
      code: stop.code,
      recovery: stop.recovery,
    };
    report.history.push({
      stepId: currentId,
      action: currentStep?.action ?? "setup",
      outcome: "blocked",
      at: new Date().toISOString(),
      url: reachedUrl,
    });
  } finally {
    if (timer) clearTimeout(timer);
    if (polling) clearInterval(polling);
    await browser?.close().catch(() => {});
    await proxy?.close();
  }
  const completed = new Set(
    report.history
      .filter((h) => h.outcome === "completed")
      .map((h) => h.stepId),
  );
  report.variations = d.variations.map((v) => ({
    id: v.id,
    name: v.name,
    status:
      v.id !== options.variationId
        ? "not-assessed"
        : v.stepIds.every((id) => completed.has(id)) &&
            report.status === "completed"
          ? "assessed"
          : v.stepIds.some((id) => completed.has(id))
            ? "partially-assessed"
            : "not-assessed",
  }));
  report.finishedAt = new Date().toISOString();
  await progress();
  return report;
}
async function focusPath(page: Page, exclusions: string[]) {
  return page.evaluate((selectors) => {
    let el = document.activeElement;
    if (!el) return "none";
    if (selectors.some((s) => el!.matches(s) || !!el!.closest(s)))
      return "excluded-region";
    const path: string[] = [];
    while (el && path.length < 16) {
      const tag = el.tagName.toLowerCase();
      const peers = el.parentElement
        ? [...el.parentElement.children].filter(
            (p) => p.tagName === el!.tagName,
          )
        : [el];
      path.unshift(`${tag}:nth-of-type(${peers.indexOf(el) + 1})`);
      el = el.parentElement;
    }
    return path.join(" > ");
  }, exclusions);
}
