"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Finding } from "@/lib/scan/types";
import type { Ga4Insight } from "@/lib/google/ga4-insights";

/* Shared pieces of the ★ Google data view: sortable tables with CSV download, links that open a page's drill-down
   panel or jump to the exact finding, device/country bars and the AI insights panel used by every tab. */

export const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
export const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
export const pathOf = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search || "/";
  } catch {
    return u;
  }
};

/* ---------- Page drill-down and finding links ---------- */

type Nav = { openPage: (urlOrPath: string) => void; openFinding: (f: Finding) => void };
export const GoogleNav = createContext<Nav | null>(null);

/** A page in a table: opens its drill-down panel (searches, visits, ad spend and issues on that page). */
export function PageLink({ url }: { url: string }) {
  const nav = useContext(GoogleNav);
  const label = url.startsWith("/") ? url : pathOf(url);
  if (!nav) return <span title={url}>{label}</span>;
  return (
    <button type="button" className="fnd-link gd-page" title={`${url}: open this page's numbers`} onClick={() => nav.openPage(url)}>
      {label}
    </button>
  );
}

/** An issue title that jumps to that exact finding in its area. */
export function FindingLink({ f }: { f: Finding }) {
  const nav = useContext(GoogleNav);
  return (
    <button type="button" className="fnd-link" onClick={() => nav?.openFinding(f)}>
      {f.title}
    </button>
  );
}

/** Up to three issue links, then "+N more". */
export function FindingList({ list }: { list: Finding[] }) {
  if (!list.length) return <em>None found by this scan</em>;
  return (
    <span className="gd-flist">
      {list.slice(0, 3).map((f) => <FindingLink key={f.id} f={f} />)}
      {list.length > 3 && <small>+{list.length - 3} more</small>}
    </span>
  );
}

/* ---------- Sortable table with CSV download ---------- */

export type Col<T> = {
  label: string;
  /** Value used to sort and for the CSV. */
  get: (r: T) => string | number | null;
  /** What the cell shows (defaults to the value). */
  cell?: (r: T) => ReactNode;
  cls?: (r: T) => string | undefined;
  wrap?: boolean;
  /** Leave out of sorting (e.g. a list of issues). */
  noSort?: boolean;
};

