"use client";

import { useEffect, useMemo, useState } from "react";
import { Spark } from "../ui";
import { findingKey } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding, type ModuleKey } from "@/lib/scan/types";
import { byVisits, channelRows, findingsOnPath, ga4Drops, lowEngagement, rate, visitsMap, type Ga4Data, type Visits } from "@/lib/google/ga4-insights";
import { Delta, GoogleMark } from "./google-data";
import type { AiInsights, GoogleState } from "./use-google";

/* The Analytics tab of ★ Google data: Connect Google Analytics, pick the GA4 property, then the AI's insights (on a
   button), the 28-day report, visitors and engagement per issue, and the drop detective (pages that lost visits,
   through which channel, with the issues found on them). */

const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
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

type Props = { g: GoogleState; scan: { id: string; url: string; host: string }; findings: Finding[]; onOpenArea: (m: ModuleKey) => void; notice: string | null };

export function AnalyticsTab({ g, scan, findings, onOpenArea, notice }: Props) {
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

  const c = s.ga4Cache;
  if (!c?.data)
    return (
      <>
        {head}
        <p className="panel sec-empty">{g.busy === "refresh" || g.busy === "ga4refresh" || g.busy === "link" ? "Fetching your Google Analytics numbers…" : c?.error ?? "No Google Analytics data yet."}</p>
        {g.busy !== "ga4refresh" && <Footer g={g} fetchedAt={undefined} />}
      </>
    );

  return (
    <>
      {head}
      {c.error && <p className="panel gd-note bad" role="alert">{c.error} Showing the numbers from {new Date(c.fetchedAt).toLocaleDateString("en-GB")}.</p>}
      <AiPanel g={g} scanId={scan.id} findings={findings} onOpenArea={onOpenArea} />
      <Ga4View d={c.data} findings={findings} onOpenArea={onOpenArea} />
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
        <button type="button" className="fnd-link" onClick={() => void g.refresh(true, "ga4")} disabled={g.busy === "ga4refresh"}>{g.busy === "ga4refresh" ? "Refreshing…" : "Refresh now"}</button>
        <button type="button" className="fnd-link" onClick={() => setChanging((v) => !v)}>{changing ? "Keep this property" : "Change property"}</button>
      </p>
      {changing && <Ga4Picker g={g} host={s.ga4Name ?? "this site"} />}
    </>
  );
}

const PRIORITY = { high: "Important", medium: "Worth a look", low: "Minor" } as const;

