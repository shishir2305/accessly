"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@accessly/ui";
import { Brand } from "../../components/auth";
import { supabase } from "../../lib/client";
export default function Reset() {
  const [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const password = String(new FormData(e.currentTarget).get("password"));
    const { error } = await supabase().auth.updateUser({ password });
    if (error) setError(error.message);
    else setMessage("Password updated. You can return to your workspace.");
  }
  return (
    <main id="main" className="auth-page">
      <section className="auth-card">
        <Brand />
        <h1>Set a new password</h1>
        <form onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              name="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <p role="alert">{error}</p>
          <p role="status">{message}</p>
          <Button>Update password</Button>
        </form>
        <a href="/">Return to workspace</a>
      </section>
    </main>
  );
}
