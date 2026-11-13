"use client";

import { useEffect, useMemo, useState } from "react";
import { Spark } from "../ui";
import { findingKey } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding, type ModuleKey } from "@/lib/scan/types";
import { gaPath } from "@/lib/google/ga4-insights";
import { campaignRows, cpa, cpc, landingHealth, money, organicValue, paidOrganicOverlap, spendMap, wastedTerms, weakLanding, type AdsData, type Spend } from "@/lib/google/ads-insights";
import type { GscData } from "@/lib/google/gsc-insights";
import { Delta, GoogleMark } from "./google-data";
import type { GoogleState } from "./use-google";

/* The Ads tab of ★ Google data: Connect Google Ads, pick the account (agency manager accounts included), then the AI's
   insights on a button, the 28-day summary, ad spend landing on pages with issues, keywords Google rates below average
   for landing-page experience, searches paid for while already in the top 3 organically, and what the organic clicks
   would cost as ads (the last two need Search Console). Pagelyt only reads Ads; it never changes campaigns. */

const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
const p0 = (n: number) => `${Math.round(n * 100)}%`;
const LPX: Record<string, string> = { BELOW_AVERAGE: "Below average", AVERAGE: "Average", ABOVE_AVERAGE: "Above average" };

const NOTICE: Record<string, { text: string; bad?: boolean }> = {
  connected: { text: "Google Ads is connected. Pagelyt now reads this site's ad numbers, refreshed once a day. It never changes your campaigns." },
  pick: { text: "Google Ads is connected. Pick the account for this site below." },
  noproperty: { text: "Google is connected, but this Google account can't see any Google Ads accounts. Connect the Google account that has access to the site's ads.", bad: true },
  token: { text: "Google Ads is connected, but Pagelyt's Google Ads access is still waiting for Google's approval, so it can't read real accounts yet.", bad: true },
  cancelled: { text: "Google Ads wasn't connected: the consent screen was closed or access was declined.", bad: true },
  scope: { text: "Google Ads wasn't connected: the Google Ads permission was unticked. Connect again and leave it ticked.", bad: true },
  plan: { text: "Google data comes with the Professional and Business plans.", bad: true },
  failed: { text: "Google Ads couldn't be connected just now. Please try again.", bad: true },
};

type Props = { g: GoogleState; scan: { id: string; url: string; host: string }; findings: Finding[]; onOpenArea: (m: ModuleKey) => void; notice: string | null };

