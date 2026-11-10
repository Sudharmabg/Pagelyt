import * as cheerio from "cheerio";
import { safeFetch } from "../scan/fetcher";
import { parseRobots, robotsPath, robotsVerdict } from "./robots";

/* AI crawler access checker: what robots.txt says to each AI bot, and how the server actually answers a request
   that carries that bot's name (firewalls and CDNs often block AI bots by user agent, whatever robots.txt says). */

export type AiBot = { token: string; owner: string; purpose: string; kind: "training" | "search" | "user"; robotsOnly?: boolean };

export const AI_BOTS: AiBot[] = [
  { token: "GPTBot", owner: "OpenAI", purpose: "Collects pages to train OpenAI's models", kind: "training" },
  { token: "OAI-SearchBot", owner: "OpenAI", purpose: "Indexes pages for ChatGPT search", kind: "search" },
  { token: "ChatGPT-User", owner: "OpenAI", purpose: "Opens a page when a ChatGPT user asks about it", kind: "user" },
  { token: "ClaudeBot", owner: "Anthropic", purpose: "Collects pages to train Claude", kind: "training" },
  { token: "Claude-SearchBot", owner: "Anthropic", purpose: "Indexes pages for Claude's search results", kind: "search" },
  { token: "Claude-User", owner: "Anthropic", purpose: "Opens a page when a Claude user asks about it", kind: "user" },
  { token: "PerplexityBot", owner: "Perplexity", purpose: "Indexes pages for Perplexity answers", kind: "search" },
  { token: "Perplexity-User", owner: "Perplexity", purpose: "Opens a page when a Perplexity user asks about it", kind: "user" },
  { token: "Google-Extended", owner: "Google", purpose: "Decides whether Gemini may use your pages. A robots.txt setting only: Google does not visit with this name", kind: "training", robotsOnly: true },
  { token: "Applebot-Extended", owner: "Apple", purpose: "Decides whether Apple may train its AI on your pages. A robots.txt setting only", kind: "training", robotsOnly: true },
  { token: "meta-externalagent", owner: "Meta", purpose: "Collects pages to train Meta's AI models", kind: "training" },
  { token: "Amazonbot", owner: "Amazon", purpose: "Indexes pages for Alexa and Amazon's AI answers", kind: "search" },
  { token: "Bytespider", owner: "ByteDance", purpose: "Collects pages for ByteDance's AI models", kind: "training" },
  { token: "CCBot", owner: "Common Crawl", purpose: "Builds the open web dataset many AI models are trained on", kind: "training" },
];

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const botUa = (token: string) => `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ${token}/1.0)`;

export type BotResult = {
  token: string;
  owner: string;
  purpose: string;
  kind: AiBot["kind"];
  robots: "allowed" | "blocked";
  /** The robots.txt line that decided it, e.g. "Disallow: /" (line 4). */
  rule: string | null;
  /** How the server answered a request carrying this bot's name. "skipped" for robots.txt-only tokens;
      "unknown" when the server also refused our normal browser request, so there is nothing to compare with. */
  server: "ok" | "blocked" | "error" | "skipped" | "unknown";
  status: number | null;
};

export type AiBotReport = {
  url: string;
  status: number;
  /** The site refused even a normal browser request from our server, so the server column can't be judged. */
  baselineBlocked: boolean;
  robots: "found" | "missing" | "error";
  llms: boolean;
  /** The page itself asks AI tools not to use it (noai / noimageai in meta robots or X-Robots-Tag). */
  noai: boolean;
  bots: BotResult[];
};

const blockedStatus = (s: number) => s === 401 || s === 403 || s === 406 || s === 429 || s === 451 || s === 503 || s >= 520;

export async function checkAiBots(start: URL): Promise<AiBotReport> {
  const page = await safeFetch(start, { ua: BROWSER_UA });
  const final = new URL(page.url);
  const path = robotsPath(final.href);

  const [robotsRes, llmsRes] = await Promise.all([
    safeFetch(new URL("/robots.txt", final.origin), { accept: "text/plain,*/*;q=0.5" }).catch(() => null),
    safeFetch(new URL("/llms.txt", final.origin), { accept: "text/plain,text/markdown,*/*;q=0.5" }).catch(() => null),
  ]);
  const robotsText = robotsRes && robotsRes.status === 200 && !/^\s*</.test(robotsRes.body) ? robotsRes.body : "";
  const parsed = parseRobots(robotsText);
  const robots: AiBotReport["robots"] = !robotsRes ? "error" : robotsText ? "found" : "missing";
  const llms = !!llmsRes && llmsRes.status === 200 && llmsRes.body.trim().length > 0 && !/^\s*<(!doctype|html)/i.test(llmsRes.body);

  const $ = cheerio.load(page.body);
  const metaRobots = $('meta[name="robots" i], meta[name="googlebot" i]').map((_, el) => $(el).attr("content") ?? "").get().join(",");
  const xrt = ([] as string[]).concat(page.headers["x-robots-tag"] ?? []).join(",");
  const noai = /\bno(image)?ai\b/i.test(`${metaRobots},${xrt}`);

  const baselineBlocked = blockedStatus(page.status);
  const bots = await Promise.all(
    AI_BOTS.map(async (b): Promise<BotResult> => {
      const v = robotsVerdict(parsed, b.token, path);
      const rule = v.rule ? `${v.rule.allow ? "Allow" : "Disallow"}: ${v.rule.path} (line ${v.rule.line})` : null;
      let server: BotResult["server"] = "skipped";
      let status: number | null = null;
      if (!b.robotsOnly && baselineBlocked) server = "unknown";
      else if (!b.robotsOnly) {
        try {
          const r = await safeFetch(final, { ua: botUa(b.token), follow: false });
          status = r.status;
          server = blockedStatus(r.status) ? "blocked" : "ok";
        } catch {
          server = "error";
        }
      }
      return { token: b.token, owner: b.owner, purpose: b.purpose, kind: b.kind, robots: v.allowed ? "allowed" : "blocked", rule, server, status };
    })
  );

  return { url: final.href, status: page.status, baselineBlocked, robots, llms, noai, bots };
}
