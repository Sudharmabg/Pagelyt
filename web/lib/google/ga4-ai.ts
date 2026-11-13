/* Server only. The AI analysis of a site's Google Analytics: the model reads the 28-day Analytics numbers, the
   Search Console summary (when connected) and this report's open issues, and writes 3 to 6 insights, each with one
   action. The answer is structured JSON (a strict schema), checked again here so only real pages and issue ids from
   this report come back. Runs only when the owner presses "Analyse with AI"; the result is cached for 24 hours. */

import { chatModel } from "../ai/chat";
import { reportBrief } from "../ai/chat-knowledge";
import type { ScanResult } from "../scan/types";
import { findingsOnPath, ga4Brief, ga4Index, rate, type Ga4Ai, type Ga4Data, type Ga4Insight } from "./ga4-insights";

/** On when OpenAI is set up (or, in `npm run dev:mock` without a key, the mock's fake OpenAI). */
export const analyseOn = () => !!(process.env.OPENAI_API_KEY || process.env.OPENAI_MOCK_URL);

const RULES = `You are Pagelyt's analytics analyst. You read a website's Google Analytics 4 numbers for the last 28 days next to its Pagelyt website report, and write insights for the site owner.

Write 3 to 6 insights, most valuable first. Each one:
- title: one short sentence naming what is happening, with the key number (for example "/pricing lost 41% of its visits, mostly from Organic Search").
- detail: 1 to 3 plain-English sentences explaining why it matters, using only numbers given below. Connect it to issues from the report when the same page or area is affected, and say so honestly when it is only a possible cause.
- action: one concrete next step the owner can take this week.
- priority: "high", "medium" or "low".
- pages: page paths from the ANALYTICS PAGES table it is about (may be empty).
- findings: ids of report issues it refers to, exactly as written in square brackets (may be empty).

Look for: pages that lost visits and which channel lost them; busy pages with low engagement; channels growing or shrinking; issues on the pages that get the most visits; key events (conversions) moving; new versus returning visitors; anything surprising.
Never invent numbers, pages or issue ids. If the data is thin (few visits), say so in one insight rather than guessing. British English. No markdown.`;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["insights"],
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "action", "priority", "pages", "findings"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          action: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          pages: { type: "array", items: { type: "string" } },
          findings: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

function pagesTable(d: Ga4Data, res: ScanResult): string {
  const rows = [...ga4Index(d).values()].sort((a, b) => b.sessions + b.prevSessions - (a.sessions + a.prevSessions)).slice(0, 30);
  return rows
    .map((p) => {
      const on = findingsOnPath(p.path, res.findings).slice(0, 5).map((f) => f.id);
      return `${p.path} | visits ${p.sessions} (before ${p.prevSessions}) | engaged ${Math.round(rate(p.engaged, p.sessions) * 100)}% | views ${p.views}${on.length ? ` | issues ${on.join(", ")}` : ""}`;
    })
    .join("\n");
}

/** `res` carries only the open findings (the caller drops the ones marked as fixed). */
export function analysePrompt(d: Ga4Data, res: ScanResult, gsc?: string): string {
  return [
    `REPORT\n${reportBrief(res)}`,
    `ANALYTICS SUMMARY\n${ga4Brief(d, res.findings, (f) => f.id)}`,
    `ANALYTICS PAGES (path | visits last 28 days (28 days before) | engaged share | page views | report issues on the page)\n${pagesTable(d, res)}`,
    gsc && `GOOGLE SEARCH CONSOLE\n${gsc}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** Keeps only well-formed insights that point at real pages and real issue ids. */
export function cleanInsights(raw: unknown, d: Ga4Data, res: ScanResult): Ga4Insight[] {
  const list = (raw as { insights?: unknown })?.insights;
  if (!Array.isArray(list)) return [];
  const paths = new Set(ga4Index(d).keys());
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

/** One structured-JSON call to the OpenAI Responses API (strict schema), shared by the Analytics and Ads analyses.
    Uses the assistant's model (`chatModel()`), low reasoning, 90 seconds at most. */
export async function askJson(instructions: string, input: string, name: string, schema: object): Promise<{ json: unknown; model: string }> {
  const model = chatModel();
  const reasoning = /^(gpt-5|o\d)/.test(model) ? { reasoning: { effort: "low" } } : {};
  const base = (process.env.OPENAI_API_KEY ? "" : process.env.OPENAI_MOCK_URL) || "https://api.openai.com";
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 90_000);
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY || "mock"}` },
      body: JSON.stringify({ model, instructions, input, text: { format: { type: "json_schema", name, strict: true, schema } }, store: false, max_output_tokens: 6000, ...reasoning }),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
    const j = (await r.json()) as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const text = (j.output ?? []).flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text ?? "";
    return { json: JSON.parse(text), model };
  } finally {
    clearTimeout(t);
  }
}

export async function analyseGa4(d: Ga4Data, res: ScanResult, basedOn: string, gsc?: string): Promise<Ga4Ai> {
  const { json, model } = await askJson(RULES, analysePrompt(d, res, gsc), "analytics_insights", SCHEMA);
  const insights = cleanInsights(json, d, res);
  if (!insights.length) throw new Error("No usable insights in the answer");
  return { insights, basedOn, model };
}
