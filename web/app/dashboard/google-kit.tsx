"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Finding } from "@/lib/scan/types";
import Link from "next/link";
import { TableModal } from "../table-modal";
import { Sparkles, type LucideIcon } from "lucide-react";

/* Shared pieces of the ★ Google data view: sortable tables with CSV download, links that open a page's drill-down
   panel or jump to the exact finding, device/country bars and the stat tiles (number, change badge, trend line) used
   by every tab. The AI insights live in ai-insights.tsx. */

/* The setup guide for each Google product (blog posts in blog-posts-google.ts): setup, connecting, uses and tips. */
export const GUIDES = {
  gsc: { href: "/blog/google-search-console-setup-guide", name: "Search Console" },
  ga4: { href: "/blog/google-analytics-4-setup-guide", name: "Google Analytics 4" },
  ads: { href: "/blog/google-ads-setup-guide", name: "Google Ads" },
} as const;
export function GuideLink({ product, children }: { product: keyof typeof GUIDES; children?: ReactNode }) {
  const g = GUIDES[product];
  return <Link className="fnd-link gd-guide" href={g.href} target="_blank">{children ?? `${g.name} setup guide and tips`} <span aria-hidden="true">↗</span></Link>;
}

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

/** "top-searches-28d" → "Top searches". */
const titleOf = (file: string) => {
  const t = file.replace(/-\d+d$/, "").replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function DataTable<T>({ rows, cols, file, sort: initial, limit = 25, rowKey, empty, title }: { rows: T[]; cols: Col<T>[]; file: string; sort?: { col: number; desc?: boolean }; limit?: number; rowKey: (r: T) => string; empty?: ReactNode; title?: string }) {
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
  const by = (i: number) => setSort((s) => (s?.col === i ? { col: i, desc: !s.desc } : { col: i, desc: typeof cols[i].get(rows[0]) === "number" }));
  const table = (list: T[]) => (
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
          {list.map((r) => (
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
  );
  const csv = (
    <button type="button" className="fnd-link" onClick={() => downloadCsv(file, cols.map((c) => c.label), sorted.map((r) => cols.map((c) => c.get(r))))}>
      Download CSV
    </button>
  );
  return (
    <>
      {table(sorted.slice(0, limit))}
      <p className="gd-tbar">
        {rows.length > limit && (
          <button type="button" className="fnd-link" aria-haspopup="dialog" onClick={() => setAll(true)}>
            Show all {rows.length}
          </button>
        )}
        {csv}
      </p>
      {rows.length > limit && (
        <TableModal open={all} onClose={() => setAll(false)} title={title ?? titleOf(file)} note={`All ${rows.length}. Click a heading to sort.`} closeOnPick="button.gd-page, button.fnd-link:not(.gd-sort)">
          {table(sorted)}
          <p className="gd-tbar">{csv}</p>
        </TableModal>
      )}
    </>
  );
}

/* ---------- Card header: icon tile, title and a short note (the shared .sc-head kit) ---------- */

export function PanelHead({ icon: Icon, title, note, id, children }: { icon: LucideIcon; title: ReactNode; note?: ReactNode; id?: string; children?: ReactNode }) {
  return (
    <header className="sc-head">
      <span className="sc-ic" aria-hidden="true"><Icon /></span>
      <div>
        <h2 id={id}>{title}</h2>
        {note && <p className="panel-note">{note}</p>}
      </div>
      {children}
    </header>
  );
}

/** The AI insights card header: a sparkle tile in place of the old ✦ glyph. */
export const AiMark = () => <span className="sc-ic gd-ai-ic" aria-hidden="true"><Sparkles /></span>;

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

/* ---------- Stat tiles: icon, label, big number, change badge and a small trend line ---------- */

export type Tile = {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Now and the same window before, for the change badge. */
  now?: number;
  before?: number;
  /** Less is better (spend, cost per conversion). */
  invert?: boolean;
  /** One line under the number, e.g. "was 2.1%". */
  note?: string;
  /** Daily values, oldest first, for the trend line. */
  spark?: number[];
  /** Accent colour (a CSS colour or var). */
  tone?: string;
};

const changeOf = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** The change against the window before, as a coloured badge (↑ green when it's good news, ↓ red when it isn't). */
export function DeltaBadge({ now, before, invert, days }: { now: number; before: number; invert?: boolean; days: number }) {
  const d = changeOf(now, before);
  if (d == null) return null;
  const tone = d === 0 ? "flat" : (invert ? d < 0 : d > 0) ? "up" : "down";
  return (
    <span className={`gd-delta ${tone}`} title={`${d > 0 ? "+" : ""}${d}% vs the previous ${days} days`}>
      <span aria-hidden="true">{d > 0 ? "↑" : d < 0 ? "↓" : "→"}</span> {Math.abs(d)}%<span className="sr-only"> {d >= 0 ? "up" : "down"} vs the previous {days} days</span>
    </span>
  );
}

/** A tiny line chart of daily values (decorative: the number and badge carry the meaning). */
export function Spark({ values }: { values: number[] }) {
  if (values.length < 3) return null;
  const W = 100, H = 30;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg className="gd-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={`${line} L${W} ${H} L0 ${H} Z`} className="gd-spark-a" />
      <path d={line} className="gd-spark-l" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A row of stat tiles. Columns follow the space available (container queries), never 4 + 2. */
export function StatTiles({ tiles, days, label }: { tiles: Tile[]; days: number; label: string }) {
  return (
    <div className="gd-tiles-wrap">
      <ul className="gd-tiles" aria-label={label} data-n={tiles.length}>
        {tiles.map((t, i) => {
          const Ic = t.icon;
          return (
            <li key={t.label} style={{ ["--tc" as string]: t.tone ?? "var(--gd-s1)", ["--i" as string]: i }}>
              <div className="gd-tile-top">
                <span className="gd-tile-ic" aria-hidden="true"><Ic /></span>
                <span className="gd-tile-l">{t.label}</span>
              </div>
              <b className="gd-tile-v">{t.value}</b>
              {t.note && <span className="gd-tile-note">{t.note}</span>}
              <div className="gd-tile-foot">
                {t.now != null && t.before != null ? <DeltaBadge now={t.now} before={t.before} invert={t.invert} days={days} /> : <span />}
                {t.spark && <Spark values={t.spark} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
