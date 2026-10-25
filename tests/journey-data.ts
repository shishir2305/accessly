import type {
  JourneyDefinition,
  JourneyStep,
  JourneyLocator,
} from "../packages/contracts/src/journeys";
export const fixtureOrigin = "http://127.0.0.1:4174";
export const byId = (value: string): JourneyLocator => ({ by: "id", value });
export function definition(
  overrides: Partial<JourneyDefinition> = {},
): JourneyDefinition {
  return {
    schemaVersion: 1,
    name: "Address and error recovery",
    goal: "Review an address and recover from invalid input",
    preconditions:
      "Authorized controlled local fixture with disposable test data",
    role: "public",
    appVersion: "phase3-fixture-v1",
    startUrl: `${fixtureOrigin}/journey/good`,
    access: "public",
    expectedOutcome: "Recovery ready, with focus restored to postal input",
    isolation: "read-only",
    grants: [],
    excludeSelectors: [".secret"],
    stepTimeoutMs: 1000,
    steps: [
      key("open-menu", "Enter"),
      checkpoint("menu", "account-menu", "Open account menu"),
      focus("menu-focus", "account-menu", "within", "entry"),
      key("close-menu", "Enter"),
      key("next-section", "Tab"),
      key("expand", "Enter"),
      checkpoint("expanded", "expanded", "Expanded details"),
      key("first-tab", "Tab"),
      key("next-tab", "Tab"),
      key("activate-tab", "Enter"),
      checkpoint("tab", "pane-b", "Selected address tab"),
      key("reach-dialog", "Tab"),
      key("open-dialog", "Enter"),
      focus("dialog-entry", "address-dialog", "within", "entry"),
      checkpoint("dialog", "address-dialog", "Open address dialog"),
      key("dialog-movement", "Tab"),
      focus("dialog-contained", "address-dialog", "within", "movement"),
      key("cancel-dialog", "Enter"),
      focus("dialog-exit", "address-dialog", "outside", "exit"),
      focus("dialog-restoration", "dialog-open", "on", "restoration"),
      key("reach-postal", "Tab"),
      {
        id: "invalid-input",
        label: "Use invalid test postal reference",
        action: "input",
        locator: byId("postal"),
        inputRef: "invalidPostal",
      },
      key("reach-validation", "Tab"),
      key("validate", "Enter"),
      checkpoint("error", "error-state", "Invalid submission state"),
      focus("recovery-entry", "recovery", "on", "entry"),
      key("recover", "Enter"),
      {
        id: "expected-recovery",
        label: "Confirm error recovery",
        action: "assert",
        locator: byId("done"),
        state: "visible",
        text: "Recovery ready",
      },
      focus("recovery-restoration", "postal", "on", "restoration"),
      checkpoint("recovery", "done", "Recovery ready"),
    ],
    variations: [
      {
        id: "cancellation",
        name: "Dialog cancellation",
        stepIds: [
          "reach-dialog",
          "open-dialog",
          "dialog-entry",
          "dialog",
          "dialog-movement",
          "dialog-contained",
          "cancel-dialog",
          "dialog-restoration",
        ],
      },
      {
        id: "invalid-recovery",
        name: "Invalid input recovery",
        stepIds: [
          "invalid-input",
          "reach-validation",
          "validate",
          "error",
          "recovery-entry",
          "recover",
          "expected-recovery",
          "recovery-restoration",
          "recovery",
        ],
      },
    ],
    ...overrides,
    ...(overrides.steps && !overrides.variations ? { variations: [] } : {}),
  };
}
export function key(
  id: string,
  key: Extract<JourneyStep, { action: "key" }>["key"],
): JourneyStep {
  return { id, label: id, action: "key", key, effect: "ui" };
}
export function click(
  id: string,
  target: string,
  effect: "ui" | "purchase" | "settings" = "ui",
): JourneyStep {
  return { id, label: id, action: "click", locator: byId(target), effect };
}
export function checkpoint(
  id: string,
  target: string,
  state = id,
): JourneyStep {
  return { id, label: id, action: "checkpoint", locator: byId(target), state };
}
export function focus(
  id: string,
  target: string,
  expectation: "on" | "within" | "outside",
  phase: "entry" | "movement" | "exit" | "restoration",
): JourneyStep {
  return {
    id,
    label: id,
    action: "focus",
    locator: byId(target),
    expectation,
    phase,
    basis: "pattern-guidance",
  };
}
