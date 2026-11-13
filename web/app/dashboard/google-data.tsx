"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spark } from "../ui";
import { findingKey } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding, type ModuleKey } from "@/lib/scan/types";
import { byTraffic, change, drops, findingsOn, lowCtr, notIndexed, strikingDistance, trafficMap, type GscData, type Traffic } from "@/lib/google/gsc-insights";
import type { GoogleState } from "./use-google";
import { AnalyticsTab } from "./analytics-data";

/* The ★ Google data view, in two tabs. Search Console: Connect Google, pick the property, then real search numbers
   for this site joined to this report's findings. Analytics: see analytics-data.tsx. Only the owner sees it. */

const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
const pathOf = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search || "/";
  } catch {
    return u;
  }
};
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

export type GoogleTab = "gsc" | "ga4";

/** `tab`: kept by the dashboard (from ?gtab=analytics on arrival), so the Overview's AI card can open Analytics. */
export function GoogleData({ g, scan, siteId, findings, onSave, onOpenArea, tab, onTab }: { g: GoogleState; scan: { id: string; url: string; host: string }; siteId: string | null; findings: Finding[]; onSave: () => void; onOpenArea: (m: ModuleKey) => void; tab: GoogleTab; onTab: (t: GoogleTab) => void }) {
  const params = useSearchParams();
  const [notice] = useState(() => params.get("google"));
  const setTab = onTab;
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
  if (!s) return error ? <p className="panel gd-note bad" role="alert">{error}</p> : <p className="panel sec-empty">Loading your Google connection…</p>;
  if (!s.configured) return <p className="panel sec-empty">Google isn&rsquo;t set up on this server yet (see DEPLOY.md, Google integrations).</p>;
  if (!s.allowed) return <p className="panel sec-empty">Google data comes with the Professional and Business plans.</p>;

  const gaNotice = notice?.startsWith("ga4") ? notice.slice(3) : null;
  return (
    <>
      <div className="gd-tabs" role="tablist" aria-label="Google data">
        <button type="button" role="tab" aria-selected={tab === "gsc"} className={tab === "gsc" ? "on" : ""} onClick={() => setTab("gsc")}>Search Console</button>
        <button type="button" role="tab" aria-selected={tab === "ga4"} className={tab === "ga4" ? "on" : ""} onClick={() => setTab("ga4")}>Analytics</button>
      </div>
      {tab === "gsc" ? (
        <GscTab g={g} scan={scan} findings={findings} onOpenArea={onOpenArea} notice={gaNotice ? null : notice} />
      ) : (
        <AnalyticsTab g={g} scan={scan} findings={findings} onOpenArea={onOpenArea} notice={gaNotice} />
      )}
    </>
  );
}

