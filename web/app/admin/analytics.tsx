"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageLoader } from "@/app/page-loader";
import type { Analytics, FeatureRow, LeadRow, ScanLogRow, StuckRow, UserRow } from "@/lib/scan/analytics";
import { DataTable, Score, fmtDate, fmtDay, type Caller, type Col } from "./kit";

/* Admin analytics tab: headline numbers, and the rows behind each one in a table you can search, sort and
   download. Pressing a number opens its table. No charts. */

type Table = "users" | "scans" | "leads" | "stuck" | "features";
const TABLES: [Table, string][] = [["users", "Users"], ["scans", "Scan log"], ["leads", "Leads"], ["stuck", "Stuck sign-ups"], ["features", "Feature use"]];
const RANGES: [number, string][] = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [0, "All time"]];

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const USERS: Col<UserRow>[] = [
  { label: "Email", text: (r) => r.email, cell: (r) => <span className="adm-owner">{r.email}</span> },
  { label: "Signed up", text: (r) => r.created, cell: (r) => fmtDay(r.created) },
  { label: "Email verified", text: (r) => (r.verified ? "Yes" : "No"), cell: (r) => (r.verified ? "Yes" : <b className="t-bad">No</b>) },
  { label: "Last sign-in", text: (r) => r.lastSignIn, cell: (r) => fmtDate(r.lastSignIn) },
  { label: "Plan", text: (r) => cap(r.plan) },
  { label: "Account type", text: (r) => cap(r.type) },
  { label: "Saved sites", text: (r) => r.sites },
  { label: "Scans in period", text: (r) => r.scans },
];

const SCANS: Col<ScanLogRow>[] = [
  { label: "Scanned", text: (r) => r.at, cell: (r) => fmtDate(r.at) },
  { label: "Website", text: (r) => r.host, cell: (r) => <strong>{r.host}</strong> },
  { label: "Email", text: (r) => r.email, cell: (r) => <span className="adm-owner">{r.email ?? "–"}</span> },
  { label: "Status", text: (r) => cap(r.status), cell: (r) => (r.status === "failed" ? <b className="t-bad">Failed</b> : cap(r.status)) },
  { label: "Score", text: (r) => r.score, cell: (r) => <Score v={r.score} /> },
  { label: "Failure reason", text: (r) => r.error, cell: (r) => <span className="adm-msg">{r.error ?? "–"}</span> },
  { label: "Report", text: () => null, noCsv: true, cell: (r) => r.status === "done" && <Link className="fnd-link" href={`/dashboard/${r.id}`} target="_blank">Report</Link> },
];

const LEADS: Col<LeadRow>[] = [
  { label: "Date", text: (r) => r.at, cell: (r) => fmtDate(r.at) },
  { label: "Name", text: (r) => r.name },
  { label: "Email", text: (r) => r.email, cell: (r) => <a className="fnd-link" href={`mailto:${r.email}`}>{r.email}</a> },
  { label: "Website", text: (r) => r.host },
  { label: "Has an account", text: (r) => (r.hasAccount ? "Yes" : "No") },
];

const STUCK: Col<StuckRow>[] = [
  { label: "Email", text: (r) => r.email, cell: (r) => <a className="fnd-link" href={`mailto:${r.email}`}>{r.email}</a> },
  { label: "Signed up", text: (r) => r.created, cell: (r) => fmtDate(r.created) },
];

const FEATURES: Col<FeatureRow>[] = [
  { label: "Feature", text: (r) => r.what },
  { label: "Account", text: (r) => r.who, cell: (r) => <span className="adm-owner">{r.who}</span> },
  { label: "Website", text: (r) => r.site },
  { label: "Date", text: (r) => r.at, cell: (r) => fmtDate(r.at) },
];

