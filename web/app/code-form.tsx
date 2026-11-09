"use client";

import { useEffect, useRef, useState } from "react";
import { adoptSession, type SessionTokens } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkCode, checkEmail } from "@/lib/validate";

const COOLDOWN = 60;

async function post(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { status: 0, json: {} };
  }
}

/* The one-time email check: type the 6-digit code from the sign-up email and this browser is signed in.
   Used on the locked dashboard and in the scan modal (for an account that never entered its code).
   `sendFirst` asks for a fresh code as it opens (the original one may be long gone). */
export function CodeForm({ email: known, sendFirst = false, onVerified }: { email: string; sendFirst?: boolean; onVerified: (session: SessionTokens) => void | Promise<void> }) {
  const [email, setEmail] = useState(known);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const resend = async (address = email) => {
    const em = checkEmail(address);
    if (!em.ok) return setErr(em.error);
    setErr("");
    setNote("");
    const r = await post("/api/auth/resend", { email: em.value, website: "" });
    if (r.status === 429) return setErr("Please wait a minute before asking for another code.");
    if (r.status !== 200) return setErr("We couldn't send a code just now. Please try again.");
    setNote(`A new code is on its way to ${em.value}.`);
    setWait(COOLDOWN);
  };

  // A fresh code as the form opens, when asked for (sent once; the button handles any later ones).
  const sent = useRef(false);
  useEffect(() => {
    if (!sendFirst || sent.current || !checkEmail(known).ok) return;
    sent.current = true;
    const t = window.setTimeout(() => void resend(known), 0);
    return () => window.clearTimeout(t);
  }, [sendFirst, known]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = checkEmail(email);
    if (!em.ok) return setErr(em.error);
    const c = checkCode(code);
    if (!c.ok) return setErr(c.error);
    setErr("");
    setBusy(true);
    const r = await post("/api/auth/verify", { email: em.value, code: c.value });
    const session = r.json.session as SessionTokens | undefined;
    const sb = supabaseBrowser();
    if (r.status !== 200 || !session || !sb || !(await adoptSession(sb, session))) {
      setBusy(false);
      return setErr(typeof r.json.error === "string" ? r.json.error : "We couldn't check the code just now. Please try again.");
    }
    await onVerified(session);
  };

  return (
    <form onSubmit={submit} noValidate>
      {!known && (
        <label>
          Email you signed up with
          <input type="email" autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      )}
      <label>
        6-digit code
        <input
          className="code-in"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={9}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ""))}
          autoFocus
          required
        />
      </label>
      {err && <p className="lm-err" role="alert">{err}</p>}
      {note && <p className="lm-fine" role="status">{note}</p>}
      <button type="submit" className="btn" disabled={busy}>{busy ? "Checking…" : "Verify email"}</button>
      <p className="lm-fine">
        Didn&rsquo;t get it? Check spam, or{" "}
        <button type="button" className="lm-link" disabled={wait > 0} onClick={() => void resend()}>
          {wait > 0 ? `send a new code in ${wait}s` : "send a new code"}
        </button>
        .
      </p>
    </form>
  );
}
