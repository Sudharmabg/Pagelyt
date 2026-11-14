/* Google Ads data as Pagelyt caches it, and the pure calculations on top of it: ad spend on the pages each finding
   affects, landing pages with issues, keywords Google rates below average for landing-page experience, searches paid
   for while already ranking in the top 3 (with Search Console), what the organic clicks would cost as ads, and the
   28-day summary. Client-safe (no secrets, no fetch), so the dashboard, the print page and the assistant use the same
   numbers. Money is in the account's currency, in whole units (Google's micros already divided). */

import type { Finding } from "../scan/types";
import { change, SITEWIDE, type GscData } from "./gsc-insights";
import { gaPath } from "./ga4-insights";

export type AdsTotals = { cost: number; clicks: number; impressions: number; conversions: number; value: number };
export type AdsCampaign = AdsTotals & { name: string; status: string; type: string };
export type AdsLanding = { url: string; cost: number; clicks: number; conversions: number };
/** `lpx`: Google's landing-page experience rating for the keyword ("BELOW_AVERAGE", "AVERAGE", "ABOVE_AVERAGE"). */
export type AdsKeyword = { text: string; match: string; campaign: string; qs: number | null; lpx: string | null; url: string | null; cost: number; clicks: number; conversions: number };
export type AdsTerm = { term: string; cost: number; clicks: number; impressions: number; conversions: number };
export type AdsData = {
  customer: string;
  /** Length of the window in days (7, 28 or 90). Older caches have none: 28. */
  days?: number;
  name: string | null;
  currency: string;
  range: { start: string; end: string };
  prevRange: { start: string; end: string };
  totals: AdsTotals;
  prev: AdsTotals;
  daily: { date: string; cost: number; clicks: number }[];
  campaigns: AdsCampaign[];
  landing: AdsLanding[];
  keywords: AdsKeyword[];
  terms: AdsTerm[];
};

/** One written insight from the AI analysis of the Ads numbers. `pages` are landing-page paths, `findings` finding ids. */
export type AdsInsight = { title: string; detail: string; action: string; priority: "high" | "medium" | "low"; pages: string[]; findings: string[] };
export type AdsAi = { insights: AdsInsight[]; basedOn: string; model: string };

export const ZERO: AdsTotals = { cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 };

/** Cost per conversion, or null with no conversions. */
export const cpa = (t: { cost: number; conversions: number }) => (t.conversions > 0 ? t.cost / t.conversions : null);
export const cpc = (t: { cost: number; clicks: number }) => (t.clicks > 0 ? t.cost / t.clicks : null);

export function money(n: number, currency: string, digits = 0): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  } catch {
    return `${n.toFixed(digits)} ${currency}`;
  }
}

/** The same page in an ad's final URL and in the report: host without "www." plus the path (no query, so tracking
    parameters don't split a page). */
export function lpKey(u: string): string {
  try {
    const x = new URL(u);
    return `${x.hostname.toLowerCase().replace(/^www\./, "")}${gaPath(x.pathname)}`;
  } catch {
    return gaPath(u);
  }
}

export function landingIndex(d: AdsData): Map<string, AdsLanding> {
  const m = new Map<string, AdsLanding>();
  for (const l of d.landing) {
    const k = lpKey(l.url);
    const had = m.get(k);
    m.set(k, had ? { ...had, cost: had.cost + l.cost, clicks: had.clicks + l.clicks, conversions: had.conversions + l.conversions } : { ...l });
  }
  return m;
}

export type Spend = { cost: number; clicks: number; scope: "pages" | "homepage" | "site"; pages: number };

/** Ad spend sending people to the pages a finding affects over the last 28 days: its listed pages, otherwise all
    spend for site-wide areas, otherwise the homepage. Same rule as Google clicks and visits per finding. */
export function spendFor(f: Finding, d: AdsData, homeUrl: string, idx = landingIndex(d)): Spend {
  if (f.pages?.rows.length) {
    let cost = 0, clicks = 0, pages = 0;
    for (const k of new Set(f.pages.rows.map((r) => lpKey(r.url)))) {
      const l = idx.get(k);
      if (l) {
        cost += l.cost;
        clicks += l.clicks;
        pages++;
      }
    }
    return { cost, clicks, scope: "pages", pages };
  }
  if (SITEWIDE.has(f.module)) return { cost: d.totals.cost, clicks: d.totals.clicks, scope: "site", pages: 0 };
  const h = idx.get(lpKey(homeUrl));
  return { cost: h?.cost ?? 0, clicks: h?.clicks ?? 0, scope: "homepage", pages: h ? 1 : 0 };
}

/** Ad spend per finding with the currency, for the badge on findings. */
export type AdSpend = Spend & { currency: string };

