import assert from "node:assert/strict";
import { test } from "node:test";
import { adsBrief, landingHealth, lpKey, money, organicValue, paidOrganicOverlap, spendFor, spendMap, wastedTerms, weakLanding, type AdsData } from "./ads-insights.ts";
import type { GscData } from "./gsc-insights.ts";
import type { Finding } from "../scan/types.ts";

const T = { cost: 1000, clicks: 500, impressions: 20000, conversions: 20, value: 0 };
const ads = (extra: Partial<AdsData> = {}): AdsData => ({
  customer: "1234567890",
  name: "Example Ads",
  currency: "GBP",
  range: { start: "2026-10-16", end: "2026-11-12" },
  prevRange: { start: "2026-09-18", end: "2026-10-15" },
  totals: T,
  prev: { ...T, cost: 800 },
  daily: [],
  campaigns: [],
  landing: [
    { url: "https://www.example.com/pricing?utm_source=g", cost: 300, clicks: 150, conversions: 3 },
    { url: "https://example.com/pricing/", cost: 100, clicks: 50, conversions: 1 },
    { url: "https://example.com/", cost: 600, clicks: 300, conversions: 16 },
  ],
  keywords: [],
  terms: [],
  ...extra,
});
const f = (id: string, module: Finding["module"], urls?: string[]): Finding => ({ id, module, severity: "high", title: id, why: "", fix: "", ...(urls ? { pages: { cols: [], rows: urls.map((url) => ({ url, cells: [] })) } } : {}) });
const key = (x: Finding) => x.id;
const gsc = (queries: { query: string; clicks: number; position: number }[]): GscData =>
  ({ property: "sc-domain:example.com", range: { start: "", end: "" }, prevRange: { start: "", end: "" }, totals: { clicks: 2000, impressions: 0, ctr: 0, position: 0, prevClicks: 0, prevImpressions: 0 }, daily: [], pages: [], queries: queries.map((q) => ({ ...q, impressions: 100, ctr: 0, page: "https://example.com/" })), inspections: [] }) as GscData;

test("lpKey ignores www, tracking parameters and trailing slashes", () => {
  assert.equal(lpKey("https://www.example.com/pricing/?utm_source=x"), "example.com/pricing");
  assert.equal(lpKey("https://example.com"), "example.com/");
});

test("spendFor adds up a finding's landing pages, all spend site-wide, the homepage otherwise", () => {
  const d = ads();
  assert.deepEqual(spendFor(f("slow", "performance", ["https://example.com/pricing"]), d, "https://example.com/"), { cost: 400, clicks: 200, scope: "pages", pages: 1 });
  assert.deepEqual(spendFor(f("hsts", "security"), d, "https://example.com/"), { cost: 1000, clicks: 500, scope: "site", pages: 0 });
  assert.deepEqual(spendFor(f("meta", "seo"), d, "https://www.example.com/"), { cost: 600, clicks: 300, scope: "homepage", pages: 1 });
  assert.equal(spendMap([f("a", "seo", ["https://example.com/none"])], d, "https://example.com/", key).get("a")?.cost, 0);
});

test("landingHealth totals spend on pages with issues", () => {
  const h = landingHealth(ads(), [f("slow", "performance", ["https://example.com/pricing"])]);
  assert.equal(h.cost, 400);
  assert.equal(h.share, 0.4);
  assert.deepEqual(h.rows.map((r) => r.issues.map((x) => x.id)), [["slow"]]);
});

test("weakLanding and wastedTerms", () => {
  const d = ads({
    keywords: [
      { text: "a", match: "EXACT", campaign: "C", qs: 3, lpx: "BELOW_AVERAGE", url: null, cost: 50, clicks: 10, conversions: 0 },
      { text: "b", match: "EXACT", campaign: "C", qs: 8, lpx: "ABOVE_AVERAGE", url: null, cost: 90, clicks: 10, conversions: 1 },
    ],
    terms: [
      { term: "free stuff", cost: 40, clicks: 12, impressions: 100, conversions: 0 },
      { term: "cheap", cost: 3, clicks: 6, impressions: 100, conversions: 0 },
      { term: "buy widget", cost: 80, clicks: 30, impressions: 300, conversions: 4 },
    ],
  });
  assert.deepEqual(weakLanding(d).map((k) => k.text), ["a"]);
  assert.deepEqual(wastedTerms(d).map((t) => t.term), ["free stuff"]);
});

test("paid vs organic overlap and organic traffic value use Search Console", () => {
  const d = ads({ terms: [{ term: "Example Shop", cost: 120, clicks: 60, impressions: 900, conversions: 5 }, { term: "widgets", cost: 200, clicks: 50, impressions: 900, conversions: 2 }] });
  const g = gsc([{ query: "example shop", clicks: 400, position: 1.2 }, { query: "widgets", clicks: 30, position: 7 }]);
  const ov = paidOrganicOverlap(d, g);
  assert.deepEqual(ov.rows.map((r) => [r.term, r.position]), [["Example Shop", 1.2]]);
  assert.equal(ov.cost, 120);
  const v = organicValue(d, g);
  assert.equal(v.matched, 400 * 2 + 30 * 4);
  assert.equal(v.rough, 2000 * 2);
});

test("money and adsBrief", () => {
  assert.equal(money(1234.5, "GBP"), "£1,235");
  const brief = adsBrief(ads(), [f("slow", "performance", ["https://example.com/pricing"])], "https://example.com/", key);
  assert.match(brief, /spend £1,000 \(\+25% vs the 28 days before\)/);
  assert.match(brief, /landing pages with report issues: £400 \(40% of spend\)/);
  assert.match(brief, /\[slow\] £400/);
});