/** The AI's insights, or the button that asks for them. */
function AiPanel({ g, scanId, findings, onOpenArea }: { g: GoogleState; scanId: string; findings: Finding[]; onOpenArea: (m: ModuleKey) => void }) {
  const ai = g.ai;
  const busy = g.busy === "analyse";
  const byId = useMemo(() => new Map(findings.map((f) => [f.id, f])), [findings]);
  return (
    <section className="panel gd-ai" aria-label="AI insights" aria-busy={busy}>
      <div className="gd-ai-top">
        <h2><span aria-hidden="true">✦</span> AI insights from your Analytics</h2>
        {ai && (
          <button type="button" className="dash-btn" onClick={() => void g.analyse(scanId, true)} disabled={busy}>{busy ? "Analysing…" : "Analyse again"}</button>
        )}
      </div>
      {!ai ? (
        <>
          <p className="panel-note">AI reads your last 28 days of Analytics next to this report and writes a few plain-English findings, each with a next step. It takes about half a minute.</p>
          <button type="button" className="dash-btn primary" onClick={() => void g.analyse(scanId)} disabled={busy}>{busy ? "Analysing your numbers…" : "Analyse with AI"}</button>
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
                    {i.pages.map((p) => <code key={p}>{p}</code>)}
                    {i.findings.map((id) => {
                      const f = byId.get(id);
                      return f ? <button key={id} type="button" className="fnd-link" onClick={() => onOpenArea(f.module)}>{f.title}</button> : null;
                    })}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="gd-fine">
            Written by AI on {new Date(ai.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} from your Analytics and this report. Check before acting.
            {!ai.current && " Your Analytics numbers have updated since: analyse again for the latest."}
          </p>
        </>
      )}
      {g.aiError && <p className="gd-note bad" role="alert">{g.aiError}</p>}
    </section>
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

function Ga4View({ d, findings, onOpenArea }: { d: Ga4Data; findings: Finding[]; onOpenArea: (m: ModuleKey) => void }) {
  const v = useMemo(() => visitsMap(findings, d, findingKey), [findings, d]);
  const ranked = useMemo(() => byVisits(findings, v, findingKey).filter((f) => (v.get(findingKey(f))?.sessions ?? 0) > 0).slice(0, 10), [findings, v]);
  const chans = useMemo(() => channelRows(d), [d]);
  const dr = useMemo(() => ga4Drops(d), [d]);
  const low = useMemo(() => lowEngagement(d), [d]);
  const T = d.totals, P = d.prev;
  return (
    <>
      <section className="panel gd-totals" aria-label="Visitors, last 28 days">
        <h2>Visitors, last 28 days</h2>
        <p className="panel-note">{d.range.start} to {d.range.end}, against the 28 days before.{d.name ? ` Property: ${d.name}.` : ""}</p>
        <ul className="sec-stats">
          <li><b>{n0(T.sessions)}</b><span>visits</span><Delta now={T.sessions} before={P.sessions} /></li>
          <li><b>{n0(T.users)}</b><span>visitors ({n0(T.newUsers)} new)</span><Delta now={T.users} before={P.users} /></li>
          <li><b>{p0(rate(T.engaged, T.sessions))}</b><span>engaged visits (was {p0(rate(P.engaged, P.sessions))})</span></li>
          <li><b>{dur(T.avgDuration)}</b><span>average visit</span><Delta now={T.avgDuration} before={P.avgDuration} /></li>
          <li><b>{n0(T.views)}</b><span>page views</span><Delta now={T.views} before={P.views} /></li>
          <li><b>{n0(T.keyEvents)}</b><span>key events</span><Delta now={T.keyEvents} before={P.keyEvents} /></li>
        </ul>
        {d.daily.length > 2 && (
          <div className="gd-spark" role="img" aria-label={`Daily visits, from ${n0(d.daily[0].sessions)} to ${n0(d.daily[d.daily.length - 1].sessions)}`}>
            <Spark data={d.daily.map((x) => x.sessions)} color="var(--d-accent)" height={70} />
          </div>
        )}
        {chans.length > 0 && (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Channel</th><th>Visits</th><th>Share</th><th>Change</th><th>Engaged</th></tr></thead>
              <tbody>
                {chans.slice(0, 8).map((c) => (
                  <tr key={c.channel}>
                    <td>{c.channel}</td>
                    <td><b>{n0(c.sessions)}</b></td>
                    <td>{p0(c.share)}</td>
                    <td className={c.change == null ? "" : c.change <= -20 ? "bad" : c.change >= 20 ? "good" : ""}>{c.change == null ? "new" : `${c.change > 0 ? "+" : ""}${c.change}%`}</td>
                    <td>{p0(c.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-label="Issues by visitors">
        <h2>Issues ranked by the visitors they reach</h2>
        <p className="panel-note">Visits over 28 days on the pages each issue affects, and how many of them were engaged (10+ seconds, 2+ pages or a key event). Site-wide issues count the whole site.</p>
        {ranked.length ? (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Issue</th><th>Area</th><th>Visits</th><th>Engaged</th><th>Covers</th></tr></thead>
              <tbody>
                {ranked.map((f) => {
                  const x = v.get(findingKey(f))!;
                  const r = rate(x.engaged, x.sessions);
                  return (
                    <tr key={findingKey(f)}>
                      <td className="gd-wrap"><button type="button" className="fnd-link" onClick={() => onOpenArea(f.module)}>{f.title}</button></td>
                      <td>{MODULE_NAMES[f.module]}</td>
                      <td><b>{n0(x.sessions)}</b></td>
                      <td className={r < 0.4 ? "bad" : ""}>{p0(r)}</td>
                      <td>{coverOf(x)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="panel-note">None of this report&rsquo;s open issues are on pages with Analytics visits.</p>}
      </section>

      <section className="panel" aria-label="Drop detective">
        <h2>Drop detective: pages that lost visitors</h2>
        <p className="panel-note">Down at least 30% on the 28 days before, with the channel that lost the most visits and the issues this scan found on the same page.</p>
        {dr.length ? (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Page</th><th>Before</th><th>Now</th><th>Lost mostly from</th><th>Issues on this page</th></tr></thead>
              <tbody>
                {dr.map((p) => {
                  const on = findingsOnPath(p.path, findings);
                  return (
                    <tr key={p.path}>
                      <td title={p.path}>{p.path}</td>
                      <td>{n0(p.prevSessions)}</td>
                      <td className="bad">{n0(p.sessions)}</td>
                      <td>{p.channel ? `${p.channel} (−${n0(p.channelLost)})` : "–"}</td>
                      <td className="gd-wrap">{on.length ? on.slice(0, 3).map((f) => f.title).join("; ") + (on.length > 3 ? ` +${on.length - 3} more` : "") : <em>None found by this scan</em>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="panel-note">No page lost 30% or more of its visits.</p>}
      </section>

      {low.length > 0 && (
        <section className="panel" aria-label="Low engagement">
          <h2>Busy pages that don&rsquo;t hold visitors</h2>
          <p className="panel-note">Pages with 50+ visits where far fewer visits are engaged than on the rest of the site ({p0(rate(T.engaged, T.sessions))}).</p>
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Page</th><th>Visits</th><th>Engaged</th><th>Issues on this page</th></tr></thead>
              <tbody>
                {low.map((p) => {
                  const on = findingsOnPath(p.path, findings);
                  return (
                    <tr key={p.path}>
                      <td title={p.path}>{p.path}</td>
                      <td>{n0(p.sessions)}</td>
                      <td className="bad">{p0(p.rate)}</td>
                      <td className="gd-wrap">{on.length ? on.slice(0, 3).map((f) => f.title).join("; ") : <em>None found by this scan</em>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
