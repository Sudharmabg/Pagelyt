"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

/* "Save this site": keeps the report in your account and optionally turns on scheduled rescans and
   uptime checks. Hidden entirely when Supabase is not configured. `inline` shows the form on the page (the
   dashboard's "Save & monitor" section) instead of in a drop-down. */
export function SaveSite({ scanId, inline = false }: { scanId: string; inline?: boolean }) {
  const sb = supabaseBrowser();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [cadence, setCadence] = useState("weekly");
  const [uptime, setUptime] = useState(true);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  if (!sb || signedIn === undefined) return null;
  if (!signedIn) return <Link href="/login" className="dash-btn">Sign in to save</Link>;

  const save = async () => {
    setState("saving");
    setErr("");
    try {
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const r = await fetch("/api/account/claim", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ scanId, cadence, uptime }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not save.");
      setState("saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
      setState("idle");
    }
  };

  const form = (
    <>
        {state === "saved" ? (
          <p className="panel-note">Saved. <Link className="fnd-link" href="/account">Manage your sites</Link></p>
        ) : (
          <>
            <label className="as-f">
              Rescan
              <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
                <option value="none">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="as-f check">
              <input type="checkbox" checked={uptime} onChange={(e) => setUptime(e.target.checked)} />
              Uptime monitoring
            </label>
            {err && <p className="lm-err" role="alert">{err}</p>}
            <button type="button" className="dash-btn primary" onClick={save} disabled={state === "saving"}>
              {state === "saving" ? "Saving…" : "Save"}
            </button>
          </>
        )}
    </>
  );
  if (inline) return <div className="panel save-inline">{form}</div>;
  return (
    <details className="xmenu">
      <summary className="dash-btn">{state === "saved" ? "Saved ✓" : "Save this site"}</summary>
      <div className="xmenu-pop save-pop">{form}</div>
    </details>
  );
}
