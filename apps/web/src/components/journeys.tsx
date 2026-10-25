"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/client";
import {
  journeyDefinition,
  effects,
  type JourneyDefinition,
  type JourneyStep,
  type JourneyLocator,
} from "../../../../packages/contracts/src/journeys";
const empty: JourneyDefinition = {
  schemaVersion: 1,
  name: "",
  goal: "",
  preconditions: "",
  role: "public",
  appVersion: "unknown",
  startUrl: "http://127.0.0.1:4174/journey",
  access: "public",
  isolation: "read-only",
  expectedOutcome: "",
  steps: [],
  grants: [],
  variations: [],
  excludeSelectors: [],
  stepTimeoutMs: 5000,
};
function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
  );
}
const defaultLocator: JourneyLocator = { by: "id", value: "control" };
function LocatorEditor({
  value,
  change,
}: {
  value: JourneyLocator;
  change: (v: JourneyLocator) => void;
}) {
  return (
    <div className="journey-fields">
      <label>
        Locate by
        <select
          value={value.by}
          onChange={(e) =>
            change(
              e.target.value === "role"
                ? { by: "role", value: "button", name: "Control name" }
                : {
                    by: e.target.value as "id" | "testId" | "label",
                    value: "control",
                  },
            )
          }
        >
          <option value="id">Stable ID</option>
          <option value="testId">Test ID</option>
          <option value="role">Role and accessible name</option>
          <option value="label">Form label</option>
        </select>
      </label>
      {value.by === "role" ? (
        <>
          <label>
            Control role
            <select
              value={value.value}
              onChange={(e) =>
                change({
                  ...value,
                  value: e.target.value as typeof value.value,
                })
              }
            >
              {[
                "button",
                "link",
                "dialog",
                "tab",
                "menuitem",
                "textbox",
                "heading",
                "alert",
                "status",
                "region",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Field
            label="Accessible name"
            value={value.name}
            onChange={(name) => change({ ...value, name })}
          />
        </>
      ) : (
        <Field
          label="Locator value"
          value={value.value}
          onChange={(v) => change({ ...value, value: v })}
        />
      )}
    </div>
  );
}
function newStep(action: JourneyStep["action"], id: string): JourneyStep {
  const base = {
    id,
    label:
      action === "checkpoint" ? "Assess reached state" : "Describe this step",
  };
  switch (action) {
    case "navigate":
      return { ...base, action, url: empty.startUrl };
    case "click":
      return { ...base, action, locator: defaultLocator, effect: "ui" };
    case "key":
      return { ...base, action, key: "Tab", effect: "ui" };
    case "input":
    case "select":
      return {
        ...base,
        action,
        locator: defaultLocator,
        inputRef: "testInput",
      };
    case "assert":
      return { ...base, action, locator: defaultLocator, state: "visible" };
    case "checkpoint":
      return {
        ...base,
        action,
        locator: defaultLocator,
        state: "Reached state",
      };
    case "focus":
      return {
        ...base,
        action,
        locator: defaultLocator,
        expectation: "on",
        phase: "entry",
        basis: "observation",
      };
    case "unsupported":
      return { ...base, action, reason: "Describe the unsupported check" };
  }
}
export function Journeys({
  applications,
  id,
}: {
  applications: any[];
  id?: string;
}) {
  const [all, setAll] = useState<any[]>([]),
    [detail, setDetail] = useState<any>(),
    [d, setD] = useState<JourneyDefinition>(empty),
    [envId, setEnvId] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [identityId, setIdentityId] = useState(""),
    [variationId, setVariationId] = useState(""),
    [identities, setIdentities] = useState<any[]>([]),
    [draft, setDraft] = useState(""),
    [variations, setVariations] = useState("[]");
  const load = useCallback(async () => {
    try {
      const [a, i] = await Promise.all([
        api("journeys"),
        api("test-identities"),
      ]);
      setAll(a);
      setIdentities(i);
      if (id) {
        const row = await api(`journeys/${id}`);
        setDetail(row);
        setD(row.definition);
        setEnvId(row.environmentId);
        setVariations(JSON.stringify(row.definition.variations, null, 2));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const selectedApp = applications.find((a) =>
    a.environments.some(
      (e: any) => e.id === (envId || applications[0]?.environments[0]?.id),
    ),
  );
  const environmentId = envId || applications[0]?.environments[0]?.id;
  function update(patch: Partial<JourneyDefinition>) {
    setD((current) => ({ ...current, ...patch }));
  }
  function stepUpdate(index: number, step: JourneyStep) {
    update({
      steps: d.steps.map((s, i) => (i === index ? step : s)),
      ...(d.steps[index].action !== step.action
        ? { grants: d.grants.filter((g) => g.stepId !== step.id) }
        : {}),
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const definition = journeyDefinition.parse({
        ...d,
        variations: JSON.parse(variations),
      });
      const row = await api(id ? `journeys/${id}` : "journeys", {
        method: "POST",
        body: JSON.stringify({
          applicationId: selectedApp?.id,
          environmentId,
          revision: detail?.revision,
          definition,
        }),
      });
      if (!id) location.assign(`/journeys/${row.id}`);
      else {
        await load();
        setStatus(
          `Version ${row.revision} saved. Historical runs retain their prior definition.`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function replay() {
    setBusy(true);
    setError("");
    try {
      const run = await api(`journeys/${id}/runs`, {
        method: "POST",
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          revision: detail.revision,
          identityId: identityId || undefined,
          variationId: variationId || undefined,
        }),
      });
      location.assign(`/runs/${run.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="journey-workspace">
      <div className="panel">
        <h2>Repeatable, bounded journeys</h2>
        <p>
          Assess selected states and transitions in Chromium using authorized
          test data. Checkpoints retain valid findings if a later step stops. A
          completed journey reports selected checks, with human review still
          needed. Other branches remain unassessed.
        </p>
        <p>
          <a href="/journeys">New journey</a>
        </p>
        <ul>
          {all.map((j) => (
            <li key={j.id}>
              <a href={`/journeys/${j.id}`}>{j.definition.name}</a> · version{" "}
              {j.revision} · {j.definition.role} · {j.definition.access}
            </li>
          ))}
        </ul>
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <p role="status">{status}</p>
      <form className="panel journey-editor" onSubmit={save}>
        <h2>
          {id
            ? `Edit journey · version ${detail?.revision ?? "…"}`
            : "Define a journey"}
        </h2>
        <label>
          Application and environment
          <select
            value={environmentId ?? ""}
            onChange={(e) => setEnvId(e.target.value)}
            disabled={!!id}
            required
          >
            <option value="">Choose environment</option>
            {applications.flatMap((a) =>
              a.environments.map((e: any) => (
                <option key={e.id} value={e.id}>
                  {a.name} · {e.name}
                </option>
              )),
            )}
          </select>
        </label>
        <Field
          label="Journey name"
          value={d.name}
          onChange={(name) => update({ name })}
          required
        />
        <Field
          label="Task goal"
          value={d.goal}
          onChange={(goal) => update({ goal })}
          required
        />
        <Field
          label="Expected task outcome"
          value={d.expectedOutcome}
          onChange={(expectedOutcome) => update({ expectedOutcome })}
          required
        />
        <Field
          label="Starting URL"
          value={d.startUrl}
          onChange={(startUrl) => update({ startUrl })}
          type="url"
          required
        />
        <Field
          label="Preconditions (safe descriptions only)"
          value={d.preconditions}
          onChange={(preconditions) => update({ preconditions })}
        />
        <div className="journey-fields">
          <Field
            label="Intended role"
            value={d.role}
            onChange={(role) => update({ role })}
            required
          />
          <Field
            label="Application version"
            value={d.appVersion}
            onChange={(appVersion) => update({ appVersion })}
          />
          <label>
            Access
            <select
              value={d.access}
              onChange={(e) =>
                update({
                  access: e.target.value as typeof d.access,
                  signedIn:
                    e.target.value === "protected"
                      ? {
                          locator: { by: "id", value: "identity" },
                          text: "Signed in as customer.",
                        }
                      : undefined,
                })
              }
            >
              <option value="public">Public</option>
              <option value="protected">Protected</option>
            </select>
          </label>
        </div>
        {d.signedIn && (
          <fieldset>
            <legend>Required signed-in role checkpoint</legend>
            <LocatorEditor
              value={d.signedIn.locator}
              change={(locator) =>
                update({ signedIn: { ...d.signedIn!, locator } })
              }
            />
            <Field
              label="Exact role marker text"
              value={d.signedIn.text}
              onChange={(text) =>
                update({ signedIn: { ...d.signedIn!, text } })
              }
            />
            <p>
              This explicit assertion must pass before any protected checkpoint
              is assessed and after every action. Login and MFA interruptions
              remain incomplete.
            </p>
          </fieldset>
        )}
        <label>
          Action isolation
          <select
            value={d.isolation}
            onChange={(e) =>
              update({ isolation: e.target.value as typeof d.isolation })
            }
          >
            <option value="read-only">Read-only navigation and UI</option>
            <option value="dedicated-test-account">
              Authorized disposable test data/account
            </option>
          </select>
        </label>
        <Field
          label="Excluded CSS selectors (one per line; comma separated also supported)"
          value={d.excludeSelectors.join("\n")}
          onChange={(v) =>
            update({
              excludeSelectors: v
                .split(/\n|,/)
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        <p>
          Secrets and literal input values do not belong in steps. Use runtime
          input references provisioned below. Evidence contains structural focus
          locations and action IDs; raw traces and screenshots are disabled
          because redaction cannot be guaranteed.
        </p>
        <h3>Ordered steps and checkpoints</h3>
        {d.steps.map((step, index) => (
          <fieldset key={step.id}>
            <legend>
              Step {index + 1} · {step.id}
            </legend>
            <Field
              label="Step description"
              value={step.label}
              onChange={(label) => stepUpdate(index, { ...step, label })}
            />
            <label>
              Action
              <select
                value={step.action}
                onChange={(e) =>
                  stepUpdate(
                    index,
                    newStep(e.target.value as JourneyStep["action"], step.id),
                  )
                }
              >
                {[
                  "navigate",
                  "click",
                  "input",
                  "select",
                  "key",
                  "assert",
                  "checkpoint",
                  "focus",
                  "unsupported",
                ].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            {"locator" in step && (
              <LocatorEditor
                value={step.locator}
                change={(locator) => stepUpdate(index, { ...step, locator })}
              />
            )}
            {step.action === "navigate" && (
              <Field
                label="Navigation URL"
                value={step.url}
                onChange={(url) => stepUpdate(index, { ...step, url })}
              />
            )}
            {(step.action === "input" || step.action === "select") && (
              <Field
                label="Runtime input reference"
                value={step.inputRef}
                onChange={(inputRef) =>
                  stepUpdate(index, { ...step, inputRef })
                }
              />
            )}
            {step.action === "key" && (
              <label>
                Keyboard command
                <select
                  value={step.key}
                  onChange={(e) =>
                    stepUpdate(index, {
                      ...step,
                      key: e.target.value as typeof step.key,
                    })
                  }
                >
                  {[
                    "Tab",
                    "Shift+Tab",
                    "Enter",
                    "Space",
                    "Escape",
                    "ArrowDown",
                    "ArrowUp",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                  ].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
            )}
            {(step.action === "click" || step.action === "key") && (
              <>
                <label>
                  Action effect
                  <select
                    value={step.effect}
                    onChange={(e) => {
                      stepUpdate(index, {
                        ...step,
                        effect: e.target.value as typeof step.effect,
                      });
                      update({
                        grants: d.grants.filter((g) => g.stepId !== step.id),
                        steps: d.steps.map((s, i) =>
                          i === index
                            ? {
                                ...step,
                                effect: e.target.value as typeof step.effect,
                              }
                            : s,
                        ),
                      });
                    }}
                  >
                    {effects.map((e) => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>
                </label>
                {step.effect !== "ui" && (
                  <div>
                    <label>
                      <input
                        type="checkbox"
                        checked={d.grants.some((g) => g.stepId === step.id)}
                        onChange={(e) =>
                          update({
                            grants: e.target.checked
                              ? [
                                  ...d.grants,
                                  {
                                    stepId: step.id,
                                    effect: step.effect as Exclude<
                                      typeof step.effect,
                                      "ui"
                                    >,
                                    reason:
                                      "Authorized in disposable local test data",
                                    requests: [],
                                  },
                                ]
                              : d.grants.filter((g) => g.stepId !== step.id),
                          })
                        }
                      />{" "}
                      Authorize this exact consequential action in isolated test
                      data
                    </label>
                    {d.grants.find((g) => g.stepId === step.id) && (
                      <>
                        <Field
                          label="Authorization reason"
                          value={
                            d.grants.find((g) => g.stepId === step.id)!.reason
                          }
                          onChange={(reason) =>
                            update({
                              grants: d.grants.map((g) =>
                                g.stepId === step.id ? { ...g, reason } : g,
                              ),
                            })
                          }
                        />
                        <label>
                          Allowed requests, METHOD /exact/path, one per line
                          <textarea
                            value={d.grants
                              .find((g) => g.stepId === step.id)!
                              .requests.map((r) => `${r.method} ${r.path}`)
                              .join("\n")}
                            onChange={(e) =>
                              update({
                                grants: d.grants.map((g) =>
                                  g.stepId === step.id
                                    ? {
                                        ...g,
                                        requests: e.target.value
                                          .split("\n")
                                          .filter(Boolean)
                                          .map((line) => {
                                            const [method, path] =
                                              line.split(" ");
                                            return {
                                              method: method as "POST",
                                              path: path ?? "",
                                            };
                                          }),
                                      }
                                    : g,
                                ),
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            {step.action === "checkpoint" && (
              <Field
                label="Checkpoint state and expected readiness"
                value={step.state}
                onChange={(state) => stepUpdate(index, { ...step, state })}
              />
            )}
            {step.action === "assert" && (
              <>
                <label>
                  Expected visibility
                  <select
                    value={step.state}
                    onChange={(e) =>
                      stepUpdate(index, {
                        ...step,
                        state: e.target.value as typeof step.state,
                      })
                    }
                  >
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
                <Field
                  label="Expected exact text (optional)"
                  value={step.text ?? ""}
                  onChange={(text) =>
                    stepUpdate(index, { ...step, text: text || undefined })
                  }
                />
              </>
            )}
            {step.action === "focus" && (
              <div className="journey-fields">
                <label>
                  Focus relationship
                  <select
                    value={step.expectation}
                    onChange={(e) =>
                      stepUpdate(index, {
                        ...step,
                        expectation: e.target.value as typeof step.expectation,
                      })
                    }
                  >
                    <option value="on">On target</option>
                    <option value="within">Within target</option>
                    <option value="outside">Outside target</option>
                  </select>
                </label>
                <label>
                  Focus phase
                  <select
                    value={step.phase}
                    onChange={(e) =>
                      stepUpdate(index, {
                        ...step,
                        phase: e.target.value as typeof step.phase,
                      })
                    }
                  >
                    {["entry", "movement", "exit", "restoration"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Interpretation
                  <select
                    value={step.basis}
                    onChange={(e) =>
                      stepUpdate(index, {
                        ...step,
                        basis: e.target.value as typeof step.basis,
                      })
                    }
                  >
                    <option value="observation">Observation</option>
                    <option value="pattern-guidance">Pattern guidance</option>
                  </select>
                </label>
              </div>
            )}
            {step.action === "unsupported" && (
              <Field
                label="Unsupported check and next action"
                value={step.reason}
                onChange={(reason) => stepUpdate(index, { ...step, reason })}
              />
            )}
            <div className="journey-actions">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => {
                  const steps = [...d.steps];
                  [steps[index - 1], steps[index]] = [
                    steps[index],
                    steps[index - 1],
                  ];
                  update({ steps });
                }}
              >
                Move step {index + 1} up
              </button>
              <button
                type="button"
                onClick={() =>
                  update({
                    steps: d.steps.filter((s) => s.id !== step.id),
                    grants: d.grants.filter((g) => g.stepId !== step.id),
                  })
                }
              >
                Remove step {index + 1}
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() =>
            update({
              steps: [
                ...d.steps,
                newStep(
                  "checkpoint",
                  `step_${crypto.randomUUID().slice(0, 8)}`,
                ),
              ],
            })
          }
        >
          Add step
        </button>
        <details>
          <summary>Import recorded steps and define variations</summary>
          <label>
            Recorded steps JSON
            <textarea
              rows={8}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              try {
                const parsed = journeyDefinition.shape.steps.parse(
                  JSON.parse(draft),
                );
                update({ steps: parsed, grants: [] });
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Import draft for review
          </button>
          <label>
            Variations JSON: id, name, ordered stepIds
            <textarea
              rows={5}
              value={variations}
              onChange={(e) => setVariations(e.target.value)}
            />
          </label>
          <p>
            Variations run separately. A main run never silently establishes
            that every branch was assessed. Suggestions remain unreviewed until
            you define and run a variation.
          </p>
        </details>
        <button disabled={busy || !applications.length}>
          {busy ? "Working…" : id ? "Save new version" : "Save journey"}
        </button>
      </form>
      {id && detail && (
        <section className="panel">
          <h2>Replay saved version {detail.revision}</h2>
          <p>
            Review the saved goal, role and action boundaries above before
            starting. Save edits first. A new run starts at the beginning;
            checkpoint evidence is preserved but side effects are never
            automatically resumed.
          </p>
          <label>
            Configured test identity
            <select
              value={identityId}
              onChange={(e) => setIdentityId(e.target.value)}
            >
              <option value="">No identity (public/read-only)</option>
              {identities
                .filter(
                  (i) =>
                    i.environmentId === environmentId &&
                    i.role === detail.definition.role &&
                    !i.revokedAt,
                )
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.kind} · expires{" "}
                    {new Date(i.expiresAt).toLocaleString()}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Variation
            <select
              value={variationId}
              onChange={(e) => setVariationId(e.target.value)}
            >
              <option value="">
                Main explicit sequence (other variations unassessed)
              </option>
              {detail.definition.variations.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={
              busy ||
              JSON.stringify(d) !== JSON.stringify(detail.definition) ||
              variations !==
                JSON.stringify(detail.definition.variations, null, 2)
            }
            onClick={() => void replay()}
          >
            Replay saved journey
          </button>
          <h3>Version and run history</h3>
          <p>
            {detail.versions.length} immutable saved versions. Changes to goal,
            role, steps or boundaries require separate assessment; earlier
            results keep their original context.
          </p>
          <ul>
            {detail.history.map((h: any) => (
              <li key={h.run.id}>
                <a href={`/runs/${h.run.id}`}>
                  Version {h.journey.revision} · {h.run.status} ·{" "}
                  {new Date(h.run.createdAt).toLocaleString()}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <IdentitySetup
        applications={applications}
        identities={identities}
        reload={load}
      />
    </div>
  );
}
function IdentitySetup({
  applications,
  identities,
  reload,
}: {
  applications: any[];
  identities: any[];
  reload: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState("login"),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const environmentId = String(f.get("environmentId")),
        a = applications.find((a) =>
          a.environments.some((env: any) => env.id === environmentId),
        );
      const inputs: Record<string, string> = {};
      for (const line of String(f.get("inputs") ?? "")
        .split("\n")
        .filter(Boolean)) {
        const at = line.indexOf("=");
        if (at < 1)
          throw new Error("Runtime inputs use reference=value, one per line.");
        inputs[line.slice(0, at)] = line.slice(at + 1);
      }
      if (kind === "login") {
        inputs.username = String(f.get("username"));
        inputs.password = String(f.get("password"));
      }
      await api("test-identities", {
        method: "POST",
        body: JSON.stringify({
          applicationId: a.id,
          environmentId,
          name: f.get("name"),
          role: f.get("role"),
          dedicatedTestIdentity: f.get("dedicated") === "on",
          expiresAt: new Date(String(f.get("expiry"))).toISOString(),
          inputs,
          login:
            kind === "login"
              ? {
                  url: f.get("loginUrl"),
                  username: { by: "id", value: f.get("usernameId") },
                  usernameRef: "username",
                  password: { by: "id", value: f.get("passwordId") },
                  passwordRef: "password",
                  submit: { by: "id", value: f.get("submitId") },
                  request: { method: "POST", path: f.get("loginPath") },
                }
              : undefined,
          session:
            kind === "session"
              ? JSON.parse(String(f.get("session")))
              : undefined,
        }),
      });
      form.reset();
      setStatus(
        "Dedicated test identity provisioned. Secret values cannot be read back through the API.",
      );
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Dedicated test identities and runtime inputs</h2>
      <p>
        These credentials are separate from the browser extension session.
        Supported: explicit username/password POST recipes, or host-scoped
        cookies/local storage provisioned by the account owner. SSO, MFA,
        CAPTCHA, sessionStorage and IndexedDB renewal are unsupported and
        produce incomplete runs. Secrets are encrypted with a versioned server
        key; normal reports omit their values. Identity use is serialized; use
        separate accounts when tests could interfere.
      </p>
      {error && (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      )}
      <p role="status">{status}</p>
      <ul>
        {identities.map((i) => (
          <li key={i.id}>
            {i.name} · {i.role} ·{" "}
            {i.revokedAt
              ? "revoked; encrypted material deleted"
              : `expires ${new Date(i.expiresAt).toLocaleString()}`}{" "}
            {!i.revokedAt && (
              <button
                onClick={async () => {
                  try {
                    await api(`test-identities/${i.id}`, { method: "DELETE" });
                    await reload();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Revoke {i.name}
              </button>
            )}
          </li>
        ))}
      </ul>
      <form className="journey-editor" onSubmit={submit}>
        <label>
          Identity environment
          <select name="environmentId" required>
            {applications.flatMap((a) =>
              a.environments.map((env: any) => (
                <option key={env.id} value={env.id}>
                  {a.name} · {env.name}
                </option>
              )),
            )}
          </select>
        </label>
        <label>
          Identity name
          <input name="name" required maxLength={100} />
        </label>
        <label>
          Identity role
          <input name="role" required defaultValue="customer" maxLength={80} />
        </label>
        <label>
          Expires within 30 days
          <input name="expiry" type="datetime-local" required />
        </label>
        <label>
          Provisioning method
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="login">Username/password login recipe</option>
            <option value="session">
              Explicit browser session provisioning
            </option>
            <option value="inputs">Runtime inputs only</option>
          </select>
        </label>
        {kind === "login" && (
          <fieldset>
            <legend>Supported login recipe</legend>
            <label>
              Login URL
              <input name="loginUrl" type="url" required />
            </label>
            <label>
              Username input ID
              <input name="usernameId" required />
            </label>
            <label>
              Password input ID
              <input name="passwordId" required />
            </label>
            <label>
              Sign-in button ID
              <input name="submitId" required />
            </label>
            <label>
              Exact login POST path
              <input name="loginPath" required defaultValue="/login" />
            </label>
            <label>
              Test username
              <input name="username" autoComplete="off" required />
            </label>
            <label>
              Test password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          </fieldset>
        )}
        {kind === "session" && (
          <label>
            Playwright storage state JSON (secret)
            <textarea
              name="session"
              rows={5}
              required
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
        <label>
          Runtime inputs (secret), reference=value per line
          <textarea
            name="inputs"
            rows={4}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          <input type="checkbox" name="dedicated" required /> I authorize this
          dedicated test identity and isolated test data for the selected
          application/environment/role.
        </label>
        <p>
          Revocation deletes live encrypted material and blocks further steps.
          Offline backups need separate protection and deletion. Local key
          custody is configured in .env.local; hosted KMS, residency and
          commercial guarantees remain open.
        </p>
        <button disabled={busy || !applications.length}>
          {busy ? "Provisioning…" : "Provision test identity"}
        </button>
      </form>
    </section>
  );
}
export function JourneyRunView({ id }: { id: string }) {
  const [run, setRun] = useState<any>(),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setRun(await api(`journey-runs/${id}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [load]);
  if (!run)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading journey progress…"}
      </p>
    );
  const r = run.report;
  return (
    <div className="journey-workspace">
      <section className="panel">
        <h2>
          {run.definition.name} · version {run.revision}
        </h2>
        <p role="status">
          Execution: {run.status}.{" "}
          {r?.status === "completed"
            ? "Selected journey checks completed; this is not full accessibility verification."
            : "Unreached steps and unsupported checks remain unassessed."}
        </p>
        {error && <p role="alert">{error}</p>}
        <p>
          {run.definition.goal} Expected task outcome:{" "}
          {run.definition.expectedOutcome}
        </p>
        <p>
          Role: {run.definition.role} · {run.definition.access} · runner version{" "}
          {r?.runnerVersion ?? "1"} · {new Date(run.createdAt).toLocaleString()}
        </p>
        <a href={`/journeys/${run.journeyId}`}>
          Review journey, versions and action boundaries
        </a>
        {run.error && <p className="notice notice-error">{run.error}</p>}
        {r?.stop && (
          <p className="notice notice-error">
            Stopped at <strong>{r.stop.stepId}</strong>: {r.stop.code}.{" "}
            {r.stop.recovery}
          </p>
        )}
        {["queued", "running"].includes(run.status) && (
          <button
            onClick={async () => {
              try {
                await api(`runs/${id}/cancel`, { method: "POST" });
                await load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Cancel journey
          </button>
        )}
        <h3>Reached scope and retained checkpoint findings</h3>
        <p>
          {r?.checkpoints.length ?? 0} of{" "}
          {
            run.definition.steps.filter(
              (s: any) =>
                s.action === "checkpoint" &&
                (!run.variationId ||
                  run.definition.variations
                    .find((v: any) => v.id === run.variationId)
                    ?.stepIds.includes(s.id)),
            ).length
          }{" "}
          selected checkpoints retained.
        </p>
        {run.checkpoints.map((c: any) => (
          <article className="mvp-record" key={c.stepId}>
            <h4>
              {c.state} · {c.completion}
            </h4>
            <a href={`/runs/${c.runId}`}>
              Inspect checkpoint checks and findings
            </a>
            <p>
              {c.assessment.findings.length} finding occurrences. Original
              evidence remains available if later steps fail.
            </p>
            <ul>
              {c.assessment.findings.map((f: any) => (
                <li key={f.id}>
                  <a href={`/findings/${f.id}`}>{f.check.help}</a> · {f.outcome}
                </li>
              ))}
            </ul>
          </article>
        ))}
        <h3>Exact triggering sequence</h3>
        <ol>
          {run.definition.steps.map((s: any) => {
            const h = r?.history.find((h: any) => h.stepId === s.id);
            return (
              <li key={s.id}>
                {s.label} ({s.action}) · {h?.outcome ?? "not assessed"}
                {h?.focus && <span> · observed focus: {h.focus}</span>}
              </li>
            );
          })}
        </ol>
        <h3>Keyboard and focus observations</h3>
        <p>
          Pointer completion never establishes keyboard accessibility. Focus
          observations and pattern guidance need contextual review; they are
          separate from established automated rule failures.
        </p>
        <ul>
          {r?.focus.map((f: any) => (
            <li key={f.stepId}>
              {f.stepId} · {f.phase} · {f.outcome} · {f.basis} · expected{" "}
              {f.expected} · observed {f.observed} · keyboard sequence:{" "}
              {f.keyboardSequence.join(", ") || "none evaluated"}
            </li>
          ))}
        </ul>
        <h3>Variations and reviewable branch suggestions</h3>
        <ul>
          {r?.variations.map((v: any) => (
            <li key={v.id}>
              {v.name}: {v.status}
            </li>
          ))}
        </ul>
        <ul>
          {r?.suggestions.map((s: any) => (
            <li key={s.kind}>
              {s.reason} · {s.status}. Add an explicit variation before
              assessing it.
            </li>
          ))}
        </ul>
        <h3>Limitations and remaining human review</h3>
        <ul>
          {r?.limitations.map((l: string) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p>
          Replaying does not resolve findings. Use the existing finding
          verification workflow with appropriate comparable evidence and human
          review. Historical journey versions retain distinct scope.
        </p>
      </section>
    </div>
  );
}
