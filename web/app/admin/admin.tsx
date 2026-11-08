"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { tone } from "../ui";
import { stepScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AdminSite } from "@/lib/scan/admin";
import { AdminAnalytics } from "./analytics";

/* Admin panel: run scheduled rescans, AI visibility checks and uptime pings by hand while the cron Worker is off.
   Rescans run one site at a time from this tab (each scan is a series of short requests), so keep it open until
   the queue finishes. The server checks the Supabase `admins` table on every call. */

type View = "due" | "all";
type Job = { state: "queued" | "running" | "done" | "failed"; label?: string; error?: string };

const when = (iso: string | null) => {
  if (!iso) return "–";
  const ms = new Date(iso).getTime() - Date.now();
  const d = Math.round(Math.abs(ms) / 86_400_000);
  const h = Math.round(Math.abs(ms) / 3_600_000);
  const span = d >= 1 ? `${d} day${d === 1 ? "" : "s"}` : h >= 1 ? `${h} hour${h === 1 ? "" : "s"}` : "under an hour";
  return ms <= 0 ? `${span} ago` : `in ${span}`;
};

function JobCell({ job, fallback }: { job?: Job; fallback: ReactNode }) {
  if (job?.state === "running") return <span className="ag-job">{job.label}</span>;
  if (job?.state === "queued") return <span className="ag-job">Queued</span>;
  if (job?.state === "failed") return <span className="ag-job bad" title={job.error}>{job.error}</span>;
  if (job?.state === "done") return <span className="ag-job">{job.label ?? "Done"}</span>;
  return <>{fallback}</>;
}

