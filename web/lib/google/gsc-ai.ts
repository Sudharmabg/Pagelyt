/* Server only. The AI analysis of a site's Google Search Console: the model reads the 28-day search numbers (pages,
   searches, near page one, low click rate, drops, indexing) next to this report's open issues and writes 3 to 6
   insights, each aimed at one key metric with an estimated gain and 2 or 3 steps. Structured JSON (strict schema), checked again here so only real page paths and
   issue ids come back. Runs only when the owner presses "Analyse with AI" on the Search Console tab; cached for 24
   hours as 'gsc_ai', separately from the Analytics and Ads insights. */

import { reportBrief } from "../ai/chat-knowledge";
import type { ScanResult } from "../scan/types";
import { askJson, cleanList, FORMAT, SCHEMA } from "./ga4-ai";
import { gaPath, type Ga4Ai, type Ga4Insight } from "./ga4-insights";
import { findingsOn, gscBrief, lowCtr, type GscData } from "./gsc-insights";

export type GscAi = Ga4Ai;

const RULES = `You are Pagelyt's search analyst. You read a website's Google Search Console numbers for the last 28 days next to its Pagelyt website report, and write insights that help the owner win more clicks from Google Search.

${FORMAT("SEARCH PAGES")}

Look for: searches close to page one that a better title, more depth or internal links could lift; page-one results with a low click rate (title and description); issues on the pages with the most clicks; pages losing clicks and the issues on them; key pages Google hasn't indexed or whose canonical Google rejected; mobile versus desktop and country differences when given.`;

export function gscPagesTable(d: GscData, res: ScanResult): string {
  return d.pages
    .filter((p) => p.impressions > 0 || p.prevClicks > 0)
    .slice(0, 30)
    .map((p) => {
      const on = findingsOn(p.url, res.findings).slice(0, 5).map((f) => f.id);
      return `${gaPath(p.url)} | clicks ${p.clicks} (before ${p.prevClicks}) | impressions ${p.impressions} | position ${p.position.toFixed(1)}${on.length ? ` | issues ${on.join(", ")}` : ""}`;
    })
    .join("\n");
}

export const gscSplits = (d: GscData) =>
  [
    d.devices?.length ? `Devices: ${d.devices.map((x) => `${x.key.toLowerCase()} ${x.clicks} clicks`).join(", ")}.` : "",
    d.countries?.length ? `Top countries: ${d.countries.slice(0, 5).map((x) => `${x.key.toUpperCase()} ${x.clicks} clicks`).join(", ")}.` : "",
    lowCtr(d).length ? `Low click rate on page one: ${lowCtr(d).slice(0, 5).map((p) => `${gaPath(p.url)} ${(p.ctr * 100).toFixed(1)}% (typical ~${(p.expected * 100).toFixed(0)}%)`).join("; ")}.` : "",
  ].filter(Boolean).join("\n");

/** `res` carries only the open findings (the caller drops the ones marked as fixed). */
export function gscPrompt(d: GscData, res: ScanResult): string {
  return [
    `REPORT\n${reportBrief(res)}`,
    `SEARCH CONSOLE SUMMARY\n${gscBrief(d, res.findings, res.url, (f) => f.id)}\n${gscSplits(d)}`,
    `SEARCH PAGES (path | clicks last 28 days (28 days before) | impressions | average position | report issues on the page)\n${gscPagesTable(d, res)}`,
  ].join("\n\n");
}

/** Keeps only well-formed insights that point at real page paths and real issue ids. */
export function cleanGscInsights(raw: unknown, d: GscData, res: ScanResult): Ga4Insight[] {
  return cleanList(raw, new Set(d.pages.map((p) => gaPath(p.url))), new Set(res.findings.map((f) => f.id)));
}

export async function analyseGsc(d: GscData, res: ScanResult, basedOn: string): Promise<GscAi> {
  const { json, model } = await askJson(RULES, gscPrompt(d, res), "search_insights", SCHEMA);
  const insights = cleanGscInsights(json, d, res);
  if (!insights.length) throw new Error("No usable insights in the answer");
  return { insights, basedOn, model };
}
