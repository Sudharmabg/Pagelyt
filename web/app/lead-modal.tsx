"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adoptSession, rememberVerifyEmail, type SessionTokens } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkEmail, checkLead, checkPassword } from "@/lib/validate";

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

/** What the email check found: unknown yet, an existing account, or a new one. */
type Known = null | "login" | "signup";
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

// The last email used on this device, so a returning visitor's form is filled and checked as it opens.
const SAVED = "pagelyt:email";
const readSaved = () => {
  try {
    return localStorage.getItem(SAVED) ?? "";
  } catch {
    return "";
  }
};
const save = (e: string) => {
  try {
    localStorage.setItem(SAVED, e);
  } catch {
    /* private mode: nothing to remember */
  }
};

/** Password box with a show/hide toggle, so nobody has to type it twice. */
function Password({ autoComplete, inputRef }: { autoComplete: "current-password" | "new-password"; inputRef?: React.Ref<HTMLInputElement> }) {
  const [shown, setShown] = useState(false);
  const isNew = autoComplete === "new-password";
  return (
    <label>
      Password
      <span className="lm-pw">
        <input ref={inputRef} name="password" type={shown ? "text" : "password"} autoComplete={autoComplete} minLength={isNew ? 8 : undefined} maxLength={isNew ? 72 : 200} required />
        <button type="button" className="lm-eye" aria-pressed={shown} onClick={() => setShown((s) => !s)}>
          {shown ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

/* One screen: the email is checked in the background as it is typed, then the same form grows the password box
   (existing account) or name and password (new account), and one button signs in or signs up and runs the scan.
   Without Supabase configured it is the plain contact form. `onSubmit` resolves to an error message, or null on
   success (the parent then navigates away, so the modal just keeps showing progress). */
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
  const sb = supabaseBrowser();
  const [legacy, setLegacy] = useState(!sb);
  const [email, setEmail] = useState("");
  const [known, setKnown] = useState<Known>(null);
  const [checking, setChecking] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const checked = useRef(new Map<string, Exclude<Known, null>>()); // answers already fetched, so retyping costs nothing
  const seq = useRef(0); // only the latest check may update the form
  const typed = useRef(false); // has the visitor typed in the email box since the modal opened?
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsId = useRef<string | undefined>(undefined);
  const token = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Start each opening fresh, with the remembered email filled in (adjusting state while rendering, as React recommends).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLegacy(!sb);
      setEmail(sb ? readSaved() : "");
      setKnown(null);
      setErr("");
      setUnverified(false);
    }
  }

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      typed.current = false;
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  /* ---- the email check ---- */
  const runCheck = async (raw: string): Promise<Known> => {
    const c = checkEmail(raw);
    if (!c.ok) return null;
    const hit = checked.current.get(c.value);
    if (hit) {
      setKnown(hit);
      return hit;
    }
    const mine = ++seq.current;
    setChecking(true);
    const r = await post("/api/auth/check", { email: c.value, website: "" });
    if (mine !== seq.current) return null; // the address changed while this was in flight
    setChecking(false);
    if (r.status === 501) {
      setLegacy(true); // accounts are not switched on here: use the plain form
      return null;
    }
    if (r.status !== 200) {
      setErr(msg(r.json, "We couldn't check that just now. Please try again."));
      return null;
    }
    const k = r.json.exists === true ? "login" : "signup";
    checked.current.set(c.value, k);
    save(c.value);
    setErr("");
    setKnown(k);
    return k;
  };

  // Check shortly after typing stops (and straight away for a remembered address).
  useEffect(() => {
    if (!open || legacy || busy || known || !checkEmail(email).ok) return;
    const t = window.setTimeout(() => void runCheck(email), 650);
    return () => window.clearTimeout(t);
  }, [open, legacy, busy, known, email]);

  // When the extra fields appear, put the cursor in the first one, unless the visitor is still typing the email.
  useEffect(() => {
    if (!known || (typed.current && document.activeElement === emailRef.current)) return;
    (known === "login" ? passRef : nameRef).current?.focus();
  }, [known]);

  // Cloudflare Turnstile (human check), only once a password is about to be sent. It stays hidden unless Cloudflare
  // actually needs the visitor to interact.
  const needsHuman = open && (legacy || known !== null);
  useEffect(() => {
    if (!needsHuman || !siteKey || !tsRef.current) return;
    token.current = undefined;
    const mount = () => {
      const w = window as unknown as { turnstile?: TurnstileApi };
      if (w.turnstile && tsRef.current && !tsRef.current.hasChildNodes()) {
        tsId.current = w.turnstile.render(tsRef.current, { sitekey: siteKey, appearance: "interaction-only", callback: (t: string) => { token.current = t; } });
      }
    };
    if (document.getElementById("cf-turnstile-js")) return mount();
    const sc = document.createElement("script");
    sc.id = "cf-turnstile-js";
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    sc.async = true;
    sc.onload = mount;
    document.head.append(sc);
  }, [needsHuman, siteKey]);

  /** The human-check token, waiting a few seconds for the invisible check to finish if it hasn't yet. */
  const humanToken = async () => {
    for (let i = 0; siteKey && !token.current && i < 40; i++) await new Promise((r) => setTimeout(r, 150));
    return token.current;
  };

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

  const field = (f: FormData, k: string) => String(f.get(k) ?? "");

  const changeEmail = (v: string) => {
    setEmail(v);
    typed.current = true;
    seq.current++; // drop any answer still on its way for the old address
    setChecking(false);
    if (known) setKnown(null); // a different address needs its own answer
    setUnverified(false);
    if (err) setErr("");
  };

  /* ---- the one submit ---- */
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const c = checkEmail(email);
    if (!c.ok) return setErr(c.error);
    setErr("");

    // Enter pressed before the background check answered: check now, then show the right fields.
    if (!known) {
      const k = await runCheck(email);
      if (k) (k === "login" ? passRef : nameRef).current?.focus();
      return;
    }

    if (known === "login") {
      const password = field(f, "password");
      if (!password) return setErr("Please enter your password.");
      setUnverified(false);
      setBusy(true);
      const r = await post("/api/auth/login", { email: c.value, password, turnstile: await humanToken(), website: field(f, "website") });
      const session = r.json.session as SessionTokens | undefined;
      if (r.status !== 200 || !session) {
        if (r.json.code === "unverified") setUnverified(true);
        return fail(msg(r.json, "We couldn't sign you in just now. Please try again."));
      }
      if (!sb || !(await adoptSession(sb, session))) return fail("We couldn't sign you in just now. Please try again.");
      const problem = await onSubmit({ lead: null, token: session.access_token, after: "dashboard" });
      if (problem) fail(problem);
      return;
    }

    const v = checkLead({ name: field(f, "name"), email: c.value });
    if ("error" in v) return setErr(v.error);
    const pw = checkPassword(field(f, "password"), c.value);
    if (!pw.ok) return setErr(pw.error);
    setBusy(true);
    const r = await post("/api/auth/signup", { ...v.lead, password: pw.value, turnstile: await humanToken(), website: field(f, "website") });
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
    const f = new FormData(e.currentTarget);
    const v = checkLead({ name: field(f, "name"), email: field(f, "email") });
    if ("error" in v) return setErr(v.error);
    setErr("");
    setBusy(true);
    const problem = await onSubmit({ lead: v.lead, turnstile: await humanToken(), after: "dashboard" });
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
  const title = known === "login" ? "Welcome back" : known === "signup" ? "Create your free account" : `See the report for ${host}`;
  const sub =
    known === "login" ? (
      <>Enter your password to open the report for <strong>{host}</strong>.</>
    ) : known === "signup" ? (
      <>It&rsquo;s free. Your report for <strong>{host}</strong> is saved to your new account.</>
    ) : (
      <>Enter your email. We&rsquo;ll sign you in or set up a free account.</>
    );
  const action = known === "login" ? "Sign in and see report" : known === "signup" ? "Create account and see report" : "Continue";

  return (
    <dialog ref={ref} className="lead-modal" aria-labelledby="lead-h" onClose={onClose} onCancel={(e) => busy && e.preventDefault()}>
      {busy ? (
        <div className="lm-body">
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
      ) : legacy ? (
        <form onSubmit={submitLegacy} noValidate>
          <h2 id="lead-h">Where should we send your report?</h2>
          <p className="lm-sub">
            Tell us who to send the full report for <strong>{host}</strong> to. Your dashboard opens right after.
          </p>
          <label>
            Full name
            <input name="name" type="text" autoComplete="name" maxLength={100} required autoFocus />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required />
          </label>
          {errBox}
          {human}
          <p className="lm-fine">We use your details to deliver the report and follow up about Pagelyt. No spam.</p>
          <div className="lm-act">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">Get my report</button>
          </div>
        </form>
      ) : (
        <form onSubmit={submit} noValidate aria-busy={checking || busy}>
          <h2 id="lead-h">{title}</h2>
          <p className="lm-sub">{sub}</p>
          <label>
            <span className="lm-lab">
              Email
              {checking && <small className="lm-checking" role="status">Checking…</small>}
            </span>
            <input
              ref={emailRef}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              value={email}
              onChange={(e) => changeEmail(e.target.value)}
              onBlur={() => !known && void runCheck(email)}
              required
              autoFocus
            />
          </label>
          {known === "signup" && (
            <label>
              Full name
              <input ref={nameRef} name="name" type="text" autoComplete="name" maxLength={100} required />
            </label>
          )}
          {known && <Password key={known} autoComplete={known === "login" ? "current-password" : "new-password"} inputRef={passRef} />}
          {honeypot}
          {errBox}
          {unverified && (
            <p className="lm-fine">
              <button type="button" className="lm-link" onClick={resend}>Send the confirmation link again</button>
            </p>
          )}
          {human}
          {known === "login" && (
            <p className="lm-fine">
              <a className="lm-link" href="/login?forgot=1">Forgot password?</a>
            </p>
          )}
          {known === "signup" && <p className="lm-fine">At least 8 characters. We use your email to deliver the report and follow up about Pagelyt. No spam.</p>}
          <div className="lm-act">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={busy || checking}>{action}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