export function AdsTab({ g, scan, findings, onOpenArea, notice }: Props) {
  const s = g.status!;
  const note = notice && NOTICE[notice];
  const head = (
    <>
      {note && <p className={`panel gd-note${note.bad ? " bad" : ""}`} role="status">{note.text}</p>}
      {g.error && <p className="panel gd-note bad" role="alert">{g.error}</p>}
    </>
  );

  if (!s.adsOn) return <>{head}<p className="panel sec-empty">Google Ads isn&rsquo;t switched on for Pagelyt yet. Search Console and Analytics work already.</p></>;

  if (!s.connected || !s.ads)
    return (
      <>
        {head}
        <section className="panel gd-connect">
          <h2>Connect Google Ads</h2>
          <p className="panel-note">See how much of your ad spend lands on pages with problems, which searches you pay for while already ranking for free, and let AI read your ads next to this report.</p>
          <ul className="gd-gets">
            <li><b>Landing-page health</b> Spend on pages with issues, and keywords Google rates below average for landing page</li>
            <li><b>Paid vs organic</b> Searches you pay for where you already rank in the top 3 on Google</li>
            <li><b>28-day summary</b> Spend, clicks, conversions and cost per conversion against the month before</li>
            <li><b>Organic traffic value</b> What your free Google clicks would cost as ads, at your own prices</li>
          </ul>
          <button type="button" className="dash-btn primary gd-btn" onClick={() => void g.connect(scan.id, "ads")} disabled={g.busy === "connect"}>
            <GoogleMark />{g.busy === "connect" ? "Opening Google…" : s.connected ? "Add Google Ads access" : "Connect Google Ads"}
          </button>
          <p className="gd-fine">Pagelyt only reads your Google Ads data: it never changes campaigns, budgets or bids. Disconnect any time from your account page.</p>
        </section>
      </>
    );

  if (!s.adsCustomer) return <>{head}<AdsPicker g={g} host={scan.host} /></>;

  const c = s.adsCache;
  if (!c?.data)
    return (
      <>
        {head}
        <p className="panel sec-empty">{g.busy === "refresh" || g.busy === "adsrefresh" || g.busy === "link" ? "Fetching your Google Ads numbers…" : c?.error ?? "No Google Ads data yet."}</p>
        {g.busy !== "adsrefresh" && <Footer g={g} fetchedAt={undefined} />}
      </>
    );

  return (
    <>
      {head}
      {c.error && <p className="panel gd-note bad" role="alert">{c.error} Showing the numbers from {new Date(c.fetchedAt).toLocaleDateString("en-GB")}.</p>}
      <AdsAiPanel g={g} scanId={scan.id} findings={findings} onOpenArea={onOpenArea} />
      <AdsView d={c.data} gsc={g.gsc} homeUrl={scan.url} findings={findings} onOpenArea={onOpenArea} />
      <Footer g={g} fetchedAt={c.fetchedAt} />
    </>
  );
}