function GscTab({ g, scan, findings, onOpenArea, notice }: { g: GoogleState; scan: { id: string; url: string; host: string }; findings: Finding[]; onOpenArea: (m: ModuleKey) => void; notice: string | null }) {
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
          <p className="panel-note">See how many real searchers each problem in this report affects, which searches are close to page one and which pages Google hasn&rsquo;t indexed.</p>
          <ul className="gd-gets">
            <li><b>Clicks at stake</b> On every finding, so you fix what costs traffic first</li>
            <li><b>Near page one</b> Searches where you rank 8 to 20</li>
            <li><b>Lost clicks</b> Pages that dropped, next to what&rsquo;s wrong on them</li>
            <li><b>Indexing check</b> Whether Google has indexed your key pages</li>
          </ul>
          <button type="button" className="dash-btn primary gd-btn" onClick={() => void g.connect(scan.id)} disabled={busy === "connect"}>
            <GoogleMark />{busy === "connect" ? "Opening Google…" : s.connected ? "Add Search Console access" : "Connect Google"}
          </button>
          <p className="gd-fine">Read-only: Pagelyt can&rsquo;t change anything in your Google account. Disconnect any time from your account page.</p>
        </section>
      </>
    );

  if (!s.property) return <>{head}<PropertyPicker g={g} host={scan.host} /></>;

  const c = s.cache;
  if (!c?.data)
    return (
      <>
        {head}
        <p className="panel sec-empty">{busy === "refresh" ? "Fetching your Search Console numbers…" : c?.error ?? "No Search Console data yet."}</p>
        {busy !== "refresh" && <Footer g={g} property={s.property} />}
      </>
    );

  return (
    <>
      {head}
      {c.error && <p className="panel gd-note bad" role="alert">{c.error} Showing the numbers from {new Date(c.fetchedAt).toLocaleDateString("en-GB")}.</p>}
      <GscView d={c.data} scanUrl={scan.url} findings={findings} onOpenArea={onOpenArea} />
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
      {!props ? (
        <p className="panel-note">Loading your properties…</p>
      ) : props.length === 0 ? (
        <p className="panel-note">This Google account ({g.status?.email}) can&rsquo;t see any Search Console properties. Add {host} in Search Console first, or disconnect from your account page and connect the Google account that has it.</p>
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
  return (
    <>
      <p className="gd-foot">
        <span>Search Console · {propLabel(property)}{g.status?.email ? ` · ${g.status.email}` : ""}{fetchedAt ? ` · updated ${new Date(fetchedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
        <button type="button" className="fnd-link" onClick={() => void g.refresh(true)} disabled={g.busy === "refresh"}>{g.busy === "refresh" ? "Refreshing…" : "Refresh now"}</button>
        <button type="button" className="fnd-link" onClick={() => setChanging((v) => !v)}>{changing ? "Keep this property" : "Change property"}</button>
      </p>
      {changing && <PropertyPicker g={g} host={property} />}
    </>
  );
}

export function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  const d = change(now, before);
  if (d == null || d === 0) return null;
  const good = invert ? d < 0 : d > 0;
  return <small className={good ? "up" : "down"}>{d > 0 ? "+" : ""}{d}% vs previous 28 days</small>;
}

function GscView({ d, scanUrl, findings, onOpenArea }: { d: GscData; scanUrl: string; findings: Finding[]; onOpenArea: (m: ModuleKey) => void }) {
  const t = useMemo(() => trafficMap(findings, d, scanUrl, findingKey), [findings, d, scanUrl]);
  const ranked = useMemo(() => byTraffic(findings, t, findingKey).filter((f) => (t.get(findingKey(f))?.impressions ?? 0) > 0).slice(0, 10), [findings, t]);
  const sd = useMemo(() => strikingDistance(d), [d]);
  const low = useMemo(() => lowCtr(d), [d]);
  const dr = useMemo(() => drops(d), [d]);
  const ni = useMemo(() => notIndexed(d), [d]);
  const T = d.totals;
  return (
    <>
      <section className="panel gd-totals" aria-label="Search totals">
        <h2>Google Search, last 28 days</h2>
        <p className="panel-note">{d.range.start} to {d.range.end}. Search Console data is final about three days later.</p>
        <ul className="sec-stats">
          <li><b>{n0(T.clicks)}</b><span>clicks</span><Delta now={T.clicks} before={T.prevClicks} /></li>
          <li><b>{n0(T.impressions)}</b><span>impressions</span><Delta now={T.impressions} before={T.prevImpressions} /></li>
          <li><b>{pct(T.ctr)}</b><span>click rate</span></li>
          <li><b>{T.position.toFixed(1)}</b><span>average position</span></li>
        </ul>
        {d.daily.length > 2 && (
          <div className="gd-spark" role="img" aria-label={`Daily clicks, from ${n0(d.daily[0].clicks)} to ${n0(d.daily[d.daily.length - 1].clicks)}`}>
            <Spark data={d.daily.map((x) => x.clicks)} color="var(--d-accent)" height={70} />
          </div>
        )}
      </section>

      <section className="panel" aria-label="Issues by Google traffic">
        <h2>Issues ranked by the traffic they touch</h2>
        <p className="panel-note">Clicks and impressions over 28 days on the pages each issue affects. Site-wide issues (security, domain, uptime, privacy) count the whole site.</p>
        {ranked.length ? (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Issue</th><th>Area</th><th>Clicks</th><th>Impressions</th><th>Covers</th></tr></thead>
              <tbody>
                {ranked.map((f) => {
                  const x = t.get(findingKey(f))!;
                  return (
                    <tr key={findingKey(f)}>
                      <td className="gd-wrap"><button type="button" className="fnd-link" onClick={() => onOpenArea(f.module)}>{f.title}</button></td>
                      <td>{MODULE_NAMES[f.module]}</td>
                      <td><b>{n0(x.clicks)}</b></td>
                      <td>{n0(x.impressions)}</td>
                      <td>{coverLabel(x)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel-note">None of this report&rsquo;s open issues are on pages that get Google impressions.</p>
        )}
      </section>

      <div className="panel-grid">
        <section className="panel" aria-label="Near page one">
          <h2>Near page one</h2>
          <p className="panel-note">Searches where you rank 8 to 20. A better title, more depth or a few internal links can move these onto page one.</p>
          {sd.length ? (
            <div className="crawl-wrap">
              <table className="crawl gd-t">
                <thead><tr><th>Search</th><th>Position</th><th>Impressions</th><th>Page</th></tr></thead>
                <tbody>{sd.map((q) => <tr key={q.query + q.page}><td title={q.query}>{q.query}</td><td>{q.position.toFixed(1)}</td><td>{n0(q.impressions)}</td><td title={q.page}>{pathOf(q.page)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="panel-note">No searches between positions 8 and 20 with at least 20 impressions.</p>}
        </section>

        <section className="panel" aria-label="Low click rate">
          <h2>Seen but not clicked</h2>
          <p className="panel-note">Page-one results with under half the usual click rate for their position (a rough benchmark). Usually the title or description isn&rsquo;t convincing.</p>
          {low.length ? (
            <div className="crawl-wrap">
              <table className="crawl gd-t">
                <thead><tr><th>Page</th><th>Position</th><th>Click rate</th><th>Typical</th></tr></thead>
                <tbody>{low.map((p) => <tr key={p.url}><td title={p.url}>{pathOf(p.url)}</td><td>{p.position.toFixed(1)}</td><td className="bad">{pct(p.ctr)}</td><td>~{pct(p.expected)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="panel-note">No page-one result is far below the usual click rate.</p>}
        </section>
      </div>

      <section className="panel" aria-label="Lost clicks">
        <h2>Pages that lost clicks</h2>
        <p className="panel-note">Down at least 30% on the 28 days before, with the issues this scan found on the same page.</p>
        {dr.length ? (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Page</th><th>Before</th><th>Now</th><th>Issues on this page</th></tr></thead>
              <tbody>
                {dr.map((p) => {
                  const on = findingsOn(p.url, findings);
                  return (
                    <tr key={p.url}>
                      <td title={p.url}>{pathOf(p.url)}</td>
                      <td>{n0(p.prevClicks)}</td>
                      <td className="bad">{n0(p.clicks)}</td>
                      <td className="gd-wrap">{on.length ? on.slice(0, 3).map((f) => f.title).join("; ") + (on.length > 3 ? ` +${on.length - 3} more` : "") : <em>None found by this scan</em>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="panel-note">No page lost 30% or more of its clicks.</p>}
      </section>

      <section className="panel" aria-label="Indexing check">
        <h2>Indexing check</h2>
        <p className="panel-note">Google&rsquo;s own answer for {d.inspections.length === 1 ? "1 key page" : `${d.inspections.length} key pages`}: the homepage, your busiest pages and pages with issues.</p>
        {d.inspections.length ? (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Page</th><th>Status</th><th>Last crawled</th><th>Google&rsquo;s canonical</th></tr></thead>
              <tbody>
                {[...ni, ...d.inspections.filter((i) => i.verdict === "PASS")].map((i) => (
                  <tr key={i.url}>
                    <td title={i.url}>{pathOf(i.url)}</td>
                    <td className={i.verdict === "PASS" ? "good" : "bad"}>{i.verdict === "PASS" ? "Indexed" : i.coverage ?? "Not indexed"}</td>
                    <td>{i.lastCrawl ? new Date(i.lastCrawl).toLocaleDateString("en-GB") : "–"}</td>
                    <td title={i.googleCanonical ?? ""}>{i.googleCanonical && i.userCanonical && i.googleCanonical !== i.userCanonical ? <span className="bad">{pathOf(i.googleCanonical)} (not yours)</span> : i.googleCanonical ? "Same as yours" : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="panel-note">Google didn&rsquo;t return inspection results for these pages.</p>}
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
