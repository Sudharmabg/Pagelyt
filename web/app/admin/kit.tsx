"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AdminHostDetail } from "@/lib/scan/admin-data";
import { ModalX, onBackdrop } from "../modal-close";
import { Ring, tone } from "../ui";

/* Shared by the admin tabs: the API caller type, date formats, a searchable and sortable table with CSV download,
   and the scores dialog for one website. */

export type Caller = <T>(path: string, body?: unknown) => Promise<{ ok: boolean; status: number; json: T & { error?: string } }>;

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
export const fmtDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "–");

export const Score = ({ v }: { v: number | null }) => (v == null ? <>–</> : <b className={`t-${tone(v)}`}>{v}</b>);

/* ---------- table ---------- */

export type Col<T> = {
  label: string;
  /** The plain value: used for search, sorting and the CSV file. */
  text: (r: T) => string | number | null;
  /** What the cell shows, when that differs from the plain value. */
  cell?: (r: T) => ReactNode;
  /** Left out of the CSV file (action columns). */
  noCsv?: boolean;
};

// A cell that starts like a formula would run in a spreadsheet: these values come from visitors, so defuse it.
const csvCell = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function DataTable<T>({ rows, cols, rowKey, name, search, empty = "Nothing here yet.", page = 50, tools }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; name: string; search: string; empty?: string; page?: number; tools?: ReactNode }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [shown, setShown] = useState(page);

  const list = useMemo(() => {
    const f = q.trim().toLowerCase();
    const out = f ? rows.filter((r) => cols.some((c) => String(c.text(r) ?? "").toLowerCase().includes(f))) : [...rows];
    if (sort) {
      const get = cols[sort.col].text;
      out.sort((a, b) => {
        const x = get(a), y = get(b);
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1; // blanks last either way
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
  }, [rows, cols, q, sort]);

  const download = () => {
    const kept = cols.filter((c) => !c.noCsv);
    const csv = [kept.map((c) => csvCell(c.label)).join(","), ...list.map((r) => kept.map((c) => csvCell(c.text(r))).join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    a.download = `pagelyt-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <>
      <div className="ag-tools adm-dt-tools">
        {tools}
        <label className="sr-only" htmlFor={`dt-${name}`}>{search}</label>
        <input id={`dt-${name}`} className="fnd-search" placeholder={search} value={q} onChange={(e) => { setQ(e.target.value); setShown(page); }} />
        <span className="panel-note">{list.length === rows.length ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : `${list.length} of ${rows.length}`}</span>
        <button type="button" className="dash-btn" disabled={!list.length} onClick={download}>Download CSV</button>
      </div>
      {list.length === 0 ? (
        <p className="panel-note">{rows.length ? "Nothing matches that search." : empty}</p>
      ) : (
        <div className="crawl-wrap">
          <table className="crawl ag-table adm-dt adm-cards">
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th key={c.label} aria-sort={sort?.col === i ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    {c.noCsv ? <span className="sr-only">{c.label}</span> : (
                      <button type="button" className="adm-sort" onClick={() => setSort((s) => (s?.col === i ? (s.dir === 1 ? { col: i, dir: -1 } : null) : { col: i, dir: 1 }))}>
                        {c.label}<span aria-hidden="true">{sort?.col === i ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.slice(0, shown).map((r) => (
                <tr key={rowKey(r)}>
                  {cols.map((c) => <td key={c.label} data-label={c.label} className={c.noCsv ? "adm-c-act" : undefined}>{c.cell ? c.cell(r) : (c.text(r) ?? "–")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > shown && (
        <p className="adm-more">
          <button type="button" className="dash-btn" onClick={() => setShown((n) => n + page * 4)}>Show more ({list.length - shown} left)</button>
        </p>
      )}
    </>
  );
}

/* ---------- one website's scores ---------- */

const ms = (v: number | null) => (v == null ? "–" : `${(v / 1000).toFixed(1)} s`);

export function ScoresDialog({ call, host, onClose }: { call: Caller; host: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<AdminHostDetail | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    let live = true;
    void call<AdminHostDetail>(`/api/admin/websites?host=${encodeURIComponent(host)}`).then((r) => {
      if (!live) return;
      if (r.ok && r.json.scans) setData(r.json);
      else setErr(r.json.error ?? "Could not load the scores.");
    });
    return () => {
      live = false;
    };
  }, [call, host]);

  const top = data?.scans.find((s) => s.id === data.latest?.id);
  const speed = data?.latest?.speed;

  return (
    <dialog ref={ref} className="lead-modal adm-scores" aria-labelledby="adm-scores-h" onClose={onClose} onClick={(e) => onBackdrop(e, onClose)}>
      <ModalX onClick={onClose} />
      <div className="lm-body">
        <h2 id="adm-scores-h">{host}</h2>
        {err ? <p className="lm-err" role="alert">{err}</p> : !data ? <p className="panel-note" role="status">Loading scores…</p> : (
          <>
            {top && top.score != null && data.latest ? (
              <>
                <div className="adm-sc-top">
                  <Ring v={top.score} size={96} stroke={10} text={String(top.score)} />
                  <div>
                    <p className="dash-eyebrow">Latest report · {fmtDate(top.at)}</p>
                    <p className="adm-sc-issues">
                      <b className="t-bad">{data.latest.issues.high}</b> high · <b className="t-warn">{data.latest.issues.medium}</b> medium · <b>{data.latest.issues.low}</b> low issues
                    </p>
                    <Link className="fnd-link" href={`/dashboard/${top.id}`} target="_blank">Open full report</Link>
                  </div>
                </div>
                <ul className="adm-sc-areas" aria-label="Area scores">
                  {top.areas.map((a) => (
                    <li key={a.key}><span>{a.name}</span><Score v={a.score} /></li>
                  ))}
                </ul>
                {speed && (
                  <ul className="adm-sc-areas" aria-label="Speed">
                    <li><span>Speed, phone</span><Score v={speed.mobile} /></li>
                    <li><span>Speed, desktop</span><Score v={speed.desktop} /></li>
                    <li><span>Largest paint (LCP)</span><b>{ms(speed.lcp)}</b></li>
                    <li><span>Layout shift (CLS)</span><b>{speed.cls == null ? "–" : speed.cls.toFixed(2)}</b></li>
                    {speed.a11y != null && <li><span>Lighthouse accessibility</span><Score v={speed.a11y} /></li>}
                  </ul>
                )}
              </>
            ) : (
              <p className="panel-note">No finished report for this website yet.</p>
            )}
            <h3>All scans ({data.scans.length})</h3>
            <div className="crawl-wrap adm-sc-list">
              <table className="crawl ag-table adm-cards">
                <thead><tr><th>Scanned</th><th>Score</th><th>Status</th><th>Email</th><th><span className="sr-only">Report</span></th></tr></thead>
                <tbody>
                  {data.scans.map((s) => (
                    <tr key={s.id}>
                      <td>{fmtDate(s.at)}</td>
                      <td data-label="Score"><Score v={s.score} /></td>
                      <td data-label="Status">{s.status === "failed" ? <span className="ag-job bad" title={s.error ?? undefined}>Failed</span> : s.status === "running" ? "Running" : s.waiting ? "Shared, not opened by anyone signed in" : "Done"}</td>
                      <td data-label="Email" className="adm-owner">{s.email ?? "–"}</td>
                      <td className="adm-c-act">{s.status === "done" && <Link className="fnd-link" href={`/dashboard/${s.id}`} target="_blank">Report</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
