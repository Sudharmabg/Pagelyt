/* Server only. The combined AI analysis: Search Console, Analytics and Google Ads read together (whichever of them are
   connected, two or more), next to this report's open issues. Its heart is the PAGE JOURNEY table, which joins each
   page's search clicks, visits, engaged share and ad spend on the same path, so the model can follow a page from Google
   Search to the visit to the conversion and to the ad money behind it. Same insight format as the single-product
   analyses (metric, now, gain, steps), plus `sources`. Runs only when the owner asks for it in the AI insights modal;
   cached for 24 hours as 'all_ai'. */

import { reportBrief } from "../ai/chat-knowledge";
import type { ScanResult } from "../scan/types";
import { adsLandingTable } from "./ads-ai";
import { adsBrief, landingIndex, money, type AdsData } from "./ads-insights";
import { askJson, cleanList, FORMAT, ga4PagesTable, schemaFor } from "./ga4-ai";
import { findingsOnPath, ga4Brief, ga4Index, gaPath, rate, type Ga4Ai, type Ga4Data, type Ga4Insight } from "./ga4-insights";
import { gscPagesTable, gscSplits } from "./gsc-ai";
import { gscBrief, type GscData } from "./gsc-insights";

export type AllAi = Ga4Ai & { products: ("gsc" | "ga4" | "ads")[] };
export type AllInput = { gsc?: { data: GscData; at: string } | null; ga4?: { data: Ga4Data; at: string } | null; ads?: { data: AdsData; at: string } | null };

/** Which data the combined insights were made from: each connected product's fetch time. */
export function allBasis(i: AllInput): string {
  return (["gsc", "ga4", "ads"] as const).map((k) => (i[k] ? `${k}:${i[k]!.at}` : "")).filter(Boolean).join("|");
}
export const productsIn = (i: AllInput) => (["gsc", "ga4", "ads"] as const).filter((k) => !!i[k]);

const RULES = `You are Pagelyt's growth analyst. You read a website's Google Search Console, Google Analytics and Google Ads numbers for the last 28 days together (whichever are given), next to its Pagelyt website report, and write insights that help the owner grow the metrics that matter: clicks from Google, visits, engagement, conversions, and conversions per pound of ad spend.

${FORMAT("PAGE JOURNEY", true)}

Your edge over a single-product report is joining the products. Look for: pages that win search clicks but whose visits are poorly engaged or never convert; ad spend landing on pages with weak engagement or report issues; searches paid for while the page already gets organic clicks; pages losing search clicks and visits together, and the issues on them; channels or devices that behave differently across search, visits and ads; the one or two pages where a fix would lift several metrics at once. At least half of the insights should use two or more products.`;

/** One row per page path across the connected products, busiest first. */
export function journeyTable(i: AllInput, res: ScanResult): string {
  type Row = { path: string; clicks?: number; prevClicks?: number; pos?: number; visits?: number; prevVisits?: number; engaged?: number; spend?: number; adClicks?: number; conv?: number };
  const rows = new Map<string, Row>();
  const at = (path: string) => rows.get(path) ?? (rows.set(path, { path }), rows.get(path)!);
  for (const p of i.gsc?.data.pages ?? []) {
    const r = at(gaPath(p.url));
    r.clicks = (r.clicks ?? 0) + p.clicks;
    r.prevClicks = (r.prevClicks ?? 0) + p.prevClicks;
    r.pos = p.position;
  }
  if (i.ga4) for (const p of ga4Index(i.ga4.data).values()) Object.assign(at(p.path), { visits: p.sessions, prevVisits: p.prevSessions, engaged: rate(p.engaged, p.sessions) });
  if (i.ads) for (const l of landingIndex(i.ads.data).values()) Object.assign(at(gaPath(l.url)), { spend: l.cost, adClicks: l.clicks, conv: l.conversions });
  const cur = i.ads?.data.currency ?? "USD";
  const weight = (r: Row) => (r.clicks ?? 0) + (r.prevClicks ?? 0) / 2 + (r.visits ?? 0) + (r.adClicks ?? 0);
  return [...rows.values()]
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, 35)
    .map((r) => {
      const parts = [r.path];
      if (i.gsc) parts.push(r.clicks == null ? "search –" : `search clicks ${r.clicks} (before ${r.prevClicks}), position ${r.pos?.toFixed(1)}`);
      if (i.ga4) parts.push(r.visits == null ? "visits –" : `visits ${r.visits} (before ${r.prevVisits}), engaged ${Math.round((r.engaged ?? 0) * 100)}%`);
      if (i.ads) parts.push(r.spend == null ? "ads –" : `ad spend ${money(r.spend, cur)}, ad clicks ${r.adClicks}, ad conversions ${Math.round((r.conv ?? 0) * 10) / 10}`);
      const on = findingsOnPath(r.path, res.findings).slice(0, 5).map((f) => f.id);
      if (on.length) parts.push(`issues ${on.join(", ")}`);
      return parts.join(" | ");
    })
    .join("\n");
}

/** `res` carries only the open findings (the caller drops the ones marked as fixed). */
export function allPrompt(i: AllInput, res: ScanResult): string {
  const key = (f: { id: string }) => f.id;
  return [
    `REPORT\n${reportBrief(res)}`,
    `PAGE JOURNEY (path | Google Search clicks last 28 days (28 days before) and average position | visits (before) and engaged share | ad spend, ad clicks and conversions | report issues on the page; "–" means no numbers for that page)\n${journeyTable(i, res)}`,
    i.gsc && `SEARCH CONSOLE SUMMARY\n${gscBrief(i.gsc.data, res.findings, res.url, key)}\n${gscSplits(i.gsc.data)}`,
    i.gsc && `SEARCH PAGES (path | clicks (before) | impressions | position | issues)\n${gscPagesTable(i.gsc.data, res)}`,
    i.ga4 && `ANALYTICS SUMMARY\n${ga4Brief(i.ga4.data, res.findings, key)}`,
    i.ga4 && `ANALYTICS PAGES (path | visits (before) | engaged share | page views | issues)\n${ga4PagesTable(i.ga4.data, res)}`,
    i.ads && `GOOGLE ADS SUMMARY\n${adsBrief(i.ads.data, res.findings, res.url, key, i.gsc?.data ?? null)}`,
    i.ads && `LANDING PAGES (path | ad spend | clicks | conversions | issues)\n${adsLandingTable(i.ads.data, res)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Every page path the combined insights may point at. */
export function allPaths(i: AllInput): Set<string> {
  const out = new Set<string>();
  for (const p of i.gsc?.data.pages ?? []) out.add(gaPath(p.url));
  if (i.ga4) for (const k of ga4Index(i.ga4.data).keys()) out.add(k);
  if (i.ads) for (const l of landingIndex(i.ads.data).values()) out.add(gaPath(l.url));
  return out;
}

export function cleanAllInsights(raw: unknown, i: AllInput, res: ScanResult): Ga4Insight[] {
  return cleanList(raw, allPaths(i), new Set(res.findings.map((f) => f.id)));
}

export async function analyseAll(i: AllInput, res: ScanResult): Promise<AllAi> {
  const { json, model } = await askJson(RULES, allPrompt(i, res), "growth_insights", schemaFor(true));
  const insights = cleanAllInsights(json, i, res);
  if (!insights.length) throw new Error("No usable insights in the answer");
  return { insights, basedOn: allBasis(i), model, products: [...productsIn(i)] };
}
