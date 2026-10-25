"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@accessly/ui";
import { workStates, evidenceAssessments } from "@accessly/contracts";
import { api } from "../lib/client";
const label = (s: string) => s.replaceAll("-", " ");
const date = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
function Notice({ error, message }: { error: string; message?: string }) {
  return (
    <>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function FindingQueue({ applications }: { applications: any[] }) {
  const [filters, setFilters] = useState({
      view: "open",
      search: "",
      state: "",
      applicationId: "",
    }),
    [data, setData] = useState<any>(null),
    [views, setViews] = useState<any[]>([]),
    [error, setError] = useState(""),
    [name, setName] = useState("");
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v),
      );
      const [d, v] = await Promise.all([
        api(`findings?${params}`),
        api("views"),
      ]);
      setData(d);
      setViews(v);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filters]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api("views", {
        method: "POST",
        body: JSON.stringify({
          name,
          filters: Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v),
          ),
        }),
      });
      setName("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Notice error={error} />
      {data && (
        <div className="mvp-stats">
          {[
            ["Open work", data.counts.open],
            ["Awaiting verification", data.counts.awaitingVerification],
            ["Verified resolutions", data.counts.resolved],
            ["Closed after review", data.counts.closedAfterReview],
          ].map(([title, value]) => (
            <div className="panel" key={title}>
              <span>{title}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
      <section className="panel">
        <h2>Find work that needs a decision</h2>
        <p className="fine">
          Verified resolutions and reviewed closures are counted separately.
          Removing coverage or accepting a remedy does not count as a fix.
        </p>
        <div className="mvp-filter-grid">
          <label>
            Work view
            <select
              value={filters.view}
              onChange={(e) => setFilters({ ...filters, view: e.target.value })}
            >
              {[
                "open",
                "awaiting-verification",
                "resolved",
                "closed-after-review",
                "all",
              ].map((v) => (
                <option value={v} key={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Application filter
            <select
              value={filters.applicationId}
              onChange={(e) =>
                setFilters({ ...filters, applicationId: e.target.value })
              }
            >
              <option value="">All applications</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Work state filter
            <select
              value={filters.state}
              onChange={(e) =>
                setFilters({ ...filters, state: e.target.value })
              }
            >
              <option value="">Any work state</option>
              {workStates.map((s) => (
                <option value={s} key={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search rule or state
            <input
              value={filters.search}
              maxLength={100}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </label>
        </div>
        <form onSubmit={save} className="mvp-save-view">
          <label>
            Saved view name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <Button variant="secondary">Save current filters</Button>
        </form>
        {views.length > 0 && (
          <div className="row mvp-saved-views" aria-label="Saved finding views">
            {views.map((v) => (
              <span key={v.id}>
                <button
                  className="button button-secondary"
                  onClick={() =>
                    setFilters({
                      view: "open",
                      search: "",
                      state: "",
                      applicationId: "",
                      ...v.filters,
                    })
                  }
                >
                  {v.name}
                </button>
                <button
                  className="button button-ghost"
                  aria-label={`Delete saved view ${v.name}`}
                  onClick={() =>
                    void api(`views/${v.id}`, { method: "DELETE" })
                      .then(load)
                      .catch((e) => setError(e.message))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
      <section className="table-wrap">
        <table>
          <caption className="sr-only">
            Tracked accessibility findings and remediation status
          </caption>
          <thead>
            <tr>
              <th>Finding</th>
              <th>Page state / role</th>
              <th>Evidence assessment</th>
              <th>Work state</th>
              <th>Last observed</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((f: any) => (
              <tr key={f.id}>
                <td>
                  <a className="table-title" href={`/findings/${f.id}`}>
                    {f.check.help}
                  </a>
                  <small>{f.rule}</small>
                </td>
                <td>
                  {f.context.state}
                  <small>Role: {f.context.role}</small>
                </td>
                <td>
                  <Pill>{label(f.assessment)}</Pill>
                </td>
                <td>
                  <Pill>{label(f.workState)}</Pill>
                </td>
                <td>{date(f.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.items.length === 0 && (
          <div className="empty">
            <h3>No findings match these filters</h3>
            <p>
              This is a work view, not a complete accessibility assessment.
              Change the filters or scan an application.
            </p>
          </div>
        )}
      </section>
      {data && (
        <p className="fine">
          Showing {data.items.length} matching findings, limited to {data.limit}{" "}
          per view. Workspace total: {data.total} tracked concerns.
        </p>
      )}
    </>
  );
}
export function FindingWorkspace({ id }: { id: string }) {
  const [f, setF] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [method, setMethod] = useState("automated-targeted"),
    [adjacent, setAdjacent] = useState(false);
  const load = useCallback(async () => {
    const data = await api(`findings/${id}`);
    setF(data);
    const outstanding = data.verifications.find(
      (v: any) =>
        v.record.remedy?.version === data.remedyVersion &&
        v.record.adjacentRequired,
    );
    setAdjacent(
      !!outstanding && outstanding.record.adjacentOutcome !== "passed",
    );
  }, [id]);
  useEffect(() => {
    setF(null);
    setError("");
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function perform(path: string, data: any, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(path, {
        method: "POST",
        body: JSON.stringify(data),
      });
      await load();
      setMessage(
        result.reasons?.length
          ? `Decision recorded; review remains required: ${result.reasons.join("; ")}`
          : success,
      );
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const state = String(d.get("state") ?? f.workState);
    void perform(
      `findings/${id}`,
      {
        revision: f.revision,
        state: ["resolved", "reopened"].includes(state) ? undefined : state,
        assessment: d.get("assessment"),
        reason: d.get("reason"),
        closureReason:
          state === "closed-after-review" ? d.get("closureReason") : undefined,
        remedyNotes: d.get("remedyNotes"),
        remedyVersion: d.get("remedyVersion"),
        steps: String(d.get("steps"))
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        safeInputs: d.get("safeInputs"),
        expectedOutcome: d.get("expectedOutcome"),
      },
      "Remediation details saved. A remedy is not resolved until appropriate verification completes.",
    );
  }
  function attempt(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    void perform(
      `findings/${id}/attempts`,
      {
        outcome: d.get("outcome"),
        conditions: d.get("conditions"),
        notes: d.get("notes"),
        context: {
          ...f.context,
          role: d.get("role"),
          state: d.get("state"),
          authentication: d.get("authentication"),
          appVersion: d.get("version"),
        },
      },
      "Reproduction attempt recorded without replacing the original observation.",
    );
  }
  function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const manual = method !== "automated-targeted";
    void perform(
      `findings/${id}/verifications`,
      {
        revision: f.revision,
        retestId: d.get("retestId"),
        method,
        outcome: d.get("outcome"),
        conditions: d.get("conditions"),
        actualOutcome: d.get("actualOutcome"),
        expectedOutcome: d.get("expectedOutcome"),
        limitations: d.get("limitations"),
        contextConfirmed: d.has("contextConfirmed"),
        identityConfirmed: d.has("identityConfirmed"),
        capabilityPreserved: d.has("capabilityPreserved"),
        humanReviewComplete: d.has("humanReviewComplete"),
        reviewMethod: String(d.get("reviewMethod") ?? ""),
        manualContext: manual
          ? {
              ...f.context,
              url: d.get("manualUrl"),
              state: d.get("manualState"),
              role: d.get("manualRole"),
              authentication: d.get("manualAuthentication"),
              appVersion: d.get("manualVersion"),
              viewport: {
                width: Number(d.get("manualWidth")),
                height: Number(d.get("manualHeight")),
                deviceScale: Number(d.get("manualScale")),
              },
            }
          : undefined,
        adjacentRequired: adjacent,
        adjacentOutcome: adjacent ? d.get("adjacentOutcome") : "not-required",
        adjacentNotes: String(d.get("adjacentNotes") ?? ""),
      },
      "Verification decision recorded. Inspect its outcome and remaining limitations below.",
    );
  }
  if (!f)
    return (
      <>
        <Notice error={error} />
        <p role="status">
          {error
            ? "Finding unavailable. Restore access or return to the work queue."
            : "Loading finding…"}
        </p>
        <a href="/findings">Return to findings</a>
      </>
    );
  const editable = !["resolved", "closed-after-review"].includes(f.workState);
  return (
    <>
      <a href="/findings" className="back-link">
        ← All findings
      </a>
      <Notice error={error} message={message} />
      <section className="panel mvp-finding-heading">
        <div>
          <h2>{f.check.help}</h2>
          <p>{f.explanation.impact}</p>
          <div className="row">
            <Pill>Work: {label(f.workState)}</Pill>
            <Pill>Evidence: {label(f.assessment)}</Pill>
            <Pill>{label(f.verificationRequirement)}</Pill>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Refresh finding
        </Button>
      </section>
      <div className="results-layout">
        <div>
          <section className="panel">
            <h2>Original context and reproduction</h2>
            {f.originalJourney && (
              <p>
                <a href={`/runs/${f.originalJourney.runId}`}>
                  Recorded journey version {f.originalJourney.revision},
                  checkpoint {f.originalJourney.stepId}: inspect triggering
                  actions and focus evidence
                </a>
                . Targeted retests replay this saved sequence with its original
                authorized boundaries and configured identity.
              </p>
            )}
            <dl className="context-grid">
              <div>
                <dt>Page</dt>
                <dd>{f.context.url}</dd>
              </div>
              <div>
                <dt>State</dt>
                <dd>{f.context.state}</dd>
              </div>
              <div>
                <dt>Role / authentication</dt>
                <dd>
                  {f.context.role} · {f.context.authentication}
                </dd>
              </div>
            </dl>
            <p className="fine">
              {f.context.preconditions ||
                "Original preconditions were not supplied."}
            </p>
            <code className="locator">{f.locator}</code>
            <p>{f.check.description}</p>
            <p className="fine">
              Steps below are user-provided instructions. They were not recorded
              or replayed automatically.
            </p>
            {f.steps.length > 0 ? (
              <ol>
                {f.steps.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            ) : (
              <p className="fine">No manual reproduction steps recorded.</p>
            )}
            <h3>Rule-based guidance</h3>
            <p>{f.explanation.remedy}</p>
            <a href={f.check.helpUrl} target="_blank" rel="noreferrer">
              Read the rule documentation ↗
            </a>
          </section>
          <section className="panel">
            <h2>Track the remedy</h2>
            <form key={`edit-${f.revision}`} onSubmit={edit}>
              <div className="form-grid">
                <label>
                  Work state
                  <select name="state" defaultValue={f.workState}>
                    {workStates.map((s) => (
                      <option
                        value={s}
                        key={s}
                        disabled={["resolved", "reopened"].includes(s)}
                      >
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Evidence assessment
                  <select name="assessment" defaultValue={f.assessment}>
                    {evidenceAssessments.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Review closure reason{" "}
                <span className="optional">
                  required only for closed after review
                </span>
                <select
                  name="closureReason"
                  defaultValue={f.closureReason ?? ""}
                >
                  <option value="">Choose a reviewed reason</option>
                  <option value="false-positive">False positive</option>
                  <option value="retired-functionality">
                    Retired functionality
                  </option>
                  <option value="not-applicable">
                    Not applicable in the recorded scope
                  </option>
                </select>
              </label>
              <label>
                Remedy notes
                <textarea
                  name="remedyNotes"
                  rows={3}
                  defaultValue={f.remedyNotes}
                  maxLength={4000}
                />
              </label>
              <label>
                Version containing the remedy
                <input
                  name="remedyVersion"
                  defaultValue={f.remedyVersion}
                  maxLength={100}
                  placeholder="For example, local build 2026-10-25"
                />
              </label>
              <label>
                Expected accessible outcome
                <textarea
                  name="expectedOutcome"
                  defaultValue={f.expectedOutcome}
                  maxLength={2000}
                  rows={2}
                />
              </label>
              <label>
                Manual reproduction steps{" "}
                <span className="optional">one step per line; no secrets</span>
                <textarea
                  name="steps"
                  defaultValue={f.steps.join("\n")}
                  rows={4}
                />
              </label>
              <label>
                Safe input descriptions
                <textarea
                  name="safeInputs"
                  defaultValue={f.safeInputs}
                  rows={2}
                  maxLength={2000}
                />
              </label>
              <label>
                Reason for this change
                <textarea name="reason" required maxLength={2000} rows={2} />
              </label>
              <p className="fine">
                Resolved is set only by an appropriate verification decision.
                False positives and retired features remain separate from
                verified repairs.
              </p>
              <Button disabled={busy}>Save remediation details</Button>
            </form>
          </section>
          <section className="panel">
            <h2>Record a reproduction attempt</h2>
            <form onSubmit={attempt} key={`attempt-${f.attempts.length}`}>
              <label>
                Reproduction outcome
                <select name="outcome">
                  {[
                    "reproduced",
                    "not-reproduced",
                    "blocked",
                    "inconclusive",
                  ].map((s) => (
                    <option value={s} key={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Attempted state
                  <input
                    name="state"
                    defaultValue={f.context.state}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Attempted role
                  <input
                    name="role"
                    defaultValue={f.context.role}
                    required
                    maxLength={80}
                  />
                </label>
              </div>
              <label>
                Attempt authentication context
                <select
                  name="authentication"
                  defaultValue={f.context.authentication}
                >
                  <option value="unknown">Unknown</option>
                  <option value="signed-out">Signed out</option>
                  <option value="user-confirmed-signed-in">
                    User-confirmed signed in
                  </option>
                </select>
              </label>
              <label>
                Attempt application version
                <input
                  name="version"
                  defaultValue={f.context.appVersion}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Attempt conditions
                <textarea
                  name="conditions"
                  required
                  rows={2}
                  maxLength={3000}
                />
              </label>
              <label>
                Attempt notes
                <textarea name="notes" required rows={2} maxLength={3000} />
              </label>
              <Button disabled={busy} variant="secondary">
                Record reproduction attempt
              </Button>
            </form>
            {f.attempts.map((a: any) => (
              <details key={a.id} className="mvp-record">
                <summary>
                  {label(a.outcome)} · {date(a.createdAt)}
                </summary>
                <p>{a.conditions}</p>
                <p>{a.notes}</p>
                <p className="fine">
                  Role: {a.context.role}; state: {a.context.state}; actor:{" "}
                  {a.actorId}.
                </p>
              </details>
            ))}
          </section>
          <section className="panel">
            <h2>Retest the affected state</h2>
            <p>
              First apply the remedy in your application and record its version
              above. A targeted retest records new evidence; it does not resolve
              the finding by itself.
            </p>
            <Button
              disabled={busy || !editable}
              onClick={() =>
                void perform(
                  `findings/${id}/retests`,
                  {
                    revision: f.revision,
                    requestId: crypto.randomUUID(),
                    screenshot: false,
                  },
                  "Retest requested. For extension assessments, reopen the original page, role, and state and select this request in the extension.",
                )
              }
            >
              Request targeted retest
            </Button>
            {!editable && (
              <p className="fine">
                A resolved or reviewed closure must enter review before a new
                remediation retest. Comparable new failures can reopen verified
                findings automatically.
              </p>
            )}
            {f.retests.map((r: any) => (
              <div className="mvp-record" key={r.id}>
                <strong>
                  {date(r.createdAt)} · {r.remedyVersion}
                </strong>
                <p>
                  <Pill>
                    {r.assessment?.outcome ?? r.executionStatus ?? r.status}
                  </Pill>{" "}
                  {r.mode === "extension" && !r.runId
                    ? "Open this request in the browser extension and confirm the original context."
                    : ""}
                </p>
                {r.executionError && (
                  <p className="notice notice-error">
                    {r.executionError} No verified resolution is implied.
                  </p>
                )}
                {r.journeyRunId && (
                  <a href={`/runs/${r.journeyRunId}`}>
                    Open original-context journey replay ↗
                  </a>
                )}
                {r.runId && (
                  <a href={`/runs/${r.runId}`}>Open retest result ↗</a>
                )}
                {r.assessment?.reasons.map((s: string, i: number) => (
                  <p key={i} className="fine">
                    {s}
                  </p>
                ))}
                {r.assessment?.changes.map((s: string, i: number) => (
                  <p key={i} className="fine">
                    Comparison change: {s}
                  </p>
                ))}
              </div>
            ))}
          </section>
          {f.retests.length > 0 && (
            <section className="panel">
              <h2>Record verification</h2>
              <p className="fine">
                Only record reviews you actually performed. A missing element,
                login redirect, different role, or incomplete scan cannot
                establish an automated fix. Preserve outstanding human and
                adjacent-behavior review.
              </p>
              <form onSubmit={verify} key={`verify-${f.revision}`}>
                <label>
                  Reassessment request
                  <select name="retestId" required>
                    {f.retests.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {date(r.createdAt)} · {r.remedyVersion} ·{" "}
                        {r.assessment?.outcome ?? r.executionStatus ?? r.status}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Verification method
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      <option value="automated-targeted">
                        Targeted automated check with context review
                      </option>
                      <option value="manual-review">
                        Recorded human review
                      </option>
                      <option value="assistive-technology">
                        Recorded assistive-technology evaluation
                      </option>
                    </select>
                  </label>
                  <label>
                    Requested verification outcome
                    <select name="outcome">
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="inconclusive">Inconclusive</option>
                    </select>
                  </label>
                </div>
                <label>
                  Verification conditions
                  <textarea
                    name="conditions"
                    required
                    maxLength={3000}
                    rows={2}
                  />
                </label>
                <label>
                  Expected behavior verified
                  <textarea
                    name="expectedOutcome"
                    defaultValue={f.expectedOutcome}
                    required
                    maxLength={3000}
                    rows={2}
                  />
                </label>
                <label>
                  Actual behavior observed
                  <textarea
                    name="actualOutcome"
                    required
                    maxLength={3000}
                    rows={2}
                  />
                </label>
                <label>
                  Verification limitations
                  <textarea
                    name="limitations"
                    required
                    maxLength={3000}
                    rows={2}
                    placeholder="State remaining limits explicitly; write none only when justified for this scope."
                  />
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="contextConfirmed" />I confirmed
                  the original application, environment, page, state, and role
                  were assessed.
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="identityConfirmed" />I confirmed
                  element continuity or reviewed the replacement in context.
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="capabilityPreserved" />
                  The remedy preserves the required capability and intended
                  accessible meaning.
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={adjacent}
                    onChange={(e) => setAdjacent(e.target.checked)}
                  />
                  This remedy requires adjacent behavior review.
                </label>
                {adjacent && (
                  <>
                    <label>
                      Adjacent behavior outcome
                      <select name="adjacentOutcome" defaultValue="pending">
                        <option value="pending">
                          Pending — keep review open
                        </option>
                        <option value="passed">
                          Passed under the recorded conditions
                        </option>
                        <option value="failed">Failed</option>
                      </select>
                    </label>
                    <label>
                      Adjacent behavior evidence and conditions
                      <textarea
                        name="adjacentNotes"
                        required
                        maxLength={3000}
                      />
                    </label>
                  </>
                )}
                {method !== "automated-targeted" && (
                  <fieldset>
                    <legend>Actual human review context</legend>
                    <label>
                      Human method and assistive-technology details
                      <textarea
                        name="reviewMethod"
                        required
                        maxLength={2000}
                        placeholder="Describe the actual technique, browser, assistive technology/version where used, and behavior reviewed."
                      />
                    </label>
                    <label>
                      Reviewed URL
                      <input
                        name="manualUrl"
                        type="url"
                        defaultValue={f.context.url}
                        required
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Reviewed state
                        <input
                          name="manualState"
                          defaultValue={f.context.state}
                          required
                        />
                      </label>
                      <label>
                        Reviewed role
                        <input
                          name="manualRole"
                          defaultValue={f.context.role}
                          required
                        />
                      </label>
                    </div>
                    <label>
                      Reviewed authentication
                      <select
                        name="manualAuthentication"
                        defaultValue={f.context.authentication}
                      >
                        <option value="unknown">Unknown</option>
                        <option value="signed-out">Signed out</option>
                        <option value="user-confirmed-signed-in">
                          User-confirmed signed in
                        </option>
                      </select>
                    </label>
                    <label>
                      Reviewed application version
                      <input
                        name="manualVersion"
                        defaultValue={f.remedyVersion}
                        required
                      />
                    </label>
                    <div className="mvp-filter-grid">
                      <label>
                        Review viewport width
                        <input
                          name="manualWidth"
                          type="number"
                          defaultValue={f.context.viewport.width}
                          required
                        />
                      </label>
                      <label>
                        Review viewport height
                        <input
                          name="manualHeight"
                          type="number"
                          defaultValue={f.context.viewport.height}
                          required
                        />
                      </label>
                      <label>
                        Review device scale
                        <input
                          name="manualScale"
                          type="number"
                          step="0.1"
                          defaultValue={f.context.viewport.deviceScale}
                          required
                        />
                      </label>
                    </div>
                    <label className="checkbox">
                      <input type="checkbox" name="humanReviewComplete" />I
                      performed the named human evaluation and all required
                      review is complete.
                    </label>
                  </fieldset>
                )}
                <Button disabled={busy || !editable}>
                  Record verification decision
                </Button>
              </form>
            </section>
          )}
          <section className="panel">
            <h2>Verification history</h2>
            {f.verifications.length === 0 ? (
              <p className="fine">
                No verification decisions have been recorded.
              </p>
            ) : (
              f.verifications.map((v: any) => (
                <details className="mvp-record" key={v.id}>
                  <summary>
                    {label(v.outcome)} ·{" "}
                    {v.resolved ? "Scoped resolution" : "Unresolved"} ·{" "}
                    {date(v.createdAt)}
                  </summary>
                  <p>
                    Method: {label(v.method)}. Actor: {v.actorId}.
                  </p>
                  <p>{v.record.conditions}</p>
                  <p>Expected: {v.record.expectedOutcome}</p>
                  <p>Observed: {v.record.actualOutcome}</p>
                  <p>Limitations: {v.record.limitations}</p>
                  {v.record.reasons.map((s: string, i: number) => (
                    <p key={i}>{s}</p>
                  ))}
                  <p className="fine">
                    Adjacent review: {v.record.adjacentOutcome}.{" "}
                    {v.record.adjacentNotes}
                  </p>
                  {v.runId && (
                    <a href={`/runs/${v.runId}`}>Assessment evidence ↗</a>
                  )}
                </details>
              ))
            )}
          </section>
        </div>
        <aside>
          <section className="panel limitations">
            <h2>Finding history</h2>
            <p className="fine">
              Changes and decisions retain their original actor, date, and
              scope. Evidence removal does not rewrite a verification
              conclusion.
            </p>
            {f.history.map((e: any) => (
              <details className="mvp-record" key={e.id}>
                <summary>
                  {label(e.kind)} · {date(e.createdAt)}
                </summary>
                <p>{e.note}</p>
                <p className="fine">Actor: {e.actorId}</p>
                {e.detail.from && (
                  <p>
                    {label(e.detail.from)} → {label(e.detail.to)}
                  </p>
                )}
                {e.detail.reasons?.map((s: string, i: number) => (
                  <p className="fine" key={i}>
                    {s}
                  </p>
                ))}
                {e.detail.runId && (
                  <a href={`/runs/${e.detail.runId}`}>Related assessment ↗</a>
                )}
              </details>
            ))}
          </section>
          <section className="panel">
            <h2>Observation history</h2>
            {f.observations.map((o: any) => (
              <div className="mvp-record" key={o.id}>
                <a href={`/runs/${o.id}`}>
                  {o.context.state} · {date(o.createdAt)}
                </a>
                <p className="fine">
                  {o.context.role}; {o.mode}; {o.status}. Version:{" "}
                  {o.context.appVersion}.
                </p>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Pilot feedback</h2>
            <p className="fine">
              Record your actual experience. Elapsed time includes waiting;
              active effort is only what you report. This does not establish
              customer demand or comparative efficacy.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void perform(
                  "feedback",
                  {
                    findingId: id,
                    usefulness: d.get("usefulness"),
                    notes: d.get("notes"),
                    activeMinutes:
                      d.get("minutes") === "" ? null : Number(d.get("minutes")),
                  },
                  "Pilot feedback recorded as your observation.",
                );
              }}
            >
              <label>
                Reproduction usefulness
                <select name="usefulness">
                  <option value="useful">Useful</option>
                  <option value="partly-useful">Partly useful</option>
                  <option value="not-yet-useful">Not yet useful</option>
                </select>
              </label>
              <label>
                Reported active minutes{" "}
                <span className="optional">optional</span>
                <input
                  name="minutes"
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                />
              </label>
              <label>
                Pilot observation
                <textarea name="notes" required maxLength={3000} />
              </label>
              <Button variant="secondary" disabled={busy}>
                Record pilot feedback
              </Button>
            </form>
            {f.feedback.map((p: any) => (
              <p className="fine" key={p.id}>
                {label(p.usefulness)} · {date(p.createdAt)}: {p.notes}
                {p.activeMinutes === null
                  ? ""
                  : ` (${p.activeMinutes} reported active minutes)`}
              </p>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
export function RunComparison({ run }: { run: any }) {
  const [runs, setRuns] = useState<any[]>([]),
    [baseline, setBaseline] = useState(""),
    [comparison, setComparison] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void api("runs")
      .then((rows) =>
        setRuns(
          rows.filter(
            (r: any) =>
              r.applicationId === run.applicationId && r.id !== run.id,
          ),
        ),
      )
      .catch((e) => setError(e.message));
  }, [run.id, run.applicationId]);
  return (
    <section className="panel">
      <h2>Compare assessment scope and observations</h2>
      <p className="fine">
        Absence is not a fix. A newly observed finding is not necessarily newly
        introduced. Scope and method differences remain visible.
      </p>
      <form
        className="mvp-save-view"
        onSubmit={(e) => {
          e.preventDefault();
          void api(`runs/${run.id}/compare?baseline=${baseline}`)
            .then((d) => {
              setComparison(d);
              setError("");
            })
            .catch((e) => setError(e.message));
        }}
      >
        <label>
          Prior run for comparison
          <select
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            required
          >
            <option value="">Select a comparison run</option>
            {runs.map((r) => (
              <option value={r.id} key={r.id}>
                {date(r.createdAt)} · {r.context.state} · {r.context.role}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary">Compare assessments</Button>
      </form>
      <Notice error={error} />
      {comparison && (
        <>
          <ul>
            {[...comparison.blocking, ...comparison.changes].map(
              (s: string, i: number) => (
                <li key={i}>{s}</li>
              ),
            )}
          </ul>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">
                Comparison of tracked observations
              </caption>
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Comparison outcome</th>
                  <th>Evidence limit</th>
                </tr>
              </thead>
              <tbody>
                {comparison.items.map((item: any) => (
                  <tr key={item.id}>
                    <td>
                      <a href={`/findings/${item.id}`}>{item.title}</a>
                    </td>
                    <td>{label(item.category)}</td>
                    <td className="mvp-wrap">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {comparison.items.length === 0 && (
            <p>
              No tracked concerns were observed in these selected runs. Other
              scope and human review remain unassessed.
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function RetentionSettings() {
  const [settings, setSettings] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    void api("settings")
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <h2>Evidence retention and local operations</h2>
      <Notice error={error} message={message} />
      {settings && (
        <>
          <p>
            Current screenshot policy:{" "}
            {settings.retentionDays === null
              ? "Keep until explicitly deleted"
              : `Delete after ${settings.retentionDays} days from capture`}
            .
          </p>
          <p className="fine">
            Changing the policy applies to existing and future screenshots.
            Expired objects are deleted by the worker; finding and verification
            history retain a deletion marker. Downloaded copies and operator
            backups are separate copies.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void api("settings", {
                method: "POST",
                body: JSON.stringify({
                  retentionDays:
                    d.get("days") === "manual" ? null : Number(d.get("days")),
                  reason: d.get("reason"),
                }),
              })
                .then((s) => {
                  setSettings(s);
                  setMessage("Evidence policy saved.");
                  setError("");
                })
                .catch((e) => setError(e.message));
            }}
          >
            <label>
              Screenshot retention
              <select
                name="days"
                defaultValue={settings.retentionDays ?? "manual"}
              >
                <option value="manual">Keep until explicitly deleted</option>
                {[1, 7, 30, 90, 365].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
            <label>
              Policy change reason
              <textarea name="reason" required maxLength={2000} />
            </label>
            <label className="checkbox">
              <input type="checkbox" required />I understand that this policy
              can delete existing screenshots while preserving record history.
            </label>
            <Button variant="secondary">Save evidence policy</Button>
          </form>
          <h3 className="mvp-margin">Usage boundaries</h3>
          <p className="fine">
            Up to {settings.limits.concurrentWorkerRuns} queued/running worker
            assessments per workspace; {settings.limits.scanRequestsPerMinute}{" "}
            scan requests per minute; 5 MB per screenshot;{" "}
            {settings.limits.savedViews} saved finding views.
          </p>
          <p className="fine">{settings.backup}</p>
          <p className="fine">
            Use the project’s backup/recovery commands and operations guide for
            local snapshots. Keep backup files private. For assistance, include
            a run ID and bounded error code rather than screenshots,
            credentials, or sensitive page content.
          </p>
        </>
      )}
    </section>
  );
}
