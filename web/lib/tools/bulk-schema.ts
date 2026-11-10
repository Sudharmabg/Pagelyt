import * as cheerio from "cheerio";
import { normaliseUrl, safeFetch } from "@/lib/scan/fetcher";
import { ldNodes, schemaIssues, type SchemaIssue } from "@/lib/scan/seo-deep";

/* Bulk schema checker: one page's structured data, checked against the same field rules the full scan uses. */

export type SchemaPage = {
  url: string;
  status: number | null;
  /** JSON-LD script blocks on the page, and how many of them are not valid JSON. */
  blocks: number;
  invalid: number;
  /** Elements using microdata (itemtype), which we count but don't validate. */
  microdata: number;
  types: string[];
  issues: SchemaIssue[];
  error?: string;
};

export function schemaOf(html: string): Pick<SchemaPage, "blocks" | "invalid" | "microdata" | "types" | "issues"> {
  const $ = cheerio.load(html.slice(0, 1_500_000));
  const scripts = $('script[type="application/ld+json"]');
  let invalid = 0;
  scripts.each((_, el) => {
    try {
      JSON.parse($(el).text());
    } catch {
      invalid++;
    }
  });
  const nodes = ldNodes($);
  const types = [...new Set(nodes.flatMap((n) => (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]).map(String)))].slice(0, 12);
  return { blocks: scripts.length, invalid, microdata: $("[itemtype]").length, types, issues: schemaIssues(nodes) };
}

export async function checkSchemaPage(raw: string): Promise<SchemaPage> {
  const empty = { status: null, blocks: 0, invalid: 0, microdata: 0, types: [], issues: [] };
  const u = normaliseUrl(raw.slice(0, 2048));
  if (!u) return { url: raw.slice(0, 200), ...empty, error: "Not a full public address." };
  try {
    const r = await safeFetch(u);
    const html = /html/i.test(String(r.headers["content-type"] ?? "html"));
    if (r.status >= 400) return { url: u.href, ...empty, status: r.status, error: `The page answered ${r.status}.` };
    if (!html) return { url: u.href, ...empty, status: r.status, error: "Not an HTML page." };
    return { url: u.href, status: r.status, ...schemaOf(r.body) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { url: u.href, ...empty, error: /Blocked/.test(msg) ? "That address isn't publicly reachable." : /timed out/i.test(msg) ? "The page took too long to answer." : "We couldn't reach this page." };
  }
}
