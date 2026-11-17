"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminWebsite } from "@/lib/scan/admin-data";
import { DataTable, Score, ScoresDialog, fmtDate, type Caller, type Col } from "./kit";

/* Admin Websites tab: every website that was ever scanned (saved or not) with the emails attached to it, and a
   Scores dialog with the area scores and past scans of each one. */

export function AdminWebsites({ call }: { call: Caller }) {
  const [rows, setRows] = useState<AdminWebsite[] | null>(null);
  const [err, setErr] = useState("");
  const [scores, setScores] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void call<{ websites?: AdminWebsite[] }>("/api/admin/websites").then((r) => {
      if (!live) return;
      if (r.ok && r.json.websites) setRows(r.json.websites);
      else setErr(r.json.error ?? "Could not load websites.");
    });
    return () => {
      live = false;
    };
  }, [call]);

  if (err) return <p className="acct-msg" role="alert">{err}</p>;
  if (!rows) return <p className="panel-note">Loading websites…</p>;

  const cols: Col<AdminWebsite>[] = [
    {
      label: "Website",
      text: (r) => r.host,
      cell: (r) => (
        <>
          <strong>{r.host}</strong>
          <span className="ag-sub">{r.shared === "waiting" ? "Shared by admin, not claimed" : r.cadence ? `Rescans ${r.cadence}` : r.saved ? "Saved" : "Not saved"}</span>
        </>
      ),
    },
    {
      label: "Email",
      text: (r) => r.emails.join("; ") || null,
      cell: (r) => (r.emails.length ? <span className="adm-owner">{r.emails[0]}{r.emails.length > 1 && <span className="ag-sub" title={r.emails.slice(1).join("\n")}>+{r.emails.length - 1} more: {r.emails.slice(1, 3).join(", ")}{r.emails.length > 3 ? "…" : ""}</span>}</span> : "–"),
    },
    { label: "Score", text: (r) => r.score, cell: (r) => <Score v={r.score} /> },
    { label: "Scans", text: (r) => r.scans, cell: (r) => <>{r.scans}{r.failed > 0 && <span className="ag-sub">{r.failed} failed</span>}</> },
    { label: "Last scan", text: (r) => r.lastAt, cell: (r) => <>{fmtDate(r.lastAt)}{r.lastStatus !== "done" && <span className="ag-sub">{r.lastStatus === "failed" ? "Failed" : "Running"}</span>}</> },
    {
      label: "Actions",
      text: () => null,
      noCsv: true,
      cell: (r) => (
        <span className="ag-act">
          <button type="button" className="fnd-link" onClick={() => setScores(r.host)}>Scores</button>
          {r.reportId && <Link className="fnd-link" href={`/dashboard/${r.reportId}`} target="_blank">Report</Link>}
        </span>
      ),
    },
  ];

  return (
    <>
      <ul className="ag-stats" aria-label="Summary">
        <li><b>{rows.length}</b><span>Websites scanned</span></li>
        <li><b>{rows.filter((r) => r.emails.length).length}</b><span>With an email</span></li>
        <li><b>{rows.filter((r) => r.saved).length}</b><span>Saved to an account</span></li>
      </ul>
      <section className="panel" aria-label="Websites">
        <DataTable rows={rows} cols={cols} rowKey={(r) => r.host} name="websites" search="Filter by website or email" empty="No website has been scanned yet." />
      </section>
      {scores && <ScoresDialog call={call} host={scores} onClose={() => setScores(null)} />}
    </>
  );
}
