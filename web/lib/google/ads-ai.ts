/* Server only. The AI analysis of a site's Google Ads: the model reads the 28-day Ads numbers (campaigns, landing
   pages, keywords with Google's landing-page rating, search terms), the Search Console summary when connected (for
   paid vs organic) and this report's open issues, and writes 3 to 6 insights, each with one action. Structured JSON
   (strict schema), checked again here so only real landing pages and issue ids come back. Runs only when the owner
   presses "Analyse with AI" on the Ads tab; cached for 24 hours, separately from the Analytics insights. */

import { reportBrief } from "../ai/chat-knowledge";
import type { ScanResult } from "../scan/types";
import { adsBrief, findingsOnUrl, landingIndex, money, type AdsAi, type AdsData, type AdsInsight } from "./ads-insights";
import { askJson, SCHEMA } from "./ga4-ai";
import { gaPath } from "./ga4-insights";
import type { GscData } from "./gsc-insights";

const RULES = `You are Pagelyt's Google Ads analyst. You read a website's Google Ads numbers for the last 28 days next to its Pagelyt website report (and its Search Console numbers when given), and write insights for the site owner.

Write 3 to 6 insights, most valuable first. Each one:
- title: one short sentence naming what is happening, with the key number and currency (for example "£420 of ad spend lands on /pricing, which loads slowly").
- detail: 1 to 3 plain-English sentences explaining why it matters, using only numbers given below. Connect it to issues from the report when the same landing page is affected, and say honestly when it is only a possible cause.
- action: one concrete next step the owner can take this week.
- priority: "high", "medium" or "low".
- pages: landing-page paths from the LANDING PAGES table it is about (may be empty).
- findings: ids of report issues it refers to, exactly as written in square brackets (may be empty).

Look for: ad spend landing on pages with issues (speed, mobile, broken things hurt Quality Score and conversions); keywords Google rates below average for landing-page experience; searches paid for while the site already ranks in the top 3 organically (possible savings, but brand terms may be worth protecting); searches with spend and no conversions; campaigns with a high or rising cost per conversion; spend, clicks or conversions moving against the 28 days before; what the organic traffic would cost as ads.
Never invent numbers, pages or issue ids. Never tell the owner to stop all advertising. If the data is thin (little spend), say so in one insight rather than guessing. British English. No markdown.`;

function landingTable(d: AdsData, res: ScanResult): string {
  return [...landingIndex(d).values()]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 30)
    .map((l) => {
      const on = findingsOnUrl(l.url, res.findings).slice(0, 5).map((f) => f.id);
      return `${gaPath(l.url)} | spend ${money(l.cost, d.currency)} | clicks ${l.clicks} | conversions ${Math.round(l.conversions * 10) / 10}${on.length ? ` | issues ${on.join(", ")}` : ""}`;
    })
    .join("\n");
}

/** `res` carries only the open findings (the caller drops the ones marked as fixed). */
export function adsPrompt(d: AdsData, res: ScanResult, gsc?: GscData | null): string {
  return [
    `REPORT\n${reportBrief(res)}`,
    `GOOGLE ADS SUMMARY\n${adsBrief(d, res.findings, res.url, (f) => f.id, gsc)}`,
    `LANDING PAGES (path | ad spend last 28 days | clicks | conversions | report issues on the page)\n${landingTable(d, res)}`,
  ].join("\n\n");
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** Keeps only well-formed insights that point at real landing pages and real issue ids. */
export function cleanAdsInsights(raw: unknown, d: AdsData, res: ScanResult): AdsInsight[] {
  const list = (raw as { insights?: unknown })?.insights;
  if (!Array.isArray(list)) return [];
  const paths = new Set([...landingIndex(d).values()].map((l) => gaPath(l.url)));
  const ids = new Set(res.findings.map((f) => f.id));
  return list
    .map((x): AdsInsight | null => {
      const o = x as Record<string, unknown>;
      const title = clip(o.title, 160), detail = clip(o.detail, 600), action = clip(o.action, 300);
      if (!title || !detail) return null;
      const priority = o.priority === "high" || o.priority === "low" ? o.priority : "medium";
      const pages = (Array.isArray(o.pages) ? o.pages : []).filter((p): p is string => typeof p === "string" && paths.has(p)).slice(0, 5);
      const findings = [...new Set((Array.isArray(o.findings) ? o.findings : []).filter((f): f is string => typeof f === "string" && ids.has(f)))].slice(0, 5);
      return { title, detail, action, priority, pages, findings };
    })
    .filter((x): x is AdsInsight => !!x)
    .slice(0, 6);
}

export async function analyseAds(d: AdsData, res: ScanResult, basedOn: string, gsc?: GscData | null): Promise<AdsAi> {
  const { json, model } = await askJson(RULES, adsPrompt(d, res, gsc), "ads_insights", SCHEMA);
  const insights = cleanAdsInsights(json, d, res);
  if (!insights.length) throw new Error("No usable insights in the answer");
  return { insights, basedOn, model };
}