export function spendMap(findings: Finding[], d: AdsData, homeUrl: string, key: (f: Finding) => string): Map<string, Spend> {
  const idx = landingIndex(d);
  return new Map(findings.map((f) => [key(f), spendFor(f, d, homeUrl, idx)]));
}

/** Findings that list this landing page. */
export function findingsOnUrl(url: string, findings: Finding[]): Finding[] {
  const k = lpKey(url);
  return findings.filter((f) => f.pages?.rows.some((r) => lpKey(r.url) === k));
}

export type LandingIssue = AdsLanding & { issues: Finding[] };

/** Landing pages that get ad clicks and have issues in the report, most spend first, plus their total spend. */
export function landingHealth(d: AdsData, findings: Finding[], max = 10): { rows: LandingIssue[]; cost: number; share: number } {
  const all = [...landingIndex(d).values()].map((l) => ({ ...l, issues: findingsOnUrl(l.url, findings) })).filter((l) => l.issues.length && l.cost > 0);
  const cost = all.reduce((a, l) => a + l.cost, 0);
  return { rows: all.sort((a, b) => b.cost - a.cost).slice(0, max), cost, share: d.totals.cost ? cost / d.totals.cost : 0 };
}

/** Keywords with spend whose landing-page experience Google rates below average, most spend first. */
export function weakLanding(d: AdsData, max = 10): AdsKeyword[] {
  return d.keywords.filter((k) => k.lpx === "BELOW_AVERAGE" && k.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, max);
}

const norm = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim();

type Organic = { clicks: number; impressions: number; position: number };
/** Search Console queries by text: clicks added up, best (lowest) position across pages. */
function organicIndex(g: GscData): Map<string, Organic> {
  const m = new Map<string, Organic>();
  for (const q of g.queries) {
    const k = norm(q.query);
    const had = m.get(k);
    m.set(k, had ? { clicks: had.clicks + q.clicks, impressions: had.impressions + q.impressions, position: Math.min(had.position, q.position) } : { clicks: q.clicks, impressions: q.impressions, position: q.position });
  }
  return m;
}

export type Overlap = AdsTerm & { position: number; organicClicks: number };

/** Searches the account paid for while the site already ranks in the top 3 for them on Google: spend that may be
    saved (or that protects the result from competitors' ads, which the owner should judge). */
export function paidOrganicOverlap(d: AdsData, g: GscData, max = 10): { rows: Overlap[]; cost: number } {
  const org = organicIndex(g);
  const rows = d.terms
    .map((t) => ({ t, o: org.get(norm(t.term)) }))
    .filter((x): x is { t: AdsTerm; o: Organic } => !!x.o && x.o.position <= 3 && x.t.cost > 0)
    .map(({ t, o }) => ({ ...t, position: o.position, organicClicks: o.clicks }))
    .sort((a, b) => b.cost - a.cost);
  return { rows: rows.slice(0, max), cost: rows.reduce((a, r) => a + r.cost, 0) };
}

export type ValueRow = { query: string; clicks: number; cpc: number; value: number };

/** What the site's organic Google clicks would cost as ads: queries the account also buys, at its own cost per click
    for them (exact), and all organic clicks at the account's average cost per click (rough, labelled as such). */
export function organicValue(d: AdsData, g: GscData, max = 10): { rows: ValueRow[]; matched: number; matchedClicks: number; avgCpc: number | null; rough: number | null } {
  const price = new Map<string, number>();
  for (const t of [...d.terms, ...d.keywords.map((k) => ({ term: k.text, cost: k.cost, clicks: k.clicks }))]) {
    const k = norm(t.term);
    if (t.clicks > 0 && !price.has(k)) price.set(k, t.cost / t.clicks);
  }
  const rows = [...organicIndex(g)]
    .filter(([q, o]) => price.has(q) && o.clicks > 0)
    .map(([q, o]) => ({ query: q, clicks: o.clicks, cpc: price.get(q)!, value: o.clicks * price.get(q)! }))
    .sort((a, b) => b.value - a.value);
  const avg = cpc(d.totals);
  return {
    rows: rows.slice(0, max),
    matched: rows.reduce((a, r) => a + r.value, 0),
    matchedClicks: rows.reduce((a, r) => a + r.clicks, 0),
    avgCpc: avg,
    rough: avg == null ? null : g.totals.clicks * avg,
  };
}

export type CampaignRow = AdsCampaign & { share: number; cpa: number | null };
export function campaignRows(d: AdsData): CampaignRow[] {
  const total = d.totals.cost || 1;
  return [...d.campaigns].sort((a, b) => b.cost - a.cost).map((c) => ({ ...c, share: c.cost / total, cpa: cpa(c) }));
}

