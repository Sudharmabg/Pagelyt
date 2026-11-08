"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adoptSession, rememberVerifyEmail, type SessionTokens } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkEmail, checkLead, checkPassword, passwordsMatch } from "@/lib/validate";

export type LeadInput = { name: string; email: string; phone: string };

/** What the modal hands to the page when it is time to run the scan. */
export type ScanStart = {
  lead: LeadInput | null;
  turnstile?: string;
  /** Proof of a just-created account, so the scan needs no second human check. */
  ticket?: string;
  /** Access token of a signed-in visitor. */
  token?: string;
  /** Where to go when the scan is done: the dashboard, or the check-your-email page. */
  after: "dashboard" | "verify";
};

type Phase = "email" | "login" | "signup" | "legacy";
type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void };

async function post(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { status: 0, json: {} };
  }
}

const msg = (j: Record<string, unknown>, fallback: string) => (typeof j.error === "string" ? j.error : fallback);

/* Asks for an email first, then either a password (account exists) or the sign-up details (new). Without
   Supabase configured it falls back to the plain contact form. `onSubmit` resolves to an error message, or null
   on success (the parent then navigates away, so the modal just keeps showing progress). */
export function LeadModal({
  open,
  host,
  steps,
  step,
  running = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  host: string;
  steps: string[];
  step: number;
  /** True when the parent is already scanning (signed-in visitors skip the form). */
  running?: boolean;
  onClose: () => void;
  onSubmit: (start: ScanStart) => Promise<string | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busyLocal, setBusy] = useState(false);
  const busy = busyLocal || running;
  const [err, setErr] = useState("");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => (supabaseBrowser() ? "email" : "legacy"));
  const [email, setEmail] = useState("");
  const [unverified, setUnverified] = useState(false);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsId = useRef<string | undefined>(undefined);
  const token = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const sb = supabaseBrowser();

  // Start each opening from the first step (adjusting state while rendering, as React recommends).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPhase(sb ? "email" : "legacy");
      setErr("");
      setUnverified(false);
    }
  }

  // Cloudflare Turnstile (human check). Only loaded when a site key is configured, and only on the steps that need it.
  const needsHuman = phase === "login" || phase === "signup" || phase === "legacy";
  useEffect(() => {
    if (!open || !siteKey || !needsHuman || !tsRef.current) return;
    token.current = undefined;
    const mount = () => {
      const w = window as unknown as { turnstile?: TurnstileApi };
      if (w.turnstile && tsRef.current && !tsRef.current.hasChildNodes()) {
        tsId.current = w.turnstile.render(tsRef.current, { sitekey: siteKey, callback: (t: string) => { token.current = t; } });
      }
    };
    if (document.getElementById("cf-turnstile-js")) return mount();
    const sc = document.createElement("script");
    sc.id = "cf-turnstile-js";
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    sc.async = true;
    sc.onload = mount;
    document.head.append(sc);
  }, [open, siteKey, needsHuman, phase]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // A human-check token works once, so ask for a fresh one after every attempt.
  const freshHumanCheck = () => {
    token.current = undefined;
    (window as unknown as { turnstile?: TurnstileApi }).turnstile?.reset(tsId.current);
  };

  const fail = (m: string) => {
    setErr(m);
    setBusy(false);
    freshHumanCheck();
  };

  const form = (e: React.FormEvent<HTMLFormElement>) => new FormData(e.currentTarget);
  const field = (f: FormData, k: string) => String(f.get(k) ?? "");

  /* ---- step 1: email ---- */
  const submitEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = form(e);
    const checked = checkEmail(field(f, "email"));
    if (!checked.ok) return setErr(checked.error);
    setErr("");
    setBusy(true);
    const r = await post("/api/auth/check", { email: checked.value, website: field(f, "website") });
    setBusy(false);
    if (r.status === 501) return setPhase("legacy"); // accounts are not switched on here: use the plain form
    if (r.status !== 200) return setErr(msg(r.json, "We couldn't check that just now. Please try again."));
    setEmail(checked.value);
    setPhase(r.json.exists === true ? "login" : "signup");
  };

  /* ---- step 2a: existing account ---- */
  const submitLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = form(e);
    const password = field(f, "password");
    if (!password) return setErr("Please enter your password.");
    setErr("");
    setUnverified(false);
    setBusy(true);
    const r = await post("/api/auth/login", { email, password, turnstile: token.current, website: field(f, "website") });
    const session = r.json.session as SessionTokens | undefined;
    if (r.status !== 200 || !session) {
      if (r.json.code === "unverified") setUnverified(true);
      return fail(msg(r.json, "We couldn't sign you in just now. Please try again."));
    }
    if (!sb || !(await adoptSession(sb, session))) return fail("We couldn't sign you in just now. Please try again.");
    const problem = await onSubmit({ lead: null, token: session.access_token, after: "dashboard" });
    if (problem) fail(problem);
  };

  /* ---- step 2b: new account ---- */
  const submitSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = form(e);
    const v = checkLead({ name: field(f, "name"), email, phone: field(f, "phone") });
    if ("error" in v) return setErr(v.error);
    const pw = checkPassword(field(f, "password"), email);
    if (!pw.ok) return setErr(pw.error);
    const mismatch = passwordsMatch(field(f, "password"), field(f, "confirm"));
    if (mismatch) return setErr(mismatch);
    setErr("");
    setBusy(true);
    const r = await post("/api/auth/signup", { ...v.lead, password: field(f, "password"), confirm: field(f, "confirm"), turnstile: token.current, website: field(f, "website") });
    if (r.status !== 200) return fail(msg(r.json, "We couldn't create your account just now. Please try again."));
    const session = r.json.session as SessionTokens | null;
    if (session && sb && (await adoptSession(sb, session))) {
      const problem = await onSubmit({ lead: v.lead, token: session.access_token, after: "dashboard" });
      if (problem) fail(problem);
      return;
    }
    // The address still has to be confirmed: run the scan now, then wait on the check-your-email page.
    rememberVerifyEmail(v.lead.email);
    const problem = await onSubmit({ lead: v.lead, ticket: typeof r.json.ticket === "string" ? r.json.ticket : undefined, after: "verify" });
    if (problem) fail(problem);
  };

  /* ---- fallback: plain contact form (no accounts configured) ---- */
  const submitLegacy = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = form(e);
    const v = checkLead({ name: field(f, "name"), email: field(f, "email"), phone: field(f, "phone") });
    if ("error" in v) return setErr(v.error);
    setErr("");
    setBusy(true);
    const problem = await onSubmit({ lead: v.lead, turnstile: token.current, after: "dashboard" });
    if (problem) fail(problem);
  };

  const resend = async () => {
    setBusy(true);
    await post("/api/auth/resend", { email, website: "" });
    setBusy(false);
    rememberVerifyEmail(email);
    router.push("/check-email");
  };

  const honeypot = <input className="lm-hp" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />;
  const errBox = err && (
    <p className="lm-err" role="alert">
      {err}
    </p>
  );
  const human = siteKey && <div ref={tsRef} className="lm-ts" />;

  return (
    <dialog ref={ref} className="lead-modal" aria-labelledby="lead-h" onClose={onClose} onCancel={(e) => busy && e.preventDefault()}>
      {busy ? (
        <div>
          <h2 id="lead-h">Analysing {host}…</h2>
          <div className="lm-progress" role="status" aria-live="polite">
            <div className="lm-bar" aria-hidden="true"><i style={{ width: `${Math.min(96, ((step + 1) / steps.length) * 100)}%` }} /></div>
            <ol className="lm-steps">
              {steps.map((t, i) => (
                <li key={t} className={i < step ? "done" : i === step ? "now" : ""}>
                  <span className="lm-mark" aria-hidden="true">{i < step ? "✓" : ""}</span>
                  {t}
                </li>
              ))}
            </ol>
            <small>This takes 10 to 30 seconds.</small>
          </div>
        </div>
      ) : phase === "email" ? (
        <form onSubmit={submitEmail} noValidate>
          <h2 id="lead-h">Enter your email to continue</h2>
          <p className="lm-sub">
            We&rsquo;ll check whether you already have an account, then open the report for <strong>{host}</strong>.
          </p>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} defaultValue={email} required autoFocus />
          </label>
          {honeypot}
          {errBox}
          <div className="lm-act">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">Continue</button>
          </div>
        </form>
      ) : phase === "login" ? (
        <form onSubmit={submitLogin} noValidate>
          <h2 id="lead-h">Welcome back</h2>
          <p className="lm-sub">Enter the password for <strong>{email}</strong> to open your report for <strong>{host}</strong>.</p>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" maxLength={200} required autoFocus />
          </label>
          {honeypot}
          {errBox}
          {unverified && (
            <p className="lm-fine">
              <button type="button" className="lm-link" onClick={resend}>Send the confirmation link again</button>
            </p>
          )}
          {human}
          <p className="lm-fine">
            <button type="button" className="lm-link" onClick={() => { setPhase("email"); setErr(""); }}>Use a different email</button>
            {" · "}
            <a className="lm-link" href="/login?forgot=1">Forgot password?</a>
          </p>
          <div className="lm-act">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">Sign in and scan</button>
          </div>
        </form>
      ) : phase === "signup" ? (
        <form onSubmit={submitSignup} noValidate>
          <h2 id="lead-h">Create your free account</h2>
          <p className="lm-sub">Your report for <strong>{host}</strong> is saved to <strong>{email}</strong>. We&rsquo;ll email one link to confirm it&rsquo;s you.</p>
          <label>
            Full name
            <input name="name" type="text" autoComplete="name" maxLength={100} required autoFocus />
          </label>
          <label>
            Phone number
            <input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} placeholder="+91 98765 43210" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
          </label>
          <label>
            Confirm password
            <input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
          </label>
          {honeypot}
          {errBox}
          {human}
          <p className="lm-fine">At least 8 characters. We use your details to deliver the report and follow up about Pagelyt. No spam.</p>
          <p className="lm-fine">
            <button type="button" className="lm-link" onClick={() => { setPhase("email"); setErr(""); }}>Use a different email</button>
          </p>
          <div className="lm-act">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">Create account and scan</button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitLegacy} noValidate>
          <h2 id="lead-h">Where should we send your report?</h2>
          <p className="lm-sub">
            Tell us who to send the full report for <strong>{host}</strong> to. Your dashboard opens right after.
          </p>
          <label>
            Full name
            <input name="name" type="text" autoComplete="name" maxLength={100} required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required />
          </label>
          <label>
            Phone number
            <input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} placeholder="+91 98765 43210" required />
          </label>
          {errBox}
          {human}
          <p className="lm-fine">We use your details to deliver the report and follow up about Pagelyt. No spam.</p>
          <div className="lm-act">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">Get my report</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
