"use client";

import { useMemo, useState } from "react";
import { findingKey } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding } from "@/lib/scan/types";
import { trafficMap } from "@/lib/google/gsc-insights";
import { visitsMap } from "@/lib/google/ga4-insights";
import { money, spendMap } from "@/lib/google/ads-insights";
import type { Ga4Insight } from "@/lib/google/ga4-insights";
import type { GoogleState } from "./use-google";
import { Delta, Skeleton, type GoogleTab } from "./google-data";
import { DataTable, FindingLink, PageLink, n0, type Col } from "./google-kit";

/* The Overview tab of ★ Google data: where each product stands, the combined numbers for the window on screen, one
   daily trend (clicks, visits, ad spend as small multiples on a shared date axis: never two scales on one axis), the
   issues to fix first by all the traffic they touch, and the most important AI insights from every product. */

type Scan = { id: string; url: string; host: string; scannedAt?: string };

export function GoogleOverview({ g, scan, findings, onTab }: { g: GoogleState; scan: Scan; findings: Finding[]; onTab: (t: GoogleTab) => void }) {
  const s = g.status!;
  if (g.inRange.loading) return <Skeleton />;
  const gsc = g.inRange.gsc?.data ?? null;
  const ga4 = g.inRange.ga4?.data ?? null;
  const ads = g.inRange.ads?.data ?? null;
  const days = g.days;
  const busy = g.busy === "load" || g.busy === "refresh";

  return (
    <>
      <ul className="gd-status" aria-label="Your Google products">
        <StatusCard
          name="Search Console"
          on={s.gsc && !!s.property}
          step={!s.connected || !s.gsc ? "Not connected" : !s.property ? "Pick a property" : null}
          detail={s.property ? s.property.replace(/^sc-domain:/, "") : "Searches, clicks, positions and indexing"}
          value={gsc ? <><b>{n0(gsc.totals.clicks)}</b> clicks <Delta now={gsc.totals.clicks} before={gsc.totals.prevClicks} days={days} /></> : null}
          onOpen={() => onTab("gsc")}
        />
        <StatusCard
          name="Analytics"
          on={s.ga4 && !!s.ga4Property}
          step={!s.connected || !s.ga4 ? "Not connected" : !s.ga4Property ? "Pick a property" : null}
          detail={s.ga4Name ?? "Visits, engagement, channels and key events"}
          value={ga4 ? <><b>{n0(ga4.totals.sessions)}</b> visits <Delta now={ga4.totals.sessions} before={ga4.prev.sessions} days={days} /></> : null}
          onOpen={() => onTab("ga4")}
        />
        {s.adsOn !== false && (
          <StatusCard
            name="Google Ads"
            on={!!s.ads && !!s.adsCustomer}
            step={!s.connected || !s.ads ? "Not connected" : !s.adsCustomer ? "Pick an account" : null}
            detail={s.adsName ?? "Spend, landing pages and paid vs organic"}
            value={ads ? <><b>{money(ads.totals.cost, ads.currency)}</b> spend <Delta now={ads.totals.cost} before={ads.prev.cost} days={days} invert /></> : null}
            onOpen={() => onTab("ads")}
          />
        )}
      </ul>

      {!gsc && !ga4 && !ads ? (
        busy ? <Skeleton /> : (
          <section className="panel gd-connect">
            <h2>Connect a Google product to fill this page</h2>
            <p className="panel-note">Each product adds its own numbers to every finding in this report. Start with Search Console: it shows the searches that bring people to {scan.host}. Pagelyt only reads your data.</p>
            <button type="button" className="dash-btn primary" onClick={() => onTab("gsc")}>Start with Search Console</button>
          </section>
        )
      ) : (
        <>
          <Kpis g={g} />
          <Trend g={g} scannedAt={scan.scannedAt} />
          <FixFirst g={g} scanUrl={scan.url} findings={findings} />
          <TopInsights g={g} onTab={onTab} />
        </>
      )}
    </>
  );
}

function StatusCard({ name, on, step, detail, value, onOpen }: { name: string; on: boolean; step: string | null; detail: string; value: React.ReactNode; onOpen: () => void }) {
  return (
    <li className={on ? "on" : ""}>
      <div className="gd-status-top">
        <h3>{name}</h3>
        <span className={`gd-pill${on ? " ok" : ""}`}>{on ? "Connected" : step}</span>
      </div>
      <p className="gd-status-d" title={detail}>{detail}</p>
      {value && <p className="gd-status-v">{value}</p>}
      <button type="button" className="fnd-link" onClick={onOpen}>{on ? `Open ${name}` : step === "Not connected" ? `Connect ${name}` : "Finish setup"} <span aria-hidden="true">→</span></button>
    </li>
  );
}