/** Searches with real spend and no conversions, most spend first. */
export function wastedTerms(d: AdsData, max = 8): AdsTerm[] {
  const avg = cpc(d.totals) ?? 0;
  return d.terms.filter((t) => t.conversions === 0 && t.clicks >= 5 && t.cost >= Math.max(1, avg * 5)).sort((a, b) => b.cost - a.cost).slice(0, max);
}

const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
const ch = (now: number, before: number) => {
  const c = change(now, before);
  return c == null ? "" : ` (${c > 0 ? "+" : ""}${c}% vs the 28 days before)`;
};

/** Google Ads in a few lines, for the assistant's instructions and the AI analysis. */
export function adsBrief(d: AdsData, findings: Finding[], homeUrl: string, key: (f: Finding) => string, gsc?: GscData | null, ai?: AdsAi | null): string {
  const T = d.totals, P = d.prev, $ = (n: number) => money(n, d.currency);
  const out: string[] = [];
  const c = cpa(T), pc = cpa(P);
  out.push(`Google Ads (${d.name ?? d.customer}, ${d.currency}), ${d.range.start} to ${d.range.end}: spend ${$(T.cost)}${ch(T.cost, P.cost)}, ${n0(T.clicks)} clicks${ch(T.clicks, P.clicks)}, ${n0(T.impressions)} impressions, ${n0(T.conversions)} conversions${ch(T.conversions, P.conversions)}, cost per conversion ${c == null ? "n/a" : $(c)}${pc == null ? "" : ` (was ${$(pc)})`}, average cost per click ${cpc(T) == null ? "n/a" : money(cpc(T)!, d.currency, 2)}.`);
  const cs = campaignRows(d).slice(0, 6);
  if (cs.length) out.push(`Campaigns: ${cs.map((x) => `${x.name} (${x.type.toLowerCase()}) ${$(x.cost)}, ${n0(x.clicks)} clicks, ${n0(x.conversions)} conversions${x.cpa == null ? "" : `, ${$(x.cpa)} each`}`).join("; ")}.`);
  const lh = landingHealth(d, findings, 6);
  if (lh.rows.length) out.push(`Ad spend on landing pages with report issues: ${$(lh.cost)} (${Math.round(lh.share * 100)}% of spend). ${lh.rows.map((l) => `${gaPath(l.url)} ${$(l.cost)}, ${n0(l.clicks)} clicks, issues: ${l.issues.slice(0, 3).map((f) => f.id).join(", ")}`).join("; ")}.`);
  const sp = spendMap(findings, d, homeUrl, key);
  const top = findings.filter((f) => (sp.get(key(f))?.cost ?? 0) > 0 && sp.get(key(f))!.scope !== "site").sort((a, b) => sp.get(key(b))!.cost - sp.get(key(a))!.cost).slice(0, 6);
  if (top.length) out.push(`Ad spend on the pages each open issue affects (28 days): ${top.map((f) => `[${f.id}] ${$(sp.get(key(f))!.cost)}`).join("; ")}.`);
  const wl = weakLanding(d, 5);
  if (wl.length) out.push(`Keywords Google rates below average for landing-page experience: ${wl.map((k) => `"${k.text}" ${$(k.cost)}${k.qs ? `, Quality Score ${k.qs}` : ""}${k.url ? `, lands on ${gaPath(k.url)}` : ""}`).join("; ")}.`);
  const w = wastedTerms(d, 5);
  if (w.length) out.push(`Searches with spend and no conversions: ${w.map((t) => `"${t.term}" ${$(t.cost)}, ${n0(t.clicks)} clicks`).join("; ")}.`);
  if (gsc) {
    const ov = paidOrganicOverlap(d, gsc, 5);
    if (ov.rows.length) out.push(`Paid searches where the site already ranks in the top 3 organically: ${$(ov.cost)} in total; ${ov.rows.map((r) => `"${r.term}" ${$(r.cost)} paid, organic position ${r.position.toFixed(1)}, ${n0(r.organicClicks)} organic clicks`).join("; ")}.`);
    const v = organicValue(d, gsc, 5);
    if (v.rows.length || v.rough != null) out.push(`Organic Google clicks priced as ads: ${$(v.matched)} for ${n0(v.matchedClicks)} clicks on searches the account also buys${v.rough != null ? `; all ${n0(gsc.totals.clicks)} organic clicks at the average cost per click would be about ${$(v.rough)} (rough)` : ""}.`);
  }
  if (ai?.insights.length) out.push(`AI insights on Ads already shown to the owner: ${ai.insights.map((i) => i.title).join("; ")}.`);
  return out.join("\n");
}
