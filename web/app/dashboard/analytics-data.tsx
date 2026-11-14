"use client";

import { useEffect, useMemo, useState } from "react";
import { findingKey } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding } from "@/lib/scan/types";
import { byVisits, channelRows, findingsOnPath, ga4Drops, lowEngagement, rate, visitsMap, type Ga4Data, type Visits } from "@/lib/google/ga4-insights";
import { change } from "@/lib/google/gsc-insights";
import { Delta, GoogleMark, Skeleton, Steps } from "./google-data";
import { DataTable, FindingLink, FindingList, InsightsPanel, PageLink, SplitBars, deviceName, n0, type Col } from "./google-kit";
import type { AiInsights, GoogleState } from "./use-google";

/* The Analytics tab of ★ Google data: Connect Google Analytics, pick the GA4 property, then the AI's insights (on a
   button), the 28-day report, visitors and engagement per issue, and the drop detective (pages that lost visits,
   through which channel, with the issues found on them). */

const p0 = (n: number) => `${Math.round(n * 100)}%`;
const dur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);

const NOTICE: Record<string, { text: string; bad?: boolean }> = {
  connected: { text: "Google Analytics is connected. Pagelyt now reads this site's visitor numbers, refreshed once a day." },
  pick: { text: "Google Analytics is connected. Pick the property for this site below." },
  noproperty: { text: "Google is connected, but this Google account has no Google Analytics 4 properties. Connect the Google account that has the site's Analytics.", bad: true },
  cancelled: { text: "Google Analytics wasn't connected: the consent screen was closed or access was declined.", bad: true },
  scope: { text: "Google Analytics wasn't connected: the Analytics permission was unticked. Connect again and leave it ticked.", bad: true },
  plan: { text: "Google data comes with the Professional and Business plans.", bad: true },
  failed: { text: "Google Analytics couldn't be connected just now. Please try again.", bad: true },
};

type Props = { g: GoogleState; scan: { id: string; url: string; host: string }; findings: Finding[]; notice: string | null };

export function AnalyticsTab({ g, scan, findings, notice }: Props) {
  const s = g.status!;
  const note = notice && NOTICE[notice];
  const head = (
    <>
      {note && <p className={`panel gd-note${note.bad ? " bad" : ""}`} role="status">{note.text}</p>}
      {g.error && <p className="panel gd-note bad" role="alert">{g.error}</p>}
    </>
  );

  if (!s.connected || !s.ga4)
    return (
      <>
        {head}
        <section className="panel gd-connect">
          <h2>Connect Google Analytics</h2>
          <Steps at={0} />
          <p className="panel-note">See how many real visitors each problem in this report reaches, which pages are losing visitors and why, and let AI read your numbers and tell you what to do next.</p>
          <ul className="gd-gets">
            <li><b>Visitors per issue</b> Visits and engagement on the pages each finding affects</li>
            <li><b>Drop detective</b> Pages that lost visitors, the channel that fell and what&rsquo;s wrong on them</li>
            <li><b>28-day report</b> Visits, engagement and channels against the month before, in your PDF too</li>
            <li><b>AI insights</b> Plain-English findings from your Analytics, each with a next step</li>
          </ul>
          <button type="button" className="dash-btn primary gd-btn" onClick={() => void g.connect(scan.id, "ga4")} disabled={g.busy === "connect"}>
            <GoogleMark />{g.busy === "connect" ? "Opening Google…" : s.connected ? "Add Google Analytics access" : "Connect Google Analytics"}
          </button>
          <p className="gd-fine">Read-only: Pagelyt can&rsquo;t change anything in your Google account. Disconnect any time from your account page.</p>
        </section>
      </>
    );

  if (!s.ga4Property) return <>{head}<Ga4Picker g={g} host={scan.host} /></>;

  const c = g.inRange.ga4;
  if (g.inRange.loading || (!c?.data && (g.busy === "refresh" || g.busy === "ga4refresh" || g.busy === "link"))) return <>{head}<Skeleton label="Fetching your Google Analytics numbers…" /></>;
  if (!c?.data)
    return (
      <>
        {head}
        <p className="panel sec-empty">{c?.error ?? "No Google Analytics data yet."}</p>
        <Footer g={g} fetchedAt={undefined} />
      </>
    );

  return (
    <>
      {head}
      {c.error && <p className="panel gd-note bad" role="alert">{c.error} Showing the numbers from {new Date(c.fetchedAt).toLocaleDateString("en-GB")}.</p>}
      <InsightsPanel title="AI insights from your Analytics" source="Analytics" ai={g.ai} busy={g.busy === "analyse"} error={g.aiError} findings={findings} onRun={(force) => void g.analyse(scan.id, force)} />
      <Ga4View d={c.data} findings={findings} />
      <Footer g={g} fetchedAt={c.fetchedAt} />
    </>
  );
}

