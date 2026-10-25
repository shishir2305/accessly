"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  Layers,
  ScanLine,
  Settings,
  LogOut,
  Puzzle,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@accessly/ui";
import {
  FindingWorkspace,
  FindingQueue,
  RunComparison,
  RetentionSettings,
} from "./mvp";
import { Journeys, JourneyRunView } from "./journeys";
import { AuthGate, Brand } from "./auth";
import { api, supabase } from "../lib/client";
export function Dashboard() {
  return <AuthGate>{(session) => <Workspace session={session} />}</AuthGate>;
}
const fmt = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function Workspace({ session }: { session: Session }) {
  const path = usePathname(),
    router = useRouter();
  const [apps, setApps] = useState<any[]>([]),
    [runs, setRuns] = useState<any[]>([]),
    [run, setRun] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [nav, setNav] = useState(false);
  const findingId = path.startsWith("/findings/") ? path.split("/")[2] : null;
  const runId = path.startsWith("/runs/") ? path.split("/")[2] : null;
  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api("applications"), api("runs")]);
      setApps(a);
      setRuns(r);
      if (runId) setRun(await api(`runs/${runId}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [runId]);
  useEffect(() => {
    setRun(null);
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);
  async function signout() {
    await supabase().auth.signOut();
    router.push("/");
  }
  const journeyId = path.startsWith("/journeys/")
    ? path.split("/")[2]
    : undefined;
  const title = path.startsWith("/journeys")
    ? "Interactive journeys"
    : findingId
      ? "Finding workspace"
      : path === "/findings"
        ? "Remediation work"
        : runId
          ? "Assessment results"
          : path === "/applications/new"
            ? "Add an application"
            : path === "/applications"
              ? "Applications"
              : path === "/runs"
                ? "Assessments"
                : path === "/settings"
                  ? "Workspace settings"
                  : "Workspace overview";
  return (
    <div className="app-layout">
      <aside
        id="workspace-navigation"
        className={`sidebar ${nav ? "is-open" : ""}`}
      >
        <Brand />
        <button
          className="mobile-close"
          aria-label="Close navigation"
          onClick={() => setNav(false)}
        >
          <X />
        </button>
        <div className="workspace-switch">
          <span className="avatar">
            {session.user.email?.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>My workspace</strong>
            <small>Personal workspace</small>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {[
            ["/", "Overview", LayoutDashboard],
            ["/applications", "Applications", Layers],
            ["/runs", "Assessments", ScanLine],
            ["/findings", "Findings", ShieldCheck],
            ["/journeys", "Journeys", ArrowRight],
            ["/settings", "Settings", Settings],
          ].map(([href, label, Icon]: any) => (
            <a
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {href === "/applications" && (
                <span className="nav-count">{apps.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-help">
          <Puzzle size={22} />
          <strong>Your browser. Your context.</strong>
          <p>Scan signed-in pages with the Accessly extension.</p>
          <a href="/settings">
            Set up the extension <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="sidebar-bottom">
          <div className="user-info">
            <span className="avatar small">
              {session.user.email?.slice(0, 1).toUpperCase()}
            </span>
            <span>{session.user.email}</span>
          </div>
          <button onClick={signout} aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setNav(true)}
            aria-expanded={nav}
            aria-controls="workspace-navigation"
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            My workspace <ChevronRight size={14} />
            <span>{runId ? "Assessment" : title}</span>
          </div>
          <span className="local-indicator">
            <i />
            Local workspace
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {runId
                  ? "SCOPED AUTOMATED ASSESSMENT"
                  : "YOUR ACCESSIBILITY WORKSPACE"}
              </span>
              <h1>{title}</h1>
              <p>
                {runId
                  ? "What was observed, where it happened, and what remains unknown."
                  : "A clearer view of your applications, barriers, and next steps."}
              </p>
            </div>
            {!runId && !findingId && path !== "/applications/new" && (
              <Button asChild>
                <a href="/applications/new">
                  <Plus size={17} />
                  Add application
                </a>
              </Button>
            )}
          </div>
          {error && (
            <div className="notice notice-error" role="alert">
              <AlertTriangle size={20} />
              <div>
                {error}
                <button onClick={() => void load()}>Retry connection</button>
              </div>
            </div>
          )}
          {loading ? (
            <p role="status">Loading your workspace…</p>
          ) : runId ? (
            run ? (
              run.mode === "journey" ? (
                <JourneyRunView id={run.id} />
              ) : (
                <RunView run={run} onChange={load} />
              )
            ) : (
              <div className="panel">
                <h2>Assessment unavailable</h2>
                <p>Check your connection and application access, then retry.</p>
                <a href="/runs">Return to assessments</a>
              </div>
            )
          ) : findingId ? (
            <FindingWorkspace id={findingId} />
          ) : path.startsWith("/journeys") ? (
            <Journeys applications={apps} id={journeyId} />
          ) : path === "/findings" ? (
            <FindingQueue applications={apps} />
          ) : path === "/applications/new" ? (
            <CreateApplication
              onCreated={async () => {
                await load();
                router.push("/applications");
              }}
            />
          ) : path === "/settings" ? (
            <SettingsView />
          ) : (
            <>
              {path === "/" && (
                <>
                  <div className="welcome-banner">
                    <div>
                      <Badge tone="green">START WITH A REAL PAGE</Badge>
                      <h2>
                        Good accessibility starts
                        <br />
                        with understanding the experience.
                      </h2>
                      <p>
                        Scan a public page or a signed-in state. Every result
                        keeps its scope and limitations in view.
                      </p>
                      <a
                        href={
                          apps.length ? "/applications" : "/applications/new"
                        }
                      >
                        Run your first assessment <ArrowRight size={17} />
                      </a>
                    </div>
                    <div className="banner-art" aria-hidden="true">
                      <div className="art-window">
                        <div className="art-dots">● ● ●</div>
                        <div className="art-line long" />
                        <div className="art-line" />
                        <div className="art-control">
                          <CheckCircle2 size={20} />
                          Evidence attached
                        </div>
                        <div className="art-line short" />
                      </div>
                      <span className="art-orbit">
                        <ShieldCheck size={27} />
                      </span>
                    </div>
                  </div>
                  <div className="stats-grid">
                    <Stat
                      label="Applications"
                      value={apps.length}
                      note="Distinct application scopes"
                      icon={<Layers />}
                    />
                    <Stat
                      label="Assessments"
                      value={runs.length}
                      note="Most recent 100 runs"
                      icon={<ScanLine />}
                    />
                    <Stat
                      label="Needs attention"
                      value={
                        runs.filter((r) =>
                          ["failed", "partial", "cancelled"].includes(r.status),
                        ).length
                      }
                      note="Interrupted or incomplete scope"
                      icon={<AlertTriangle />}
                    />
                  </div>
                </>
              )}
              {path !== "/runs" && (
                <section className="section">
                  <div className="section-heading">
                    <div>
                      <h2>Your applications</h2>
                      <p>Keep environments and assessed scope distinct.</p>
                    </div>
                    <span className="muted">
                      {apps.length} application{apps.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {apps.length ? (
                    <div className="application-grid">
                      {apps.map((app) => (
                        <ApplicationCard
                          app={app}
                          key={app.id}
                          refresh={load}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<Layers />}
                      title="Give your first application a home"
                      description="Add an application and a permitted origin. You can assess a public page or connect the extension for signed-in pages."
                      action={
                        <Button asChild>
                          <a href="/applications/new">
                            <Plus size={16} />
                            Add application
                          </a>
                        </Button>
                      }
                    />
                  )}
                </section>
              )}
              {path !== "/applications" && (
                <section className="section">
                  <div className="section-heading">
                    <div>
                      <h2>Recent assessments</h2>
                      <p>
                        Each run represents the page and state actually reached.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => void load()}
                      aria-label="Refresh assessments"
                    >
                      <RefreshCw size={16} />
                    </Button>
                  </div>
                  <RunTable runs={runs} apps={apps} />
                </section>
              )}
              <div className="scope-footer">
                <ShieldCheck size={17} />
                <span>
                  Selected automated checks provide scoped evidence. They do not
                  establish complete accessibility or legal conformance.
                </span>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
function Stat({ label, value, note, icon }: any) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
    </div>
  );
}
function Empty({ icon, title, description, action }: any) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function CreateApplication({ onCreated }: { onCreated: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = new FormData(e.currentTarget);
    try {
      await api("applications", {
        method: "POST",
        body: JSON.stringify({
          name: d.get("name"),
          environment: d.get("environment"),
          origin: d.get("origin"),
          pages: String(d.get("pages"))
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-layout">
      <section className="panel">
        <h2>Define a clear assessment scope</h2>
        <p className="muted">
          An origin includes the protocol, host, and port. Saved pages must
          belong to that origin.
        </p>
        <form onSubmit={submit}>
          <label>
            Application name
            <input
              name="name"
              required
              maxLength={100}
              placeholder="For example, Customer portal"
            />
          </label>
          <div className="form-grid">
            <label>
              Environment name
              <input
                name="environment"
                required
                defaultValue="Development"
                maxLength={80}
              />
            </label>
            <label>
              Permitted origin
              <input
                name="origin"
                type="url"
                required
                placeholder="http://localhost:4174"
              />
            </label>
          </div>
          <label>
            Saved public page URLs{" "}
            <span className="optional">optional, one per line</span>
            <textarea
              name="pages"
              rows={4}
              placeholder="http://localhost:4174/public"
            />
          </label>
          <div className="notice">
            <ShieldCheck size={19} />
            <p>
              Assess only applications you are authorized to test. URL query
              strings and fragments are omitted from saved context.
            </p>
          </div>
          <label className="checkbox">
            <input type="checkbox" required />I am authorized to assess this
            application.
          </label>
          <p role="alert" className="error">
            {error}
          </p>
          <div className="form-actions">
            <Button variant="secondary" asChild>
              <a href="/applications">Cancel</a>
            </Button>
            <Button disabled={busy}>
              {busy ? "Creating…" : "Create application"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      </section>
      <aside className="help-panel">
        <span className="eyebrow">TWO WAYS TO ASSESS</span>
        <h3>Public pages</h3>
        <p>
          Request a background scan of a saved public page. Private addresses
          are blocked, except the explicitly configured local test fixture.
        </p>
        <h3>Signed-in and local pages</h3>
        <p>
          Sign in to your application normally, reach a state, then use the
          extension. Your application’s session stays in your browser.
        </p>
        <h3>Start small</h3>
        <p>
          One meaningful page is a useful starting point. Other states and
          journeys remain unassessed.
        </p>
      </aside>
    </div>
  );
}
function ApplicationCard({ app, refresh }: any) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [screenshot, setScreenshot] = useState(false),
    [exclusions, setExclusions] = useState("");
  const env = app.environments[0];
  const [url, setUrl] = useState(env.pages[0] ?? "");
  async function scan(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("runs/public", {
        method: "POST",
        body: JSON.stringify({
          applicationId: app.id,
          environmentId: env.id,
          url,
          state: "Initial page",
          screenshot,
          excludeSelectors: exclusions
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      await refresh();
      location.href = `/runs/${result.id}`;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="application-card">
      <div className="application-top">
        <span className="app-icon">
          <Layers size={20} />
        </span>
        <Badge>{env.name}</Badge>
      </div>
      <h3>{app.name}</h3>
      <p className="origin">{env.origin}</p>
      <div className="card-divider" />
      <form onSubmit={scan}>
        <label>
          Public page URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder={`${env.origin}/`}
            list={`pages-${env.id}`}
          />
        </label>
        <datalist id={`pages-${env.id}`}>
          {env.pages.map((p: string) => (
            <option value={p} key={p} />
          ))}
        </datalist>
        <details className="capture-options">
          <summary>Evidence and exclusions</summary>
          <p className="fine">
            Worker screenshots upload automatically after this explicit request.
            Review the target’s sensitivity first; use the extension for a local
            screenshot preview.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={screenshot}
              onChange={(e) => setScreenshot(e.target.checked)}
            />
            Include visible-viewport screenshot
          </label>
          <label>
            Exclude CSS selectors, one per line
            <textarea
              rows={2}
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              placeholder=".customer-details"
            />
          </label>
          <p className="fine">
            Excluded regions are skipped by the scanner and masked in
            screenshots. Invalid selectors fail the assessment.
          </p>
        </details>
        <p className="error" role="alert">
          {error}
        </p>
        <Button variant="secondary" disabled={busy}>
          {busy ? "Queueing…" : "Assess public page"}
          <ArrowUpRight size={15} />
        </Button>
      </form>
      <p className="fine">For protected or private pages, use the extension.</p>
    </article>
  );
}
function RunTable({ runs, apps }: any) {
  return runs.length ? (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">
          Recent page assessments with their scope and completion status
        </caption>
        <thead>
          <tr>
            <th>Application / page</th>
            <th>State & context</th>
            <th>Method</th>
            <th>Status</th>
            <th>Assessed</th>
            <th>
              <span className="sr-only">Open result</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r: any) => (
            <tr key={r.id}>
              <td>
                <a href={`/runs/${r.id}`} className="table-title">
                  {apps.find((a: any) => a.id === r.applicationId)?.name ??
                    "Application"}
                </a>
                <small className="truncate">{r.context.url}</small>
              </td>
              <td>
                {r.context.state}
                <small>Role: {r.context.role}</small>
              </td>
              <td>
                <Badge>
                  {r.mode === "extension"
                    ? "Browser extension"
                    : "Public worker"}
                </Badge>
              </td>
              <td>
                <Badge
                  tone={
                    r.status === "completed"
                      ? "green"
                      : ["failed", "partial"].includes(r.status)
                        ? "amber"
                        : "neutral"
                  }
                >
                  {r.status}
                </Badge>
              </td>
              <td className="muted">{fmt(r.createdAt)}</td>
              <td>
                <a
                  href={`/runs/${r.id}`}
                  aria-label={`Open assessment of ${r.context.state}`}
                >
                  <ArrowUpRight size={18} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      icon={<ScanLine />}
      title="Your evidence starts with an assessment"
      description="Once you scan a page, its result and exact scope will appear here."
    />
  );
}
function RunView({ run, onChange }: any) {
  const [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [image, setImage] = useState(""),
    [imageId, setImageId] = useState("");
  const checks = run.result?.checks ?? [];
  const activeEvidence = run.evidence.find((e: any) => e.status === "ready");
  const results = run.findings.filter(
    (f: any) => filter === "all" || f.outcome === filter,
  );
  async function action(path: string, method = "POST") {
    try {
      await api(path, { method });
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function viewEvidence() {
    try {
      const data = await api(`evidence/${activeEvidence.id}`);
      setImage(data.url);
      setImageId(activeEvidence.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <p className="sr-only" role="status">
        Assessment status: {run.status}.
      </p>
      <div className="run-toolbar">
        <a href="/runs" className="back-link">
          ← All assessments
        </a>
        <div className="row">
          <Badge tone={run.status === "completed" ? "green" : "amber"}>
            {run.status}
          </Badge>
          {["queued", "running"].includes(run.status) && (
            <Button
              variant="secondary"
              onClick={() => void action(`runs/${run.id}/cancel`)}
            >
              Cancel assessment
            </Button>
          )}
          {["failed", "cancelled", "partial"].includes(run.status) &&
            run.mode === "worker" &&
            !run.result?.journey && (
              <Button
                variant="secondary"
                onClick={() => void action(`runs/${run.id}/retry`)}
              >
                <RefreshCw size={15} />
                Run again
              </Button>
            )}
        </div>
      </div>
      {run.result?.journey && (
        <p className="notice">
          <a href={`/runs/${run.result.journey.runId}`}>
            Inspect the parent journey, exact actions, focus observations and
            incomplete scope
          </a>
        </p>
      )}
      <section className="panel context-panel">
        <div className="section-heading">
          <div>
            <h2>{run.context.state}</h2>
            <p className="break">{run.context.url}</p>
          </div>
          <Badge>
            {run.mode === "extension"
              ? "Current-tab scan"
              : run.result?.journey
                ? "Journey checkpoint worker"
                : "Public-page worker"}
          </Badge>
        </div>
        <dl className="context-grid">
          {[
            ["Role", run.context.role],
            ["Authentication", run.context.authentication],
            ["Environment version", run.context.appVersion],
            [
              "Viewport",
              `${run.context.viewport.width} × ${run.context.viewport.height}`,
            ],
            ["Captured", fmt(run.result?.finishedAt ?? run.createdAt)],
            [
              "Engine / profile",
              run.result
                ? `axe ${run.result.engineVersion} · ${run.result.profile}`
                : "Not yet assessed",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="fine">
          Preconditions: {run.context.preconditions || "Not supplied"}
        </p>
      </section>
      {run.error && (
        <div className="notice notice-error" role="alert">
          <AlertTriangle />
          <p>{run.error}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!run.result ? (
        <div className="panel">
          <h2>
            {["queued", "running"].includes(run.status)
              ? "Assessment in progress"
              : "No assessment evidence collected"}
          </h2>
          <p role="status">
            {["queued", "running"].includes(run.status)
              ? "You can leave this page. The worker records status durably and this view refreshes automatically."
              : "The requested page was not assessed. Existing findings remain unchanged."}
          </p>
        </div>
      ) : (
        <>
          <RunComparison run={run} />
          <div className="stats-grid">
            <Stat
              label="Rule-failure occurrences"
              value={
                run.findings.filter((f: any) => f.outcome === "violation")
                  .length
              }
              note="Task severity requires context"
              icon={<AlertTriangle />}
            />
            <Stat
              label="Review candidates"
              value={
                run.findings.filter((f: any) => f.outcome === "incomplete")
                  .length
              }
              note="Human judgment remains needed"
              icon={<Clock3 />}
            />
            <Stat
              label="Rules with passed checks"
              value={checks.filter((c: any) => c.outcome === "pass").length}
              note="Within this assessed state only"
              icon={<CheckCircle2 />}
            />
          </div>
          <div className="results-layout">
            <section>
              <div className="section-heading">
                <h2>Observed findings</h2>
                <label className="inline-label">
                  Show
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All observations</option>
                    <option value="violation">Rule failures</option>
                    <option value="incomplete">Needs review</option>
                  </select>
                </label>
              </div>
              {results.length ? (
                results.map((f: any) => (
                  <article className="finding" key={f.id}>
                    <details
                      onToggle={(e) => {
                        if (e.currentTarget.open) setSelected(f.element);
                      }}
                    >
                      <summary>
                        <span className="finding-symbol" aria-hidden="true">
                          {f.outcome === "incomplete" ? "?" : "!"}
                        </span>
                        <span>
                          <strong>{f.check.help}</strong>
                          <small>
                            {f.rule} · {f.element.description}
                          </small>
                        </span>
                        <Badge
                          tone={f.outcome === "incomplete" ? "amber" : "red"}
                        >
                          {f.outcome === "incomplete"
                            ? "Needs review"
                            : `${f.check.impact ?? "Unrated"} engine impact`}
                        </Badge>
                      </summary>
                      <div className="finding-body">
                        <p className="finding-impact">
                          {f.check.explanation?.impact ??
                            "Review this observed rule failure in the context of the intended user task."}
                        </p>
                        <h3>Observed evidence</h3>
                        <p>{f.element.summary}</p>
                        <code className="locator">{f.element.locator}</code>
                        <p className="fine">
                          Check identifiers:{" "}
                          {f.element.checks.join(", ") || "Not supplied"}. Text
                          and HTML omitted.
                        </p>
                        <h3>Rule-based remedy guidance</h3>
                        <p>
                          {f.check.explanation?.remedy ?? f.check.description}
                        </p>
                        <p className="fine">
                          This is reviewed rule guidance. Product intent, actual
                          task impact, and the resulting behavior require
                          review. No source location is available.
                        </p>
                        <p>
                          <a
                            className="button button-secondary"
                            href={`/findings/${f.id}`}
                          >
                            Track remedy and verification →
                          </a>
                        </p>
                        <h3>Reproduce this observation</h3>
                        <p>
                          Open the recorded environment, use role “
                          {run.context.role}”, and reach “{run.context.state}”.{" "}
                          {run.context.preconditions ||
                            "Starting conditions were not supplied."}{" "}
                          Scan the same state using the recorded profile.
                        </p>
                        <p className="fine">
                          Multistep actions were not recorded or replayed. A
                          current-state scan does not assess keyboard entry or
                          exit.
                        </p>
                        <div className="row">
                          <a
                            href={f.check.helpUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Rule documentation <ExternalLink size={13} />
                          </a>
                          <button onClick={() => setSelected(f.element)}>
                            Locate in captured viewport
                          </button>
                        </div>
                        <p className="fine">
                          Relevant tags: {f.check.tags.join(", ")}
                        </p>
                      </div>
                    </details>
                  </article>
                ))
              ) : (
                <Empty
                  icon={<CheckCircle2 />}
                  title="No matching observations"
                  description="No observations match this view. Selected automated checks cannot establish complete accessibility; human review remains necessary."
                />
              )}
              <details className="panel check-breakdown">
                <summary>Completed and inapplicable rule outcomes</summary>
                <p className="fine">
                  Inapplicable means this rule had no applicable targets; it is
                  separate from passed checks. Unsupported content is listed
                  under limitations.
                </p>
                <ul>
                  {checks
                    .filter((c: any) =>
                      ["pass", "inapplicable"].includes(c.outcome),
                    )
                    .map((c: any) => (
                      <li key={c.rule}>
                        {c.help} <Badge>{c.outcome}</Badge>
                      </li>
                    ))}
                </ul>
              </details>
            </section>
            <aside>
              <section className="panel evidence-panel">
                <h2>Captured evidence</h2>
                {activeEvidence ? (
                  <>
                    <p>{activeEvidence.description}</p>
                    {image && imageId === activeEvidence.id ? (
                      <div className="evidence-image">
                        <img
                          src={image}
                          alt={activeEvidence.description}
                          onError={() => {
                            setImage("");
                            setError(
                              "Evidence link expired or could not load. Open it again for a new private link.",
                            );
                          }}
                        />
                        {selected?.box && (
                          <span
                            className="evidence-highlight"
                            aria-hidden="true"
                            style={{
                              left: `${(selected.box.x / run.context.viewport.width) * 100}%`,
                              top: `${(selected.box.y / run.context.viewport.height) * 100}%`,
                              width: `${(selected.box.width / run.context.viewport.width) * 100}%`,
                              height: `${(selected.box.height / run.context.viewport.height) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => void viewEvidence()}
                      >
                        Open private screenshot
                      </Button>
                    )}
                    <p className="fine">
                      Visible viewport only.{" "}
                      {activeEvidence.masked
                        ? "Masking was applied."
                        : "No masking recorded."}{" "}
                      Private links expire after 60 seconds.
                    </p>
                    <Button
                      variant="danger"
                      onClick={() =>
                        void action(`evidence/${activeEvidence.id}`, "DELETE")
                      }
                    >
                      Delete screenshot
                    </Button>
                  </>
                ) : (
                  <p className="muted">
                    {run.evidenceState === "pending"
                      ? "Screenshot processing is still in progress. "
                      : run.evidenceState === "failed"
                        ? "Screenshot processing did not complete. "
                        : "No screenshot is available. "}
                    Text evidence and findings remain usable.
                    {run.evidence.some((e: any) => e.status === "deleted")
                      ? " Previously captured evidence was deleted."
                      : ""}
                  </p>
                )}
                {selected && (
                  <div className="text-evidence">
                    <h3>Selected element</h3>
                    <p>{selected.description}</p>
                    <code className="locator">{selected.locator}</code>
                    <p className="fine">
                      {selected.box
                        ? selected.box.y < 0 ||
                          selected.box.y >= run.context.viewport.height
                          ? "Element is outside the captured viewport."
                          : `Viewport position: ${Math.round(selected.box.x)}, ${Math.round(selected.box.y)}. Size: ${Math.round(selected.box.width)} × ${Math.round(selected.box.height)}.`
                        : "Element geometry was unavailable."}
                    </p>
                  </div>
                )}
              </section>
              <section className="panel limitations">
                <h2>Scope & limitations</h2>
                <ul>
                  {run.result.limitations.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                {run.result.exclusions.length > 0 && (
                  <>
                    <h3>Excluded selectors</h3>
                    <ul>
                      {run.result.exclusions.map((s: string) => (
                        <li key={s}>
                          <code>{s}</code>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="fine">
                  Scanner {run.result.scannerVersion}. Historical results retain
                  their original assessment context.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
function SettingsView() {
  return (
    <>
      <RetentionSettings />
      <div className="form-layout">
        <section className="panel">
          <span className="eyebrow">BROWSER EXTENSION</span>
          <h2>Assess the page you’re already using</h2>
          <ol className="setup-steps">
            <li>
              Build the extension with <code>pnpm extension:package</code>.
            </li>
            <li>
              Open <code>chrome://extensions</code>, enable Developer mode, and
              choose Load unpacked. Select <code>apps/extension/dist</code>{" "}
              inside this project.
            </li>
            <li>
              Open the extension and choose Connect to Accessly. Sign in and
              approve the connection.
            </li>
            <li>
              Add an application here. Sign into that application normally,
              reach a meaningful state, and scan through the extension.
            </li>
            <li>
              Review the text evidence and optional screenshot before uploading.
            </li>
          </ol>
          <div className="notice">
            <ShieldCheck />
            <p>
              Target credentials and cookies stay in your browser. Accessly
              connection tokens are kept in extension-owned storage and expire
              after eight hours.
            </p>
          </div>
          <h3>Local test application</h3>
          <p>
            The fixture server runs at{" "}
            <a href="http://127.0.0.1:4174" target="_blank" rel="noreferrer">
              127.0.0.1:4174
            </a>
            . It includes public, signed-in, correct, and deliberately broken
            experiences.
          </p>
        </section>
        <aside className="help-panel">
          <h3>Evidence handling</h3>
          <p>
            Screenshots are optional and private. Use exclusions, masking, or
            omission to control uploaded evidence. Screenshot deletion preserves
            the original finding history.
          </p>
          <h3>MVP scope</h3>
          <p>
            Current-state assessment, remediation tracking, comparable retests,
            and recorded verification are available. Journey replay, source
            attribution, and AI remain later phases.
          </p>
          <h3>Data location</h3>
          <p>
            With the default local setup, authentication, database, and storage
            run on your machine. Hosted services require separate configuration.
          </p>
        </aside>
      </div>
    </>
  );
}
