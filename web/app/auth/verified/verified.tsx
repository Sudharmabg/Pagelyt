"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { claimAndFindReport, forgetVerifyEmail, rememberVerifyEmail, useLinkError } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkEmail } from "@/lib/validate";
import { SignInLink } from "@/app/sign-in-modal";

/* Where the confirmation link lands. Supabase puts the new session in the address; the client picks it up, then
   this page attaches the person's scans to their account and opens the newest report. */
export function Verified() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const linkError = useLinkError();
  const [timedOut, setTimedOut] = useState(false);
  const problem = linkError || timedOut;
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sb || linkError) return;
    let finished = false;
    const finish = async () => {
      if (finished) return;
      finished = true;
      const id = await claimAndFindReport(sb);
      forgetVerifyEmail();
      router.replace(id ? `/dashboard/${id}` : "/account");
    };
    sb.auth.getSession().then(({ data }) => data.session && void finish());
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => session && void finish());
    const timer = window.setTimeout(() => !finished && setTimedOut(true), 10000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [sb, router, linkError]);

  if (!sb) {
    return (
      <div className="panel auth-card">
        <h2>Accounts aren’t switched on yet</h2>
        <p className="panel-note">Add your Supabase URL and anon key to enable sign-in. See DEPLOY.md.</p>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="panel auth-card" role="status">
        <h2>Confirming your email…</h2>
        <p className="panel-note">One moment. Your report opens next.</p>
      </div>
    );
  }

  return (
    <form
      className="panel auth-card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const c = checkEmail(typed);
        if (!c.ok) return setErr(c.error);
        rememberVerifyEmail(c.value);
        void fetch("/api/auth/resend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: c.value, website: "" }) }).finally(() => router.push("/check-email"));
      }}
    >
      <h2>That link didn’t work</h2>
      <p className="panel-note">Confirmation links work once and expire. Enter your email and we&rsquo;ll send a new one. Already confirmed? <SignInLink>Sign in</SignInLink>.</p>
      <div className="tf">
        <label htmlFor="vf-email">Email</label>
        <input id="vf-email" type="email" autoComplete="email" inputMode="email" maxLength={254} value={typed} onChange={(e) => setTyped(e.target.value)} required />
      </div>
      {err && <p className="lm-err" role="alert">{err}</p>}
      <button type="submit" className="btn">Send a new link</button>
    </form>
  );
}
