"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { claimAndFindReport, forgetVerifyEmail, rememberVerifyEmail, useVerifyEmail } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkEmail } from "@/lib/validate";

const COOLDOWN = 60;

/* Shown while a new visitor's report is ready but their email is not confirmed yet. It sends the link again on
   request and moves on by itself the moment they confirm, even if they open the link in another tab. */
export function CheckEmail() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const email = useVerifyEmail();
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);

  const go = useCallback(async () => {
    if (!sb) return;
    const id = await claimAndFindReport(sb);
    forgetVerifyEmail();
    router.replace(id ? `/dashboard/${id}` : "/account");
  }, [sb, router]);

  // Move on as soon as the email is confirmed in this browser or another tab.
  useEffect(() => {
    if (!sb) return;
    let done = false;
    const once = () => {
      if (!done) {
        done = true;
        void go();
      }
    };
    sb.auth.getSession().then(({ data }) => data.session && once());
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => session && once());
    return () => sub.subscription.unsubscribe();
  }, [sb, go]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const resend = async (address: string) => {
    setErr("");
    setNote("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/resend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: address, website: "" }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status === 429) setErr(j.error ?? "Please wait a little before asking again.");
      else if (!r.ok) setErr(j.error ?? "We couldn't send that just now. Please try again.");
      else {
        setNote("Sent. It can take a minute, so check your spam folder too.");
        setWait(COOLDOWN);
      }
    } catch {
      setErr("Could not reach the server. Please try again.");
    }
    setBusy(false);
  };

  if (!email) {
    return (
      <form
        className="panel auth-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const c = checkEmail(typed);
          if (!c.ok) return setErr(c.error);
          rememberVerifyEmail(c.value);
          void resend(c.value);
        }}
      >
        <h2>Which email did you use?</h2>
        <p className="panel-note">We&rsquo;ll send the confirmation link to it.</p>
        <div className="tf">
          <label htmlFor="ce-email">Email</label>
          <input id="ce-email" type="email" autoComplete="email" inputMode="email" maxLength={254} value={typed} onChange={(e) => setTyped(e.target.value)} required />
        </div>
        {err && <p className="lm-err" role="alert">{err}</p>}
        <button type="submit" className="btn" disabled={busy}>Send the link</button>
      </form>
    );
  }

  return (
    <div className="panel auth-card" role="status">
      <h2>We sent a link to {email}</h2>
      <p className="panel-note">
        Open it to confirm your address. Your report opens straight after. The link works once and expires, so use the newest email.
      </p>
      {note && <p className="lm-fine">{note}</p>}
      {err && <p className="lm-err" role="alert">{err}</p>}
      <div className="lm-act">
        <button type="button" className="btn ghost" disabled={busy || wait > 0} onClick={() => resend(email)}>
          {wait > 0 ? `Send again in ${wait}s` : "Send the link again"}
        </button>
        <Link className="btn ghost" href="/" onClick={forgetVerifyEmail}>Use a different email</Link>
      </div>
    </div>
  );
}
