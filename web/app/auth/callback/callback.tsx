"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { PROVIDER_NAMES, takePending, type OAuthPending } from "@/lib/oauth";
import { adoptSession, claimAndFindReport, type SessionTokens } from "@/lib/pending";
import { beginScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { checkLead } from "@/lib/validate";
import { landing } from "../../login/login-form";

type Problem = { error: string; code?: string; domain?: string };

const hostOf = (url: string) => url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();

/* Where Google and GitHub send the person back (via Supabase). Hands the code to /api/auth/oauth, signs the browser
   in, asks for a name if the provider had none, then carries on with what they were doing: the scan they started in
   the scan modal, or the page they signed in from. */
export function OAuthCallback() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const started = useRef(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [ask, setAsk] = useState<{ pending: OAuthPending; token: string } | null>(null);
  const [status, setStatus] = useState("Signing you in…");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  /** Signed in: start their scan, or open where they were going. */
  const proceed = async (p: OAuthPending, token: string) => {
    if (p.scanUrl) {
      setStatus("Starting your scan…");
      const s = await beginScan(p.scanUrl, token);
      if ("error" in s) return setProblem({ error: s.error, code: s.code, domain: hostOf(p.scanUrl) });
      track("scan_started", { source: p.source, signed_in: true });
      if (s.done) await fetch("/api/account/claim", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ scanId: s.id }) }).catch(() => {});
      if (!s.done && s.prevId) return router.replace(`/dashboard/${s.prevId}?scan=${s.id}`);
      return router.replace(`/dashboard/${s.id}${s.done ? "" : "?new=1"}`);
    }
    const next = /^\/(?![/\\])/.test(p.next) ? p.next : "/dashboard"; // only ever a page on this site
    router.replace(await landing(next, token));
  };

  useEffect(() => {
    if (started.current || !sb) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const pending = takePending();
    const code = q.get("code");
    const denied = q.get("error_description") || hash.get("error_description") || q.get("error") || hash.get("error");
    void (async () => {
      if (denied) return setProblem({ error: /denied|cancel/i.test(denied) ? "Sign-in was cancelled. You can try again, or use your email instead." : "The sign-in didn't finish. Please try again, or use your email instead.", code: "denied" });
      if (!code || !pending) return setProblem({ error: "This sign-in link has expired. Please start again from the sign-in page.", code: "expired" });
      let r: Response;
      try {
        r = await fetch("/api/auth/oauth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, verifier: pending.verifier, url: pending.scanUrl ?? "", intent: pending.intent }) });
      } catch {
        return setProblem({ error: "Could not reach the server. Please try again." });
      }
      const j = (await r.json().catch(() => ({}))) as { session?: SessionTokens; isNew?: boolean; needsName?: boolean; error?: string; code?: string };
      if (!r.ok || !j.session) return setProblem({ error: j.error ?? "We couldn't sign you in just now. Please try again.", code: j.code });
      if (!(await adoptSession(sb, j.session))) return setProblem({ error: "We couldn't sign you in just now. Please try again." });
      window.history.replaceState(null, "", "/auth/callback"); // the code is spent: keep it out of history
      track(j.isNew ? "sign_up" : "login", { method: pending.provider, source: pending.source });
      await claimAndFindReport(sb);
      if (j.needsName) return setAsk({ pending, token: j.session.access_token });
      await proceed(pending, j.session.access_token);
    })();
  }, [sb]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveName = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sb || !ask) return;
    const typed = String(new FormData(e.currentTarget).get("name") ?? ""); // read before any await: currentTarget is cleared after
    const user = (await sb.auth.getUser()).data.user;
    const v = checkLead({ name: typed, email: user?.email ?? "" });
    if ("error" in v) return setErr(v.error);
    setErr("");
    setBusy(true);
    const t0 = (await sb.auth.getSession()).data.session?.access_token ?? ask.token;
    const r = await fetch("/api/auth/name", { method: "POST", headers: { authorization: `Bearer ${t0}`, "content-type": "application/json" }, body: JSON.stringify({ name: v.lead.name }) }).catch(() => null);
    if (!r?.ok) {
      setBusy(false);
      const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
      return setErr(j?.error ?? "We couldn't save your name just now. Please try again.");
    }
    // A fresh token carries the new name to the header and dashboard straight away.
    const token = (await sb.auth.refreshSession()).data.session?.access_token ?? t0;
    setAsk(null);
    await proceed(ask.pending, token);
  };

  if (!sb) {
    return (
      <div className="panel auth-card">
        <h2>Accounts aren’t switched on yet</h2>
        <p className="panel-note">Add your Supabase URL and anon key to enable sign-in. See DEPLOY.md.</p>
      </div>
    );
  }

  if (problem) {
    const notOwner = problem.code === "not_owner" || problem.code === "known";
    return (
      <div className="panel auth-card" role="alert">
        <h2>{notOwner ? "This website belongs to another account" : problem.code === "denied" ? "Sign-in cancelled" : "We couldn't sign you in"}</h2>
        <p className="panel-note">{problem.error}</p>
        <div className="acct-links">
          {notOwner && problem.domain && problem.code === "not_owner" && (
            <Link className="btn" href={`/claim?domain=${encodeURIComponent(problem.domain)}`}>Prove I Own It</Link>
          )}
          {problem.code === "not_owner" ? <Link className="lm-link" href="/dashboard">Go to my dashboard</Link> : <Link className="btn" href="/login">Back to sign in</Link>}
        </div>
      </div>
    );
  }

  if (ask) {
    return (
      <form className="panel auth-card" onSubmit={saveName} noValidate>
        <h2>What should we call you?</h2>
        <p className="panel-note">Your {PROVIDER_NAMES[ask.pending.provider]} profile has no name. It shows on your dashboard and report covers.</p>
        <div className="tf">
          <label htmlFor="cb-name">Full name</label>
          <input id="cb-name" name="name" type="text" autoComplete="name" maxLength={100} required autoFocus />
        </div>
        {err && <p className="lm-err" role="alert">{err}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
      </form>
    );
  }

  return (
    <div className="panel auth-card" role="status">
      <h2>{status}</h2>
      <p className="panel-note">One moment.</p>
    </div>
  );
}
