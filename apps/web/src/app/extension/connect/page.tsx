"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGate, Brand } from "../../../components/auth";
import { Button } from "@accessly/ui";
import { api } from "../../../lib/client";
function Connect() {
  const params = useSearchParams();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function connect() {
    setBusy(true);
    try {
      const challenge = params.get("challenge"),
        state = params.get("state"),
        extensionId = params.get("extensionId");
      if (
        !challenge ||
        !state ||
        !extensionId ||
        !/^[a-p]{32}$/.test(extensionId) ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(state)
      )
        throw new Error(
          "Connection request is invalid. Open the connection flow from the extension.",
        );
      const { code } = await api("extension/authorize", {
        method: "POST",
        body: JSON.stringify({ challenge, extensionId }),
      });
      location.assign(
        `https://${extensionId}.chromiumapp.org/accessly?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <AuthGate>
      {(session) => (
        <main id="main" className="auth-page">
          <section className="auth-card">
            <Brand />
            <h1>Connect your extension</h1>
            <p>
              Connect as {session.user.email}. The extension can read your
              applications and upload user-initiated scans and optional
              evidence. It does not receive target-application credentials.
            </p>
            <p>
              This connection expires after eight hours and can be revoked from
              the extension.
            </p>
            <p className="error" role="alert">
              {error}
            </p>
            <Button disabled={busy} onClick={() => void connect()}>
              {busy ? "Connecting…" : "Connect to Accessly"}
            </Button>
          </section>
        </main>
      )}
    </AuthGate>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading connection…</p>}>
      <Connect />
    </Suspense>
  );
}