export function AdminAnalytics({ call }: { call: Caller }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState("");
  const [table, setTable] = useState<Table>("users");
  const [onlyNew, setOnlyNew] = useState(false); // Users: only accounts created in the period

  useEffect(() => {
    let live = true;
    call<Analytics>(`/api/admin/analytics?days=${days}`).then((r) => {
      if (!live) return;
      if (r.ok && r.json.rows) {
        setData(r.json);
        setErr("");
      } else setErr(r.json.error || "Could not load analytics.");
    });
    return () => {
      live = false;
    };
  }, [call, days]);

  const range = (
    <div className="adm-view" role="group" aria-label="Time range">
      {RANGES.map(([d, label]) => (
        <button key={d} type="button" className={`dash-btn${days === d ? " primary" : ""}`} aria-pressed={days === d} onClick={() => setDays(d)}>{label}</button>
      ))}
    </div>
  );

  if (err) return <>{range}<p className="acct-msg" role="alert">{err}</p></>;
  if (!data) return <>{range}<PageLoader text="Loading analytics…" /></>;

  const { window: w, totals: t, rows } = data;
  const open = (to: Table, fresh = false) => () => {
    setTable(to);
    setOnlyNew(fresh);
    document.getElementById("adm-rows")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const tiles: [string, string | number, string, () => void][] = [
    ["Scans", w.scans, `${w.hosts} websites · ${w.failed} failed (${pct(w.failed, w.scans)})`, open("scans")],
    ["Leads", w.leads, `${rows.leads.filter((l) => !l.hasAccount).length} without an account`, open("leads")],
    ["Sign-ups", data.usersAvailable ? w.signups : "–", data.usersAvailable ? `${t.users} accounts in total` : "Auth API unavailable", open("users", true)],
    ["Active users", data.usersAvailable ? w.active : "–", "Signed in during the period", open("users")],
    ["Stuck sign-ups", data.usersAvailable ? rows.stuck.length : "–", "Accounts that never entered the email code", open("stuck")],
    ["Paid accounts", t.paid, `${pct(t.paid, t.users || t.paid)} of accounts`, open("users")],
    ["Saved sites", t.sites, `${w.sitesSaved} new · ${t.scheduled} scheduled`, open("features")],
    ["Feature use", w.shares + w.comparisons, `${w.shares} shares · ${w.comparisons} comparisons · ${w.aiRuns} AI answers`, open("features")],
  ];
  const users = onlyNew ? rows.users.filter((u) => u.inPeriod) : rows.users;

  return (
    <div className="adm-an">
      <div className="ag-tools">{range}<p className="panel-note">{data.since ? `Since ${fmtDay(data.since)}` : "Everything so far"}</p></div>

      <ul className="adm-tiles adm-tiles-btn" aria-label="Headline numbers">
        {tiles.map(([label, n, sub, go]) => (
          <li key={label}>
            <button type="button" onClick={go} aria-label={`${label}: ${n}. Show the rows.`}>
              <span>{label}</span><b>{n}</b><small>{sub}</small>
            </button>
          </li>
        ))}
      </ul>

      <section className="panel" id="adm-rows" aria-label="Rows behind the numbers">
        <div className="adm-tabs adm-subtabs" role="tablist" aria-label="Tables">
          {TABLES.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={table === k} className={table === k ? "on" : undefined} onClick={() => setTable(k)}>
              {label} <small>{rows[k].length}</small>
            </button>
          ))}
        </div>

        {table === "users" && (
          !data.usersAvailable ? <p className="panel-note">The account list is unavailable (the Supabase auth admin API did not answer).</p> : (
            <DataTable
              key={`users-${onlyNew}`}
              rows={users}
              cols={USERS}
              rowKey={(r) => r.email}
              name="users"
              search="Filter by email, plan or type"
              empty="No accounts yet."
              tools={<label className="adm-check"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Signed up in this period only</label>}
            />
          )
        )}
        {table === "scans" && (
          <>
            {w.scans > rows.scans.length && <p className="panel-note">Showing the newest {data.scanLogCap} of {w.scans} scans. Pick a shorter period to see older ones in full.</p>}
            <DataTable rows={rows.scans} cols={SCANS} rowKey={(r) => r.id} name="scan-log" search="Filter by website, email or status" empty="No scans in this period." />
          </>
        )}
        {table === "leads" && <DataTable rows={rows.leads} cols={LEADS} rowKey={(r) => `${r.at}${r.email}${r.host}`} name="leads" search="Filter by name, email or website" empty="No leads in this period." />}
        {table === "stuck" && <DataTable rows={rows.stuck} cols={STUCK} rowKey={(r) => r.email} name="stuck-sign-ups" search="Filter by email" empty="Nobody is stuck: every account has confirmed its email." />}
        {table === "features" && <DataTable rows={rows.features} cols={FEATURES} rowKey={(r) => `${r.what}${r.who}${r.site}${r.at}`} name="feature-use" search="Filter by feature, account or website" empty="No feature use yet." />}
      </section>
    </div>
  );
}