export function AdminPanel() {
  const sb = supabaseBrowser();
  const [state, setState] = useState<"loading" | "signin" | "forbidden" | "error" | "ready">("loading");
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [mode, setMode] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"ops" | "analytics">("ops");
  const [view, setView] = useState<View>("due");
  const [q, setQ] = useState("");
  const [scanJobs, setScanJobs] = useState<Record<string, Job>>({});
  const [aiJobs, setAiJobs] = useState<Record<string, Job>>({});
  const [pinging, setPinging] = useState(false);
  const busy = (jobs: Record<string, Job>) => Object.values(jobs).some((j) => j.state === "queued" || j.state === "running");
  const running = busy(scanJobs) || busy(aiJobs) || pinging;

  const token = useCallback(async () => (await sb?.auth.getSession())?.data.session?.access_token, [sb]);

  const call = useCallback(
    async <T,>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: T & { error?: string } }> => {
      const t = await token();
      if (!t) return { ok: false, status: 401, json: { error: "Please sign in again." } as T & { error?: string } };
      try {
        const r = await fetch(path, body === undefined ? { headers: { authorization: `Bearer ${t}` } } : { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify(body) });
        return { ok: r.ok, status: r.status, json: (await r.json().catch(() => ({}))) as T & { error?: string } };
      } catch {
        return { ok: false, status: 0, json: { error: "Could not reach the server." } as T & { error?: string } };
      }
    },
    [token]
  );

  const load = useCallback(async () => {
    const r = await call<{ sites?: AdminSite[]; mode?: string }>("/api/admin/sites");
    if (r.status === 401) return setState("signin");
    if (r.status === 403) return setState("forbidden");
    if (!r.ok || !r.json.sites) {
      setMsg(r.json.error ?? "");
      return setState("error");
    }
    setSites(r.json.sites);
    setMode(r.json.mode ?? "");
    setState("ready");
  }, [call]);

  useEffect(() => {
    if (!sb) return;
    const t = window.setTimeout(() => void load(), 0); // not a synchronous state update inside the effect
    return () => window.clearTimeout(t);
  }, [sb, load]);

  useEffect(() => {
    if (!running) return;
    const stop = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [running]);

  const filter = useCallback((rows: AdminSite[]) => {
    const f = q.trim().toLowerCase();
    return f ? rows.filter((s) => s.host.toLowerCase().includes(f) || s.owner.toLowerCase().includes(f)) : rows;
  }, [q]);
  const scanRows = useMemo(() => filter(view === "due" ? sites.filter((s) => s.due) : sites), [sites, view, filter]);
  const aiRows = useMemo(() => filter(sites.filter((s) => s.ai.track && (view === "all" || s.ai.due))), [sites, view, filter]);
  const dueScans = sites.filter((s) => s.due);
  const dueAi = sites.filter((s) => s.ai.due);

  const rescan = async (ids: string[]) => {
    setMsg("");
    setScanJobs(Object.fromEntries(ids.map((id) => [id, { state: "queued" } as Job])));
    let ok = 0;
    for (const id of ids) {
      const set = (j: Job) => setScanJobs((m) => ({ ...m, [id]: j }));
      set({ state: "running", label: "Starting…" });
      const start = await call<{ id?: string }>("/api/admin/scan", { siteId: id });
      if (!start.ok || !start.json.id) {
        set({ state: "failed", error: start.json.error || "Could not start." });
        continue;
      }
      const r = await stepScan(start.json.id, (label) => set({ state: "running", label }));
      if ("error" in r) set({ state: "failed", error: r.error });
      else {
        ok++;
        set({ state: "done", label: "Rescanned" });
      }
    }
    setMsg(`Rescanned ${ok} of ${ids.length} site${ids.length === 1 ? "" : "s"}.`);
    void load();
  };

  const runAi = async (ids: string[]) => {
    setMsg("");
    setAiJobs(Object.fromEntries(ids.map((id) => [id, { state: "queued" } as Job])));
    let ok = 0;
    for (const id of ids) {
      const set = (j: Job) => setAiJobs((m) => ({ ...m, [id]: j }));
      set({ state: "running", label: "Asking AI systems…" });
      const r = await call<{ runs?: number; errors?: number }>("/api/admin/ai", { siteId: id });
      if (!r.ok) set({ state: "failed", error: r.json.error || "Run failed." });
      else {
        ok++;
        const { runs = 0, errors = 0 } = r.json;
        set({ state: "done", label: runs ? `${runs} answers${errors ? `, ${errors} failed` : ""}` : "No prompts" });
      }
    }
    setMsg(`Ran AI checks for ${ok} of ${ids.length} site${ids.length === 1 ? "" : "s"}.`);
    void load();
  };

  const ping = async () => {
    setPinging(true);
    setMsg("");
    const r = await call<{ checked?: number; down?: string[] }>("/api/admin/uptime", {});
    setPinging(false);
    if (!r.ok) return setMsg(r.json.error || "Uptime check failed.");
    const down = r.json.down ?? [];
    setMsg(`Pinged ${r.json.checked ?? 0} site${r.json.checked === 1 ? "" : "s"}. ${down.length ? `Down: ${down.join(", ")}` : "All up."}`);
  };

  if (!sb) return <div className="panel auth-card"><h1>Accounts aren’t switched on yet</h1><p className="panel-note">Add your Supabase URL and anon key to use the admin panel. See DEPLOY.md.</p></div>;
  if (state === "loading") return <p className="dash-loading" role="status">Loading…</p>;
  if (state === "signin") {
    return (
      <div className="panel auth-card">
        <h1>Sign in to open the admin panel</h1>
        <Link className="btn" href="/login?next=/admin">Sign in</Link>
      </div>
    );
  }
  if (state === "forbidden") {
    return (
      <div className="panel auth-card">
        <h1>This page is for admins</h1>
        <p className="panel-note">Your account isn’t on the admin list.</p>
        <Link className="dash-btn" href="/account">Back to your account</Link>
      </div>
    );
  }
  if (state === "error") return <div className="panel auth-card"><h1>Something went wrong</h1><p className="panel-note">{msg || "We couldn’t load the admin data. Please refresh the page."}</p></div>;

  return (
    <div className="acct-grid ag adm">
      <header className="acct-head">
        <div>
          <h1>Admin</h1>
          <p className="panel-note">{sites.length} saved site{sites.length === 1 ? "" : "s"}{mode === "memory" ? " · in-memory store (no Supabase)" : ""}</p>
        </div>
        <div className="brand-act">
          <button type="button" className="dash-btn" disabled={running} onClick={ping}>{pinging ? "Pinging…" : "Ping uptime sites"}</button>
          <button type="button" className="dash-btn" disabled={running} onClick={() => void load()}>Refresh</button>
        </div>
      </header>

      <div className="adm-tabs" role="tablist" aria-label="Admin sections">
        {(["ops", "analytics"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : undefined} onClick={() => setTab(t)}>
            {t === "ops" ? "Operations" : "Analytics"}
          </button>
        ))}
      </div>

      {tab === "analytics" ? <AdminAnalytics call={call} /> : <>
      <ul className="ag-stats" aria-label="Summary">
        <li className={dueScans.length ? "bad" : undefined}><b>{dueScans.length}</b><span>Rescans due</span></li>
        <li className={dueAi.length ? "bad" : undefined}><b>{dueAi.length}</b><span>AI checks due</span></li>
        <li><b>{sites.filter((s) => s.uptime).length}</b><span>Sites with uptime on</span></li>
      </ul>

      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>

      <div className="ag-tools">
        <div className="adm-view" role="group" aria-label="Show">
          {(["due", "all"] as const).map((v) => (
            <button key={v} type="button" className={`dash-btn${view === v ? " primary" : ""}`} aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "due" ? "Due now" : "All sites"}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="adm-q">Filter by domain or owner</label>
        <input id="adm-q" className="fnd-search" placeholder="Filter by domain or owner" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {running && <p className="panel-note">Keep this tab open until the queue finishes. Each rescan takes about a minute.</p>}

      <section className="panel" aria-label="Rescans">
        <div className="acct-head">
          <h2>Rescans</h2>
          <button type="button" className="dash-btn primary" disabled={running || !dueScans.length} onClick={() => rescan(dueScans.map((s) => s.id))}>
            Run all due{dueScans.length ? ` (${dueScans.length})` : ""}
          </button>
        </div>
        {scanRows.length === 0 ? (
          <p className="panel-note">{view === "due" ? "Nothing is due. Switch to “All sites” to run one anyway." : "No saved sites yet."}</p>
        ) : (
          <div className="crawl-wrap">
            <table className="crawl ag-table">
              <thead>
                <tr><th>Site</th><th>Owner</th><th>Score</th><th>Last scan</th><th>Next run</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {scanRows.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.host}</strong><span className="ag-sub">{s.cadence === "none" ? "No schedule" : `Rescans ${s.cadence}`}</span></td>
                    <td className="adm-owner">{s.owner}</td>
                    <td>{s.score == null ? "–" : <b className={`t-${tone(s.score)}`}>{s.score}</b>}</td>
                    <td><JobCell job={scanJobs[s.id]} fallback={when(s.lastScannedAt)} /></td>
                    <td>{s.cadence === "none" ? "–" : s.due ? <b className="t-bad">Due</b> : when(s.nextRunAt)}</td>
                    <td className="ag-act">
                      {s.lastScanId && <Link className="fnd-link" href={`/dashboard/${s.lastScanId}`}>Report</Link>}
                      <button type="button" className="fnd-link" disabled={running} onClick={() => rescan([s.id])}>Run now</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-label="AI visibility checks">
        <div className="acct-head">
          <h2>AI visibility checks</h2>
          <button type="button" className="dash-btn primary" disabled={running || !dueAi.length} onClick={() => runAi(dueAi.map((s) => s.id))}>
            Run all due{dueAi.length ? ` (${dueAi.length})` : ""}
          </button>
        </div>
        {aiRows.length === 0 ? (
          <p className="panel-note">{view === "due" ? "No AI checks are due." : "No sites have AI tracking on."}</p>
        ) : (
          <div className="crawl-wrap">
            <table className="crawl ag-table">
              <thead>
                <tr><th>Site</th><th>Owner</th><th>Prompts</th><th>Last run</th><th>Next run</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {aiRows.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.host}</strong></td>
                    <td className="adm-owner">{s.owner}</td>
                    <td>{s.ai.prompts}</td>
                    <td><JobCell job={aiJobs[s.id]} fallback={when(s.ai.lastRunAt)} /></td>
                    <td>{s.ai.due ? <b className="t-bad">Due</b> : when(s.ai.nextRunAt)}</td>
                    <td className="ag-act">
                      <button type="button" className="fnd-link" disabled={running || !s.ai.prompts} onClick={() => runAi([s.id])}>Run now</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </>}
    </div>
  );
}
