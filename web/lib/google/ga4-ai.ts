/* Server only. The AI analysis of a site's Google Analytics: the model reads the 28-day Analytics numbers, the
   Search Console summary (when connected) and this report's open issues, and writes 3 to 6 insights, each with one
   action. The answer is structured JSON (a strict schema), checked again here so only real pages and issue ids from
   this report come back. Runs only when the owner presses "Analyse with AI"; the result is cached for 24 hours. */

import { chatModel } from "../ai/chat";
import { reportBrief } from "../ai/chat-knowledge";
import type { ScanResult } from "../scan/types";
import { findingsOnPath, ga4Brief, ga4Index, METRICS, rate, type Ga4Ai, type Ga4Data, type Ga4Insight, type Metric, type PlanStep, type Source } from "./ga4-insights";

/** On when OpenAI is set up (or, in `npm run dev:mock` without a key, the mock's fake OpenAI). */
export const analyseOn = () => !!(process.env.OPENAI_API_KEY || process.env.OPENAI_MOCK_URL);

/** How every AI analysis writes its insights (Search Console, Analytics, Google Ads and all of them together).
    `table` names the prompt's table of page paths the insight may point at. */
export const FORMAT = (table: string, sources = false) => `Write 3 to 5 insights. Each insight is about growing one key metric of this website, and they are ordered by the size of the gain, biggest first. Each one:
- metric: the key metric it would grow: "search_clicks" (clicks from Google Search), "search_visibility" (impressions and positions), "visits", "engagement" (engaged share, time on site), "conversions" (key events or ad conversions) or "ad_efficiency" (spend per conversion, wasted spend).
- title: one short sentence naming the opportunity or problem, with the key number (for example "/pricing lost 38% of its Google clicks and has two speed issues").
- now: the current value of that metric for the page, search or site the insight is about, with its unit, taken exactly from the numbers below (for example "212 clicks a month" or "1.8% click rate").
- gain: a careful, conservative estimate of what the steps could add over the next 28 days, starting with "about" or "up to" and with the unit (for example "about +120 clicks a month" or "up to £90 a month less wasted spend"). Base it only on the numbers below and these rules of thumb: moving a search from around position 8 to the top 4 roughly doubles its click rate; a page-one result with a below-typical click rate can usually reach the typical rate; fixing a slow, broken or hard-to-use page lifts its engaged share and conversions modestly (10 to 20%); spend on searches with no conversions can mostly be saved. If there is no honest basis for a number, write "hard to estimate".
- detail: 1 to 3 plain-English sentences on why it matters, using only numbers given below. Connect it to report issues on the same page, and say honestly when an issue is only a possible cause.
- plan: a step-by-step playbook of 4 to 7 steps, in the order to do them, that a non-expert could follow without more help. Each step has:
  - title: one sentence starting with a verb, naming the page, search or report issue it applies to.
  - how: 2 to 4 plain-English sentences saying exactly where to do it (for example "In your website editor open the page's SEO settings", "In Search Console paste the address into the top bar and press Request indexing") and what to change. Explain any term you use.
  - example: the exact wording to use when the step is about text (a page title under 60 characters, a meta description under 155, a heading, an internal-link sentence, an ad headline), otherwise an empty string. Suggested wording only, never invented facts or numbers.
- time: how long the whole plan takes and when results usually show, in one sentence (for example "About 2 hours of work; clicks usually move within 2 to 4 weeks").
- effort: "quick" (under an hour), "moderate" (a few hours) or "bigger" (a day or more).
- check: one or two sentences on how to confirm it worked: which number to look at, in which Google report, and what change to expect.
- priority: "high" for the biggest gains, then "medium", then "low".
- pages: page paths from the ${table} table it is about (may be empty).
- findings: ids of report issues it refers to, exactly as written in square brackets (may be empty).${sources ? `
- sources: which products' numbers the insight uses: "gsc" (Search Console), "ga4" (Analytics), "ads" (Google Ads). Prefer insights that join two or more.` : ""}
Skip generic advice that would fit any website. Never invent numbers, pages or issue ids. If the data is thin (few clicks or visits, little spend), say so in one insight with gain "hard to estimate" rather than guessing. British English. No markdown.`;

const RULES = `You are Pagelyt's analytics analyst. You read a website's Google Analytics 4 numbers for the last 28 days next to its Pagelyt website report, and write insights that help the owner grow visits, engagement and conversions.

${FORMAT("ANALYTICS PAGES")}

