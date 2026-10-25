"use client";
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@accessly/ui";
import { supabase } from "../lib/client";
export function AuthGate({
  children,
}: {
  children: (session: Session) => ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [configuration, setConfiguration] = useState("");
  useEffect(() => {
    try {
      const client = supabase();
      void client.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setReady(true);
      });
      const { data } = client.auth.onAuthStateChange((_event, s) =>
        setSession(s),
      );
      return () => data.subscription.unsubscribe();
    } catch (e) {
      setConfiguration((e as Error).message);
      setReady(true);
    }
  }, []);
  if (configuration)
    return (
      <main id="main" className="auth-page">
        <div className="auth-card">
          <Brand />
          <h1>Finish local setup</h1>
          <p role="status">{configuration}</p>
          <p>
            Database, authentication, and private storage run locally. No paid
            account or AI key is needed.
          </p>
        </div>
      </main>
    );
  if (!ready)
    return (
      <main id="main" className="auth-page">
        <p role="status">Restoring your session…</p>
      </main>
    );
  return session ? children(session) : <AuthForm />;
}
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Accessly home">
      <span aria-hidden="true" className="brand-mark">
        a
      </span>
      accessly
      <span className="brand-dot" aria-hidden="true">
        .
      </span>
    </a>
  );
}
export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup" | "recover">("signin"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = supabase();
      const email = String(data.get("email"));
      const password = String(data.get("password"));
      if (mode === "recover") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage(
          "If an account exists, a recovery email is on its way. For local development, open the mail viewer at 127.0.0.1:54324.",
        );
      } else {
        const { error, data } =
          mode === "signin"
            ? await client.auth.signInWithPassword({ email, password })
            : await client.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session)
          setMessage(
            "Check your email to confirm your account. Local emails appear at 127.0.0.1:54324.",
          );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-page">
      <div className="auth-intro">
        <Brand />
        <span className="eyebrow">ACCESSIBILITY, WITH EVIDENCE</span>
        <h1>
          Understand the barrier.
          <br />
          <em>Make the next step clear.</em>
        </h1>
        <p>
          Find accessibility issues in the pages people actually use. Keep the
          context, understand the impact, and work from evidence.
        </p>
        <div className="auth-foot">
          Built for real applications. Honest about what was assessed.
        </div>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="eyebrow">YOUR WORKSPACE</span>
        <h2 id="auth-title">
          {mode === "signin"
            ? "Welcome back"
            : mode === "signup"
              ? "Create your account"
              : "Recover your account"}
        </h2>
        <p>
          {mode === "signin"
            ? "Sign in to your accessibility workspace."
            : mode === "signup"
              ? "Start with one application and a meaningful page."
              : "We’ll send a link to reset your password."}
        </p>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
            />
          </label>
          {mode !== "recover" && (
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
            </label>
          )}
          <p role="alert" className="error">
            {error}
          </p>
          <p role="status">{message}</p>
          <Button disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in →"
                : mode === "signup"
                  ? "Create account →"
                  : "Send recovery link"}
          </Button>
        </form>
        <div className="auth-links">
          <button
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError("");
            }}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Create an account"}
          </button>
          <button
            onClick={() => {
              setMode(mode === "recover" ? "signin" : "recover");
              setError("");
            }}
          >
            {mode === "recover" ? "Back to sign in" : "Forgot password?"}
          </button>
        </div>
        <p className="fine">
          Local development uses local authentication. Target application
          passwords and cookies stay in your browser.
        </p>
      </section>
    </main>
  );
}
