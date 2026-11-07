"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { STAGE_LABELS } from "@/lib/scan/labels";

type Cadence = "none" | "daily" | "weekly" | "monthly";
type SiteRow = { id: string; host: string; url: string; cadence: Cadence; uptime: boolean; alerts: boolean; last_scan_id: string | null };
type ScanRow = { id: string; host: string; created_at: string; status: string; overall: string | null };
type Check = { site_id: string; ok: boolean };

export function Account() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined); // undefined = still checking
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const load = useCallback(async () => {
    if (!sb) return;
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const [s, r, c] = await Promise.all([
      sb.from("sites").select("id,host,url,cadence,uptime,alerts,last_scan_id").order("created_at", { ascending: false }),
      sb.from("scans").select("id,host,created_at,status,overall:result->>overall").order("created_at", { ascending: false }).limit(20),
      sb.from("uptime_checks").select("site_id,ok").gte("at", since).limit(2000),
    ]);
    setSites((s.data as SiteRow[]) ?? []);
    setScans((r.data as unknown as ScanRow[]) ?? []);
    setChecks((c.data as Check[]) ?? []);
  }, [sb]);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      if (data.session) void load();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
      if (session) void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [sb, load]);

  const token = async () => (await sb!.auth.getSession()).data.session?.access_token;

  const update = async (id: string, patch: Partial<Pick<SiteRow, "cadence" | "uptime" | "alerts">>) => {
    const next = { ...patch, ...(patch.cadence ? { next_run_at: patch.cadence === "none" ? null : new Date().toISOString() } : {}) };
    const { error } = await sb!.from("sites").update(next).eq("id", id);
    setMsg(error ? error.message : "Saved.");
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await sb!.from("sites").delete().eq("id", id);
    setMsg(error ? error.message : "Site removed.");
    void load();
  };

  /** Runs a full scan, one stage per request, as the signed-in user. */
  const scan = async (url: string, key: string) => {
    setBusy(key);
    setMsg(`${STAGE_LABELS[0]}…`);
    try {
      const auth = { authorization: `Bearer ${await token()}`, "content-type": "application/json" };
      const start = await (await fetch("/api/scan", { method: "POST", headers: auth, body: JSON.stringify({ url }) })).json();
      if (!start.id) throw new Error(start.error || "Scan failed.");
      let done = !!start.done;
      while (!done) {
        const r = await fetch(`/api/scan/${start.id}/step`, { method: "POST" });
        const p = await r.json();
        if (!r.ok) throw new Error(p.error || "Scan failed.");
        setMsg(`${p.label}…`);
        done = p.done;
      }
      await fetch("/api/account/claim", { method: "POST", headers: auth, body: JSON.stringify({ scanId: start.id }) });
      setMsg("Scan complete. Opening your report…");
      router.push(`/dashboard/${start.id}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setBusy(null);
    }
  };

  const uptimePct = (siteId: string) => {
    const mine = checks.filter((c) => c.site_id === siteId);
    return mine.length ? `${((mine.filter((c) => c.ok).length / mine.length) * 100).toFixed(1)}% (${mine.length} checks, 24h)` : "No checks yet";
  };

  if (!sb) {
    return (
      <div className="panel auth-card">
        <h1>Accounts aren’t switched on yet</h1>
        <p className="panel-note">Add your Supabase URL and anon key to enable accounts. See DEPLOY.md.</p>
      </div>
    );
  }
  if (email === undefined) return <p className="dash-loading" role="status">Loading…</p>;
  if (email === null) {
    return (
      <div className="panel auth-card">
        <h1>Sign in to see your sites</h1>
        <p className="panel-note">Save sites, rescan them on a schedule and keep your report history.</p>
        <Link className="btn" href="/login">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="acct-grid">
      <header className="acct-head">
        <div>
          <h1>Your sites</h1>
          <p className="panel-note">Signed in as {email}</p>
        </div>
        <div className="brand-act">
          <Link className="dash-btn" href="/account/brand">Brand settings</Link>
          <button type="button" className="dash-btn" onClick={() => sb.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>

      <section className="panel" aria-label="Add a site">
        <h2>Scan a site</h2>
        <form className="acct-add" onSubmit={(e) => { e.preventDefault(); if (newUrl.trim()) void scan(newUrl.trim(), "new"); }}>
          <label className="sr-only" htmlFor="acct-url">Website address</label>
          <input id="acct-url" className="fnd-search" placeholder="https://yourwebsite.com" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <button className="btn sm" type="submit" disabled={!!busy}>{busy === "new" ? "Scanning…" : "Scan now"}</button>
        </form>
        <p className="panel-note">Open a finished report and choose “Save this site” to schedule rescans and uptime checks.</p>
      </section>

      <section className="panel" aria-label="Saved sites">
        <h2>Saved sites</h2>
        {sites.length === 0 ? (
          <p className="panel-note">No saved sites yet.</p>
        ) : (
          <ul className="acct-sites">
            {sites.map((s) => (
              <li key={s.id}>
                <div className="as-main">
                  <strong>{s.host}</strong>
                  <span className="as-links">
                    {s.last_scan_id && <Link className="fnd-link" href={`/dashboard/${s.last_scan_id}`}>Latest report</Link>}
                    <Link className="fnd-link" href={`/account/visibility/${s.id}`}>AI visibility</Link>
                  </span>
                  <span className="panel-note">{s.uptime ? `Uptime ${uptimePct(s.id)}` : "Uptime monitoring off"}</span>
                </div>
                <label className="as-f">
                  Rescan
                  <select value={s.cadence} onChange={(e) => update(s.id, { cadence: e.target.value as Cadence })}>
                    <option value="none">Never</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label className="as-f check">
                  <input type="checkbox" checked={s.uptime} onChange={(e) => update(s.id, { uptime: e.target.checked })} />
                  Uptime
                </label>
                <label className="as-f check" title="Email me when a scheduled rescan finds a score drop or a new high-priority issue">
                  <input type="checkbox" checked={s.alerts} disabled={s.cadence === "none"} onChange={(e) => update(s.id, { alerts: e.target.checked })} />
                  Alerts
                </label>
                <button type="button" className="dash-btn" disabled={!!busy} onClick={() => scan(s.url, s.id)}>{busy === s.id ? "Scanning…" : "Scan now"}</button>
                <button type="button" className="dash-btn" onClick={() => remove(s.id)} aria-label={`Remove ${s.host}`}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-label="Recent reports">
        <h2>Recent reports</h2>
        {scans.length === 0 ? (
          <p className="panel-note">Reports you create while signed in show up here.</p>
        ) : (
          <ul className="acct-scans">
            {scans.map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/${r.id}`}>{r.host}</Link>
                <span>{new Date(r.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span>
                <b>{r.status === "done" ? (r.overall ?? "–") : r.status}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
