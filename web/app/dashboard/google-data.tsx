"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { findingKey } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding, type ModuleKey } from "@/lib/scan/types";
import { byTraffic, change, drops, findingsOn, lowCtr, notIndexed, strikingDistance, trafficMap, type GscData, type GscQuery, type Traffic } from "@/lib/google/gsc-insights";
import type { Days, GoogleState } from "./use-google";
import { AnalyticsTab } from "./analytics-data";
import { AdsTab } from "./ads-data";
import { GoogleOverview } from "./google-overview";
import { PageDrill } from "./page-drill";
import { DataTable, FindingLink, FindingList, GoogleNav, InsightsPanel, PageLink, SplitBars, countryName, deviceName, n0, pathOf, pct, type Col, GuideLink } from "./google-kit";

/* The ★ Google data view: Overview | Search Console | Analytics | Google Ads, with a 7/28/90-day window, sortable
   tables with CSV download, and a drill-down panel for any page. Search Console lives here; Analytics in
   analytics-data.tsx, Ads in ads-data.tsx, the Overview in google-overview.tsx. Only the owner sees it. */

const propLabel = (p: string) => (p.startsWith("sc-domain:") ? `${p.slice(10)} (domain)` : p);

const NOTICE: Record<string, { text: string; bad?: boolean }> = {
  connected: { text: "Google is connected. Pagelyt now reads this site's Search Console numbers, refreshed once a day." },
  pick: { text: "Google is connected. Pick the Search Console property for this site below." },
  noproperty: { text: "Google is connected, but this Google account has no Search Console properties. Add the site in Search Console, or connect the Google account that has it.", bad: true },
  cancelled: { text: "Google wasn't connected: the consent screen was closed or access was declined.", bad: true },
  scope: { text: "Google wasn't connected: the Search Console permission was unticked. Connect again and leave it ticked.", bad: true },
  expired: { text: "That connection attempt took too long. Please try again.", bad: true },
  plan: { text: "Google data comes with the Professional and Business plans.", bad: true },
  failed: { text: "Google couldn't be connected just now. Please try again.", bad: true },
};

export type GoogleTab = "overview" | "gsc" | "ga4" | "ads";
type Scan = { id: string; url: string; host: string };

/** `tab`: kept by the dashboard (from ?gtab= on arrival), so the banner and Overview cards can open a tab. */
export function GoogleData({ g, scan, siteId, findings, onSave, onOpenFinding, tab, onTab }: { g: GoogleState; scan: Scan; siteId: string | null; findings: Finding[]; onSave: () => void; onOpenArea?: (m: ModuleKey) => void; onOpenFinding: (f: Finding) => void; tab: GoogleTab; onTab: (t: GoogleTab) => void }) {
  const params = useSearchParams();
  const [notice] = useState(() => params.get("google"));
  const [page, setPage] = useState<string | null>(null);
  const nav = useMemo(() => ({ openPage: setPage, openFinding: (f: Finding) => { setPage(null); onOpenFinding(f); } }), [onOpenFinding]);
  // Drop ?google= and ?gtab= from the address so a refresh doesn't show the notice again.
  useEffect(() => {
    if (!notice && !params.get("gtab")) return;
    const q = new URLSearchParams(window.location.search);
    q.delete("google");
    q.delete("gtab");
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }, [notice, params]);
  const { status: s, error } = g;

  if (!siteId)
    return (
      <div className="panel sec-cta">
        <p>Google data runs on saved sites. Save {scan.host} first, then connect Google here.</p>
        <button type="button" className="dash-btn primary" onClick={onSave}>Save this site</button>
      </div>
    );
  if (!s) return error ? <p className="panel gd-note bad" role="alert">{error}</p> : <Skeleton />;
  if (!s.configured) return <p className="panel sec-empty">Google isn&rsquo;t set up on this server yet (see DEPLOY.md, Google integrations).</p>;
  if (!s.allowed) return <p className="panel sec-empty">Google data comes with the Professional and Business plans.</p>;

  const gaNotice = notice?.startsWith("ga4") ? notice.slice(3) : null;
  const adsNotice = notice?.startsWith("ads") ? notice.slice(3) : null;
  const linked = (s.gsc && !!s.property) || (s.ga4 && !!s.ga4Property) || (!!s.adsOn && !!s.ads && !!s.adsCustomer);
  const TABS: [GoogleTab, string][] = [["overview", "Overview"], ["gsc", "Search Console"], ["ga4", "Analytics"], ...(s.adsOn === false ? [] : [["ads", "Google Ads"] as [GoogleTab, string]])];
  return (
    <GoogleNav.Provider value={nav}>
      <div className="gd-bar">
        <div className="gd-tabs" role="tablist" aria-label="Google data">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => onTab(k)}>{label}</button>
          ))}
        </div>
        {linked && <RangePicker g={g} />}
      </div>
      {g.inRange.error && <p className="panel gd-note bad" role="alert">{g.inRange.error}</p>}
      {tab === "overview" ? (
        <GoogleOverview g={g} scan={scan} findings={findings} onTab={onTab} />
      ) : tab === "gsc" ? (
        <GscTab g={g} scan={scan} findings={findings} notice={gaNotice || adsNotice ? null : notice} />
      ) : tab === "ga4" ? (
        <AnalyticsTab g={g} scan={scan} findings={findings} notice={gaNotice} />
      ) : (
        <AdsTab g={g} scan={scan} findings={findings} notice={adsNotice} />
      )}
      {page && <PageDrill page={page} g={g} scan={scan} findings={findings} onClose={() => setPage(null)} />}
    </GoogleNav.Provider>
  );
}

