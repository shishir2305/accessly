import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PROFILE } from "@accessly/contracts";
import "./popup.css";
import { RecorderPanel } from "./recorder-panel";
async function send(type: string, extra: object = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok)
    throw new Error(
      response?.error ??
        "The extension action was interrupted. Reopen the popup to recover.",
    );
  return response.data;
}
function Popup() {
  const [status, setStatus] = useState<any>(null),
    [apps, setApps] = useState<any[]>([]),
    [requests, setRequests] = useState<any[]>([]),
    [selectedRetest, setSelectedRetest] = useState(""),
    [envId, setEnvId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [image, setImage] = useState(""),
    [description, setDescription] = useState(""),
    [masked, setMasked] = useState(false),
    [preview, setPreview] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    start = useRef<{ x: number; y: number } | null>(null);
  async function load() {
    const s = await send("status");
    setStatus(s);
    if (s.connected) {
      const a = await send("applications");
      setApps(a);
      const requests = await send("retests");
      if (!Array.isArray(requests))
        throw new Error(
          "Retest requests could not load. Reopen the extension to retry.",
        );
      setRequests(requests);
      setSelectedRetest((current) =>
        requests.some((r: any) => r.id === current) ? current : "",
      );
      setEnvId((v) => v || a[0]?.environments[0]?.id || "");
    }
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const timer = setInterval(() => void load().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!image || !canvas.current) return;
    const img = new Image();
    img.onload = () => {
      const c = canvas.current!;
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
    };
    img.src = image;
  }, [image]);
  async function action(type: string, extra: object = {}) {
    setBusy(true);
    setError("");
    try {
      const data = await send(type, extra);
      await load();
      return data;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function scan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    const app = apps.find((a) =>
      a.environments.some((e: any) => e.id === envId),
    );
    if (!app) {
      setError("Add an application in the web app first.");
      return;
    }
    setImage("");
    setPreview(false);
    await action("scan", {
      options: {
        applicationId: app.id,
        retestId: selectedRetest || undefined,
        environmentId: envId,
        state: String(d.get("state")),
        role: String(d.get("role") || "unknown"),
        preconditions: String(d.get("preconditions")),
        authentication: d.get("authentication"),
        expectedProtected: d.get("protected") === "on",
        appVersion: String(d.get("version") || "unknown"),
        excludeSelectors: String(d.get("exclusions"))
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      },
    });
  }
  const selectedRequest = requests.find((r) => r.id === selectedRetest);
  const pending = status?.pending;
  const result = pending?.result;
  const violations =
    result?.checks.filter((c: any) => c.outcome === "violation") ?? [];
  const incomplete =
    result?.checks.filter((c: any) => c.outcome === "incomplete") ?? [];
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - b.left) / b.width) * e.currentTarget.width,
      y: ((e.clientY - b.top) / b.height) * e.currentTarget.height,
    };
  }
  return (
    <main>
      <header>
        <a
          href={__WEB_ORIGIN__}
          target="_blank"
          rel="noreferrer"
          className="brand"
        >
          <span>a</span>accessly.
        </a>
        <small>PAGE ASSESSMENT</small>
      </header>
      <p className="scope">
        Scan the reached state. Keep the evidence and its limits.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!status ? (
        <p role="status">Loading connection…</p>
      ) : !status.connected ? (
        <section>
          <h1>Connect your workspace</h1>
          <p>
            Sign in to Accessly to save page assessments. Your target
            application’s session stays in this browser.
          </p>
          <button disabled={busy} onClick={() => void action("connect")}>
            {busy ? "Connecting…" : "Connect to Accessly"}
          </button>
        </section>
      ) : (
        <>
          <RecorderPanel />
          {!pending || pending.status === "failed" ? (
            <>
              <h1>Assess the current page</h1>
              {pending?.error && (
                <p className="error" role="alert">
                  {pending.error}
                </p>
              )}
              {apps.length ? (
                <>
                  <label>
                    Finding-specific retest
                    <select
                      value={selectedRetest}
                      onChange={(e) => {
                        const r = requests.find((r) => r.id === e.target.value);
                        setSelectedRetest(e.target.value);
                        if (r) setEnvId(r.environmentId);
                      }}
                    >
                      <option value="">New page assessment</option>
                      {requests.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} · {r.context.state} · {r.remedyVersion}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedRequest && (
                    <div className="observation">
                      <strong>Reassess the original context</strong>
                      <p>
                        State: {selectedRequest.context.state}; role:{" "}
                        {selectedRequest.context.role}; expected version:{" "}
                        {selectedRequest.remedyVersion}.
                      </p>
                      <a
                        href={selectedRequest.context.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open the original page ↗
                      </a>
                      <p className="fine">
                        Reach the same state yourself. This does not replay a
                        journey. Record actual context if it differs; comparison
                        may be inconclusive.
                      </p>
                    </div>
                  )}
                  <form
                    key={selectedRetest || "new-assessment"}
                    onSubmit={scan}
                  >
                    <label>
                      Application and environment
                      <select
                        value={envId}
                        disabled={!!selectedRetest}
                        onChange={(e) => setEnvId(e.target.value)}
                      >
                        {apps.flatMap((a) =>
                          a.environments.map((e: any) => (
                            <option value={e.id} key={e.id}>
                              {a.name} · {e.name}
                            </option>
                          )),
                        )}
                      </select>
                    </label>
                    <label>
                      State label
                      <input
                        name="state"
                        defaultValue={selectedRequest?.context.state ?? ""}
                        placeholder="For example, Open address dialog"
                        required
                        maxLength={120}
                      />
                    </label>
                    <div className="grid">
                      <label>
                        Target role
                        <input
                          name="role"
                          defaultValue={selectedRequest?.context.role ?? ""}
                          placeholder="unknown"
                          maxLength={80}
                        />
                      </label>
                      <label>
                        Application version
                        <input
                          name="version"
                          defaultValue={selectedRequest?.remedyVersion ?? ""}
                          placeholder="unknown"
                          maxLength={100}
                        />
                      </label>
                    </div>
                    <label>
                      Authentication context
                      <select
                        name="authentication"
                        defaultValue={
                          selectedRequest?.context.authentication ?? "unknown"
                        }
                      >
                        <option value="unknown">
                          Unknown / not established
                        </option>
                        <option value="user-confirmed-signed-in">
                          I confirm the intended signed-in page is visible
                        </option>
                        <option value="signed-out">
                          Signed-out experience
                        </option>
                      </select>
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        name="protected"
                        defaultChecked={
                          selectedRequest?.context.authentication ===
                          "user-confirmed-signed-in"
                        }
                      />
                      This assessment must reach protected content
                    </label>
                    <label>
                      Preconditions and reproduction context
                      <textarea
                        name="preconditions"
                        defaultValue={
                          selectedRequest?.context.preconditions ?? ""
                        }
                        maxLength={2000}
                        rows={2}
                        placeholder="Use safe descriptions. Do not include passwords or personal data."
                      />
                    </label>
                    <details>
                      <summary>Exclude sensitive areas from scanning</summary>
                      <label>
                        CSS selectors, one per line
                        <textarea
                          name="exclusions"
                          defaultValue={
                            selectedRequest?.exclusions.join("\n") ?? ""
                          }
                          rows={2}
                          placeholder=".private-details"
                        />
                      </label>
                      <p className="fine">
                        Screenshots are disabled for scans with exclusions; text
                        evidence remains usable.
                      </p>
                    </details>
                    {selectedRequest && (
                      <label className="check">
                        <input type="checkbox" required />I confirmed the
                        intended current page, role, state, and version before
                        this retest.
                      </label>
                    )}
                    <p className="fine">
                      Query strings, fragments, page text, HTML, and input
                      values are omitted. Review the result before upload.
                    </p>
                    <button disabled={busy}>
                      {busy ? "Assessing…" : "Scan current page"}
                    </button>
                  </form>
                </>
              ) : (
                <p>
                  Add an application in the{" "}
                  <a
                    href={`${__WEB_ORIGIN__}/applications/new`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    web app
                  </a>{" "}
                  first.
                </p>
              )}
            </>
          ) : !result ? (
            <section>
              <h1>
                {pending.status === "scanning"
                  ? "Assessing the current state…"
                  : "Assessment interrupted"}
              </h1>
              <p role="status">
                You can close this popup and reopen it. Results waiting for
                review expire after 30 minutes.
              </p>
            </section>
          ) : (
            <section>
              <div className="row">
                <h1>Review before uploading</h1>
                <span className="pill">{result.completion}</span>
              </div>
              <p>
                <strong>{result.context.state}</strong>
                <br />
                {result.context.url}
              </p>
              <div className="counts">
                <strong>
                  {violations.reduce(
                    (n: number, c: any) => n + c.elements.length,
                    0,
                  )}
                  <small>Rule-failure occurrences</small>
                </strong>
                <strong>
                  {incomplete.length}
                  <small>Rules needing review</small>
                </strong>
              </div>
              <p className="fine">
                Role: {result.context.role}. Authentication:{" "}
                {result.context.authentication}. Only top-level content and
                selected checks were assessed.
              </p>
              <details>
                <summary>Inspect text evidence and limitations</summary>
                {result.limitations.map((s: string, i: number) => (
                  <p className="fine" key={i}>
                    {s}
                  </p>
                ))}
                {[...violations, ...incomplete].map((c: any) => (
                  <div className="observation" key={c.rule}>
                    <strong>{c.help}</strong>
                    {c.elements.map((el: any, i: number) => (
                      <div key={i}>
                        <code>{el.locator}</code>
                        <p>{el.summary}</p>
                        <button
                          className="secondary"
                          onClick={() =>
                            void action("highlight", { locator: el.locator })
                          }
                        >
                          Highlight element {i + 1}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </details>
              <h2>Optional screenshot</h2>
              <p className="fine">
                Capture only after reviewing page sensitivity. Screenshots may
                include personal data. Omit the image to upload text evidence
                alone.
              </p>
              {!image ? (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action("capture").then((d) => {
                      if (d) {
                        setImage(d.data);
                        setMasked(false);
                        setPreview(false);
                      }
                    })
                  }
                >
                  Capture visible viewport
                </button>
              ) : (
                <>
                  <canvas
                    ref={canvas}
                    aria-label="Screenshot preview. Drag across a region to mask it. Keyboard users can mask the entire image or omit it."
                    tabIndex={0}
                    onPointerDown={(e) => {
                      start.current = point(e);
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerUp={(e) => {
                      if (!start.current) return;
                      const end = point(e),
                        begin = start.current;
                      const ctx = e.currentTarget.getContext("2d")!;
                      ctx.fillStyle = "#111827";
                      ctx.fillRect(
                        Math.min(begin.x, end.x),
                        Math.min(begin.y, end.y),
                        Math.max(1, Math.abs(end.x - begin.x)),
                        Math.max(1, Math.abs(end.y - begin.y)),
                      );
                      setMasked(true);
                      setPreview(false);
                      start.current = null;
                    }}
                  />
                  <p className="fine">
                    Drag to mask a region. Masking is applied locally. Visual
                    masking cannot guarantee that every sensitive detail is
                    removed.
                  </p>
                  <div className="row">
                    <button
                      className="secondary"
                      onClick={() => {
                        const c = canvas.current!;
                        const ctx = c.getContext("2d")!;
                        ctx.fillStyle = "#111827";
                        ctx.fillRect(0, 0, c.width, c.height);
                        setMasked(true);
                        setPreview(false);
                      }}
                    >
                      Mask entire screenshot
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setImage("");
                        setDescription("");
                        setPreview(false);
                      }}
                    >
                      Omit screenshot
                    </button>
                  </div>
                  <label>
                    Nonvisual evidence description
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={1500}
                      placeholder="Describe what the captured state shows, without secrets."
                    />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={preview}
                      onChange={(e) => setPreview(e.target.checked)}
                    />
                    I reviewed the image and want to upload it.
                  </label>
                </>
              )}
              {pending.status === "retry" && (
                <p className="error" role="alert">
                  {pending.error} Approved uploads retry up to five times while
                  the scan remains within its 30-minute lifetime.
                </p>
              )}
              <div className="actions">
                <button
                  disabled={
                    busy || (!!image && (!preview || !description.trim()))
                  }
                  onClick={() =>
                    void action("upload", {
                      image: image
                        ? canvas.current?.toDataURL("image/png")
                        : undefined,
                      description,
                      masked,
                    })
                  }
                >
                  {busy
                    ? "Uploading…"
                    : pending.status === "retry"
                      ? "Retry approved upload"
                      : "Upload reviewed result"}
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setImage("");
                    void action("discard");
                  }}
                >
                  Discard pending scan
                </button>
              </div>
            </section>
          )}
          {status.lastRun && (
            <a
              className="result-link"
              href={status.lastRun.url}
              target="_blank"
              rel="noreferrer"
            >
              Open latest result in Accessly ↗
            </a>
          )}
          <footer>
            <span>{PROFILE}</span>
            <button
              className="text"
              disabled={busy}
              onClick={() => void action("disconnect")}
            >
              Disconnect
            </button>
          </footer>
        </>
      )}
      <p className="fine">
        A clean scan is scoped evidence, not proof of complete accessibility.
        Human review remains necessary.
      </p>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Popup />);
