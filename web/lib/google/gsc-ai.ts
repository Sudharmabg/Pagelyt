/* Server only. The AI analysis of a site's Google Search Console: the model reads the 28-day search numbers (pages,
   searches, near page one, low click rate, drops, indexing) next to this report's open issues and writes 3 to 6
   insights, each with one action. Structured JSON (strict schema), checked again here so only real page paths and
   issue ids come back. Runs only when the owner presses "Analyse with AI" on the Search Console tab; cached for 24
   hours as 'gsc_ai', separately from the Analytics and Ads insights. */

import { reportBrief } from "../ai/chat-knowledge";
import type { ScanResult } from "../scan/types";
import { askJson, SCHEMA } from "./ga4-ai";
import { gaPath, type Ga4Ai, type Ga4Insight } from "./ga4-insights";
import { findingsOn, gscBrief, lowCtr, type GscData } from "./gsc-insights";

export type GscAi = Ga4Ai;

const RULES = `You are Pagelyt's search analyst. You read a website's Google Search Console numbers for the last 28 days next to its Pagelyt website report, and write insights for the site owner.

Write 3 to 6 insights, most valuable first. Each one:
- title: one short sentence naming what is happening, with the key number (for example "/pricing lost 38% of its Google clicks and has two speed issues").
- detail: 1 to 3 plain-English sentences explaining why it matters, using only numbers given below. Connect it to issues from the report when the same page is affected, and say honestly when it is only a possible cause.
- action: one concrete next step the owner can take this week.
- priority: "high", "medium" or "low".
- pages: page paths from the SEARCH PAGES table it is about (may be empty).
- findings: ids of report issues it refers to, exactly as written in square brackets (may be empty).

Look for: issues on the pages with the most clicks; searches close to page one that a better title, more depth or internal links could lift; page-one results with a low click rate (title and description); pages losing clicks and the issues on them; key pages Google hasn't indexed or whose canonical Google rejected; mobile versus desktop and country differences when given.
Never invent numbers, pages or issue ids. If the data is thin (few clicks), say so in one insight rather than guessing. British English. No markdown.`;

function pagesTable(d: GscData, res: ScanResult): string {
  return d.pages
    .filter((p) => p.impressions > 0 || p.prevClicks > 0)
    .slice(0, 30)
    .map((p) => {
      const on = findingsOn(p.url, res.findings).slice(0, 5).map((f) => f.id);
      return `${gaPath(p.url)} | clicks ${p.clicks} (before ${p.prevClicks}) | impressions ${p.impressions} | position ${p.position.toFixed(1)}${on.length ? ` | issues ${on.join(", ")}` : ""}`;
    })
    .join("\n");
}

const splits = (d: GscData) =>
  [
    d.devices?.length ? `Devices: ${d.devices.map((x) => `${x.key.toLowerCase()} ${x.clicks} clicks`).join(", ")}.` : "",
    d.countries?.length ? `Top countries: ${d.countries.slice(0, 5).map((x) => `${x.key.toUpperCase()} ${x.clicks} clicks`).join(", ")}.` : "",
    lowCtr(d).length ? `Low click rate on page one: ${lowCtr(d).slice(0, 5).map((p) => `${gaPath(p.url)} ${(p.ctr * 100).toFixed(1)}% (typical ~${(p.expected * 100).toFixed(0)}%)`).join("; ")}.` : "",
  ].filter(Boolean).join("\n");

/** `res` carries only the open findings (the caller drops the ones marked as fixed). */
export function gscPrompt(d: GscData, res: ScanResult): string {
  return [
    `REPORT\n${reportBrief(res)}`,
    `SEARCH CONSOLE SUMMARY\n${gscBrief(d, res.findings, res.url, (f) => f.id)}\n${splits(d)}`,
    `SEARCH PAGES (path | clicks last 28 days (28 days before) | impressions | average position | report issues on the page)\n${pagesTable(d, res)}`,
  ].join("\n\n");
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** Keeps only well-formed insights that point at real page paths and real issue ids. */
export function cleanGscInsights(raw: unknown, d: GscData, res: ScanResult): Ga4Insight[] {
  const list = (raw as { insights?: unknown })?.insights;
  if (!Array.isArray(list)) return [];
  const paths = new Set(d.pages.map((p) => gaPath(p.url)));
  const ids = new Set(res.findings.map((f) => f.id));
  return list
    .map((x): Ga4Insight | null => {
      const o = x as Record<string, unknown>;
      const title = clip(o.title, 160), detail = clip(o.detail, 600), action = clip(o.action, 300);
      if (!title || !detail) return null;
      const priority = o.priority === "high" || o.priority === "low" ? o.priority : "medium";
      const pages = (Array.isArray(o.pages) ? o.pages : []).filter((p): p is string => typeof p === "string" && paths.has(p)).slice(0, 5);
      const findings = [...new Set((Array.isArray(o.findings) ? o.findings : []).filter((f): f is string => typeof f === "string" && ids.has(f)))].slice(0, 5);
      return { title, detail, action, priority, pages, findings };
    })
    .filter((x): x is Ga4Insight => !!x)
    .slice(0, 6);
}

export async function analyseGsc(d: GscData, res: ScanResult, basedOn: string): Promise<GscAi> {
  const { json, model } = await askJson(RULES, gscPrompt(d, res), "search_insights", SCHEMA);
  const insights = cleanGscInsights(json, d, res);
  if (!insights.length) throw new Error("No usable insights in the answer");
  return { insights, basedOn, model };
}
