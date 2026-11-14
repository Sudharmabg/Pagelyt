"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tone } from "../../ui";
import { runScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { MODULE_NAMES } from "@/lib/scan/types";
import type { SiteSummary } from "@/lib/scan/agency";
import { AGENCY_UPSELL } from "../../dashboard/agency-modal";
import { SignInLink } from "@/app/sign-in-modal";

/* Agency dashboard: every saved client site at a glance, with bulk rescans.
   Bulk rescans run one site at a time from this tab (each scan is a series of short requests), so the
   tab has to stay open until the queue finishes. Paid plans only; the server enforces that. */

type Sort = "score" | "change" | "host" | "scanned" | "high";
type Job = { state: "queued" | "running" | "done" | "failed"; label?: string; error?: string };

const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
};

function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="ag-none">–</span>;
  const w = 84, h = 26;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v / 100) * (h - 6)).toFixed(1)}`);
  return (
    <svg className="ag-trend" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Score history: ${values.join(", ")}`}>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function AgencySites() {
  const sb = supabaseBrowser();
  const [state, setState] = useState<"loading" | "signin" | "upgrade" | "error" | "ready">("loading");
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const running = Object.values(jobs).some((j) => j.state === "queued" || j.state === "running");

  const token = useCallback(async () => (await sb?.auth.getSession())?.data.session?.access_token, [sb]);

  const load = useCallback(async () => {
    const t = await token();
    if (!t) return setState("signin");
    const r = await fetch("/api/account/sites", { headers: { authorization: `Bearer ${t}` } }).catch(() => null);
    if (!r) return setState("error");
    const j = (await r.json()) as { sites?: SiteSummary[]; upgrade?: boolean; error?: string };
    if (r.status === 401) return setState("signin");
    if (j.upgrade) return setState("upgrade");
    if (!r.ok || !j.sites) {
      setMsg(j.error ?? "");
      return setState("error");
    }
    setSites(j.sites);
    setState("ready");
  }, [token]);

  useEffect(() => {
    if (!sb) return;
    // Defer so the first render is not a synchronous state update inside the effect.
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [sb, load]);

  // Warn before closing the tab mid-queue.
  useEffect(() => {
    if (!running) return;
    const stop = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [running]);

  const list = useMemo(() => {
    const f = q.trim().toLowerCase();
    const rows = f ? sites.filter((s) => s.host.toLowerCase().includes(f)) : sites;
    const val = (s: SiteSummary): number | string => {
      switch (sort) {
        case "score": return s.score ?? 999; // lowest first: those need attention
        case "change": return s.change ?? 999; // biggest drops first
        case "high": return -s.high;
        case "scanned": return s.lastScannedAt ? new Date(s.lastScannedAt).getTime() : 0; // oldest first
        default: return s.host;
      }
    };
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      return typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number);
    });
  }, [sites, q, sort]);

  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const allPicked = list.length > 0 && list.every((s) => picked.has(s.id));

  const rescan = async (ids: string[]) => {
    const t = await token();
    if (!t) return setMsg("Please sign in again.");
    const queue = sites.filter((s) => ids.includes(s.id));
    setJobs(Object.fromEntries(queue.map((s) => [s.id, { state: "queued" } as Job])));
    let ok = 0;
    for (const s of queue) {
      setJobs((j) => ({ ...j, [s.id]: { state: "running", label: "Starting…" } }));
      const r = await runScan(s.url, t, (label) => setJobs((j) => ({ ...j, [s.id]: { state: "running", label } })), { siteId: s.id });
      if ("error" in r) {
        setJobs((j) => ({ ...j, [s.id]: { state: "failed", error: r.error } }));
        if (/limit/i.test(r.error)) {
          // Rate limited: the rest would fail the same way.
          setJobs((j) => Object.fromEntries(Object.entries(j).map(([k, v]) => [k, v.state === "queued" ? { state: "failed", error: "Skipped: scan limit reached" } : v])));
          break;
        }
      } else {
        ok++;
        setJobs((j) => ({ ...j, [s.id]: { state: "done" } }));
      }
    }
    setMsg(`Rescanned ${ok} of ${queue.length} site${queue.length === 1 ? "" : "s"}.`);
    setPicked(new Set());
    void load();
  };

  if (!sb) return <div className="panel auth-card"><h1>Accounts aren’t switched on yet</h1><p className="panel-note">Add your Supabase URL and anon key to enable accounts. See DEPLOY.md.</p></div>;
  if (state === "loading") return <p className="dash-loading" role="status">Loading your sites…</p>;
  if (state === "signin") {
    return (
      <div className="panel auth-card">
        <h1>Sign in to see your client sites</h1>
        <SignInLink className="btn" next="/account/sites" stay>Sign in</SignInLink>
      </div>
    );
  }
  if (state === "upgrade") {
    return (
      <div className="panel auth-card">
        <h1>The agency dashboard comes with any paid plan</h1>
        <p className="panel-note">See every client site in one place, track score trends, rescan them in bulk, compare against competitors and send branded PDF reports.</p>
        <div className="brand-act">
          <Link className="btn" href={AGENCY_UPSELL}>Talk to us about a plan</Link>
          <Link className="dash-btn" href="/account">Back to your account</Link>
        </div>
      </div>
    );
  }
  if (state === "error") return <div className="panel auth-card"><h1>Something went wrong</h1><p className="panel-note">{msg || "We couldn’t load your sites. Please refresh the page."}</p></div>;

  const atRisk = sites.filter((s) => s.high > 0).length;
  const dropped = sites.filter((s) => (s.change ?? 0) <= -5).length;
  const avg = sites.filter((s) => s.score != null);

  return (
    <div className="acct-grid ag">
      <header className="acct-head">
        <div>
          <h1>Agency dashboard</h1>
          <p className="panel-note">{sites.length} client site{sites.length === 1 ? "" : "s"}</p>
        </div>
        <div className="brand-act">
          <Link className="dash-btn" href="/account">Account &amp; schedules</Link>
          <Link className="dash-btn" href="/account/brand">Brand settings</Link>
        </div>
      </header>

      <ul className="ag-stats" aria-label="Summary">
        <li><b>{avg.length ? Math.round(avg.reduce((a, s) => a + s.score!, 0) / avg.length) : "–"}</b><span>Average score</span></li>
        <li className={atRisk ? "bad" : undefined}><b>{atRisk}</b><span>With high-priority issues</span></li>
        <li className={dropped ? "bad" : undefined}><b>{dropped}</b><span>Dropped 5+ points</span></li>
      </ul>

      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>

      {sites.length === 0 ? (
        <section className="panel">
          <h2>No client sites yet</h2>
          <p className="panel-note">Scan a client’s site, open the report and choose “Save this site”. It will appear here with its score history.</p>
          <Link className="btn sm" href="/account">Scan a site</Link>
        </section>
      ) : (
        <section className="panel" aria-label="Client sites">
          <div className="ag-tools">
            <label className="sr-only" htmlFor="ag-q">Filter sites</label>
            <input id="ag-q" className="fnd-search" placeholder="Filter by domain" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="as-f">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="score">Lowest score first</option>
                <option value="change">Biggest drop first</option>
                <option value="high">Most high-priority issues</option>
                <option value="scanned">Least recently scanned</option>
                <option value="host">Domain A–Z</option>
              </select>
            </label>
            <button type="button" className="dash-btn primary" disabled={running || picked.size === 0} onClick={() => rescan([...picked])}>
              {running ? "Rescanning…" : `Rescan selected${picked.size ? ` (${picked.size})` : ""}`}
            </button>
          </div>
          {running && <p className="panel-note">Keep this tab open until the rescans finish. Each site takes about a minute.</p>}
          <div className="crawl-wrap">
            <table className="crawl ag-table">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="Select all" checked={allPicked} disabled={running} onChange={() => setPicked(allPicked ? new Set() : new Set(list.map((s) => s.id)))} /></th>
                  <th>Site</th><th>Score</th><th>Trend</th><th>Weakest area</th><th>High</th><th>Last scan</th><th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const job = jobs[s.id];
                  return (
                    <tr key={s.id}>
                      <td><input type="checkbox" aria-label={`Select ${s.host}`} checked={picked.has(s.id)} disabled={running} onChange={() => toggle(s.id)} /></td>
                      <td><strong>{s.host}</strong>{s.cadence !== "none" && <span className="ag-sub">Rescans {s.cadence}</span>}</td>
                      <td>
                        {s.score == null ? "–" : <b className={`t-${tone(s.score)}`}>{s.score}</b>}
                        {s.change ? <span className={`ag-delta ${s.change > 0 ? "up" : "down"}`}>{s.change > 0 ? `+${s.change}` : s.change}</span> : null}
                      </td>
                      <td><Trend values={s.trend} /></td>
                      <td>{s.weakest ? `${MODULE_NAMES[s.weakest.key]} (${s.weakest.score})` : "–"}</td>
                      <td>{s.high ? <b className="t-bad">{s.high}</b> : "0"}</td>
                      <td>
                        {job?.state === "running" ? <span className="ag-job">{job.label}</span>
                          : job?.state === "queued" ? <span className="ag-job">Queued</span>
                          : job?.state === "failed" ? <span className="ag-job bad" title={job.error}>{job.error}</span>
                          : ago(s.lastScannedAt)}
                      </td>
                      <td className="ag-act">
                        {s.lastScanId && <Link className="fnd-link" href={`/dashboard/${s.lastScanId}`}>Report</Link>}
                        <button type="button" className="fnd-link" disabled={running} onClick={() => rescan([s.id])}>Rescan</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