function RangePicker({ g }: { g: GoogleState }) {
  const loading = g.busy === "range";
  return (
    <div className="gd-range" role="group" aria-label="Date range">
      {([7, 28, 90] as Days[]).map((d) => (
        <button key={d} type="button" aria-pressed={g.days === d} className={g.days === d ? "on" : ""} onClick={() => void g.setDays(d)} disabled={loading}>
          {d} days
        </button>
      ))}
      {loading && <span className="gd-range-busy" role="status">Loading…</span>}
    </div>
  );
}

/** Placeholder blocks while numbers load. */
export function Skeleton({ label = "Loading your Google numbers…" }: { label?: string }) {
  return (
    <div className="gd-skel" role="status" aria-label={label}>
      <div className="gd-skel-row">{[0, 1, 2, 3].map((i) => <span key={i} />)}</div>
      <div className="gd-skel-chart" />
      <div className="gd-skel-lines">{[0, 1, 2, 3, 4].map((i) => <span key={i} />)}</div>
    </div>
  );
}

/** "How it works" steps on each connect card. */
export function Steps({ at }: { at: 0 | 1 | 2 }) {
  const steps = ["Connect your Google account", "Pick this site's property", "See your numbers on every fix"];
  return (
    <ol className="gd-steps" aria-label="Setup">
      {steps.map((s, i) => (
        <li key={s} className={i < at ? "done" : i === at ? "now" : ""} aria-current={i === at ? "step" : undefined}>
          <span aria-hidden="true">{i < at ? "✓" : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function GscTab({ g, scan, findings, notice }: { g: GoogleState; scan: Scan; findings: Finding[]; notice: string | null }) {
  const { status, busy, error } = g;
  const s = status!;
  const note = notice && NOTICE[notice];
  const head = (
    <>
      {note && <p className={`panel gd-note${note.bad ? " bad" : ""}`} role="status">{note.text}</p>}
      {error && <p className="panel gd-note bad" role="alert">{error}</p>}
    </>
  );

  if (!s.connected || !s.gsc)
    return (
      <>
        {head}
        <section className="panel gd-connect">
          <h2>Connect Google Search Console</h2>
          <Steps at={0} />
          <p className="panel-note">See how many real searchers each problem in this report affects, which searches are close to page one and which pages Google hasn&rsquo;t indexed.</p>
          <ul className="gd-gets">
            <li><b>Clicks at stake</b> On every finding, so you fix what costs traffic first</li>
            <li><b>Near page one</b> Searches where you rank 8 to 20</li>
            <li><b>Lost clicks</b> Pages that dropped, next to what&rsquo;s wrong on them</li>
            <li><b>Indexing check</b> Whether Google has indexed your key pages</li>
            <li><b>AI insights</b> Plain-English findings from your searches, each with a next step</li>
          </ul>
          <button type="button" className="dash-btn primary gd-btn" onClick={() => void g.connect(scan.id)} disabled={busy === "connect"}>
            <GoogleMark />{busy === "connect" ? "Opening Google…" : s.connected ? "Add Search Console access" : "Connect Google"}
          </button>
          <p className="gd-fine">Read-only: Pagelyt can&rsquo;t change anything in your Google account. Disconnect any time from your account page.</p>
          <p className="gd-fine">New to Search Console? <GuideLink product="gsc">Read our setup guide</GuideLink></p>
        </section>
      </>
    );

  if (!s.property) return <>{head}<PropertyPicker g={g} host={scan.host} /></>;

  const c = g.inRange.gsc;
  if (g.inRange.loading || (!c?.data && (busy === "refresh" || busy === "link"))) return <>{head}<Skeleton label="Fetching your Search Console numbers…" /></>;
  if (!c?.data)
    return (
      <>
        {head}
        <p className="panel sec-empty">{c?.error ?? "No Search Console data yet."}</p>
        <Footer g={g} property={s.property} />
      </>
    );

  return (
    <>
      {head}
      {c.error && <p className="panel gd-note bad" role="alert">{c.error} Showing the numbers from {new Date(c.fetchedAt).toLocaleDateString("en-GB")}.</p>}
      <InsightsPanel title="AI insights from your searches" source="Search Console" ai={g.gscAi} busy={busy === "gscanalyse"} error={g.gscAiError} findings={findings} onRun={(force) => void g.analyseGsc(scan.id, force)} />
      <GscView d={c.data} scanUrl={scan.url} findings={findings} />
      <Footer g={g} property={s.property} fetchedAt={c.fetchedAt} />
    </>
  );
}

function PropertyPicker({ g, host }: { g: GoogleState; host: string }) {
  const props = g.status?.properties;
  const [pick, setPick] = useState("");
  const { loadProps } = g;
  useEffect(() => {
    if (!props) void loadProps();
  }, [props, loadProps]);
  return (
    <section className="panel">
      <h2>Which Search Console property is {host}?</h2>
      <Steps at={1} />
      {!props ? (
        <p className="panel-note">Loading your properties…</p>
      ) : props.length === 0 ? (
        <p className="panel-note">This Google account ({g.status?.email}) can&rsquo;t see any Search Console properties. Add {host} in Search Console first (<GuideLink product="gsc">how to add and verify a site</GuideLink>), or disconnect from your account page and connect the Google account that has it.</p>
      ) : (
        <form className="gd-pick" onSubmit={(e) => { e.preventDefault(); if (pick) void g.link(pick); }}>
          <label>
            <span className="sr-only">Search Console property</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)} required>
              <option value="">Choose a property…</option>
              {props.map((p) => <option key={p} value={p}>{propLabel(p)}</option>)}
            </select>
          </label>
          <button type="submit" className="dash-btn primary" disabled={!pick || g.busy === "link"}>{g.busy === "link" ? "Linking…" : "Use this property"}</button>
        </form>
      )}
    </section>
  );
}

function Footer({ g, property, fetchedAt }: { g: GoogleState; property: string; fetchedAt?: string }) {
  const [changing, setChanging] = useState(false);
  const refreshing = g.busy === "refresh" || g.busy === "range";
  return (
    <>
      <p className="gd-foot">
        <span>Search Console · {propLabel(property)}{g.status?.email ? ` · ${g.status.email}` : ""}{fetchedAt ? ` · updated ${new Date(fetchedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
        <button type="button" className="fnd-link" onClick={() => void (g.days === 28 ? g.refresh(true) : g.setDays(g.days, true))} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh now"}</button>
        <button type="button" className="fnd-link" onClick={() => setChanging((v) => !v)}>{changing ? "Keep this property" : "Change property"}</button>
        <GuideLink product="gsc">Tips</GuideLink>
      </p>
      {changing && <PropertyPicker g={g} host={property} />}
    </>
  );
}

export function Delta({ now, before, invert, days = 28 }: { now: number; before: number; invert?: boolean; days?: number }) {
  const d = change(now, before);
  if (d == null || d === 0) return null;
  const good = invert ? d < 0 : d > 0;
  return <small className={good ? "up" : "down"}>{d > 0 ? "+" : ""}{d}% vs previous {days} days</small>;
}

/** Top searches: one row per search, with its best page (the queries list is per search and page). */
function topSearches(d: GscData): (GscQuery & { pages: number })[] {
  const m = new Map<string, GscQuery & { pages: number; pw: number }>();
  for (const q of d.queries) {
    const x = m.get(q.query);
    if (!x) m.set(q.query, { ...q, pages: 1, pw: q.position * q.impressions });
    else {
      if (q.clicks > x.clicks) x.page = q.page;
      x.clicks += q.clicks;
      x.impressions += q.impressions;
      x.pw += q.position * q.impressions;
      x.pages += 1;
    }
  }
  return [...m.values()].map(({ pw, ...x }) => ({ ...x, ctr: x.impressions ? x.clicks / x.impressions : 0, position: x.impressions ? pw / x.impressions : x.position }));
}

function GscView({ d, scanUrl, findings }: { d: GscData; scanUrl: string; findings: Finding[] }) {
  const days = d.days ?? 28;
  const t = useMemo(() => trafficMap(findings, d, scanUrl, findingKey), [findings, d, scanUrl]);
  const ranked = useMemo(() => byTraffic(findings, t, findingKey).filter((f) => (t.get(findingKey(f))?.impressions ?? 0) > 0), [findings, t]);
  const sd = useMemo(() => strikingDistance(d, 50), [d]);
  const low = useMemo(() => lowCtr(d, 30), [d]);
  const dr = useMemo(() => drops(d, 30), [d]);
  const ni = useMemo(() => notIndexed(d), [d]);
  const searches = useMemo(() => topSearches(d), [d]);
  const issuesOn = useMemo(() => new Map(d.pages.map((p) => [p.url, findingsOn(p.url, findings)])), [d, findings]);
  const T = d.totals;

  const issueCols: Col<Finding>[] = [
    { label: "Issue", get: (f) => f.title, cell: (f) => <FindingLink f={f} />, wrap: true },
    { label: "Area", get: (f) => MODULE_NAMES[f.module] },
    { label: "Clicks", get: (f) => t.get(findingKey(f))?.clicks ?? 0, cell: (f) => <b>{n0(t.get(findingKey(f))?.clicks ?? 0)}</b> },
    { label: "Impressions", get: (f) => t.get(findingKey(f))?.impressions ?? 0, cell: (f) => n0(t.get(findingKey(f))?.impressions ?? 0) },
    { label: "Covers", get: (f) => coverLabel(t.get(findingKey(f))!) },
  ];
  const searchCols: Col<GscQuery & { pages: number }>[] = [
    { label: "Search", get: (q) => q.query, wrap: true },
    { label: "Clicks", get: (q) => q.clicks, cell: (q) => <b>{n0(q.clicks)}</b> },
    { label: "Impressions", get: (q) => q.impressions, cell: (q) => n0(q.impressions) },
    { label: "Click rate", get: (q) => q.ctr, cell: (q) => pct(q.ctr) },
    { label: "Position", get: (q) => +q.position.toFixed(1) },
    { label: "Top page", get: (q) => q.page, cell: (q) => <PageLink url={q.page} /> },
  ];
  const pageCols: Col<GscData["pages"][number]>[] = [
    { label: "Page", get: (p) => p.url, cell: (p) => <PageLink url={p.url} /> },
    { label: "Clicks", get: (p) => p.clicks, cell: (p) => <b>{n0(p.clicks)}</b> },
    { label: "Change", get: (p) => change(p.clicks, p.prevClicks), cell: (p) => { const c = change(p.clicks, p.prevClicks); return c == null ? "new" : `${c > 0 ? "+" : ""}${c}%`; }, cls: (p) => { const c = change(p.clicks, p.prevClicks); return c == null ? undefined : c <= -30 ? "bad" : c >= 30 ? "good" : undefined; } },
    { label: "Impressions", get: (p) => p.impressions, cell: (p) => n0(p.impressions) },
    { label: "Click rate", get: (p) => p.ctr, cell: (p) => pct(p.ctr) },
    { label: "Position", get: (p) => +p.position.toFixed(1) },
    { label: "Issues", get: (p) => issuesOn.get(p.url)?.length ?? 0, cls: (p) => (issuesOn.get(p.url)?.length ? "bad" : undefined) },
  ];

  return (
    <>
      <section className="panel gd-totals" aria-label="Search totals">
        <h2>Google Search, last {days} days</h2>
        <p className="panel-note">{d.range.start} to {d.range.end}, against the {days} days before. Search Console data is final about three days later.</p>
        <ul className="sec-stats">
          <li><b>{n0(T.clicks)}</b><span>clicks</span><Delta now={T.clicks} before={T.prevClicks} days={days} /></li>
          <li><b>{n0(T.impressions)}</b><span>impressions</span><Delta now={T.impressions} before={T.prevImpressions} days={days} /></li>
          <li><b>{pct(T.ctr)}</b><span>click rate</span></li>
          <li><b>{T.position.toFixed(1)}</b><span>average position</span></li>
        </ul>
        {(d.devices?.length || d.countries?.length) ? (
          <div className="gd-splits">
            <SplitBars title="Clicks by device" unit="clicks" rows={(d.devices ?? []).map((x) => ({ key: deviceName(x.key), value: x.clicks }))} />
            <SplitBars title="Clicks by country" unit="clicks" rows={(d.countries ?? []).map((x) => ({ key: countryName(x.key), value: x.clicks }))} />
          </div>
        ) : null}
      </section>

      <section className="panel" aria-label="Issues by Google traffic">
        <h2>Issues ranked by the traffic they touch</h2>
        <p className="panel-note">Clicks and impressions over {days} days on the pages each issue affects. Site-wide issues (security, domain, uptime, privacy) count the whole site. Click an issue to open it.</p>
        <DataTable rows={ranked} cols={issueCols} file={`issues-by-search-traffic-${days}d`} sort={{ col: 2 }} limit={10} rowKey={findingKey} empty={<p className="panel-note">None of this report&rsquo;s open issues are on pages that get Google impressions.</p>} />
      </section>

      <div className="panel-grid">
        <section className="panel" aria-label="Top searches">
          <h2>Top searches</h2>
          <p className="panel-note">What people typed before they found you.</p>
          <DataTable rows={searches} cols={searchCols} file={`top-searches-${days}d`} sort={{ col: 1 }} limit={10} rowKey={(q) => q.query} empty={<p className="panel-note">No searches in this window.</p>} />
        </section>
        <section className="panel" aria-label="Top pages">
          <h2>Top pages</h2>
          <p className="panel-note">Your pages by Google clicks. Click a page for its searches, visits and issues.</p>
          <DataTable rows={d.pages} cols={pageCols} file={`top-pages-${days}d`} sort={{ col: 1 }} limit={10} rowKey={(p) => p.url} empty={<p className="panel-note">No pages with Google impressions in this window.</p>} />
        </section>
      </div>

      <div className="panel-grid">
        <section className="panel" aria-label="Near page one">
          <h2>Near page one</h2>
          <p className="panel-note">Searches where you rank 8 to 20. A better title, more depth or a few internal links can move these onto page one.</p>
          <DataTable
            rows={sd}
            rowKey={(q) => q.query + q.page}
            file={`near-page-one-${days}d`}
            sort={{ col: 2 }}
            limit={10}
            cols={[
              { label: "Search", get: (q) => q.query, wrap: true },
              { label: "Position", get: (q) => +q.position.toFixed(1) },
              { label: "Impressions", get: (q) => q.impressions, cell: (q) => n0(q.impressions) },
              { label: "Page", get: (q) => q.page, cell: (q) => <PageLink url={q.page} /> },
            ]}
            empty={<p className="panel-note">No searches between positions 8 and 20 with at least 20 impressions.</p>}
          />
        </section>

        <section className="panel" aria-label="Low click rate">
          <h2>Seen but not clicked</h2>
          <p className="panel-note">Page-one results with under half the usual click rate for their position (a rough benchmark). Usually the title or description isn&rsquo;t convincing.</p>
          <DataTable
            rows={low}
            rowKey={(p) => p.url}
            file={`low-click-rate-${days}d`}
            limit={10}
            cols={[
              { label: "Page", get: (p) => p.url, cell: (p) => <PageLink url={p.url} /> },
              { label: "Position", get: (p) => +p.position.toFixed(1) },
              { label: "Click rate", get: (p) => p.ctr, cell: (p) => pct(p.ctr), cls: () => "bad" },
              { label: "Typical", get: (p) => p.expected, cell: (p) => `~${pct(p.expected)}` },
            ]}
            empty={<p className="panel-note">No page-one result is far below the usual click rate.</p>}
          />
        </section>
      </div>

      <section className="panel" aria-label="Lost clicks">
        <h2>Pages that lost clicks</h2>
        <p className="panel-note">Down at least 30% on the {days} days before, with the issues this scan found on the same page.</p>
        <DataTable
          rows={dr}
          rowKey={(p) => p.url}
          file={`lost-clicks-${days}d`}
          limit={10}
          cols={[
            { label: "Page", get: (p) => p.url, cell: (p) => <PageLink url={p.url} /> },
            { label: "Before", get: (p) => p.prevClicks, cell: (p) => n0(p.prevClicks) },
            { label: "Now", get: (p) => p.clicks, cell: (p) => n0(p.clicks), cls: () => "bad" },
            { label: "Lost", get: (p) => p.lost, cell: (p) => `−${n0(p.lost)}` },
            { label: "Issues on this page", get: (p) => findingsOn(p.url, findings).map((f) => f.title).join("; "), cell: (p) => <FindingList list={findingsOn(p.url, findings)} />, wrap: true, noSort: true },
          ]}
          empty={<p className="panel-note">No page lost 30% or more of its clicks.</p>}
        />
      </section>

      <section className="panel" aria-label="Indexing check">
        <h2>Indexing check</h2>
        {days !== 28 ? (
          <p className="panel-note">Google&rsquo;s indexing check runs with the 28-day view. Switch to 28 days to see it.</p>
        ) : (
          <>
            <p className="panel-note">Google&rsquo;s own answer for {d.inspections.length === 1 ? "1 key page" : `${d.inspections.length} key pages`}: the homepage, your busiest pages and pages with issues.</p>
            <DataTable
              rows={[...ni, ...d.inspections.filter((i) => i.verdict === "PASS")]}
              rowKey={(i) => i.url}
              file="indexing-check"
              cols={[
                { label: "Page", get: (i) => i.url, cell: (i) => <PageLink url={i.url} /> },
                { label: "Status", get: (i) => (i.verdict === "PASS" ? "Indexed" : i.coverage ?? "Not indexed"), cls: (i) => (i.verdict === "PASS" ? "good" : "bad") },
                { label: "Last crawled", get: (i) => i.lastCrawl?.slice(0, 10) ?? null, cell: (i) => (i.lastCrawl ? new Date(i.lastCrawl).toLocaleDateString("en-GB") : "–") },
                { label: "Google’s canonical", get: (i) => i.googleCanonical, cell: (i) => (i.googleCanonical && i.userCanonical && i.googleCanonical !== i.userCanonical ? <span className="bad" title={i.googleCanonical}>{pathOf(i.googleCanonical)} (not yours)</span> : i.googleCanonical ? "Same as yours" : "–") },
              ]}
              empty={<p className="panel-note">Google didn&rsquo;t return inspection results for these pages.</p>}
            />
          </>
        )}
      </section>
    </>
  );
}

export const coverLabel = (x: Traffic) => (x.scope === "site" ? "whole site" : x.scope === "homepage" ? "homepage" : `${x.pages} page${x.pages === 1 ? "" : "s"}`);

/* Google's "G", in brand colours as the sign-in guidelines ask. */
export function GoogleMark() {
  return (
    <svg className="gd-g" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
