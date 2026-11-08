"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adoptSession, claimAndFindReport, rememberVerifyEmail, type SessionTokens } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkEmail } from "@/lib/validate";
import { useTurnstile } from "../use-turnstile";

async function post(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { status: 0, json: {} };
  }
}

const msg = (j: Record<string, unknown>, fallback: string) => (typeof j.error === "string" ? j.error : fallback);

/* Email and password sign-in, with "Forgot password?". Everything goes through our rate-limited /api/auth routes. */
export function LoginForm({ next, startForgot }: { next: string; startForgot: boolean }) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<"signin" | "forgot" | "sent">(startForgot ? "forgot" : "signin");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const { box: humanBox, siteKey: humanKey, token: humanToken, reset: resetHuman } = useTurnstile(mode === "signin");

  const fail = (m: string) => {
    setErr(m);
    setBusy(false);
    resetHuman();
  };

  const signIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const em = checkEmail(f.get("email"));
    const password = String(f.get("password") ?? "");
    if (!em.ok) return setErr(em.error);
    if (!password) return setErr("Please enter your password.");
    setErr("");
    setUnverified(false);
    setBusy(true);
    const r = await post("/api/auth/login", { email: em.value, password, turnstile: humanToken(), website: String(f.get("website") ?? "") });
    const session = r.json.session as SessionTokens | undefined;
    if (r.status !== 200 || !session) {
      if (r.json.code === "unverified") {
        setEmail(em.value);
        setUnverified(true);
      }
      return fail(msg(r.json, "We couldn't sign you in just now. Please try again."));
    }
    if (!sb || !(await adoptSession(sb, session))) return fail("We couldn't sign you in just now. Please try again.");
    await claimAndFindReport(sb); // attaches any scans started with this email before the account existed
    router.push(next);
  };

  const forgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const em = checkEmail(f.get("email"));
    if (!em.ok) return setErr(em.error);
    setErr("");
    setBusy(true);
    const r = await post("/api/auth/forgot", { email: em.value, website: String(f.get("website") ?? "") });
    setBusy(false);
    if (r.status === 200) {
      setEmail(em.value);
      return setMode("sent");
    }
    setErr(msg(r.json, "We couldn't send that just now. Please try again."));
  };

  const resend = async () => {
    setBusy(true);
    await post("/api/auth/resend", { email, website: "" });
    setBusy(false);
    rememberVerifyEmail(email);
    router.push("/check-email");
  };

  if (!sb) {
    return (
      <div className="panel auth-card">
        <h2>Accounts aren’t switched on yet</h2>
        <p className="panel-note">Add your Supabase URL and anon key to enable sign-in. See DEPLOY.md.</p>
      </div>
    );
  }

  const honeypot = <input className="lm-hp" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />;

  if (mode === "sent") {
    return (
      <div className="panel auth-card" role="status">
        <h2>Check your inbox</h2>
        <p className="panel-note">If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a link to choose a new password. It works once and expires soon.</p>
        <button type="button" className="lm-link" onClick={() => setMode("signin")}>Back to sign in</button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <form className="panel auth-card" onSubmit={forgot} noValidate>
        <h2>Reset your password</h2>
        <p className="panel-note">Enter your email and we&rsquo;ll send a link to choose a new one. Signed up before passwords existed? Use this to set your first password.</p>
        <div className="tf">
          <label htmlFor="fg-email">Email</label>
          <input id="fg-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required />
        </div>
        {honeypot}
        {err && <p className="lm-err" role="alert">{err}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Sending…" : "Email me a reset link"}</button>
        <button type="button" className="lm-link" onClick={() => { setMode("signin"); setErr(""); }}>Back to sign in</button>
      </form>
    );
  }

  return (
    <form className="panel auth-card" onSubmit={signIn} noValidate>
      <div className="tf">
        <label htmlFor="login-email">Email</label>
        <input id="login-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required />
      </div>
      <div className="tf">
        <label htmlFor="login-password">Password</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" maxLength={200} required />
      </div>
      {honeypot}
      {err && <p className="lm-err" role="alert">{err}</p>}
      {unverified && (
        <p className="lm-fine">
          <button type="button" className="lm-link" onClick={resend}>Send the confirmation link again</button>
        </p>
      )}
      {humanKey && <div ref={humanBox} className="lm-ts" />}
      <button type="submit" className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <button type="button" className="lm-link" onClick={() => { setMode("forgot"); setErr(""); }}>Forgot password?</button>
    </form>
  );
}
