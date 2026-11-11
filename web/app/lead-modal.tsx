"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adoptSession, rememberVerifyEmail, type SessionTokens } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkEmail, checkLead, checkPassword } from "@/lib/validate";
import { isDisposable } from "@/lib/disposable";
import { CodeForm } from "./code-form";

export type LeadInput = { name: string; email: string };

/** What the modal hands to the page when it is time to run the scan. */
export type ScanStart = {
  lead: LeadInput | null;
  turnstile?: string;
  /** Proof of a just-created account, so the scan needs no second human check and belongs to that account. */
  ticket?: string;
  /** Access token of a signed-in visitor. */
  token?: string;
  /** "dashboard": run the scan here, then open the report. "verify": open the (locked) dashboard straight away;
      it keeps the scan running there while the new account enters its email code. */
  after: "dashboard" | "verify";
};

/** Why a scan could not start. `code: "not_owner"` means the website belongs to another account. */
export type ScanProblem = { error: string; code?: string; domain?: string };

/* login: the website is registered, so only its owner can log in and scan it.
   signup: a new website, so a new account (name, email, password).
   claim: someone who owns a registered website but has no account yet makes one, then proves ownership.
   code: the account must enter the 6-digit code from its email (once). */
type Mode = null | "login" | "signup" | "claim" | "code";
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

