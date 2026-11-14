"use client";

import Link from "next/link";
import { PRICING_ON } from "../site-config";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { STAGE_LABELS } from "@/lib/scan/labels";
import { AGENCY_UPSELL, useAccount, type AccountInfo } from "../dashboard/agency-modal";
import { disconnectGoogle, googleAccount, type GoogleStatus } from "../dashboard/use-google";
import { firstName, useSignedInUser } from "@/lib/use-signed-in";
import { checkPassword, passwordsMatch } from "@/lib/validate";
import { SignInLink } from "@/app/sign-in-modal";

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
  const user = useSignedInUser();

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
        <SignInLink className="btn" next="/account" stay>Sign in</SignInLink>
      </div>
    );
  }

  const scoreOf = (id: string | null) => scans.find((r) => r.id === id)?.overall ?? null;
  const lastOf = (id: string | null) => scans.find((r) => r.id === id)?.created_at ?? null;
  const planName = acct ? acct.plan.charAt(0).toUpperCase() + acct.plan.slice(1) : "";
  const display = user?.name ?? email.split("@")[0];

  return (
    <div className="acct-wrap">
      <header className="acct-hero">
        <span className="acct-av lg" aria-hidden="true">{display.charAt(0).toUpperCase()}</span>
        <div className="acct-id">
          <h1>{firstName(display)}&rsquo;s account</h1>
          <p>
            {email}
            {acct && <span className={`acct-plan${acct.paid ? " paid" : ""}`}>{planName} plan</span>}
          </p>
        </div>
        <div className="acct-hero-act">
          <Link className="dash-btn primary" href="/dashboard">Open dashboard</Link>
          {acct?.accountType === "agency" && <Link className="dash-btn" href={acct.paid ? "/account/sites" : AGENCY_UPSELL}>Agency dashboard</Link>}
        </div>
      </header>

      <ul className="acct-kpis" aria-label="At a glance">
        <li><b>{sites.length}</b><span>saved site{sites.length === 1 ? "" : "s"}</span></li>
        <li><b>{scans.length}</b><span>recent report{scans.length === 1 ? "" : "s"}</span></li>
        <li><b>{sites.filter((x) => x.cadence !== "none").length}</b><span>on a rescan schedule</span></li>
        <li><b>{sites.filter((x) => x.uptime).length}</b><span>with uptime checks</span></li>
      </ul>

      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>

      <div className="acct-cols">
        <div className="acct-main">
          <section className="panel" aria-labelledby="acct-scan-h">
            <h2 id="acct-scan-h">Scan a site</h2>
            <form className="acct-add" onSubmit={(e) => { e.preventDefault(); if (newUrl.trim()) void scan(newUrl.trim(), "new"); }}>
              <label className="sr-only" htmlFor="acct-url">Website address</label>
              <input id="acct-url" className="fnd-search" placeholder="https://yourwebsite.com" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <button className="btn sm" type="submit" disabled={!!busy}>{busy === "new" ? "Scanning…" : "Scan now"}</button>
            </form>
            <p className="panel-note">Open a finished report and choose &ldquo;Save this site&rdquo; to schedule rescans and uptime checks.</p>
          </section>

          <section className="panel" aria-labelledby="acct-sites-h">
            <h2 id="acct-sites-h">Saved sites</h2>
            {sites.length === 0 ? (
              <p className="panel-note">No saved sites yet. Scan a site above, then save it from its report.</p>
            ) : (
              <ul className="acct-cards">
                {sites.map((s) => {
                  const score = scoreOf(s.last_scan_id);
                  const last = lastOf(s.last_scan_id);
                  return (
                    <li key={s.id} className="acct-card">
                      <div className="ac-top">
                        <span className={`ac-score ${scoreBand(score)}`} aria-label={score ? `Score ${score}` : "No score yet"}>{score ?? "–"}</span>
                        <div className="ac-name">
                          <strong>{s.host}</strong>
                          <span className="panel-note">{last ? `Last scanned ${new Date(last).toLocaleDateString("en-GB", { dateStyle: "medium" })}` : "Not scanned recently"} · {s.uptime ? `Uptime ${uptimePct(s.id)}` : "Uptime off"}</span>
                        </div>
                      </div>
                      <div className="as-links">
                        {s.last_scan_id && <Link className="fnd-link" href={`/dashboard/${s.last_scan_id}`}>Latest report</Link>}
                        {s.last_scan_id && <Link className="fnd-link" href={`/dashboard/${s.last_scan_id}?view=google`}>Google data</Link>}
                        <Link className="fnd-link" href={`/account/visibility/${s.id}`}>AI visibility</Link>
                      </div>
                      <div className="ac-ctl">
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
                        <span className="ac-btns">
                          <button type="button" className="dash-btn" disabled={!!busy} onClick={() => scan(s.url, s.id)}>{busy === s.id ? "Scanning…" : "Scan now"}</button>
                          <button type="button" className="dash-btn ghost" onClick={() => { if (window.confirm(`Remove ${s.host} from your saved sites? Its reports stay.`)) void remove(s.id); }} aria-label={`Remove ${s.host}`}>Remove</button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="acct-rep-h">
            <h2 id="acct-rep-h">Recent reports</h2>
            {scans.length === 0 ? (
              <p className="panel-note">Reports you create while signed in show up here.</p>
            ) : (
              <ul className="acct-scans">
                {scans.map((r) => (
                  <li key={r.id}>
                    <Link href={`/dashboard/${r.id}`}>{r.host}</Link>
                    <span>{new Date(r.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span>
                    <b className={r.status === "done" ? scoreBand(r.overall) : ""}>{r.status === "done" ? (r.overall ?? "–") : r.status}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="acct-side">
          {acct && (
            <section className="panel" aria-labelledby="acct-plan-h">
              <h2 id="acct-plan-h">Plan and profile</h2>
              <p className="acct-planline"><b>{planName}</b>{acct.paid ? " · paid plan" : " · free"}</p>
              <label className="as-f">
                I am
                <select value={acct.accountType ?? ""} onChange={(e) => e.target.value && void setType(e.target.value as "agency" | "owner")}>
                  {acct.accountType === null && <option value="">Choose…</option>}
                  <option value="owner">Looking after my own website</option>
                  <option value="agency">An agency or freelancer with client sites</option>
                </select>
              </label>
              {acct.accountType === "agency" && !acct.paid && <p className="panel-note">The agency dashboard comes with any paid plan.</p>}
              <div className="acct-links">
                <Link className="fnd-link" href="/account/brand">Brand settings</Link>
                {!acct.paid && PRICING_ON && <Link className="fnd-link" href="/pricing">Compare plans</Link>}
                <Link className="fnd-link" href="/consultation">Book a consultation</Link>
              </div>
            </section>
          )}

          <GoogleAccount />
          <Security email={email} onSignOut={() => void sb.auth.signOut()} />
        </aside>
      </div>
    </div>
  );
}

const scoreBand = (v: string | null) => {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return "";
  return n >= 80 ? "good" : n >= 50 ? "warn" : "bad";
};

/* Security: change password (current one checked on the server), forgot-password link and sign out. */
function Security({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const current = String(f.get("current") ?? "");
    if (!current) return setErr("Please enter your current password.");
    const pw = checkPassword(f.get("password"), email);
    if (!pw.ok) return setErr(pw.error);
    const mismatch = passwordsMatch(String(f.get("password")), String(f.get("confirm") ?? ""));
    if (mismatch) return setErr(mismatch);
    setErr("");
    setBusy(true);
    try {
      const t = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
      const r = await fetch("/api/auth/password", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ current, password: pw.value }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return setErr(j.error ?? "We couldn't change your password just now. Please try again.");
      form.reset();
      setDone(true);
      setOpen(false);
    } catch {
      setErr("We couldn't change your password just now. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel" aria-labelledby="acct-sec-h">
      <h2 id="acct-sec-h">Security</h2>
      {done && <p className="acct-ok" role="status">Password changed. Other browsers and devices were signed out, and we emailed you a notice.</p>}
      {open ? (
        <form className="acct-pw" onSubmit={submit} noValidate>
          <div className="tf">
            <label htmlFor="cp-cur">Current password</label>
            <input id="cp-cur" name="current" type="password" autoComplete="current-password" maxLength={200} required autoFocus />
          </div>
          <div className="tf">
            <label htmlFor="cp-new">New password</label>
            <input id="cp-new" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
          </div>
          <div className="tf">
            <label htmlFor="cp-cf">Confirm new password</label>
            <input id="cp-cf" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
          </div>
          <p className="lm-fine">At least 8 characters. Forgotten the current one? <SignInLink forgot stay email={email}>Reset it with an email code</SignInLink>.</p>
          {err && <p className="lm-err" role="alert">{err}</p>}
          <div className="acct-links">
            <button type="submit" className="dash-btn primary" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
            <button type="button" className="dash-btn ghost" onClick={() => { setOpen(false); setErr(""); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p className="panel-note">Signed in as <b>{email}</b>. Sessions end 7 days after sign-in.</p>
          <div className="acct-links">
            <button type="button" className="dash-btn" onClick={() => { setOpen(true); setDone(false); }}>Change password</button>
            <button type="button" className="dash-btn ghost" onClick={onSignOut}>Sign out</button>
          </div>
        </>
      )}
    </section>
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
    if (!window.confirm("Disconnect Google? Pagelyt's access is removed at Google and the Search Console, Analytics and Google Ads data saved for your sites is deleted.")) return;
    setBusy(true);
    setErr("");
    try {
      await disconnectGoogle();
      setG({ ...g, connected: false, email: null, gsc: false, ga4: false, ads: false });
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
          <p className="panel-note">Connected as <b>{g.email ?? "your Google account"}</b>. Read-only: Pagelyt can&rsquo;t change anything in your Google account.</p>
          <ul className="acct-g">
            <li className={g.gsc ? "on" : ""}>Search Console<span>{g.gsc ? "Connected" : "Not yet"}</span></li>
            <li className={g.ga4 ? "on" : ""}>Analytics<span>{g.ga4 ? "Connected" : "Not yet"}</span></li>
            {g.adsOn !== false && <li className={g.ads ? "on" : ""}>Google Ads<span>{g.ads ? "Connected" : "Not yet"}</span></li>}
          </ul>
          <button type="button" className="dash-btn" style={{ justifySelf: "start" }} onClick={() => void off()} disabled={busy}>{busy ? "Disconnecting…" : "Disconnect Google"}</button>
        </>
      ) : (
        <p className="panel-note">See the real clicks, visitors and ad spend behind each issue. Open a saved site&rsquo;s report and choose <b>Google data</b> to connect Search Console, Analytics and Google Ads{g.allowed ? "" : " (Professional and Business plans)"}.</p>
      )}
      {err && <p className="panel-note" role="alert">{err}</p>}
    </section>
  );
}
