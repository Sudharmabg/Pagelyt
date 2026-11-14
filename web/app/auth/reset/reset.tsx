"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLinkError } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkPassword, passwordsMatch } from "@/lib/validate";

/* Where the password-reset link lands. Supabase puts a short recovery session in the address; once the client
   picks it up, the person chooses a new password. */
export function Reset() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const linkError = useLinkError();
  const [stage, setStage] = useState<"waiting" | "ready" | "problem" | "done">("waiting");
  const state = linkError && stage !== "done" ? "problem" : stage;
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sb || linkError) return;
    let ready = false;
    const open = (address: string | undefined) => {
      ready = true;
      setEmail(address ?? "");
      setStage("ready");
    };
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) open(session?.user.email);
    });
    sb.auth.getSession().then(({ data }) => data.session && open(data.session.user.email));
    const timer = window.setTimeout(() => !ready && setStage("problem"), 10000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [sb, linkError]);

  if (!sb) {
    return (
      <div className="panel auth-card">
        <h2>Accounts aren’t switched on yet</h2>
        <p className="panel-note">Add your Supabase URL and anon key to enable sign-in. See DEPLOY.md.</p>
      </div>
    );
  }

  if (state === "waiting") {
    return (
      <div className="panel auth-card" role="status">
        <h2>One moment…</h2>
        <p className="panel-note">Checking your reset link.</p>
      </div>
    );
  }

  if (state === "problem") {
    return (
      <div className="panel auth-card">
        <h2>That link didn’t work</h2>
        <p className="panel-note">Reset links work once and expire soon. <Link href="/login?forgot=1">Send a new reset link</Link>.</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="panel auth-card" role="status">
        <h2>Password updated</h2>
        <p className="panel-note">You&rsquo;re signed in. <Link href="/dashboard">Go to your dashboard</Link>.</p>
      </div>
    );
  }

  return (
    <form
      className="panel auth-card"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const pw = checkPassword(f.get("password"), email);
        if (!pw.ok) return setErr(pw.error);
        const mismatch = passwordsMatch(String(f.get("password")), String(f.get("confirm") ?? ""));
        if (mismatch) return setErr(mismatch);
        setErr("");
        setBusy(true);
        const { error } = await sb.auth.updateUser({ password: pw.value });
        setBusy(false);
        if (error) return setErr(error.message.toLowerCase().includes("password") ? "That password isn't accepted. Please choose another." : "We couldn't update your password. Please try again.");
        setStage("done");
        window.setTimeout(() => router.push("/dashboard"), 1500);
      }}
    >
      <h2>Choose a new password</h2>
      <div className="tf">
        <label htmlFor="rs-pw">New password</label>
        <input id="rs-pw" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required autoFocus />
      </div>
      <div className="tf">
        <label htmlFor="rs-cf">Confirm new password</label>
        <input id="rs-cf" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      <p className="panel-note">At least 8 characters.</p>
      {err && <p className="lm-err" role="alert">{err}</p>}
      <button type="submit" className="btn" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