function Kpis({ g }: { g: GoogleState }) {
  const gsc = g.inRange.gsc?.data, ga4 = g.inRange.ga4?.data, ads = g.inRange.ads?.data;
  const days = g.days;
  const tiles: { v: string; l: string; d?: React.ReactNode }[] = [];
  if (gsc) {
    tiles.push({ v: n0(gsc.totals.clicks), l: "Google search clicks", d: <Delta now={gsc.totals.clicks} before={gsc.totals.prevClicks} days={days} /> });
    tiles.push({ v: n0(gsc.totals.impressions), l: "times seen in Google", d: <Delta now={gsc.totals.impressions} before={gsc.totals.prevImpressions} days={days} /> });
  }
  if (ga4) {
    tiles.push({ v: n0(ga4.totals.sessions), l: "visits", d: <Delta now={ga4.totals.sessions} before={ga4.prev.sessions} days={days} /> });
    tiles.push({ v: n0(ga4.totals.keyEvents), l: "key events", d: <Delta now={ga4.totals.keyEvents} before={ga4.prev.keyEvents} days={days} /> });
  }
  if (ads) {
    tiles.push({ v: money(ads.totals.cost, ads.currency), l: "ad spend", d: <Delta now={ads.totals.cost} before={ads.prev.cost} days={days} invert /> });
    tiles.push({ v: n0(ads.totals.conversions), l: "ad conversions", d: <Delta now={ads.totals.conversions} before={ads.prev.conversions} days={days} /> });
  }
  return (
    <section className="panel gd-totals" aria-label={`Last ${days} days`}>
      <h2>Your Google numbers, last {days} days</h2>
      <ul className="sec-stats">{tiles.map((t) => <li key={t.l}><b>{t.v}</b><span>{t.l}</span>{t.d}</li>)}</ul>
    </section>
  );
}

/* ---------- Daily trend: small multiples sharing one date axis ---------- */

type Series = { key: "clicks" | "visits" | "spend"; label: string; color: string; points: Map<string, number>; fmt: (n: number) => string };

const W = 720, ROW = 74, GAP = 18, LEFT = 8, RIGHT = 8;

