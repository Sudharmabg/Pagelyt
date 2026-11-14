"use client";

import { useEffect, useMemo, useRef } from "react";
import { findingsOn, pageKey } from "@/lib/google/gsc-insights";
import { gaPath, rate } from "@/lib/google/ga4-insights";
import { lpKey, money } from "@/lib/google/ads-insights";
import { MODULE_NAMES, type Finding } from "@/lib/scan/types";
import type { GoogleState } from "./use-google";
import { FindingLink, n0, pct } from "./google-kit";

/* The side panel for one page, opened from any page link in ★ Google data: its Google searches, Analytics visits and
   channels, ad spend, and the issues this scan found on it, all for the date window on screen. */

export function PageDrill({ page, g, scan, findings, onClose }: { page: string; g: GoogleState; scan: { url: string }; findings: Finding[]; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const url = useMemo(() => {
    try {
      return new URL(page, scan.url).href;
    } catch {
      return page;
    }
  }, [page, scan.url]);
  const path = gaPath(url);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus?.();
    };
  }, [onClose]);

  const gsc = g.inRange.gsc?.data ?? null;
  const ga4 = g.inRange.ga4?.data ?? null;
  const ads = g.inRange.ads?.data ?? null;
  const days = g.days;

  const k = pageKey(url);
  const sc = gsc?.pages.filter((p) => pageKey(p.url) === k) ?? [];
  const scT = sc.reduce((a, p) => ({ clicks: a.clicks + p.clicks, impressions: a.impressions + p.impressions, prev: a.prev + p.prevClicks, pos: a.pos + p.position * p.impressions }), { clicks: 0, impressions: 0, prev: 0, pos: 0 });
  const queries = (gsc?.queries.filter((q) => pageKey(q.page) === k) ?? []).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 8);
  const ga = ga4?.pages.filter((p) => gaPath(p.path) === path) ?? [];
  const gaT = ga.reduce((a, p) => ({ sessions: a.sessions + p.sessions, engaged: a.engaged + p.engaged, views: a.views + p.views, prev: a.prev + p.prevSessions }), { sessions: 0, engaged: 0, views: 0, prev: 0 });
  const chans = (ga4?.pageChannels.filter((c) => gaPath(c.path) === path) ?? []).sort((a, b) => b.sessions - a.sessions).slice(0, 5);
  const lk = lpKey(url);
  const land = ads?.landing.filter((l) => lpKey(l.url) === lk) ?? [];
  const adT = land.reduce((a, l) => ({ cost: a.cost + l.cost, clicks: a.clicks + l.clicks, conv: a.conv + l.conversions }), { cost: 0, clicks: 0, conv: 0 });
  const issues = findingsOn(url, findings);

  return (
    <div className="gd-drawer-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="gd-drawer" role="dialog" aria-modal="true" aria-labelledby="gd-drawer-h">
        <header>
          <div>
            <p className="gd-drawer-k">Page · last {days} days</p>
            <h2 id="gd-drawer-h">{path}</h2>
            <a href={url} target="_blank" rel="noopener noreferrer" className="fnd-link">Open the page <span aria-hidden="true">↗</span></a>
          </div>
          <button ref={close} type="button" className="gd-drawer-x" onClick={onClose} aria-label="Close">×</button>
        </header>

        <section>
          <h3>Google Search</h3>
          {!gsc ? <p className="panel-note">Connect Search Console to see this page&rsquo;s searches.</p> : !sc.length ? <p className="panel-note">No Google impressions for this page in this window.</p> : (
            <>
              <ul className="gd-dstats">
                <li><b>{n0(scT.clicks)}</b><span>clicks{scT.prev ? ` (was ${n0(scT.prev)})` : ""}</span></li>
                <li><b>{n0(scT.impressions)}</b><span>impressions</span></li>
                <li><b>{pct(scT.impressions ? scT.clicks / scT.impressions : 0)}</b><span>click rate</span></li>
                <li><b>{scT.impressions ? (scT.pos / scT.impressions).toFixed(1) : "–"}</b><span>position</span></li>
              </ul>
              {queries.length > 0 && (
                <table className="crawl gd-t gd-dt">
                  <thead><tr><th scope="col">Top searches</th><th scope="col">Clicks</th><th scope="col">Position</th></tr></thead>
                  <tbody>{queries.map((q) => <tr key={q.query}><td className="gd-wrap">{q.query}</td><td>{n0(q.clicks)}</td><td>{q.position.toFixed(1)}</td></tr>)}</tbody>
                </table>
              )}
            </>
          )}
        </section>

        <section>
          <h3>Visitors</h3>
          {!ga4 ? <p className="panel-note">Connect Google Analytics to see this page&rsquo;s visits.</p> : !ga.length ? <p className="panel-note">No Analytics visits to this page in this window.</p> : (
            <>
              <ul className="gd-dstats">
                <li><b>{n0(gaT.sessions)}</b><span>visits{gaT.prev ? ` (was ${n0(gaT.prev)})` : ""}</span></li>
                <li><b>{Math.round(rate(gaT.engaged, gaT.sessions) * 100)}%</b><span>engaged</span></li>
                <li><b>{n0(gaT.views)}</b><span>page views</span></li>
              </ul>
              {chans.length > 0 && (
                <table className="crawl gd-t gd-dt">
                  <thead><tr><th scope="col">Channel</th><th scope="col">Visits</th><th scope="col">Before</th></tr></thead>
                  <tbody>{chans.map((c) => <tr key={c.channel}><td>{c.channel}</td><td>{n0(c.sessions)}</td><td>{n0(c.prevSessions)}</td></tr>)}</tbody>
                </table>
              )}
            </>
          )}
        </section>

        {ads && (
          <section>
            <h3>Google Ads</h3>
            {!land.length ? <p className="panel-note">No ads land on this page in this window.</p> : (
              <ul className="gd-dstats">
                <li><b>{money(adT.cost, ads.currency)}</b><span>ad spend</span></li>
                <li><b>{n0(adT.clicks)}</b><span>ad clicks</span></li>
                <li><b>{n0(adT.conv)}</b><span>conversions</span></li>
              </ul>
            )}
          </section>
        )}

        <section>
          <h3>Issues on this page ({issues.length})</h3>
          {!issues.length ? <p className="panel-note">This scan found no page-level issues here. Site-wide issues still apply.</p> : (
            <ul className="gd-dissues">
              {issues.map((f) => (
                <li key={f.id} className={`sev-${f.severity}`}>
                  <FindingLink f={f} />
                  <small>{MODULE_NAMES[f.module]} · {f.severity}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
