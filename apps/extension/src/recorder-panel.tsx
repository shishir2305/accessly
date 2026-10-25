import { useEffect, useState } from "react";
export function RecorderPanel() {
  const [recording, setRecording] = useState<any>(),
    [error, setError] = useState("");
  async function action(type: string) {
    try {
      const r = await chrome.runtime.sendMessage({ type });
      if (!r.ok) throw new Error(r.error);
      setRecording(r.data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void action("record-status");
    const timer = setInterval(() => void action("record-status"), 2000);
    return () => clearInterval(timer);
  }, []);
  return (
    <details>
      <summary>Record a journey draft</summary>
      <p>
        Explicit recording captures supported activations, keyboard commands and
        same-origin navigation. Typed values, passwords and page text are
        omitted; inputs become runtime references. Review all steps and action
        boundaries in the web app. Recording ends after 30 minutes or 55 steps.
      </p>
      {error && <p role="alert">{error}</p>}
      <p role="status">
        {recording?.active
          ? `Recording: ${recording.steps.length} supported steps captured.`
          : "Recording stopped."}{" "}
        {recording?.limitation}
      </p>
      {!recording?.active ? (
        <button onClick={() => void action("record-start")}>
          Start recording
        </button>
      ) : (
        <button onClick={() => void action("record-stop")}>
          Stop recording
        </button>
      )}
      {recording && !recording.active && (
        <>
          <label>
            Reviewable draft steps
            <textarea
              rows={8}
              readOnly
              value={JSON.stringify(recording.steps, null, 2)}
            />
          </label>
          <p>
            Copy these steps into a journey draft. Add readiness assertions,
            checkpoints, expected outcomes and input references; replay is
            separately authorized. Unsupported controls remain explicit.
          </p>
          <button onClick={() => void action("record-discard")}>
            Discard recording
          </button>
        </>
      )}
    </details>
  );
}