// The last email used on this device, so a returning owner's login form is already filled in.
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
function Password({ autoComplete }: { autoComplete: "current-password" | "new-password" }) {
  const [shown, setShown] = useState(false);
  const isNew = autoComplete === "new-password";
  return (
    <label>
      Password
      <span className="lm-pw">
        <input name="password" type={shown ? "text" : "password"} autoComplete={autoComplete} minLength={isNew ? 8 : undefined} maxLength={isNew ? 72 : 200} required />
        <button type="button" className="lm-eye" aria-pressed={shown} onClick={() => setShown((s) => !s)}>
          {shown ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

/* As soon as it opens, the modal asks whether the website is already registered: a registered site gets the
   log-in form (its owner only), a new one the sign-up form. Without Supabase configured it is the plain contact
   form. `onSubmit` resolves to a problem, or null on success (the parent then navigates away, so the modal just
   just says the dashboard is opening). */
export function LeadModal({
  open,
  url,
  host,
  running = false,
  tool,
  onClose,
  onSubmit,
}: {
  open: boolean;
  url: string;
  host: string;
  /** True when the parent is already scanning (signed-in visitors skip the form). */
  running?: boolean;
  /** Set on a free tool's page: the modal only signs the visitor in (log in or sign up, with the email code if new),
      then `onSubmit` runs the tool. No website lookup, no website taken by the new account, no dashboard. */
  tool?: string;
  onClose: () => void;
  onSubmit: (start: ScanStart) => Promise<ScanProblem | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busyLocal, setBusy] = useState(false);
  const [opening, setOpening] = useState(false); // a new account's dashboard is about to open
  const busy = busyLocal || running;
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const router = useRouter();
  const sb = supabaseBrowser();
  const [legacy, setLegacy] = useState(!sb);
  const [mode, setMode] = useState<Mode>(null);
  const [known, setKnown] = useState(false); // is the website registered?
  const [domain, setDomain] = useState(host);
  const [email, setEmail] = useState("");
  const [notOwner, setNotOwner] = useState(""); // signed in, but the website belongs to another account
  const [afterCode, setAfterCode] = useState<"scan" | "claim" | "tool">("scan"); // what happens once the email code is in
  const [resendCode, setResendCode] = useState(false); // the code screen must send a fresh code (a login, not a sign-up)
  const tsRef = useRef<HTMLDivElement>(null);
  const tsId = useRef<string | undefined>(undefined);
  const token = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Start each opening fresh (adjusting state while rendering, as React recommends).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLegacy(!sb);
      // A tool needs no website lookup: a returning visitor (email saved on this device) starts at log in.
      setMode(tool && sb ? (readSaved() ? "login" : "signup") : null);
      setKnown(false);
      setDomain(host);
      setEmail(sb ? readSaved() : "");
      setErr("");
      setNote("");
      setNotOwner("");
      setOpening(false);
      setBusy(false);
      setResendCode(false);
    }
  }

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  /* ---- is this website registered? ---- */
  const lookUp = async () => {
    const r = await post("/api/auth/site", { url });
    if (r.status === 501) return setLegacy(true); // accounts are not switched on here: use the plain form
    if (r.status !== 200) return setErr(msg(r.json, "We couldn't check that website just now. Please try again."));
    if (typeof r.json.domain === "string") setDomain(r.json.domain);
    const k = r.json.known === true;
    setKnown(k);
    setMode(k ? "login" : "signup");
  };
  useEffect(() => {
    if (!open || legacy || running || mode !== null) return;
    const t = window.setTimeout(() => void lookUp(), 0);
    return () => window.clearTimeout(t);
  }, [open, legacy, running, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cloudflare Turnstile (human check), only once a password is about to be sent. It stays hidden unless Cloudflare
  // actually needs the visitor to interact.
  const needsHuman = open && (legacy || mode === "login" || mode === "signup" || mode === "claim");
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
  }, [needsHuman, siteKey, mode]);

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
    setOpening(false);
    freshHumanCheck();
  };

  const field = (f: FormData, k: string) => String(f.get(k) ?? "");

  const switchTo = (m: Mode, why = "") => {
    setErr("");
    setNote(why);
    setMode(m);
  };

  /** Signed in: run the scan. A website registered to someone else stops here with a way to prove ownership. */
  const scanAs = async (session: SessionTokens, lead: LeadInput | null) => {
    const problem = await onSubmit({ lead, token: session.access_token, after: "dashboard" });
    if (!problem) return;
    setBusy(false);
    if (problem.code === "not_owner") return setNotOwner(problem.domain || domain);
    setErr(problem.error);
  };

  const goClaim = () => router.push(`/claim?domain=${encodeURIComponent(domain)}`);

  /* ---- log in (registered website) ---- */
  const login = async (f: FormData) => {
    const c = checkEmail(field(f, "email"));
    if (!c.ok) return setErr(c.error);
    const password = field(f, "password");
    if (!password) return setErr("Please enter your password.");
    setEmail(c.value);
    setBusy(true);
    const r = await post("/api/auth/login", { email: c.value, password, turnstile: await humanToken(), website: field(f, "website") });
    const session = r.json.session as SessionTokens | undefined;
    if (r.status !== 200 || !session) {
      if (r.json.code === "unverified") {
        // The account never entered its email code: send a fresh one and ask for it here.
        setBusy(false);
        setAfterCode(tool ? "tool" : "scan");
        setResendCode(true);
        return switchTo("code");
      }
      return fail(msg(r.json, "We couldn't log you in just now. Please try again."));
    }
    if (!sb || !(await adoptSession(sb, session))) return fail("We couldn't log you in just now. Please try again.");
    save(c.value);
    await scanAs(session, null);
  };

  /* ---- sign up (new website, or an owner about to prove ownership) ---- */
  const signup = async (f: FormData, claim: boolean) => {
    const v = checkLead({ name: field(f, "name"), email: field(f, "email") });
    if ("error" in v) return setErr(v.error);
    if (isDisposable(v.lead.email)) return setErr("Please use a permanent email address, not a temporary inbox.");
    const pw = checkPassword(field(f, "password"), v.lead.email);
    if (!pw.ok) return setErr(pw.error);
    setEmail(v.lead.email);
    setBusy(true);
    const r = await post("/api/auth/signup", { ...v.lead, password: pw.value, url: claim || tool ? undefined : url, claim, turnstile: await humanToken(), website: field(f, "website") });
    if (r.status === 409 && (r.json.code === "exists" || r.json.code === "known")) {
      setBusy(false);
      freshHumanCheck();
      if (r.json.code === "known") setKnown(true);
      return switchTo("login", msg(r.json, "Please log in instead."));
    }
    if (r.status !== 200) return fail(msg(r.json, "We couldn't create your account just now. Please try again."));
    save(v.lead.email);
    const session = r.json.session as SessionTokens | null;
    if (session && sb && (await adoptSession(sb, session))) {
      if (claim) return goClaim();
      return scanAs(session, v.lead);
    }
    if (claim || tool) {
      // The account must enter its email code here first; then it claims its site, or the tool runs.
      setBusy(false);
      setAfterCode(claim ? "claim" : "tool");
      return switchTo("code");
    }
    // The email still has to be confirmed: open the locked dashboard now; the scan runs there meanwhile.
    rememberVerifyEmail(v.lead.email);
    setOpening(true);
    const problem = await onSubmit({ lead: v.lead, ticket: typeof r.json.ticket === "string" ? r.json.ticket : undefined, after: "verify" });
    if (problem) fail(problem.error);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    const f = new FormData(e.currentTarget);
    if (mode === "login") return login(f);
    if (mode === "signup" || mode === "claim") return signup(f, mode === "claim");
  };

  const verified = async (session: SessionTokens) => {
    if (afterCode === "claim") return goClaim();
    setBusy(true);
    await scanAs(session, null);
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
    if (problem) fail(problem.error);
  };

  const honeypot = <input className="lm-hp" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />;
  const errBox = err && (
    <p className="lm-err" role="alert">
      {err}
    </p>
  );
  const noteBox = note && <p className="lm-note" role="status">{note}</p>;
  const human = siteKey && <div ref={tsRef} className="lm-ts" />;
  const cancel = <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>;

  let content: React.ReactNode;
  if (notOwner) {
    content = (
      <div className="lm-body">
        <h2 id="lead-h">{notOwner} belongs to another account</h2>
        <p className="lm-sub">
          Each website can be scanned by one account. Log in with the account that registered <strong>{notOwner}</strong>, or prove you own the site and we&rsquo;ll move it to
          your account.
        </p>
        <div className="lm-act">
          {cancel}
          <button type="button" className="btn" onClick={goClaim}>Prove I own it</button>
        </div>
      </div>
    );
  } else if (busy) {
    // The scan itself runs on the dashboard, which shows each area as it finishes; this only covers the moment
    // before it opens.
    content = tool ? (
      <div className="lm-body">
        <h2 id="lead-h">Signing you in…</h2>
        <p className="lm-sub" role="status">The {tool} runs as soon as you&rsquo;re in.</p>
      </div>
    ) : (
      <div className="lm-body">
        <h2 id="lead-h">Opening your dashboard…</h2>
        <p className="lm-sub" role="status">
          {opening ? "Your scan has started. Next, enter the code we’ve emailed you to unlock the report." : `Your scan of ${host} is starting. You’ll see each area completed live.`}
        </p>
      </div>
    );
  } else if (legacy) {
    content = (
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
          {cancel}
          <button type="submit" className="btn">Get my report</button>
        </div>
      </form>
    );
  } else if (mode === null) {
    content = (
      <div className="lm-body">
        <h2 id="lead-h">Checking {host}…</h2>
        {err ? (
          <>
            {errBox}
            <div className="lm-act">
              {cancel}
              <button type="button" className="btn" onClick={() => { setErr(""); void lookUp(); }}>Try again</button>
            </div>
          </>
        ) : (
          <p className="lm-sub" role="status">One moment while we look up this website.</p>
        )}
      </div>
    );
  } else if (mode === "code") {
    content = (
      <div className="lm-body lm-code">
        <h2 id="lead-h">Verify your email</h2>
        <p className="lm-sub">
          We&rsquo;ve sent a 6-digit code to <strong>{email}</strong>. Enter it to {afterCode === "claim" ? "finish creating your account" : afterCode === "tool" ? `run the ${tool}` : `see the report for ${host}`}. You only
          need to do this once.
        </p>
        <CodeForm email={email} sendFirst={resendCode} onVerified={verified} />
        <div className="lm-act">{cancel}</div>
      </div>
    );
  } else {
    const isLogin = mode === "login";
    const title = isLogin ? "Welcome back" : mode === "claim" ? `Create an account to claim ${domain}` : "Create your free account";
    const sub = tool ? (
      isLogin ? (
        <>Log in to run the <strong>{tool}</strong>.</>
      ) : (
        <>It&rsquo;s free, and every Pagelyt tool works with the same account. The <strong>{tool}</strong> runs as soon as you&rsquo;re in.</>
      )
    ) : isLogin ? (
      known ? (
        <><strong>{domain}</strong> is registered with Pagelyt. Log in with its account to see the report.</>
      ) : (
        <>Log in to see the report for <strong>{host}</strong>.</>
      )
    ) : mode === "claim" ? (
      <>Next you&rsquo;ll add a short code to your website or DNS to prove it&rsquo;s yours, and we&rsquo;ll move it to this account.</>
    ) : (
      <>It&rsquo;s free. The report for <strong>{host}</strong> is saved to your new account.</>
    );
    content = (
      <form onSubmit={submit} noValidate key={mode}>
        <h2 id="lead-h">{title}</h2>
        <p className="lm-sub">{sub}</p>
        {noteBox}
        {!isLogin && (
          <label>
            Full name
            <input name="name" type="text" autoComplete="name" maxLength={100} required autoFocus />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} defaultValue={email} required autoFocus={isLogin && !email} />
        </label>
        <Password autoComplete={isLogin ? "current-password" : "new-password"} />
        {honeypot}
        {errBox}
        {human}
        {isLogin ? (
          <p className="lm-fine">
            <a className="lm-link" href="/login?forgot=1">Forgot password?</a>
          </p>
        ) : (
          <p className="lm-fine">At least 8 characters. We&rsquo;ll email you a 6-digit code to confirm your address. No spam.</p>
        )}
        <div className="lm-act">
          {cancel}
          <button type="submit" className="btn">
            {tool ? (isLogin ? "Log in and run" : "Create account and run") : isLogin ? "Log in and see report" : mode === "claim" ? "Create account" : "Create account and see report"}
          </button>
        </div>
        {isLogin && known && (
          <p className="lm-switch">
            Own {domain} but don&rsquo;t have the account?{" "}
            <button type="button" className="lm-link" onClick={() => switchTo("claim")}>Prove ownership</button>
          </p>
        )}
        {isLogin && !known && (
          <p className="lm-switch">
            New to Pagelyt? <button type="button" className="lm-link" onClick={() => switchTo("signup")}>Create an account</button>
          </p>
        )}
        {mode === "signup" && (
          <p className="lm-switch">
            Already have an account? <button type="button" className="lm-link" onClick={() => switchTo("login")}>Log in</button>
          </p>
        )}
        {mode === "claim" && (
          <p className="lm-switch">
            <button type="button" className="lm-link" onClick={() => switchTo("login")}>Back to log in</button>
          </p>
        )}
      </form>
    );
  }

  return (
    <dialog ref={ref} className="lead-modal" aria-labelledby="lead-h" onClose={onClose} onCancel={(e) => busy && e.preventDefault()}>
      {content}
    </dialog>
  );
}