const csvCell = (v: string | number | null) => {
  if (v == null) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never let a spreadsheet run it as a formula
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(file: string, head: string[], rows: (string | number | null)[][]) {
  const text = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${file}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataTable<T>({ rows, cols, file, sort: initial, limit = 25, rowKey, empty }: { rows: T[]; cols: Col<T>[]; file: string; sort?: { col: number; desc?: boolean }; limit?: number; rowKey: (r: T) => string; empty?: ReactNode }) {
  const [sort, setSort] = useState<{ col: number; desc: boolean } | null>(initial ? { col: initial.col, desc: initial.desc ?? true } : null);
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = cols[sort.col].get;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en-GB", { numeric: true });
      return sort.desc ? -c : c;
    });
  }, [rows, cols, sort]);
  if (!rows.length) return <>{empty ?? null}</>;
  const shown = all ? sorted : sorted.slice(0, limit);
  const by = (i: number) => setSort((s) => (s?.col === i ? { col: i, desc: !s.desc } : { col: i, desc: typeof cols[i].get(rows[0]) === "number" }));
  return (
    <>
      <div className="crawl-wrap">
        <table className="crawl gd-t">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c.label} scope="col" aria-sort={sort?.col === i ? (sort.desc ? "descending" : "ascending") : undefined}>
                  {c.noSort ? c.label : (
                    <button type="button" className="gd-sort" onClick={() => by(i)}>
                      {c.label}
                      <span aria-hidden="true">{sort?.col === i ? (sort.desc ? "↓" : "↑") : "↕"}</span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={rowKey(r)}>
                {cols.map((c) => (
                  <td key={c.label} className={[c.wrap ? "gd-wrap" : "", c.cls?.(r) ?? ""].join(" ").trim() || undefined}>
                    {c.cell ? c.cell(r) : c.get(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="gd-tbar">
        {rows.length > limit && (
          <button type="button" className="fnd-link" onClick={() => setAll((v) => !v)}>
            {all ? `Show the first ${limit}` : `Show all ${rows.length}`}
          </button>
        )}
        <button type="button" className="fnd-link" onClick={() => downloadCsv(file, cols.map((c) => c.label), sorted.map((r) => cols.map((c) => c.get(r))))}>
          Download CSV
        </button>
      </p>
    </>
  );
}

/* ---------- Device and country bars ---------- */

export function SplitBars({ title, rows, unit }: { title: string; rows: { key: string; value: number }[]; unit: string }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!rows.length || !total) return null;
  return (
    <div className="gd-split">
      <h3>{title}</h3>
      <ul>
        {rows.slice(0, 6).map((r) => (
          <li key={r.key}>
            <span className="gd-split-k">{r.key}</span>
            <span className="gd-split-bar" aria-hidden="true"><i style={{ width: `${(r.value / rows[0].value) * 100}%` }} /></span>
            <span className="gd-split-v">{n0(r.value)} <small>{Math.round((r.value / total) * 100)}%</small></span>
          </li>
        ))}
      </ul>
      <p className="sr-only">{unit}</p>
    </div>
  );
}

const DEVICE: Record<string, string> = { MOBILE: "Mobile", DESKTOP: "Desktop", TABLET: "Tablet", mobile: "Mobile", desktop: "Desktop", tablet: "Tablet", "smart tv": "Smart TV" };
export const deviceName = (k: string) => DEVICE[k] ?? k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
/** Search Console reports countries as ISO 3166-1 alpha-3 codes; show the English name where the browser knows it. */
export function countryName(code: string): string {
  if (code.length !== 3) return code;
  const a2 = A3[code.toLowerCase()];
  try {
    return (a2 && new Intl.DisplayNames(["en-GB"], { type: "region" }).of(a2.toUpperCase())) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
const A3: Record<string, string> = { ind: "in", usa: "us", gbr: "gb", can: "ca", aus: "au", deu: "de", fra: "fr", esp: "es", ita: "it", nld: "nl", bra: "br", mex: "mx", jpn: "jp", chn: "cn", sgp: "sg", are: "ae", sau: "sa", zaf: "za", nga: "ng", pak: "pk", bgd: "bd", lka: "lk", npl: "np", phl: "ph", idn: "id", mys: "my", nzl: "nz", irl: "ie", swe: "se", nor: "no", dnk: "dk", fin: "fi", pol: "pl", che: "ch", aut: "at", bel: "be", prt: "pt", tur: "tr", rus: "ru", ukr: "ua", kor: "kr", twn: "tw", hkg: "hk", tha: "th", vnm: "vn", egy: "eg", ken: "ke", arg: "ar", col: "co", chl: "cl", per: "pe", isr: "il" };

/* ---------- AI insights panel (one per tab, each with its own cache) ---------- */

const PRIORITY = { high: "Important", medium: "Worth a look", low: "Minor" } as const;

export function InsightsPanel({ title, source, ai, busy, error, findings, onRun }: { title: string; source: string; ai: { insights: Ga4Insight[]; at: string; current: boolean } | null; busy: boolean; error: string; findings: Finding[]; onRun: (force: boolean) => void }) {
  const byId = useMemo(() => new Map(findings.map((f) => [f.id, f])), [findings]);
  return (
    <section className="panel gd-ai" aria-label={title} aria-busy={busy}>
      <div className="gd-ai-top">
        <h2><span aria-hidden="true">✦</span> {title}</h2>
        {ai && <button type="button" className="dash-btn" onClick={() => onRun(true)} disabled={busy}>{busy ? "Analysing…" : "Analyse again"}</button>}
      </div>
      {!ai ? (
        <>
          <p className="panel-note">AI reads your last 28 days of {source} next to this report and writes a few plain-English findings, each with a next step. It takes about half a minute.</p>
          <button type="button" className="dash-btn primary" onClick={() => onRun(false)} disabled={busy}>{busy ? "Analysing your numbers…" : "Analyse with AI"}</button>
        </>
      ) : (
        <>
          <ol className="gd-ins">
            {ai.insights.map((i) => (
              <li key={i.title} className={`p-${i.priority}`}>
                <span className="gd-ins-p">{PRIORITY[i.priority]}</span>
                <h3>{i.title}</h3>
                <p>{i.detail}</p>
                <p className="gd-ins-do"><b>Next step:</b> {i.action}</p>
                {(i.pages.length > 0 || i.findings.length > 0) && (
                  <p className="gd-ins-refs">
                    {i.pages.map((p) => <PageLink key={p} url={p} />)}
                    {i.findings.map((id) => {
                      const f = byId.get(id);
                      return f ? <FindingLink key={id} f={f} /> : null;
                    })}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="gd-fine">
            Written by AI on {new Date(ai.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} from your {source} and this report. Check before acting.
            {!ai.current && ` Your ${source} numbers have updated since: analyse again for the latest.`}
          </p>
        </>
      )}
      {error && <p className="gd-note bad" role="alert">{error}</p>}
    </section>
  );
}