function AdsPicker({ g, host }: { g: GoogleState; host: string }) {
  const accounts = g.status?.adsAccounts;
  const [pick, setPick] = useState("");
  const { loadProps } = g;
  useEffect(() => {
    if (!accounts) void loadProps("ads");
  }, [accounts, loadProps]);
  return (
    <section className="panel">
      <h2>Which Google Ads account advertises {host}?</h2>
      {!accounts ? (
        <p className="panel-note">Loading your Google Ads accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="panel-note">This Google account ({g.status?.email}) can&rsquo;t see any Google Ads accounts Pagelyt can read. Ask the account&rsquo;s admin to add it with Read only access, or disconnect from your account page and connect the Google account that has it.</p>
      ) : (
        <form className="gd-pick" onSubmit={(e) => { e.preventDefault(); if (pick) void g.link(pick, "ads"); }}>
          <label>
            <span className="sr-only">Google Ads account</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)} required>
              <option value="">Choose an account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3")}{a.login ? ", via manager" : ""})</option>)}
            </select>
          </label>
          <button type="submit" className="dash-btn primary" disabled={!pick || g.busy === "link"}>{g.busy === "link" ? "Linking…" : "Use this account"}</button>
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
        <span>Google Ads · {s.adsName ?? s.adsCustomer}{s.email ? ` · ${s.email}` : ""}{fetchedAt ? ` · updated ${new Date(fetchedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
        <button type="button" className="fnd-link" onClick={() => void g.refresh(true, "ads")} disabled={g.busy === "adsrefresh"}>{g.busy === "adsrefresh" ? "Refreshing…" : "Refresh now"}</button>
        <button type="button" className="fnd-link" onClick={() => setChanging((v) => !v)}>{changing ? "Keep this account" : "Change account"}</button>
      </p>
      {changing && <AdsPicker g={g} host={s.adsName ?? "this site"} />}
    </>
  );
}

const PRIORITY = { high: "Important", medium: "Worth a look", low: "Minor" } as const;

/** The AI's insights on the Ads numbers, or the button that asks for them. Separate from the Analytics insights. */
function AdsAiPanel({ g, scanId, findings, onOpenArea }: { g: GoogleState; scanId: string; findings: Finding[]; onOpenArea: (m: ModuleKey) => void }) {
  const ai = g.adsAi;
  const busy = g.busy === "adsanalyse";
  const byId = useMemo(() => new Map(findings.map((f) => [f.id, f])), [findings]);
  return (
    <section className="panel gd-ai" aria-label="AI insights on Google Ads" aria-busy={busy}>
      <div className="gd-ai-top">
        <h2><span aria-hidden="true">✦</span> AI insights from your Google Ads</h2>
        {ai && <button type="button" className="dash-btn" onClick={() => void g.analyseAds(scanId, true)} disabled={busy}>{busy ? "Analysing…" : "Analyse again"}</button>}
      </div>
      {!ai ? (
        <>
          <p className="panel-note">AI reads your last 28 days of Google Ads next to this report{g.gsc ? " and your Search Console numbers" : ""} and writes a few plain-English findings, each with a next step. It takes about half a minute.</p>
          <button type="button" className="dash-btn primary" onClick={() => void g.analyseAds(scanId)} disabled={busy}>{busy ? "Analysing your ads…" : "Analyse with AI"}</button>
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
            Written by AI on {new Date(ai.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} from your Google Ads and this report. Check before changing campaigns.
            {!ai.current && " Your Ads numbers have updated since: analyse again for the latest."}
          </p>
        </>
      )}
      {g.adsAiError && <p className="gd-note bad" role="alert">{g.adsAiError}</p>}
    </section>
  );
}

const coverOf = (x: Spend) => (x.scope === "site" ? "whole site" : x.scope === "homepage" ? "homepage" : `${x.pages} page${x.pages === 1 ? "" : "s"}`);

function AdsView({ d, gsc, homeUrl, findings, onOpenArea }: { d: AdsData; gsc: GscData | null; homeUrl: string; findings: Finding[]; onOpenArea: (m: ModuleKey) => void }) {
  const $ = (n: number, digits = 0) => money(n, d.currency, digits);
  const sp = useMemo(() => spendMap(findings, d, homeUrl, findingKey), [findings, d, homeUrl]);
  const ranked = useMemo(() => findings.filter((f) => { const x = sp.get(findingKey(f)); return !!x && x.cost > 0 && x.scope !== "site"; }).sort((a, b) => sp.get(findingKey(b))!.cost - sp.get(findingKey(a))!.cost).slice(0, 10), [findings, sp]);
  const lh = useMemo(() => landingHealth(d, findings), [d, findings]);
  const weak = useMemo(() => weakLanding(d), [d]);
  const camps = useMemo(() => campaignRows(d), [d]);
  const waste = useMemo(() => wastedTerms(d), [d]);
  const ov = useMemo(() => (gsc ? paidOrganicOverlap(d, gsc) : null), [d, gsc]);
  const val = useMemo(() => (gsc ? organicValue(d, gsc) : null), [d, gsc]);
  const T = d.totals, P = d.prev;
  const c = cpa(T), pc = cpa(P);
  return (
    <>
      <section className="panel gd-totals" aria-label="Google Ads, last 28 days">
        <h2>Google Ads, last 28 days</h2>
        <p className="panel-note">{d.range.start} to {d.range.end}, against the 28 days before.{d.name ? ` Account: ${d.name}.` : ""} Amounts in {d.currency}.</p>
        <ul className="sec-stats">
          <li><b>{$(T.cost)}</b><span>spend</span><Delta now={T.cost} before={P.cost} /></li>
          <li><b>{n0(T.clicks)}</b><span>clicks</span><Delta now={T.clicks} before={P.clicks} /></li>
          <li><b>{n0(T.conversions)}</b><span>conversions</span><Delta now={T.conversions} before={P.conversions} /></li>
          <li><b>{c == null ? "–" : $(c, 2)}</b><span>per conversion{pc == null ? "" : ` (was ${$(pc, 2)})`}</span></li>
          <li><b>{cpc(T) == null ? "–" : $(cpc(T)!, 2)}</b><span>per click</span></li>
          <li><b>{n0(T.impressions)}</b><span>impressions</span><Delta now={T.impressions} before={P.impressions} /></li>
        </ul>
        {d.daily.length > 2 && (
          <div className="gd-spark" role="img" aria-label={`Daily ad spend, from ${$(d.daily[0].cost)} to ${$(d.daily[d.daily.length - 1].cost)}`}>
            <Spark data={d.daily.map((x) => x.cost)} color="var(--d-accent)" height={70} />
          </div>
        )}
        {camps.length > 0 && (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Campaign</th><th>Type</th><th>Spend</th><th>Clicks</th><th>Conversions</th><th>Per conversion</th></tr></thead>
              <tbody>
                {camps.slice(0, 10).map((x) => (
                  <tr key={x.name}>
                    <td className="gd-wrap">{x.name}{x.status && x.status !== "ENABLED" ? <em> ({x.status.toLowerCase()})</em> : null}</td>
                    <td>{x.type.replace(/_/g, " ").toLowerCase()}</td>
                    <td><b>{$(x.cost)}</b></td>
                    <td>{n0(x.clicks)}</td>
                    <td>{n0(x.conversions)}</td>
                    <td className={x.cpa != null && c != null && x.cpa > c * 1.5 ? "bad" : ""}>{x.cpa == null ? "–" : $(x.cpa, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-label="Ad landing-page health">
        <h2>Ad spend landing on pages with issues</h2>
        <p className="panel-note">
          {lh.rows.length ? <><b>{$(lh.cost)}</b> ({p0(lh.share)} of your spend) sent people to pages where this scan found problems. Slow, broken or hard-to-use landing pages lower Quality Score, raise your cost per click and lose conversions.</> : "None of the pages your ads land on have issues in this report."}
        </p>
        {lh.rows.length > 0 && (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Landing page</th><th>Spend</th><th>Clicks</th><th>Conversions</th><th>Issues on this page</th></tr></thead>
              <tbody>
                {lh.rows.map((l) => (
                  <tr key={l.url}>
                    <td title={l.url}>{gaPath(l.url)}</td>
                    <td><b>{$(l.cost)}</b></td>
                    <td>{n0(l.clicks)}</td>
                    <td>{n0(l.conversions)}</td>
                    <td className="gd-wrap">
                      {l.issues.slice(0, 3).map((f, i) => <span key={findingKey(f)}>{i ? "; " : ""}<button type="button" className="fnd-link" onClick={() => onOpenArea(f.module)}>{f.title}</button></span>)}
                      {l.issues.length > 3 ? ` +${l.issues.length - 3} more` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ranked.length > 0 && (
          <>
            <h3 className="gd-sub">Issues ranked by the ad spend on their pages</h3>
            <div className="crawl-wrap">
              <table className="crawl gd-t">
                <thead><tr><th>Issue</th><th>Area</th><th>Ad spend</th><th>Ad clicks</th><th>Covers</th></tr></thead>
                <tbody>
                  {ranked.map((f) => {
                    const x = sp.get(findingKey(f))!;
                    return (
                      <tr key={findingKey(f)}>
                        <td className="gd-wrap"><button type="button" className="fnd-link" onClick={() => onOpenArea(f.module)}>{f.title}</button></td>
                        <td>{MODULE_NAMES[f.module]}</td>
                        <td><b>{$(x.cost)}</b></td>
                        <td>{n0(x.clicks)}</td>
                        <td>{coverOf(x)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="panel" aria-label="Keywords with weak landing pages">
        <h2>Keywords Google rates below average for landing page</h2>
        <p className="panel-note">Google&rsquo;s own &ldquo;landing page experience&rdquo; rating, part of Quality Score. A below-average page makes every click on these keywords cost more.</p>
        {weak.length ? (
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Keyword</th><th>Campaign</th><th>Spend</th><th>Quality Score</th><th>Lands on</th></tr></thead>
              <tbody>
                {weak.map((k) => (
                  <tr key={`${k.campaign}|${k.text}|${k.match}`}>
                    <td className="gd-wrap">{k.text} <em>({k.match.toLowerCase()})</em></td>
                    <td className="gd-wrap">{k.campaign}</td>
                    <td><b>{$(k.cost)}</b></td>
                    <td className={k.qs != null && k.qs <= 4 ? "bad" : ""}>{k.qs ?? "–"}/10 · {LPX[k.lpx ?? ""] ?? "–"}</td>
                    <td title={k.url ?? ""}>{k.url ? gaPath(k.url) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="panel-note">No keyword with spend has a below-average landing page rating.</p>}
      </section>

      <section className="panel" aria-label="Paid vs organic">
        <h2>Paid searches where you already rank in the top 3</h2>
        {!gsc ? (
          <p className="panel-note">Connect Search Console on the first tab to compare what you pay for with where you already rank for free.</p>
        ) : ov && ov.rows.length ? (
          <>
            <p className="panel-note"><b>{$(ov.cost)}</b> went on searches where your site is already in Google&rsquo;s top 3 organic results. Some of it may be saved; for your brand name it can still be worth keeping the ad, so competitors don&rsquo;t take the top spot.</p>
            <div className="crawl-wrap">
              <table className="crawl gd-t">
                <thead><tr><th>Search</th><th>Ad spend</th><th>Ad clicks</th><th>Organic position</th><th>Organic clicks</th></tr></thead>
                <tbody>
                  {ov.rows.map((r) => (
                    <tr key={r.term}>
                      <td className="gd-wrap">{r.term}</td>
                      <td><b>{$(r.cost)}</b></td>
                      <td>{n0(r.clicks)}</td>
                      <td className="good">{r.position.toFixed(1)}</td>
                      <td>{n0(r.organicClicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <p className="panel-note">None of the searches you pay for are ones where you already rank in the top 3.</p>}
      </section>

      {gsc && val && (val.rows.length > 0 || val.rough != null) && (
        <section className="panel" aria-label="Organic traffic value">
          <h2>What your free Google traffic is worth</h2>
          <p className="panel-note">
            {val.rows.length > 0 && <>Your organic clicks on searches you also advertise on would have cost <b>{$(val.matched)}</b> as ads ({n0(val.matchedClicks)} clicks at your own cost per click). </>}
            {val.rough != null && <>All {n0(gsc.totals.clicks)} organic clicks at your average cost per click ({$(val.avgCpc!, 2)}) come to roughly <b>{$(val.rough)}</b> a month. This is a rough figure: prices differ a lot between searches.</>}
          </p>
          {val.rows.length > 0 && (
            <div className="crawl-wrap">
              <table className="crawl gd-t">
                <thead><tr><th>Search</th><th>Organic clicks</th><th>Your cost per click</th><th>Worth as ads</th></tr></thead>
                <tbody>
                  {val.rows.map((r) => (
                    <tr key={r.query}>
                      <td className="gd-wrap">{r.query}</td>
                      <td>{n0(r.clicks)}</td>
                      <td>{$(r.cpc, 2)}</td>
                      <td><b>{$(r.value)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {waste.length > 0 && (
        <section className="panel" aria-label="Searches with no conversions">
          <h2>Searches with spend and no conversions</h2>
          <p className="panel-note">Searches people typed that got 5+ clicks and no conversions in 28 days. Check whether they match what you sell; if not, add them as negative keywords.</p>
          <div className="crawl-wrap">
            <table className="crawl gd-t">
              <thead><tr><th>Search</th><th>Spend</th><th>Clicks</th></tr></thead>
              <tbody>
                {waste.map((t) => (
                  <tr key={t.term}>
                    <td className="gd-wrap">{t.term}</td>
                    <td className="bad"><b>{$(t.cost)}</b></td>
                    <td>{n0(t.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
