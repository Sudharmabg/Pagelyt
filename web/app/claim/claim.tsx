"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useSignedInUser } from "@/lib/use-signed-in";

const META = "pagelyt-site-verification";
type State = { status: "pending"; token: string } | { status: "owned" } | null;

async function call(domain: string, action: "start" | "check"): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
  try {
    const r = await fetch("/api/sites/claim", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ domain, action }),
    });
    return { ok: r.ok, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, json: {} };
  }
}

/* Shows the code to publish (meta tag or DNS TXT record) and checks for it. Once found, the website moves to
   the signed-in account and its owner can scan it. */
export function Claim({ domain: wanted }: { domain: string }) {
  const user = useSignedInUser();
  const [domain, setDomain] = useState(wanted);
  const [state, setState] = useState<State>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !wanted) return;
    let live = true;
    void call(wanted, "start").then(({ ok, json }) => {
      if (!live) return;
      if (typeof json.domain === "string") setDomain(json.domain);
      if (!ok) return setErr(typeof json.error === "string" ? json.error : "Couldn't start the check. Please try again.");
      setState(json.status === "owned" ? { status: "owned" } : { status: "pending", token: String(json.token ?? "") });
    });
    return () => {
      live = false;
    };
  }, [user, wanted]);

  const check = async () => {
    setBusy(true);
    setErr("");
    const { ok, json } = await call(domain, "check");
    setBusy(false);
    if (!ok) return setErr(typeof json.error === "string" ? json.error : "Couldn't check just now. Please try again.");
    if (json.status === "owned") return setState({ status: "owned" });
    setErr(typeof json.error === "string" ? json.error : "We couldn't find the code yet.");
  };

  if (!wanted) {
    return (
      <div className="panel auth-card">
        <h2>Which website?</h2>
        <p className="panel-note">Start from the home page: enter your website and choose &ldquo;Prove I own it&rdquo;.</p>
        <Link className="btn" href="/">Go to the home page</Link>
      </div>
    );
  }
  if (user === undefined) return <div className="panel auth-card" aria-busy="true"><p className="panel-note">Loading…</p></div>;
  if (!user) {
    return (
      <div className="panel auth-card">
        <h2>Log in first</h2>
        <p className="panel-note">
          Log in to the account that should own <strong>{wanted}</strong>. No account yet? Enter {wanted} on the home page and choose &ldquo;Prove ownership&rdquo; to create one.
        </p>
        <Link className="btn" href={`/login?next=${encodeURIComponent(`/claim?domain=${wanted}`)}`}>Log in</Link>
      </div>
    );
  }
  if (state?.status === "owned") {
    return (
      <div className="panel auth-card" role="status">
        <h2>{domain} is yours</h2>
        <p className="panel-note">It now belongs to <strong>{user.email}</strong>, and you can scan it any time.</p>
        <Link className="btn" href="/">Scan {domain}</Link>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="panel auth-card" aria-busy={!err}>
        {err ? <p className="lm-err" role="alert">{err}</p> : <p className="panel-note">Preparing your code…</p>}
      </div>
    );
  }

  const tag = `<meta name="${META}" content="${state.token}">`;
  const txt = `${META}=${state.token}`;
  return (
    <div className="panel auth-card">
      <h2>Prove you own {domain}</h2>
      <p className="panel-note">Do one of these, then press Check. You can remove the code once the website is yours.</p>
      <ol className="claim-steps">
        <li>
          <strong>Add a meta tag</strong> to the <code>&lt;head&gt;</code> of your homepage (https://{domain}/ or https://www.{domain}/):
          <code className="claim-code">{tag}</code>
        </li>
        <li>
          <strong>Or add a DNS TXT record</strong> on <code>{domain}</code> with this value:
          <code className="claim-code">{txt}</code>
        </li>
      </ol>
      {err && <p className="lm-err" role="alert">{err}</p>}
      <button type="button" className="btn" disabled={busy} onClick={check}>{busy ? "Checking…" : "Check now"}</button>
    </div>
  );
}
