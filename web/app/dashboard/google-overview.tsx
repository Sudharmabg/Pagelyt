"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChartColumn, Eye, Megaphone, MousePointerClick, Plug, Search, Target, Wallet, type LucideIcon } from "lucide-react";
import { findingKey } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding } from "@/lib/scan/types";
import { trafficMap } from "@/lib/google/gsc-insights";
import { visitsMap } from "@/lib/google/ga4-insights";
import { money, spendMap } from "@/lib/google/ads-insights";
import type { GoogleState } from "./use-google";
import { Skeleton, type GoogleTab } from "./google-data";
import { DataTable, DeltaBadge, FindingLink, Spark, StatTiles, n0, type Col, type Tile, AiMark } from "./google-kit";
import { METRIC, allInsights, type AiTab } from "./ai-insights";

/* The Overview tab of ★ Google data: where each product stands, the combined numbers for the window on screen, one
   daily trend (clicks, visits, ad spend as small multiples on a shared date axis: never two scales on one axis), the
   issues to fix first by all the traffic they touch, and a teaser of the AI insights (the full list opens in the AI insights modal). */

type Scan = { id: string; url: string; host: string; scannedAt?: string };

export function GoogleOverview({ g, scan, findings, onTab, onAi }: { g: GoogleState; scan: Scan; findings: Finding[]; onTab: (t: GoogleTab) => void; onAi: (t?: AiTab) => void }) {
  const s = g.status!;
  if (g.inRange.loading) return <Skeleton />;
  const gsc = g.inRange.gsc?.data ?? null;
  const ga4 = g.inRange.ga4?.data ?? null;
  const ads = g.inRange.ads?.data ?? null;
  const days = g.days;
  const busy = g.busy === "load" || g.busy === "refresh";

  return (
    <>
      <div className="gd-status-wrap">
      <ul className="gd-status" aria-label="Your Google products">
        <StatusCard
          i={0}
          icon={Search}
          name="Search Console"
          on={s.gsc && !!s.property}
          step={!s.connected || !s.gsc ? "Not connected" : !s.property ? "Pick a property" : null}
          detail={s.property ? s.property.replace(/^sc-domain:/, "") : "Searches, clicks, positions and indexing"}
          value={gsc ? { v: n0(gsc.totals.clicks), unit: "clicks", badge: <DeltaBadge now={gsc.totals.clicks} before={gsc.totals.prevClicks} days={days} />, spark: gsc.daily.map((x) => x.clicks) } : null}
          onOpen={() => onTab("gsc")}
        />
        <StatusCard
          i={1}
          icon={ChartColumn}
          name="Analytics"
          on={s.ga4 && !!s.ga4Property}
          step={!s.connected || !s.ga4 ? "Not connected" : !s.ga4Property ? "Pick a property" : null}
          detail={s.ga4Name ?? "Visits, engagement, channels and key events"}
          value={ga4 ? { v: n0(ga4.totals.sessions), unit: "visits", badge: <DeltaBadge now={ga4.totals.sessions} before={ga4.prev.sessions} days={days} />, spark: ga4.daily.map((x) => x.sessions) } : null}
          onOpen={() => onTab("ga4")}
        />
        {s.adsOn !== false && (
          <StatusCard
            i={2}
            icon={Megaphone}
            name="Google Ads"
            on={!!s.ads && !!s.adsCustomer}
            step={!s.connected || !s.ads ? "Not connected" : !s.adsCustomer ? "Pick an account" : null}
            detail={s.adsName ?? "Spend, landing pages and paid vs organic"}
            value={ads ? { v: money(ads.totals.cost, ads.currency), unit: "spend", badge: <DeltaBadge now={ads.totals.cost} before={ads.prev.cost} days={days} invert />, spark: ads.daily.map((x) => x.cost) } : null}
            onOpen={() => onTab("ads")}
          />
        )}
      </ul>
      </div>

      {!gsc && !ga4 && !ads ? (
        busy ? <Skeleton /> : (
          <section className="panel gd-connect sc-card">
            <header className="sc-head">
              <span className="sc-ic" aria-hidden="true"><Plug /></span>
              <div>
                <h2>Connect a Google product to fill this page</h2>
                <p className="panel-note">Each product adds its own numbers to every finding in this report. Pagelyt only reads your data.</p>
              </div>
            </header>
            <ul className="sc-items">
              {CONNECT_ROWS.map(([Ic, t, d], i) => (
                <li key={t} style={{ ["--i" as string]: i }}>
                  <span className="sc-ic" aria-hidden="true"><Ic /></span>
                  <span><b>{t}</b><small>{d.replace("{host}", scan.host)}</small></span>
                </li>
              ))}
            </ul>
            <footer className="sc-foot">
              <button type="button" className="dash-btn primary" onClick={() => onTab("gsc")}>Start with Search Console <span aria-hidden="true">→</span></button>
            </footer>
          </section>
        )
      ) : (
        <>
          <Kpis g={g} />
          <Trend g={g} scannedAt={scan.scannedAt} />
          <FixFirst g={g} scanUrl={scan.url} findings={findings} />
          <AiTeaser g={g} onAi={onAi} />
        </>
      )}
    </>
  );
}

