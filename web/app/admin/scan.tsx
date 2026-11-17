"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CopyButton, CopyField } from "@/components/avara/CopyButtonBlock";
import { stepScan } from "@/lib/run-scan";
import type { AdminInvite } from "@/lib/scan/admin-data";
import { DataTable, Score, ScoresDialog, fmtDate, type Caller, type Col } from "./kit";

/* Admin Scan tab: scan any website and share the link. Until somebody signs in through the link the report shows
   only its scores; the first person to sign in becomes its owner. The scan runs from this tab, so keep it open. */

const linkOf = (id: string) => `${window.location.origin}/dashboard/${id}`;

export function AdminScan({ call }: { call: Caller }) {
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<{ host: string; label: string } | null>(null);
  const [done, setDone] = useState<{ id: string; host: string } | null>(null);
  const [err, setErr] = useState("");
  const [list, setList] = useState<{ ready: boolean; invites: AdminInvite[] } | null>(null);
  const [scores, setScores] = useState<string | null>(null);

  const fetchList = useCallback(() => call<{ ready?: boolean; invites?: AdminInvite[] }>("/api/admin/websites?shared=1"), [call]);
  const apply = useCallback((r: Awaited<ReturnType<typeof fetchList>>) => {
    if (r.ok && r.json.invites) setList({ ready: !!r.json.ready, invites: r.json.invites });
    else setErr(r.json.error ?? "Could not load your shared scans.");
  }, []);

  useEffect(() => {
    let live = true;
    void fetchList().then((r) => live && apply(r));
    return () => {
      live = false;
    };
  }, [fetchList, apply]);

  useEffect(() => {
    if (!job) return;
    const stop = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [job]);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (job || !url.trim()) return;
    setErr("");
    setDone(null);
    setJob({ host: url.trim(), label: "Starting…" });
    const start = await call<{ id?: string; host?: string }>("/api/admin/scan", { url: url.trim() });
    if (!start.ok || !start.json.id) {
      setJob(null);
      return setErr(start.json.error || "Could not start the scan.");
    }
    const { id, host = url.trim() } = start.json;
    const r = await stepScan(id, (label) => setJob({ host, label }));
    setJob(null);
    if ("error" in r) setErr(`The scan of ${host} stopped: ${r.error}`);
    else {
      setDone({ id, host });
      setUrl("");
    }
    apply(await fetchList());
  };

  const cols: Col<AdminInvite>[] = [
    { label: "Website", text: (r) => r.host, cell: (r) => <strong>{r.host}</strong> },
    { label: "Scanned", text: (r) => r.at, cell: (r) => fmtDate(r.at) },
    { label: "Score", text: (r) => r.score, cell: (r) => (r.status === "failed" ? <span className="ag-job bad" title={r.error ?? undefined}>Failed</span> : r.status === "running" ? "Running" : <Score v={r.score} />) },
    { label: "Link opened", text: (r) => r.openedAt, cell: (r) => (r.openedAt ? fmtDate(r.openedAt) : "Not yet") },
    { label: "Claimed by", text: (r) => r.claimedBy, cell: (r) => (r.claimedBy ? <span className="adm-owner">{r.claimedBy}<span className="ag-sub">{fmtDate(r.claimedAt)}</span></span> : "Nobody yet") },
    {
      label: "Actions",
      text: () => null,
      noCsv: true,
      cell: (r) => r.status === "done" && (
        <span className="ag-act">
          <CopyButton value={linkOf(r.id)} label="Copy link" size="sm" variant="outline" />
          <button type="button" className="fnd-link" onClick={() => setScores(r.host)}>Scores</button>
          <Link className="fnd-link" href={`/dashboard/${r.id}`} target="_blank">Report</Link>
        </span>
      ),
    },
  ];

  return (
    <>
      <section className="panel" aria-label="Scan a website to share">
        <h2>Scan a website to share</h2>
        <p className="panel-note">The link shows the scores to anyone. The first person who signs in through it gets the full report, saved to their account.</p>
        <form className="adm-scan-form" onSubmit={run}>
          <label className="sr-only" htmlFor="adm-scan-url">Website address</label>
          <input id="adm-scan-url" className="fnd-search" inputMode="url" autoComplete="off" placeholder="example.com" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!!job} />
          <button type="submit" className="dash-btn primary" disabled={!!job || !url.trim()}>{job ? "Scanning…" : "Scan"}</button>
        </form>
        {job && <p className="ag-job" role="status"><strong>{job.host}</strong>: {job.label}<span className="ag-sub">Keep this tab open. A scan takes about a minute.</span></p>}
        {err && <p className="lm-err" role="alert">{err}</p>}
        {done && (
          <div className="adm-scan-done" role="status">
            <p><strong>{done.host}</strong> is scanned. Copy the link and send it.</p>
            <CopyField value={linkOf(done.id)} label="Report link" />
            <p className="ag-act">
              <button type="button" className="fnd-link" onClick={() => setScores(done.host)}>See scores</button>
              <Link className="fnd-link" href={`/dashboard/${done.id}`} target="_blank">Open full report</Link>
            </p>
          </div>
        )}
      </section>

      <section className="panel" aria-label="Shared scans">
        <h2>Shared scans</h2>
        {!list ? <p className="panel-note">Loading…</p> : !list.ready ? (
          <p className="lm-note">Shared scans need migration 0014. Run <code>supabase/migrations/0014_invite_scans.sql</code> in the Supabase SQL editor, then refresh.</p>
        ) : (
          <DataTable rows={list.invites} cols={cols} rowKey={(r) => r.id} name="shared-scans" search="Filter by website or email" empty="No shared scans yet. Scan a website above." />
        )}
      </section>

      {scores && <ScoresDialog call={call} host={scores} onClose={() => setScores(null)} />}
    </>
  );
}