function Ga4Picker({ g, host }: { g: GoogleState; host: string }) {
  const props = g.status?.ga4Properties;
  const [pick, setPick] = useState("");
  const { loadProps } = g;
  useEffect(() => {
    if (!props) void loadProps("ga4");
  }, [props, loadProps]);
  return (
    <section className="panel">
      <h2>Which Google Analytics property is {host}?</h2>
      <Steps at={1} />
      {!props ? (
        <p className="panel-note">Loading your Analytics properties…</p>
      ) : props.length === 0 ? (
        <p className="panel-note">This Google account ({g.status?.email}) can&rsquo;t see any Google Analytics 4 properties. Ask the site&rsquo;s Analytics admin to add it with Viewer access, or disconnect from your account page and connect the Google account that has it.</p>
      ) : (
        <form className="gd-pick" onSubmit={(e) => { e.preventDefault(); if (pick) void g.link(pick, "ga4"); }}>
          <label>
            <span className="sr-only">Google Analytics property</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)} required>
              <option value="">Choose a property…</option>
              {props.map((p) => <option key={p.property} value={p.property}>{p.name}{p.account ? ` (${p.account})` : ""}</option>)}
            </select>
          </label>
          <button type="submit" className="dash-btn primary" disabled={!pick || g.busy === "link"}>{g.busy === "link" ? "Linking…" : "Use this property"}</button>
        </form>
      )}
    </section>
  );
}

