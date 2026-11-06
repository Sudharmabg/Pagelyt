"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  const sb = supabaseBrowser();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr("Please enter a valid email address.");
    setErr("");
    setState("sending");
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/account` } });
    if (error) {
      setErr(error.message);
      setState("idle");
    } else setState("sent");
  };

  if (!sb) {
    return (
      <div className="panel auth-card">
        <h2>Accounts aren’t switched on yet</h2>
        <p className="panel-note">Add your Supabase URL and anon key to enable sign-in. See DEPLOY.md.</p>
      </div>
    );
  }

  if (state === "sent") {
    return (
      <div className="panel auth-card" role="status">
        <h2>Check your inbox</h2>
        <p className="panel-note">We sent a sign-in link to <strong>{email}</strong>. It can take a minute, and the link works once.</p>
      </div>
    );
  }

  return (
    <form className="panel auth-card" onSubmit={submit} noValidate>
      <div className="tf">
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {err && <p className="lm-err" role="alert">{err}</p>}
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