Look for: pages that lost visits and which channel lost them; busy pages with low engagement; channels growing or shrinking; issues on the pages that get the most visits; key events (conversions) moving; new versus returning visitors; anything surprising.`;

/** The strict JSON schema every analysis answers in (`sources` only for the combined one). */
export const schemaFor = (sources = false) => ({
  type: "object",
  additionalProperties: false,
  required: ["insights"],
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["metric", "title", "now", "gain", "detail", "plan", "time", "effort", "check", "priority", "pages", "findings", ...(sources ? ["sources"] : [])],
        properties: {
          metric: { type: "string", enum: [...METRICS] },
          title: { type: "string" },
          now: { type: "string" },
          gain: { type: "string" },
          detail: { type: "string" },
          plan: {
            type: "array",
            items: { type: "object", additionalProperties: false, required: ["title", "how", "example"], properties: { title: { type: "string" }, how: { type: "string" }, example: { type: "string" } } },
          },
          time: { type: "string" },
          effort: { type: "string", enum: ["quick", "moderate", "bigger"] },
          check: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          pages: { type: "array", items: { type: "string" } },
          findings: { type: "array", items: { type: "string" } },
          ...(sources ? { sources: { type: "array", items: { type: "string", enum: ["gsc", "ga4", "ads"] } } } : {}),
        },
      },
    },
  },
});
export const SCHEMA = schemaFor();

export function ga4PagesTable(d: Ga4Data, res: ScanResult): string {
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
    `ANALYTICS PAGES (path | visits last 28 days (28 days before) | engaged share | page views | report issues on the page)\n${ga4PagesTable(d, res)}`,
    gsc && `GOOGLE SEARCH CONSOLE\n${gsc}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const SOURCES = new Set(["gsc", "ga4", "ads"]);

/** Keeps only well-formed insights that point at real page paths (`paths`) and real issue ids (`ids`); shared by every
    analysis. Answers in the older shape (one `action`, no steps) still come through. */
export function cleanList(raw: unknown, paths: Set<string>, ids: Set<string>): Ga4Insight[] {
  const list = (raw as { insights?: unknown })?.insights;
  if (!Array.isArray(list)) return [];
  return list
    .map((x): Ga4Insight | null => {
      const o = (x ?? {}) as Record<string, unknown>;
      const title = clip(o.title, 160), detail = clip(o.detail, 600);
      if (!title || !detail) return null;
      const plan = (Array.isArray(o.plan) ? o.plan : [])
        .map((v): PlanStep | null => {
          const q = (v ?? {}) as Record<string, unknown>;
          const t = clip(q.title, 200), how = clip(q.how, 600), example = clip(q.example, 400);
          return t ? { title: t, how, ...(example ? { example } : {}) } : null;
        })
        .filter((v): v is PlanStep => !!v)
        .slice(0, 7);
      const steps = plan.length ? plan.map((p) => p.title) : (Array.isArray(o.steps) ? o.steps : []).map((t) => clip(t, 300)).filter(Boolean).slice(0, 3);
      const action = steps[0] ?? clip(o.action, 300);
      const priority = o.priority === "high" || o.priority === "low" ? o.priority : "medium";
      const pages = (Array.isArray(o.pages) ? o.pages : []).filter((p): p is string => typeof p === "string" && paths.has(p)).slice(0, 5);
      const findings = [...new Set((Array.isArray(o.findings) ? o.findings : []).filter((f): f is string => typeof f === "string" && ids.has(f)))].slice(0, 5);
      const out: Ga4Insight = { title, detail, action, priority, pages, findings };
      if (typeof o.metric === "string" && (METRICS as readonly string[]).includes(o.metric)) out.metric = o.metric as Metric;
      const now = clip(o.now, 80), gain = clip(o.gain, 80);
      if (now) out.now = now;
      if (gain) out.gain = gain;
      if (steps.length) out.steps = steps;
      if (plan.length) out.plan = plan;
      const time = clip(o.time, 160), check = clip(o.check, 400);
      if (time) out.time = time;
      if (check) out.check = check;
      if (o.effort === "quick" || o.effort === "moderate" || o.effort === "bigger") out.effort = o.effort;
      if (Array.isArray(o.sources)) {
        const src = [...new Set(o.sources.filter((v): v is Source => typeof v === "string" && SOURCES.has(v)))];
        if (src.length) out.sources = src;
      }
      return out;
    })
    .filter((x): x is Ga4Insight => !!x)
    .slice(0, 6);
}

/** Keeps only well-formed insights that point at real pages and real issue ids. */
export function cleanInsights(raw: unknown, d: Ga4Data, res: ScanResult): Ga4Insight[] {
  return cleanList(raw, new Set(ga4Index(d).keys()), new Set(res.findings.map((f) => f.id)));
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
      body: JSON.stringify({ model, instructions, input, text: { format: { type: "json_schema", name, strict: true, schema } }, store: false, max_output_tokens: 14000, ...reasoning }),
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
