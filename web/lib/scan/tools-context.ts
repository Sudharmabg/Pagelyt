import type { ScanResult } from "./types";

/* What the free tools pre-fill from a finished scan. Plain data, safe to send to the browser. */

export type ToolId = "llms" | "robots" | "schema" | "serp" | "headers";

export type ToolContext = {
  scanId: string;
  host: string;
  url: string;
  origin: string;
  name: string;
  title: string;
  description: string;
  pages: { title: string; url: string }[];
  sitemap: string;
  hostKind: "netlify" | "vercel" | "nginx" | "apache";
  /** Findings from this scan that each tool can fix (titles), by tool. */
  fixes: Record<ToolId, string[]>;
  /** AI crawlers the site's robots.txt currently blocks. */
  blocked: string[];
};

/** The finding ids each tool can fix. */
export const TOOL_FIXES: Record<ToolId, string[]> = {
  llms: ["no-llms"],
  robots: ["no-robots", "ai-blocked", "no-sitemap"],
  schema: ["no-structured-data", "bad-json-ld"],
  serp: ["no-title", "title-length", "no-description", "description-length"],
  headers: ["hsts", "csp", "clickjacking", "nosniff", "referrer"],
};

const nameFrom = (title: string, host: string) => {
  const part = title.split(/\s[|\-–—·:]\s/).map((s) => s.trim()).filter(Boolean).pop();
  const guess = part && part.length <= 40 ? part : "";
  return guess || host.replace(/\.[a-z.]+$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export function toolContext(scanId: string, r: ScanResult): ToolContext {
  const u = new URL(r.url);
  const home = r.crawl?.list[0];
  const tech = new Set((r.tech ?? []).map((t) => t.name));
  // No crawl (only the homepage was checked): the homepage fingerprint still has its title.
  const title = home?.title || r.snapshot?.title || "";
  const fixes = Object.fromEntries(
    (Object.keys(TOOL_FIXES) as ToolId[]).map((k) => [k, r.findings.filter((f) => TOOL_FIXES[k].includes(f.id)).map((f) => f.title)])
  ) as ToolContext["fixes"];
  const ai = r.findings.find((f) => f.id === "ai-blocked");
  return {
    scanId,
    host: r.host,
    url: u.origin + (u.pathname === "/" ? "" : u.pathname),
    origin: u.origin,
    name: nameFrom(title, r.host),
    title,
    description: home?.description ?? "",
    pages: (r.crawl?.list ?? []).filter((p) => p.status >= 200 && p.status < 300 && p.title).slice(0, 8).map((p) => ({ title: p.title.slice(0, 70), url: p.url })),
    sitemap: `${u.origin}/sitemap.xml`,
    hostKind: tech.has("Netlify") ? "netlify" : tech.has("Vercel") ? "vercel" : tech.has("nginx") ? "nginx" : tech.has("Apache") ? "apache" : "netlify",
    fixes,
    blocked: ai ? ai.title.replace(/^.*?:\s*/, "").split(/,\s*/).map((s) => s.trim()).filter(Boolean) : [],
  };
}
