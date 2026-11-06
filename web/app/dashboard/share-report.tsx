"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

/* "Share branded report": creates a client-facing link with your brand and none of ours.
   The report must belong to your account (Save this site first). Hidden without Supabase. */
export function ShareReport({ scanId }: { scanId: string }) {
  const sb = supabaseBrowser();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandId, setBrandId] = useState("");
  const [details, setDetails] = useState(true);
  const [ai, setAi] = useState(false);
  const [days, setDays] = useState("0");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sb) return;
    const load = async () => {
      const { data } = await sb.from("brands").select("id,name").order("created_at");
      setBrands(data ?? []);
      setBrandId((cur) => cur || data?.[0]?.id || "");
    };
    sb.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (data.session) void load();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSignedIn(!!s);
      if (s) void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  if (!sb || !signedIn) return null;

  const create = async () => {
    setState("busy");
    setErr("");
    try {
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ scanId, brandId: brandId || null, showDetails: details, includeAi: ai, expiresInDays: Number(days) || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not create the link.");
      setLink(`${window.location.origin}${j.path}`);
      setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the link.");
      setState("idle");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the link is selectable below */
    }
  };

  return (
    <details className="xmenu">
      <summary className="dash-btn">Share branded report</summary>
      <div className="xmenu-pop save-pop">
        {state === "done" ? (
          <>
            <p className="panel-note">Your client-facing link:</p>
            <input className="fnd-search" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Shared report link" />
            <div className="brand-act">
              <button type="button" className="dash-btn primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
              <a className="dash-btn" href={link} target="_blank" rel="noopener noreferrer">Open</a>
            </div>
          </>
        ) : (
          <>
            {brands.length === 0 ? (
              <p className="panel-note">No brand yet. <Link className="fnd-link" href="/account/brand">Create one</Link> to put your logo and colour on the report.</p>
            ) : (
              <label className="as-f">
                Brand
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  <option value="">No brand (neutral)</option>
                </select>
              </label>
            )}
            <label className="as-f check"><input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} />Include “how to fix” steps</label>
            <label className="as-f check"><input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} />Include AI visibility summary</label>
            <label className="as-f">
              Link expires
              <select value={days} onChange={(e) => setDays(e.target.value)}>
                <option value="0">Never</option>
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
              </select>
            </label>
            {err && <p className="lm-err" role="alert">{err} {err.includes("Save this site") && "Use “Save this site” first."}</p>}
            <button type="button" className="dash-btn primary" onClick={create} disabled={state === "busy"}>{state === "busy" ? "Creating…" : "Create link"}</button>
          </>
        )}
      </div>
    </details>
  );
}
