"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adoptSession, claimAndFindReport, type SessionTokens } from "@/lib/pending";
import { CodeForm } from "../code-form";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkCode, checkEmail, checkPassword, passwordsMatch } from "@/lib/validate";
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
/** Signing in opens the dashboard (the newest report). Agencies on a paid plan start on the agency dashboard
    instead, unless a specific page was requested. */
export async function landing(next: string, accessToken: string): Promise<string> {
  if (next !== "/dashboard") return next;
  try {
    const r = await fetch("/api/account/type", { headers: { authorization: `Bearer ${accessToken}` } });
    const a = r.ok ? ((await r.json()) as { paid?: boolean; accountType?: string | null }) : null;
    return a?.paid && a.accountType === "agency" ? "/account/sites" : next;
  } catch {
    return next;
  }
}

/** `onSignedIn` replaces the default "go to the landing page" (the sign-in modal uses it to stay on the page).
    `title` adds a heading to the sign-in step; `bare` drops the card styling inside a modal. */
export function LoginForm({ next, startForgot, onSignedIn, title, bare = false, email: startEmail = "" }: { next: string; startForgot: boolean; onSignedIn?: (accessToken: string) => void | Promise<void>; title?: string; bare?: boolean; email?: string }) {
  const router = useRouter();
  const done = async (accessToken: string) => (onSignedIn ? onSignedIn(accessToken) : router.push(await landing(next, accessToken)));
  const card = bare ? "auth-card auth-bare" : "panel auth-card";
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<"signin" | "forgot" | "code">(startForgot ? "forgot" : "signin");
  const [email, setEmail] = useState(startEmail);
  const [err, setErr] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
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
        setBusy(false);
        return setUnverified(true);
      }
      return fail(msg(r.json, "We couldn't sign you in just now. Please try again."));
    }
    if (!sb || !(await adoptSession(sb, session))) return fail("We couldn't sign you in just now. Please try again.");
    await claimAndFindReport(sb); // attaches any scans started with this email before the account existed
    await done(session.access_token);
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
      startWait();
      return setMode("code");
    }
    setErr(msg(r.json, "We couldn't send that just now. Please try again."));
  };

  // "Send a new code" waits a minute between emails (the server allows one a minute per address).
  const startWait = () => {
    setWait(60);
    const t = window.setInterval(() => setWait((w) => (w <= 1 ? (window.clearInterval(t), 0) : w - 1)), 1000);
  };

  const resendReset = async () => {
    setErr("");
    const r = await post("/api/auth/forgot", { email, website: "" });
    if (r.status !== 200) return setErr(msg(r.json, r.status === 429 ? "Please wait a minute before asking for another code." : "We couldn't send a code just now. Please try again."));
    startWait();
  };

  const reset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const c = checkCode(f.get("code"));
    if (!c.ok) return setErr(c.error);
    const pw = checkPassword(f.get("password"), email);
    if (!pw.ok) return setErr(pw.error);
    const mismatch = passwordsMatch(String(f.get("password")), String(f.get("confirm") ?? ""));
    if (mismatch) return setErr(mismatch);
    setErr("");
    setBusy(true);
    const r = await post("/api/auth/reset", { email, code: c.value, password: pw.value });
    const session = r.json.session as SessionTokens | undefined;
    if (r.status !== 200 || !session) {
      setBusy(false);
      return setErr(msg(r.json, "We couldn't reset your password just now. Please try again."));
    }
    if (!sb || !(await adoptSession(sb, session))) {
      setBusy(false);
      return setErr("Your password is saved, but we couldn't sign you in. Please sign in with it.");
    }
    await claimAndFindReport(sb);
    await done(session.access_token);
  };

  if (!sb) {
    return (
      <div className={card}>
        <h2>Accounts aren’t switched on yet</h2>
        <p className="panel-note">Add your Supabase URL and anon key to enable sign-in. See DEPLOY.md.</p>
      </div>
    );
  }

  const honeypot = <input className="lm-hp" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />;

  if (mode === "code") {
    return (
      <form className={`${card} auth-code`} onSubmit={reset} noValidate>
        <h2>Enter your code</h2>
        <p className="panel-note">If an account exists for <strong>{email}</strong>, we&rsquo;ve emailed it a 6-digit code. Enter it with your new password. The code works once and expires in an hour.</p>
        <div className="tf">
          <label htmlFor="rs-code">6-digit code</label>
          <input id="rs-code" className="code-in" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={9} required autoFocus />
        </div>
        <div className="tf">
          <label htmlFor="rs-pw">New password</label>
          <input id="rs-pw" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </div>
        <div className="tf">
          <label htmlFor="rs-cf">Confirm new password</label>
          <input id="rs-cf" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </div>
        <p className="lm-fine">At least 8 characters. Other browsers and devices will be signed out.</p>
        {err && <p className="lm-err" role="alert">{err}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Saving…" : "Save password and sign in"}</button>
        <p className="lm-fine">
          Didn&rsquo;t get it? Check spam, or{" "}
          <button type="button" className="lm-link" disabled={wait > 0} onClick={() => void resendReset()}>{wait > 0 ? `send a new code in ${wait}s` : "send a new code"}</button>.
        </p>
        <button type="button" className="lm-link" onClick={() => { setMode("signin"); setErr(""); }}>Back to sign in</button>
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form className={card} onSubmit={forgot} noValidate>
        <h2>Reset your password</h2>
        <p className="panel-note">Enter your email and we&rsquo;ll send a 6-digit code to choose a new password. Signed up before passwords existed? Use this to set your first password.</p>
        <div className="tf">
          <label htmlFor="fg-email">Email</label>
          <input id="fg-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required defaultValue={startEmail} />
        </div>
        {honeypot}
        {err && <p className="lm-err" role="alert">{err}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
        <button type="button" className="lm-link" onClick={() => { setMode("signin"); setErr(""); }}>Back to sign in</button>
      </form>
    );
  }

  if (unverified) {
    return (
      <div className={`${card} auth-code`}>
        <h2>Verify your email</h2>
        <p className="panel-note">We&rsquo;ve sent a 6-digit code to <strong>{email}</strong>. Enter it to finish signing in. You only need to do this once.</p>
        <CodeForm
          email={email}
          sendFirst
          onVerified={async (session) => {
            await claimAndFindReport(sb);
            await done(session.access_token);
          }}
        />
        <button type="button" className="lm-link" onClick={() => { setUnverified(false); setErr(""); }}>Back to sign in</button>
      </div>
    );
  }

  return (
    <form className={card} onSubmit={signIn} noValidate>
      {title && <h2>{title}</h2>}
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
      {humanKey && <div ref={humanBox} className="lm-ts" />}
      <button type="submit" className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <button type="button" className="lm-link" onClick={() => { setMode("forgot"); setErr(""); }}>Forgot password?</button>
    </form>
  );
}