function Footer({ g, fetchedAt }: { g: GoogleState; fetchedAt?: string }) {
  const [changing, setChanging] = useState(false);
  const s = g.status!;
  return (
    <>
      <p className="gd-foot">
        <span>Google Analytics · {s.ga4Name ?? s.ga4Property}{s.email ? ` · ${s.email}` : ""}{fetchedAt ? ` · updated ${new Date(fetchedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
        <button type="button" className="fnd-link" onClick={() => void (g.days === 28 ? g.refresh(true, "ga4") : g.setDays(g.days, true))} disabled={g.busy === "ga4refresh" || g.busy === "range"}>{g.busy === "ga4refresh" || g.busy === "range" ? "Refreshing…" : "Refresh now"}</button>
        <button type="button" className="fnd-link" onClick={() => setChanging((v) => !v)}>{changing ? "Keep this property" : "Change property"}</button>
      </p>
      {changing && <Ga4Picker g={g} host={s.ga4Name ?? "this site"} />}
    </>
  );
}

/** The top AI insights on the Overview, once they exist. */
export function AiOverviewCard({ ai, onOpen }: { ai: AiInsights; onOpen: () => void }) {
  const top = [...ai.insights].sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]).slice(0, 3);
  return (
    <section className="panel gd-ai gd-ai-card" aria-labelledby="gd-ai-card-h">
      <div className="gd-ai-top">
        <h2 id="gd-ai-card-h"><span aria-hidden="true">✦</span> What your Analytics says</h2>
        <button type="button" className="fnd-link" onClick={onOpen}>All insights <span aria-hidden="true">→</span></button>
      </div>
      <ul className="gd-ins gd-ins-mini">
        {top.map((i) => (
          <li key={i.title} className={`p-${i.priority}`}>
            <h3>{i.title}</h3>
            <p className="gd-ins-do"><b>Next step:</b> {i.action}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}


const coverOf = (x: Visits) => (x.scope === "site" ? "whole site" : x.scope === "homepage" ? "homepage" : `${x.pages} page${x.pages === 1 ? "" : "s"}`);
const chg = (c: number | null) => (c == null ? "new" : `${c > 0 ? "+" : ""}${c}%`);
const chgCls = (c: number | null) => (c == null ? undefined : c <= -20 ? "bad" : c >= 20 ? "good" : undefined);

function Ga4View({ d, findings }: { d: Ga4Data; findings: Finding[] }) {
  const days = d.days ?? 28;
  const v = useMemo(() => visitsMap(findings, d, findingKey), [findings, d]);
  const ranked = useMemo(() => byVisits(findings, v, findingKey).filter((f) => (v.get(findingKey(f))?.sessions ?? 0) > 0), [findings, v]);
  const chans = useMemo(() => channelRows(d), [d]);
  const dr = useMemo(() => ga4Drops(d, 30), [d]);
  const low = useMemo(() => lowEngagement(d, 20), [d]);
  const T = d.totals, P = d.prev;
  const visits = (f: Finding) => v.get(findingKey(f))!;

  const issueCols: Col<Finding>[] = [
    { label: "Issue", get: (f) => f.title, cell: (f) => <FindingLink f={f} />, wrap: true },
    { label: "Area", get: (f) => MODULE_NAMES[f.module] },
    { label: "Visits", get: (f) => visits(f).sessions, cell: (f) => <b>{n0(visits(f).sessions)}</b> },
    { label: "Engaged", get: (f) => rate(visits(f).engaged, visits(f).sessions), cell: (f) => p0(rate(visits(f).engaged, visits(f).sessions)), cls: (f) => (rate(visits(f).engaged, visits(f).sessions) < 0.4 ? "bad" : undefined) },
    { label: "Covers", get: (f) => coverOf(visits(f)) },
  ];
  const pageCols: Col<Ga4Data["pages"][number]>[] = [
    { label: "Page", get: (p) => p.path, cell: (p) => <PageLink url={p.path} /> },
    { label: "Visits", get: (p) => p.sessions, cell: (p) => <b>{n0(p.sessions)}</b> },
    { label: "Change", get: (p) => change(p.sessions, p.prevSessions), cell: (p) => chg(change(p.sessions, p.prevSessions)), cls: (p) => chgCls(change(p.sessions, p.prevSessions)) },
    { label: "Engaged", get: (p) => rate(p.engaged, p.sessions), cell: (p) => p0(rate(p.engaged, p.sessions)) },
    { label: "Page views", get: (p) => p.views, cell: (p) => n0(p.views) },
    { label: "Issues", get: (p) => findingsOnPath(p.path, findings).length, cls: (p) => (findingsOnPath(p.path, findings).length ? "bad" : undefined) },
  ];

  return (
    <>
      <section className="panel gd-totals" aria-label={`Visitors, last ${days} days`}>
        <h2>Visitors, last {days} days</h2>
        <p className="panel-note">{d.range.start} to {d.range.end}, against the {days} days before.{d.name ? ` Property: ${d.name}.` : ""}</p>
        <ul className="sec-stats">
          <li><b>{n0(T.sessions)}</b><span>visits</span><Delta now={T.sessions} before={P.sessions} days={days} /></li>
          <li><b>{n0(T.users)}</b><span>visitors ({n0(T.newUsers)} new)</span><Delta now={T.users} before={P.users} days={days} /></li>
          <li><b>{p0(rate(T.engaged, T.sessions))}</b><span>engaged visits (was {p0(rate(P.engaged, P.sessions))})</span></li>
          <li><b>{dur(T.avgDuration)}</b><span>average visit</span><Delta now={T.avgDuration} before={P.avgDuration} days={days} /></li>
          <li><b>{n0(T.views)}</b><span>page views</span><Delta now={T.views} before={P.views} days={days} /></li>
          <li><b>{n0(T.keyEvents)}</b><span>key events</span><Delta now={T.keyEvents} before={P.keyEvents} days={days} /></li>
        </ul>
        {(d.devices?.length || d.countries?.length) ? (
          <div className="gd-splits">
            <SplitBars title="Visits by device" unit="visits" rows={(d.devices ?? []).map((x) => ({ key: deviceName(x.key), value: x.sessions }))} />
            <SplitBars title="Visits by country" unit="visits" rows={(d.countries ?? []).map((x) => ({ key: x.key, value: x.sessions }))} />
          </div>
        ) : null}
        <h3 className="gd-sub">Where visits come from</h3>
        <DataTable
          rows={chans}
          rowKey={(c) => c.channel}
          file={`channels-${days}d`}
          sort={{ col: 1 }}
          limit={8}
          cols={[
            { label: "Channel", get: (c) => c.channel },
            { label: "Visits", get: (c) => c.sessions, cell: (c) => <b>{n0(c.sessions)}</b> },
            { label: "Share", get: (c) => c.share, cell: (c) => p0(c.share) },
            { label: "Change", get: (c) => c.change, cell: (c) => chg(c.change), cls: (c) => chgCls(c.change) },
            { label: "Engaged", get: (c) => c.rate, cell: (c) => p0(c.rate) },
          ]}
        />
      </section>

      <section className="panel" aria-label="Issues by visitors">
        <h2>Issues ranked by the visitors they reach</h2>
        <p className="panel-note">Visits over {days} days on the pages each issue affects, and how many were engaged (10+ seconds, 2+ pages or a key event). Site-wide issues count the whole site. Click an issue to open it.</p>
        <DataTable rows={ranked} cols={issueCols} file={`issues-by-visitors-${days}d`} sort={{ col: 2 }} limit={10} rowKey={findingKey} empty={<p className="panel-note">None of this report&rsquo;s open issues are on pages with Analytics visits.</p>} />
      </section>

      <section className="panel" aria-label="Top pages">
        <h2>Top pages</h2>
        <p className="panel-note">Your busiest pages. Click a page for its searches, visits, ad spend and issues.</p>
        <DataTable rows={d.pages} cols={pageCols} file={`top-pages-visits-${days}d`} sort={{ col: 1 }} limit={10} rowKey={(p) => p.path} empty={<p className="panel-note">No page visits in this window.</p>} />
      </section>

      <section className="panel" aria-label="Drop detective">
        <h2>Drop detective: pages that lost visitors</h2>
        <p className="panel-note">Down at least 30% on the {days} days before, with the channel that lost the most visits and the issues this scan found on the same page.</p>
        <DataTable
          rows={dr}
          rowKey={(p) => p.path}
          file={`lost-visitors-${days}d`}
          limit={10}
          cols={[
            { label: "Page", get: (p) => p.path, cell: (p) => <PageLink url={p.path} /> },
            { label: "Before", get: (p) => p.prevSessions, cell: (p) => n0(p.prevSessions) },
            { label: "Now", get: (p) => p.sessions, cell: (p) => n0(p.sessions), cls: () => "bad" },
            { label: "Lost mostly from", get: (p) => (p.channel ? `${p.channel} (−${n0(p.channelLost)})` : null), cell: (p) => (p.channel ? `${p.channel} (−${n0(p.channelLost)})` : "–") },
            { label: "Issues on this page", get: (p) => findingsOnPath(p.path, findings).map((f) => f.title).join("; "), cell: (p) => <FindingList list={findingsOnPath(p.path, findings)} />, wrap: true, noSort: true },
          ]}
          empty={<p className="panel-note">No page lost 30% or more of its visits.</p>}
        />
      </section>

      {low.length > 0 && (
        <section className="panel" aria-label="Low engagement">
          <h2>Busy pages that don&rsquo;t hold visitors</h2>
          <p className="panel-note">Pages with 50+ visits where far fewer visits are engaged than on the rest of the site ({p0(rate(T.engaged, T.sessions))}).</p>
          <DataTable
            rows={low}
            rowKey={(p) => p.path}
            file={`low-engagement-${days}d`}
            limit={10}
            cols={[
              { label: "Page", get: (p) => p.path, cell: (p) => <PageLink url={p.path} /> },
              { label: "Visits", get: (p) => p.sessions, cell: (p) => n0(p.sessions) },
              { label: "Engaged", get: (p) => p.rate, cell: (p) => p0(p.rate), cls: () => "bad" },
              { label: "Issues on this page", get: (p) => findingsOnPath(p.path, findings).map((f) => f.title).join("; "), cell: (p) => <FindingList list={findingsOnPath(p.path, findings)} />, wrap: true, noSort: true },
            ]}
          />
        </section>
      )}
    </>
  );
}
