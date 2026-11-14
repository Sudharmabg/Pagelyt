"use client";

import { useEffect, useMemo, useState } from "react";
import { findingKey } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding } from "@/lib/scan/types";
import { campaignRows, cpa, cpc, findingsOnUrl, landingHealth, money, organicValue, paidOrganicOverlap, spendMap, wastedTerms, weakLanding, type AdsData, type Spend } from "@/lib/google/ads-insights";
import type { GscData } from "@/lib/google/gsc-insights";
import { Delta, GoogleMark, Skeleton, Steps } from "./google-data";
import { DataTable, FindingLink, FindingList, InsightsPanel, PageLink, n0, type Col, GuideLink } from "./google-kit";
import type { GoogleState } from "./use-google";

/* The Ads tab of ★ Google data: Connect Google Ads, pick the account (agency manager accounts included), then the AI's
   insights on a button, the 28-day summary, ad spend landing on pages with issues, keywords Google rates below average
   for landing-page experience, searches paid for while already in the top 3 organically, and what the organic clicks
   would cost as ads (the last two need Search Console). Pagelyt only reads Ads; it never changes campaigns. */

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

type Props = { g: GoogleState; scan: { id: string; url: string; host: string }; findings: Finding[]; notice: string | null };

export function AdsTab({ g, scan, findings, notice }: Props) {
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
          <Steps at={0} />
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
          <p className="gd-fine">New to Google Ads? <GuideLink product="ads">Read our setup guide</GuideLink></p>
        </section>
      </>
    );

  if (!s.adsCustomer) return <>{head}<AdsPicker g={g} host={scan.host} /></>;

  const c = g.inRange.ads;
  if (g.inRange.loading || (!c?.data && (g.busy === "refresh" || g.busy === "adsrefresh" || g.busy === "link"))) return <>{head}<Skeleton label="Fetching your Google Ads numbers…" /></>;
  if (!c?.data)
    return (
      <>
        {head}
        <p className="panel sec-empty">{c?.error ?? "No Google Ads data yet."}</p>
        <Footer g={g} fetchedAt={undefined} />
      </>
    );

  return (
    <>
      {head}
      {c.error && <p className="panel gd-note bad" role="alert">{c.error} Showing the numbers from {new Date(c.fetchedAt).toLocaleDateString("en-GB")}.</p>}
      <InsightsPanel title="AI insights from your Google Ads" source="Google Ads" ai={g.adsAi} busy={g.busy === "adsanalyse"} error={g.adsAiError} findings={findings} onRun={(force) => void g.analyseAds(scan.id, force)} />
      <AdsView d={c.data} gsc={g.inRange.gsc?.data ?? (g.days === 28 ? g.gsc : null)} homeUrl={scan.url} findings={findings} />
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
      <Steps at={1} />
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
        <button type="button" className="fnd-link" onClick={() => void (g.days === 28 ? g.refresh(true, "ads") : g.setDays(g.days, true))} disabled={g.busy === "adsrefresh" || g.busy === "range"}>{g.busy === "adsrefresh" || g.busy === "range" ? "Refreshing…" : "Refresh now"}</button>
        <button type="button" className="fnd-link" onClick={() => setChanging((v) => !v)}>{changing ? "Keep this account" : "Change account"}</button>
        <GuideLink product="ads">Tips</GuideLink>
      </p>
      {changing && <AdsPicker g={g} host={s.adsName ?? "this site"} />}
    </>
  );
}

const coverOf = (x: Spend) => (x.scope === "site" ? "whole site" : x.scope === "homepage" ? "homepage" : `${x.pages} page${x.pages === 1 ? "" : "s"}`);

