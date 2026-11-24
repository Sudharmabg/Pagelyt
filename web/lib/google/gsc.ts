/* Server only. Reads Search Console: the properties an account can see, Search Analytics for the last 28 days and
   the 28 before, and URL Inspection for the pages that matter. About 25 requests per refresh, well inside a Worker's
   subrequest budget. */

import { rootDomain } from "../domain";
import type { Finding } from "../scan/types";
import { gJson } from "./oauth";
import { pageKey, type GscData, type GscInspection, type GscPage, type GscQuery } from "./gsc-insights";

const WM = "https://www.googleapis.com/webmasters/v3";
const INSPECT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
/** URL Inspection allows 2,000 a day per property; a refresh inspects at most this many (a Worker's subrequest budget is the tighter limit). */
const MAX_INSPECT = 30;
/** The most pages tracked for the indexing check. */
const MAX_CANDIDATES = 500;

export type GscProperty = { siteUrl: string; permissionLevel: string };

export async function listProperties(access: string): Promise<GscProperty[]> {
  const d = await gJson<{ siteEntry?: GscProperty[] }>(access, `${WM}/sites`);
  return (d.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");
}

/** The property that covers a host: the domain property first, then the URL-prefix ones for that host. */
export function matchProperty(host: string, props: GscProperty[]): string | null {
  const h = host.toLowerCase().replace(/^www\./, "");
  const root = rootDomain(h);
  const want = [`sc-domain:${h}`, `sc-domain:${root}`, `https://${h}/`, `https://www.${h}/`, `http://${h}/`, `http://www.${h}/`];
  for (const w of want) if (props.some((p) => p.siteUrl === w)) return w;
  return null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const back = (d: Date, n: number) => new Date(d.getTime() - n * 86_400_000);

/** Search Console data is final about 3 days later, so the window ends then. */
export function ranges(now = new Date(), days = 28) {
  const end = back(now, 3);
  const start = back(end, days - 1);
  const pEnd = back(start, 1);
  return { range: { start: day(start), end: day(end) }, prevRange: { start: day(back(pEnd, days - 1)), end: day(pEnd) } };
}

type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

async function query(access: string, prop: string, body: Record<string, unknown>): Promise<Row[]> {
  const d = await gJson<{ rows?: Row[] }>(access, `${WM}/sites/${encodeURIComponent(prop)}/searchAnalytics/query`, body);
  return d.rows ?? [];
}

/** `days`: 7, 28 or 90. URL Inspection runs only for the 28-day window (the other windows reuse its answers). */
export async function fetchGsc(access: string, property: string, scan: { url: string; findings: Finding[]; crawl?: string[] }, days = 28, prior: GscInspection[] = []): Promise<GscData> {
  const { range, prevRange } = ranges(new Date(), days);
  const span = (r: { start: string; end: string }) => ({ startDate: r.start, endDate: r.end });
  const [pages, prevPages, queries, daily, tot, prevTot, devices, countries] = await Promise.all([
    query(access, property, { ...span(range), dimensions: ["page"], rowLimit: 1000 }),
    query(access, property, { ...span(prevRange), dimensions: ["page"], rowLimit: 1000 }),
    query(access, property, { ...span(range), dimensions: ["query", "page"], rowLimit: 1000 }),
    query(access, property, { ...span(range), dimensions: ["date"], rowLimit: 100 }),
    query(access, property, { ...span(range) }),
    query(access, property, { ...span(prevRange) }),
    query(access, property, { ...span(range), dimensions: ["device"], rowLimit: 10 }).catch(() => []),
    query(access, property, { ...span(range), dimensions: ["country"], rowLimit: 10 }).catch(() => []),
  ]);
  const splitOf = (rows: Row[]) => rows.map((r) => ({ key: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions })).filter((r) => r.key).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

  const prev = new Map(prevPages.map((r) => [r.keys?.[0] ?? "", r]));
  const pageRows: GscPage[] = pages.map((r) => {
    const url = r.keys?.[0] ?? "";
    const p = prev.get(url);
    return { url, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, prevClicks: p?.clicks ?? 0, prevImpressions: p?.impressions ?? 0 };
  });
  // Pages that had clicks before but none now don't appear in this window's rows: add them, so drops are seen.
  const seen = new Set(pageRows.map((p) => p.url));
  for (const [url, p] of prev) if (url && !seen.has(url) && p.clicks > 0) pageRows.push({ url, clicks: 0, impressions: 0, ctr: 0, position: 0, prevClicks: p.clicks, prevImpressions: p.impressions });

  const all = days === 28 ? candidates(scan, pageRows) : [];
  const qRows: GscQuery[] = queries.map((r) => ({ query: r.keys?.[0] ?? "", page: r.keys?.[1] ?? "", clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
  const t = tot[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const pt = prevTot[0] ?? { clicks: 0, impressions: 0 };

  return {
    property,
    days,
    devices: splitOf(devices),
    countries: splitOf(countries),
    range,
    prevRange,
    totals: { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position, prevClicks: pt.clicks, prevImpressions: pt.impressions },
    daily: daily.map((r) => ({ date: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions })).sort((a, b) => a.date.localeCompare(b.date)),
    pages: pageRows.sort((a, b) => b.impressions - a.impressions).slice(0, 500),
    queries: qRows,
    inspections: days === 28 ? await inspectNext(access, property, all, prior) : [],
    inspectTotal: days === 28 ? all.length : undefined,
  };
}

/** Every page worth asking Google about, most important first: the homepage, the pages with the most impressions,
    pages the scan found problems on, then every other page the scan crawled (sitemap and links). Pages Google hasn't
    indexed get no impressions, so only the crawl list can reveal them. */
function candidates(scan: { url: string; findings: Finding[]; crawl?: string[] }, pages: GscPage[]): string[] {
  const out = new Map<string, string>();
  const add = (u: string) => {
    if (out.size < MAX_CANDIDATES && /^https?:\/\//i.test(u) && !out.has(pageKey(u))) out.set(pageKey(u), u);
  };
  add(scan.url);
  for (const p of pages.filter((x) => x.impressions > 0).slice(0, 7)) add(p.url);
  for (const f of scan.findings) for (const r of f.pages?.rows.slice(0, 2) ?? []) add(r.url);
  for (const u of scan.crawl ?? []) add(u);
  return [...out.values()];
}

/** Inspects the next batch: pages never checked first; once all are checked, the ones Google hadn't indexed, to catch
    fixes. Earlier answers are kept, so each refresh covers more of the site. */
async function inspectNext(access: string, property: string, all: string[], prior: GscInspection[]): Promise<GscInspection[]> {
  const keep = new Map(prior.filter((i) => all.some((u) => pageKey(u) === pageKey(i.url))).map((i) => [pageKey(i.url), i]));
  let todo = all.filter((u) => !keep.has(pageKey(u)));
  if (!todo.length) todo = [...keep.values()].filter((i) => i.verdict !== "PASS").map((i) => i.url);
  for (const i of await inspectPages(access, property, todo.slice(0, MAX_INSPECT))) keep.set(pageKey(i.url), i);
  return [...keep.values()];
}

type InspectReply = { inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string; googleCanonical?: string; userCanonical?: string } } };

async function inspectPages(access: string, property: string, urls: string[]): Promise<GscInspection[]> {
  const res = await Promise.all(
    urls.map(async (url): Promise<GscInspection | null> => {
      try {
        const d = await gJson<InspectReply>(access, INSPECT, { inspectionUrl: url, siteUrl: property });
        const s = d.inspectionResult?.indexStatusResult;
        if (!s?.verdict) return null;
        return { url, verdict: s.verdict, coverage: s.coverageState ?? null, lastCrawl: s.lastCrawlTime ?? null, googleCanonical: s.googleCanonical ?? null, userCanonical: s.userCanonical ?? null };
      } catch {
        return null; // a URL outside the property, or the daily quota: skip it
      }
    })
  );
  return res.filter((x): x is GscInspection => !!x);
}
