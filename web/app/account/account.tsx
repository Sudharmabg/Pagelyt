"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { STAGE_LABELS } from "@/lib/scan/labels";
import { AGENCY_UPSELL, useAccount, type AccountInfo } from "../dashboard/agency-modal";
import { disconnectGoogle, googleAccount, type GoogleStatus } from "../dashboard/use-google";

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
  const [acct, setAcct] = useAccount(!!email);

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

  const setType = async (type: "agency" | "owner") => {
    const r = await fetch("/api/account/type", { method: "POST", headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" }, body: JSON.stringify({ type }) }).catch(() => null);
    if (r?.ok) setAcct((await r.json()) as AccountInfo);
    setMsg(r?.ok ? "Saved." : "Could not save. Please try again.");
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
          {acct?.accountType === "agency" && <Link className="dash-btn primary" href={acct.paid ? "/account/sites" : AGENCY_UPSELL}>Agency dashboard</Link>}
          <Link className="dash-btn" href="/account/brand">Brand settings</Link>
          <button type="button" className="dash-btn" onClick={() => sb.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>

      {acct && (
        <section className="panel" aria-label="Account type">
          <h2>How you use Pagelyt</h2>
          <label className="as-f">
            I am
            <select value={acct.accountType ?? ""} onChange={(e) => e.target.value && void setType(e.target.value as "agency" | "owner")}>
              {acct.accountType === null && <option value="">Choose…</option>}
              <option value="owner">Looking after my own website</option>
              <option value="agency">An agency or freelancer with client sites</option>
            </select>
          </label>
          <p className="panel-note">Plan: {acct.plan.charAt(0).toUpperCase() + acct.plan.slice(1)}{acct.accountType === "agency" && !acct.paid ? ". The agency dashboard comes with any paid plan." : ""}</p>
        </section>
      )}

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

      <GoogleAccount />
    </div>
  );
}

/* Connect Google: which Google account is connected, and Disconnect (revokes Pagelyt's access at Google and deletes
   everything stored from it). Connecting happens from a report's Google data view, per site. */
function GoogleAccount() {
  const [g, setG] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    googleAccount().then(setG).catch(() => setG(null));
  }, []);
  if (!g?.configured) return null;
  const off = async () => {
    if (!window.confirm("Disconnect Google? Pagelyt's access is removed at Google and the Search Console data saved for your sites is deleted.")) return;
    setBusy(true);
    setErr("");
    try {
      await disconnectGoogle();
      setG({ ...g, connected: false, email: null, gsc: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel" aria-label="Google">
      <h2>Google</h2>
      {g.connected ? (
        <>
          <p className="panel-note">
            Connected as <b>{g.email ?? "your Google account"}</b>{g.gsc ? ", with read-only access to Search Console" : ""}. Pagelyt can&rsquo;t change anything in your Google account.
          </p>
          <button type="button" className="dash-btn" style={{ justifySelf: "start" }} onClick={() => void off()} disabled={busy}>{busy ? "Disconnecting…" : "Disconnect Google"}</button>
        </>
      ) : (
        <p className="panel-note">Open a saved site&rsquo;s report and choose <b>Google data</b> to connect Search Console{g.allowed ? "" : " (Professional and Business plans)"}.</p>
      )}
      {err && <p className="panel-note" role="alert">{err}</p>}
    </section>
  );
}