function Trend({ g, scannedAt }: { g: GoogleState; scannedAt?: string }) {
  const gsc = g.inRange.gsc?.data, ga4 = g.inRange.ga4?.data, ads = g.inRange.ads?.data;
  const all: Series[] = useMemo(() => {
    const out: Series[] = [];
    if (gsc?.daily.length) out.push({ key: "clicks", label: "Search clicks", color: "var(--gd-s1)", points: new Map(gsc.daily.map((d) => [d.date, d.clicks])), fmt: n0 });
    if (ga4?.daily.length) out.push({ key: "visits", label: "Visits", color: "var(--gd-s2)", points: new Map(ga4.daily.map((d) => [d.date, d.sessions])), fmt: n0 });
    if (ads?.daily.length) out.push({ key: "spend", label: "Ad spend", color: "var(--gd-s3)", points: new Map(ads.daily.map((d) => [d.date, d.cost])), fmt: (n) => money(n, ads.currency) });
    return out;
  }, [gsc, ga4, ads]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const dates = useMemo(() => [...new Set(all.flatMap((s) => [...s.points.keys()]))].sort(), [all]);
  if (dates.length < 3 || !all.length) return null;
  const shown = all.filter((s) => !hidden.has(s.key));
  const H = Math.max(1, shown.length) * (ROW + GAP) + 18;
  const x = (i: number) => LEFT + (i / (dates.length - 1)) * (W - LEFT - RIGHT);
  const scanDay = scannedAt?.slice(0, 10);
  const scanI = scanDay ? dates.indexOf(scanDay) : -1;
  const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const toggle = (k: string) => setHidden((h) => {
    const n = new Set(h);
    if (n.has(k)) n.delete(k);
    else if (all.length - n.size > 1) n.add(k); // keep at least one series on screen
    return n;
  });
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(dates.length - 1, Math.round(((px - LEFT) / (W - LEFT - RIGHT)) * (dates.length - 1)))));
  };

  return (
    <section className="panel gd-trend" aria-label="Daily trend">
      <div className="gd-trend-top">
        <h2>Day by day</h2>
        <div className="gd-chips" role="group" aria-label="Show series">
          {all.map((s) => (
            <button key={s.key} type="button" aria-pressed={!hidden.has(s.key)} className={hidden.has(s.key) ? "" : "on"} onClick={() => toggle(s.key)}>
              <i style={{ background: s.color }} aria-hidden="true" />{s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="panel-note">Each line has its own scale, so compare shapes, not heights.{scanI >= 0 ? " The dashed line marks the day of this scan." : ""}</p>
      <div className="gd-trend-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Daily ${shown.map((s) => s.label.toLowerCase()).join(", ")} from ${fmtDay(dates[0])} to ${fmtDay(dates[dates.length - 1])}`}>
          {shown.map((s, row) => {
            const top = row * (ROW + GAP) + 14;
            const vals = dates.map((d) => s.points.get(d));
            const max = Math.max(1, ...vals.map((v) => v ?? 0));
            const y = (v: number) => top + ROW - (v / max) * ROW;
            let path = "";
            vals.forEach((v, i) => {
              if (v == null) return;
              path += `${path && vals[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
            });
            const last = [...vals].reverse().find((v) => v != null) ?? 0;
            return (
              <g key={s.key}>
                <text x={LEFT} y={top - 4} className="gd-tl">{s.label}</text>
                <text x={W - RIGHT} y={top - 4} className="gd-tv" textAnchor="end">{hover != null && vals[hover] != null ? s.fmt(vals[hover]!) : `latest ${s.fmt(last)}`}</text>
                <line x1={LEFT} x2={W - RIGHT} y1={top + ROW} y2={top + ROW} className="gd-base" />
                <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {hover != null && vals[hover] != null && <circle cx={x(hover)} cy={y(vals[hover]!)} r="4" fill={s.color} stroke="var(--d-card)" strokeWidth="2" />}
              </g>
            );
          })}
          {scanI >= 0 && <line x1={x(scanI)} x2={x(scanI)} y1={8} y2={H - 14} className="gd-scanline" />}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={8} y2={H - 14} className="gd-cross" />}
          <text x={LEFT} y={H - 2} className="gd-ax">{fmtDay(dates[0])}</text>
          {hover != null && <text x={Math.min(W - 60, Math.max(60, x(hover)))} y={H - 2} className="gd-ax gd-ax-h" textAnchor="middle">{fmtDay(dates[hover])}{hover === scanI ? " · scan" : ""}</text>}
          <text x={W - RIGHT} y={H - 2} className="gd-ax" textAnchor="end">{fmtDay(dates[dates.length - 1])}</text>
          <rect x="0" y="0" width={W} height={H} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      </div>
      <p className="gd-tbar">
        <button type="button" className="fnd-link" onClick={() => setTable((v) => !v)} aria-expanded={table}>{table ? "Hide the numbers" : "Show as a table"}</button>
      </p>
      {table && (
        <DataTable
          rows={dates}
          rowKey={(d) => d}
          file={`daily-${g.days}d`}
          limit={120}
          cols={[{ label: "Date", get: (d) => d }, ...all.map((s): Col<string> => ({ label: s.label, get: (d) => s.points.get(d) ?? null, cell: (d) => (s.points.has(d) ? s.fmt(s.points.get(d)!) : "–") }))]}
        />
      )}
    </section>
  );
}

/* ---------- Fix first: every issue by all the traffic it touches ---------- */

type Row = { f: Finding; clicks: number; visits: number; adClicks: number; spend: number; reach: number; cover: string };

function FixFirst({ g, scanUrl, findings }: { g: GoogleState; scanUrl: string; findings: Finding[] }) {
  const gsc = g.inRange.gsc?.data, ga4 = g.inRange.ga4?.data, ads = g.inRange.ads?.data;
  const rows = useMemo(() => {
    const t = gsc ? trafficMap(findings, gsc, scanUrl, findingKey) : null;
    const v = ga4 ? visitsMap(findings, ga4, findingKey) : null;
    const sp = ads ? spendMap(findings, ads, scanUrl, findingKey) : null;
    return findings
      .map((f): Row => {
        const k = findingKey(f);
        const a = t?.get(k), b = v?.get(k), c = sp?.get(k);
        const scope = a?.scope ?? b?.scope ?? c?.scope;
        const pages = Math.max(a?.pages ?? 0, b?.pages ?? 0, c?.pages ?? 0);
        const clicks = a?.clicks ?? 0, visits = b?.sessions ?? 0, adClicks = c?.clicks ?? 0;
        return { f, clicks, visits, adClicks, spend: c?.cost ?? 0, reach: clicks + visits + adClicks, cover: scope === "site" ? "whole site" : scope === "homepage" ? "homepage" : `${pages} page${pages === 1 ? "" : "s"}` };
      })
      .filter((r) => r.reach > 0);
  }, [gsc, ga4, ads, findings, scanUrl]);
  const cols: Col<Row>[] = [
    { label: "Issue", get: (r) => r.f.title, cell: (r) => <FindingLink f={r.f} />, wrap: true },
    { label: "Area", get: (r) => MODULE_NAMES[r.f.module] },
    { label: "Traffic touched", get: (r) => r.reach, cell: (r) => <b>{n0(r.reach)}</b> },
    ...(gsc ? [{ label: "Search clicks", get: (r: Row) => r.clicks, cell: (r: Row) => n0(r.clicks) }] : []),
    ...(ga4 ? [{ label: "Visits", get: (r: Row) => r.visits, cell: (r: Row) => n0(r.visits) }] : []),
    ...(ads ? [{ label: "Ad spend", get: (r: Row) => +r.spend.toFixed(2), cell: (r: Row) => money(r.spend, ads.currency) }] : []),
    { label: "Covers", get: (r) => r.cover },
  ];
  return (
    <section className="panel" aria-label="Fix first">
      <h2>Fix first</h2>
      <p className="panel-note">Open issues ranked by all the Google traffic on their pages over {g.days} days: search clicks, visits and paid clicks together. Click one to jump straight to it.</p>
      <DataTable rows={rows} cols={cols} file={`fix-first-${g.days}d`} sort={{ col: 2 }} limit={8} rowKey={(r) => findingKey(r.f)} empty={<p className="panel-note">None of this report&rsquo;s open issues are on pages with Google traffic in this window.</p>} />
    </section>
  );
}

/* ---------- The most important AI insights from every product ---------- */

const RANK = { high: 0, medium: 1, low: 2 } as const;

function TopInsights({ g, onTab }: { g: GoogleState; onTab: (t: GoogleTab) => void }) {
  const all: (Ga4Insight & { from: string; tab: GoogleTab })[] = [
    ...(g.gscAi?.insights ?? []).map((i) => ({ ...i, from: "Search Console", tab: "gsc" as GoogleTab })),
    ...(g.ai?.insights ?? []).map((i) => ({ ...i, from: "Analytics", tab: "ga4" as GoogleTab })),
    ...(g.adsAi?.insights ?? []).map((i) => ({ ...i, from: "Google Ads", tab: "ads" as GoogleTab })),
  ].sort((a, b) => RANK[a.priority] - RANK[b.priority]);
  const s = g.status!;
  const can: [GoogleTab, string][] = [];
  if (s.property && !g.gscAi) can.push(["gsc", "Search Console"]);
  if (s.ga4Property && !g.ai) can.push(["ga4", "Analytics"]);
  if (s.adsCustomer && s.adsOn !== false && !g.adsAi) can.push(["ads", "Google Ads"]);
  if (!all.length && !can.length) return null;
  return (
    <section className="panel gd-ai" aria-label="Top AI insights">
      <div className="gd-ai-top"><h2><span aria-hidden="true">✦</span> What AI sees in your numbers</h2></div>
      {all.length > 0 && (
        <ul className="gd-ins gd-ins-mini">
          {all.slice(0, 5).map((i) => (
            <li key={i.from + i.title} className={`p-${i.priority}`}>
              <span className="gd-ins-p">{i.from}</span>
              <h3>{i.title}</h3>
              <p className="gd-ins-do"><b>Next step:</b> {i.action}</p>
              {i.pages.length > 0 && <p className="gd-ins-refs">{i.pages.slice(0, 3).map((p) => <PageLink key={p} url={p} />)}</p>}
            </li>
          ))}
        </ul>
      )}
      {can.length > 0 && (
        <p className="panel-note">
          {all.length ? "Not analysed yet: " : "AI hasn't read your numbers yet. Run it on "}
          {can.map(([t, label], i) => (
            <span key={t}>{i ? ", " : ""}<button type="button" className="fnd-link" onClick={() => onTab(t)}>{label}</button></span>
          ))}
          .
        </p>
      )}
    </section>
  );
}