function AdsView({ d, gsc, homeUrl, findings }: { d: AdsData; gsc: GscData | null; homeUrl: string; findings: Finding[] }) {
  const days = d.days ?? 28;
  const $ = (n: number, digits = 0) => money(n, d.currency, digits);
  const sp = useMemo(() => spendMap(findings, d, homeUrl, findingKey), [findings, d, homeUrl]);
  const ranked = useMemo(() => findings.filter((f) => { const x = sp.get(findingKey(f)); return !!x && x.cost > 0 && x.scope !== "site"; }), [findings, sp]);
  const lh = useMemo(() => landingHealth(d, findings, 50), [d, findings]);
  const weak = useMemo(() => weakLanding(d, 50), [d]);
  const camps = useMemo(() => campaignRows(d), [d]);
  const waste = useMemo(() => wastedTerms(d, 30), [d]);
  const ov = useMemo(() => (gsc ? paidOrganicOverlap(d, gsc, 30) : null), [d, gsc]);
  const val = useMemo(() => (gsc ? organicValue(d, gsc, 30) : null), [d, gsc]);
  const T = d.totals, P = d.prev;
  const c = cpa(T), pc = cpa(P);
  const spend = (f: Finding) => sp.get(findingKey(f))!;

  const issueCols: Col<Finding>[] = [
    { label: "Issue", get: (f) => f.title, cell: (f) => <FindingLink f={f} />, wrap: true },
    { label: "Area", get: (f) => MODULE_NAMES[f.module] },
    { label: "Ad spend", get: (f) => +spend(f).cost.toFixed(2), cell: (f) => <b>{$(spend(f).cost)}</b> },
    { label: "Ad clicks", get: (f) => spend(f).clicks, cell: (f) => n0(spend(f).clicks) },
    { label: "Covers", get: (f) => coverOf(spend(f)) },
  ];
  const landingCols: Col<AdsData["landing"][number]>[] = [
    { label: "Landing page", get: (l) => l.url, cell: (l) => <PageLink url={l.url} /> },
    { label: "Spend", get: (l) => +l.cost.toFixed(2), cell: (l) => <b>{$(l.cost)}</b> },
    { label: "Clicks", get: (l) => l.clicks, cell: (l) => n0(l.clicks) },
    { label: "Conversions", get: (l) => +l.conversions.toFixed(1), cell: (l) => n0(l.conversions) },
    { label: "Issues on this page", get: (l) => findingsOnUrl(l.url, findings).map((f) => f.title).join("; "), cell: (l) => <FindingList list={findingsOnUrl(l.url, findings)} />, wrap: true, noSort: true },
  ];

  return (
    <>
      <section className="panel gd-totals" aria-label={`Google Ads, last ${days} days`}>
        <h2>Google Ads, last {days} days</h2>
        <p className="panel-note">{d.range.start} to {d.range.end}, against the {days} days before.{d.name ? ` Account: ${d.name}.` : ""} Amounts in {d.currency}.</p>
        <ul className="sec-stats">
          <li><b>{$(T.cost)}</b><span>spend</span><Delta now={T.cost} before={P.cost} days={days} /></li>
          <li><b>{n0(T.clicks)}</b><span>clicks</span><Delta now={T.clicks} before={P.clicks} days={days} /></li>
          <li><b>{n0(T.conversions)}</b><span>conversions</span><Delta now={T.conversions} before={P.conversions} days={days} /></li>
          <li><b>{c == null ? "–" : $(c, 2)}</b><span>per conversion{pc == null ? "" : ` (was ${$(pc, 2)})`}</span></li>
          <li><b>{cpc(T) == null ? "–" : $(cpc(T)!, 2)}</b><span>per click</span></li>
          <li><b>{n0(T.impressions)}</b><span>impressions</span><Delta now={T.impressions} before={P.impressions} days={days} /></li>
        </ul>
        <h3 className="gd-sub">Campaigns</h3>
        <DataTable
          rows={camps}
          rowKey={(x) => x.name}
          file={`campaigns-${days}d`}
          sort={{ col: 2 }}
          limit={10}
          cols={[
            { label: "Campaign", get: (x) => x.name, cell: (x) => <>{x.name}{x.status && x.status !== "ENABLED" ? <em> ({x.status.toLowerCase()})</em> : null}</>, wrap: true },
            { label: "Type", get: (x) => x.type.replace(/_/g, " ").toLowerCase() },
            { label: "Spend", get: (x) => +x.cost.toFixed(2), cell: (x) => <b>{$(x.cost)}</b> },
            { label: "Clicks", get: (x) => x.clicks, cell: (x) => n0(x.clicks) },
            { label: "Conversions", get: (x) => +x.conversions.toFixed(1), cell: (x) => n0(x.conversions) },
            { label: "Per conversion", get: (x) => (x.cpa == null ? null : +x.cpa.toFixed(2)), cell: (x) => (x.cpa == null ? "–" : $(x.cpa, 2)), cls: (x) => (x.cpa != null && c != null && x.cpa > c * 1.5 ? "bad" : undefined) },
          ]}
        />
      </section>

      <section className="panel" aria-label="Ad landing-page health">
        <h2>Ad spend landing on pages with issues</h2>
        <p className="panel-note">
          {lh.rows.length ? <><b>{$(lh.cost)}</b> ({p0(lh.share)} of your spend) sent people to pages where this scan found problems. Slow, broken or hard-to-use landing pages lower Quality Score, raise your cost per click and lose conversions.</> : "None of the pages your ads land on have issues in this report."}
        </p>
        <DataTable rows={lh.rows} cols={landingCols} file={`ad-landing-pages-with-issues-${days}d`} sort={{ col: 1 }} limit={10} rowKey={(l) => l.url} />
        {ranked.length > 0 && (
          <>
            <h3 className="gd-sub">Issues ranked by the ad spend on their pages</h3>
            <DataTable rows={ranked} cols={issueCols} file={`issues-by-ad-spend-${days}d`} sort={{ col: 2 }} limit={10} rowKey={findingKey} />
          </>
        )}
      </section>

      <section className="panel" aria-label="Keywords with weak landing pages">
        <h2>Keywords Google rates below average for landing page</h2>
        <p className="panel-note">Google&rsquo;s own &ldquo;landing page experience&rdquo; rating, part of Quality Score. A below-average page makes every click on these keywords cost more.</p>
        <DataTable
          rows={weak}
          rowKey={(k) => `${k.campaign}|${k.text}|${k.match}`}
          file={`weak-landing-keywords-${days}d`}
          limit={10}
          cols={[
            { label: "Keyword", get: (k) => k.text, cell: (k) => <>{k.text} <em>({k.match.toLowerCase()})</em></>, wrap: true },
            { label: "Campaign", get: (k) => k.campaign, wrap: true },
            { label: "Spend", get: (k) => +k.cost.toFixed(2), cell: (k) => <b>{$(k.cost)}</b> },
            { label: "Quality Score", get: (k) => k.qs, cell: (k) => `${k.qs ?? "–"}/10 · ${LPX[k.lpx ?? ""] ?? "–"}`, cls: (k) => (k.qs != null && k.qs <= 4 ? "bad" : undefined) },
            { label: "Lands on", get: (k) => k.url, cell: (k) => (k.url ? <PageLink url={k.url} /> : "–") },
          ]}
          empty={<p className="panel-note">No keyword with spend has a below-average landing page rating.</p>}
        />
      </section>

      <section className="panel" aria-label="Paid vs organic">
        <h2>Paid searches where you already rank in the top 3</h2>
        {!gsc ? (
          <p className="panel-note">Connect Search Console to compare what you pay for with where you already rank for free.</p>
        ) : ov && ov.rows.length ? (
          <>
            <p className="panel-note"><b>{$(ov.cost)}</b> went on searches where your site is already in Google&rsquo;s top 3 organic results. Some of it may be saved; for your brand name it can still be worth keeping the ad, so competitors don&rsquo;t take the top spot.</p>
            <DataTable
              rows={ov.rows}
              rowKey={(r) => r.term}
              file={`paid-vs-organic-${days}d`}
              cols={[
                { label: "Search", get: (r) => r.term, wrap: true },
                { label: "Ad spend", get: (r) => +r.cost.toFixed(2), cell: (r) => <b>{$(r.cost)}</b> },
                { label: "Ad clicks", get: (r) => r.clicks, cell: (r) => n0(r.clicks) },
                { label: "Organic position", get: (r) => +r.position.toFixed(1), cls: () => "good" },
                { label: "Organic clicks", get: (r) => r.organicClicks, cell: (r) => n0(r.organicClicks) },
              ]}
            />
          </>
        ) : <p className="panel-note">None of the searches you pay for are ones where you already rank in the top 3.</p>}
      </section>

      {gsc && val && (val.rows.length > 0 || val.rough != null) && (
        <section className="panel" aria-label="Organic traffic value">
          <h2>What your free Google traffic is worth</h2>
          <p className="panel-note">
            {val.rows.length > 0 && <>Your organic clicks on searches you also advertise on would have cost <b>{$(val.matched)}</b> as ads ({n0(val.matchedClicks)} clicks at your own cost per click). </>}
            {val.rough != null && <>All {n0(gsc.totals.clicks)} organic clicks over {days} days at your average cost per click ({$(val.avgCpc!, 2)}) come to roughly <b>{$(val.rough)}</b>. This is a rough figure: prices differ a lot between searches.</>}
          </p>
          <DataTable
            rows={val.rows}
            rowKey={(r) => r.query}
            file={`organic-value-${days}d`}
            cols={[
              { label: "Search", get: (r) => r.query, wrap: true },
              { label: "Organic clicks", get: (r) => r.clicks, cell: (r) => n0(r.clicks) },
              { label: "Your cost per click", get: (r) => +r.cpc.toFixed(2), cell: (r) => $(r.cpc, 2) },
              { label: "Worth as ads", get: (r) => +r.value.toFixed(2), cell: (r) => <b>{$(r.value)}</b> },
            ]}
          />
        </section>
      )}

      {waste.length > 0 && (
        <section className="panel" aria-label="Searches with no conversions">
          <h2>Searches with spend and no conversions</h2>
          <p className="panel-note">Searches people typed that got 5+ clicks and no conversions in {days} days. Check whether they match what you sell; if not, add them as negative keywords.</p>
          <DataTable
            rows={waste}
            rowKey={(t) => t.term}
            file={`no-conversion-searches-${days}d`}
            cols={[
              { label: "Search", get: (t) => t.term, wrap: true },
              { label: "Spend", get: (t) => +t.cost.toFixed(2), cell: (t) => <b>{$(t.cost)}</b>, cls: () => "bad" },
              { label: "Clicks", get: (t) => t.clicks, cell: (t) => n0(t.clicks) },
            ]}
          />
        </section>
      )}
    </>
  );
}