const CONNECT_ROWS: [LucideIcon, string, string][] = [
  [Search, "Start with Search Console", "The searches that bring people to {host}, and the clicks each issue costs"],
  [ChartColumn, "Then Analytics", "Visits and key events on the pages with problems"],
  [Megaphone, "Then Google Ads", "Ad spend landing on pages that need fixing"],
];

function StatusCard({ i, icon: Icon, name, on, step, detail, value, onOpen }: { i: number; icon: LucideIcon; name: string; on: boolean; step: string | null; detail: string; value: { v: string; unit: string; badge: React.ReactNode; spark: number[] } | null; onOpen: () => void }) {
  return (
    <li className={on ? "on" : "off"} style={{ ["--i" as string]: i }}>
      <div className="gd-status-top">
        <span className="sc-ic" aria-hidden="true"><Icon /></span>
        <div className="gd-status-name">
          <h3>{name}</h3>
          <p className="gd-status-d" title={detail}>{detail}</p>
        </div>
        <span className={`gd-pill${on ? " ok" : ""}`}>{on ? "Connected" : step}</span>
      </div>
      {value ? (
        <div className="gd-status-num">
          <p className="gd-status-v"><b>{value.v}</b> <span>{value.unit}</span></p>
          {value.badge}
          <Spark values={value.spark} />
        </div>
      ) : (
        <p className="gd-status-empty">{on ? "Numbers load once a day." : "Not adding numbers to this report yet."}</p>
      )}
      <button type="button" className="fnd-link" onClick={onOpen}>{on ? `Open ${name}` : step === "Not connected" ? `Connect ${name}` : "Finish setup"} <ArrowRight aria-hidden="true" /></button>
    </li>
  );
}

function Kpis({ g }: { g: GoogleState }) {
  const gsc = g.inRange.gsc?.data, ga4 = g.inRange.ga4?.data, ads = g.inRange.ads?.data;
  const days = g.days;
  const tiles: Tile[] = [];
  if (gsc) {
    tiles.push({ icon: MousePointerClick, label: "Search clicks", value: n0(gsc.totals.clicks), now: gsc.totals.clicks, before: gsc.totals.prevClicks, spark: gsc.daily.map((x) => x.clicks), tone: "var(--gd-s1)" });
    tiles.push({ icon: Eye, label: "Seen in Google", value: n0(gsc.totals.impressions), now: gsc.totals.impressions, before: gsc.totals.prevImpressions, spark: gsc.daily.map((x) => x.impressions), tone: "#7b3fe0" });
  }
  if (ga4) {
    tiles.push({ icon: ChartColumn, label: "Visits", value: n0(ga4.totals.sessions), now: ga4.totals.sessions, before: ga4.prev.sessions, spark: ga4.daily.map((x) => x.sessions), tone: "var(--gd-s2)" });
    tiles.push({ icon: Target, label: "Key events", value: n0(ga4.totals.keyEvents), now: ga4.totals.keyEvents, before: ga4.prev.keyEvents, tone: "#0f9d8a" });
  }
  if (ads) {
    tiles.push({ icon: Wallet, label: "Ad spend", value: money(ads.totals.cost, ads.currency), now: ads.totals.cost, before: ads.prev.cost, invert: true, spark: ads.daily.map((x) => x.cost), tone: "var(--gd-s3)" });
    tiles.push({ icon: Target, label: "Ad conversions", value: n0(ads.totals.conversions), now: ads.totals.conversions, before: ads.prev.conversions, tone: "#e8a10a" });
  }
  return (
    <section className="panel gd-totals" aria-label={`Last ${days} days`}>
      <h2>Your Google numbers, last {days} days</h2>
      <StatTiles tiles={tiles} days={days} label={`Your Google numbers, last ${days} days`} />
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

/* ---------- AI insights teaser: the top few, the rest in the modal ---------- */

function AiTeaser({ g, onAi }: { g: GoogleState; onAi: (t?: AiTab) => void }) {
  const all = allInsights(g);
  const combined = !!g.status && [g.gsc, g.ga4, g.ads].filter(Boolean).length >= 2;
  return (
    <section className="panel gd-ai gd-ai-teaser" aria-labelledby="gd-ai-teaser-h">
      <div className="gd-ai-top">
        <AiMark />
        <div>
          <h2 id="gd-ai-teaser-h">{all.length ? "Your biggest wins, according to AI" : "Let AI find your biggest wins"}</h2>
          <p className="panel-note">{combined ? "It reads Search Console, Analytics and Google Ads together, page by page." : "It reads your Google numbers next to this report."}</p>
        </div>
      </div>
      {all.length > 0 && (
        <ul className="gd-teaser">
          {all.slice(0, 3).map((i, n) => {
            const m = i.metric ? METRIC[i.metric] : null;
            const MIc = m?.icon;
            return (
              <li key={i.from + i.title + n} className={`p-${i.priority}`}>
                {m && MIc ? <span className={`gd-metric m-${i.metric}`}><MIc aria-hidden="true" />{m.label}</span> : null}
                <h3>{i.title}</h3>
                {i.gain && !/hard to estimate/i.test(i.gain) && <p className="gd-gain-t">{i.gain}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="gd-teaser-foot">
        <button type="button" className="dash-btn primary" onClick={() => onAi(combined ? "all" : undefined)}>
          {all.length ? `See all ${all.length} insights` : combined ? "Analyse everything together" : "Analyse with AI"} <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
