import assert from "node:assert/strict";
import { test } from "node:test";
import { byTraffic, drops, expectedCtr, findingsOn, gscBrief, lowCtr, notIndexed, pageKey, strikingDistance, trafficFor, type GscData, type GscPage } from "./gsc-insights.ts";
import type { Finding } from "../scan/types.ts";

const page = (url: string, clicks: number, impressions: number, position = 5, prevClicks = clicks): GscPage => ({ url, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position, prevClicks, prevImpressions: impressions });
const data = (pages: GscPage[], extra: Partial<GscData> = {}): GscData => ({
  property: "sc-domain:example.com",
  range: { start: "2026-10-14", end: "2026-11-10" },
  prevRange: { start: "2026-09-16", end: "2026-10-13" },
  totals: { clicks: 1000, impressions: 50000, ctr: 0.02, position: 12, prevClicks: 800, prevImpressions: 40000 },
  daily: [],
  pages,
  queries: [],
  inspections: [],
  ...extra,
});
const f = (id: string, module: Finding["module"], severity: Finding["severity"], urls?: string[]): Finding => ({ id, module, severity, title: id, why: "", fix: "", ...(urls ? { pages: { cols: [], rows: urls.map((url) => ({ url, cells: [] })) } } : {}) });
const key = (x: Finding) => x.id;

test("pageKey ignores scheme, www, trailing slash and fragment", () => {
  assert.equal(pageKey("http://www.Example.com/about/#team"), pageKey("https://example.com/about"));
  assert.equal(pageKey("https://example.com"), "example.com/");
  assert.notEqual(pageKey("https://example.com/a?x=1"), pageKey("https://example.com/a"));
});

test("trafficFor sums a finding's pages, uses the whole site for site-wide areas and the homepage otherwise", () => {
  const d = data([page("https://example.com/", 300, 9000), page("https://example.com/a", 40, 2000), page("https://www.example.com/b/", 10, 500)]);
  assert.deepEqual(trafficFor(f("t", "seo", "high", ["https://example.com/a", "http://example.com/b", "https://example.com/zzz"]), d, "https://example.com/"), { clicks: 50, impressions: 2500, scope: "pages", pages: 2 });
  assert.deepEqual(trafficFor(f("hsts", "security", "medium"), d, "https://example.com/"), { clicks: 1000, impressions: 50000, scope: "site", pages: 0 });
  assert.deepEqual(trafficFor(f("meta", "seo", "low"), d, "https://www.example.com"), { clicks: 300, impressions: 9000, scope: "homepage", pages: 1 });
});

test("byTraffic keeps severity first and breaks ties by clicks", () => {
  const t = new Map([["a", { clicks: 5, impressions: 1, scope: "pages" as const, pages: 1 }], ["b", { clicks: 90, impressions: 1, scope: "pages" as const, pages: 1 }], ["c", { clicks: 900, impressions: 1, scope: "pages" as const, pages: 1 }]]);
  assert.deepEqual(byTraffic([f("a", "seo", "high"), f("c", "seo", "low"), f("b", "seo", "high")], t, key).map((x) => x.id), ["b", "a", "c"]);
});

test("strikingDistance keeps positions 8 to 20 with enough impressions, biggest first", () => {
  const q = (query: string, position: number, impressions: number) => ({ query, page: "https://example.com/", clicks: 1, impressions, ctr: 0, position });
  const d = data([], { queries: [q("top", 3, 900), q("near", 11, 300), q("nearer", 8.4, 600), q("far", 35, 900), q("tiny", 12, 5)] });
  assert.deepEqual(strikingDistance(d).map((x) => x.query), ["nearer", "near"]);
});

test("lowCtr flags page-one results under half the benchmark", () => {
  assert.equal(expectedCtr(1), 0.28);
  assert.equal(expectedCtr(30), expectedCtr(10));
  const d = data([page("https://example.com/weak", 10, 2000, 2), page("https://example.com/fine", 300, 2000, 2), page("https://example.com/low-volume", 0, 50, 1)]);
  assert.deepEqual(lowCtr(d).map((p) => p.url), ["https://example.com/weak"]);
});

test("drops finds pages down 30% or more and findingsOn lists issues on them", () => {
  const d = data([page("https://example.com/a", 20, 900, 5, 100), page("https://example.com/b", 80, 900, 5, 100), page("https://example.com/c", 0, 0, 0, 5)]);
  const dr = drops(d);
  assert.deepEqual(dr.map((p) => [p.url, p.lost]), [["https://example.com/a", 80]]);
  const list = [f("x", "seo", "high", ["https://www.example.com/a/"]), f("y", "seo", "low", ["https://example.com/b"])];
  assert.deepEqual(findingsOn("https://example.com/a", list).map((x) => x.id), ["x"]);
});

test("notIndexed and gscBrief", () => {
  const d = data([page("https://example.com/", 300, 9000)], { inspections: [{ url: "https://example.com/", verdict: "PASS", coverage: "Submitted and indexed", lastCrawl: null, googleCanonical: null, userCanonical: null }, { url: "https://example.com/x", verdict: "NEUTRAL", coverage: "Crawled - currently not indexed", lastCrawl: null, googleCanonical: null, userCanonical: null }] });
  assert.deepEqual(notIndexed(d).map((i) => i.url), ["https://example.com/x"]);
  const brief = gscBrief(d, [f("meta", "seo", "high")], "https://example.com/", key);
  assert.match(brief, /1,000 clicks \(\+25% vs the 28 days before\)/);
  assert.match(brief, /\[meta\] 300/);
  assert.match(brief, /Not indexed by Google: https:\/\/example.com\/x \(Crawled - currently not indexed\)/);
});
