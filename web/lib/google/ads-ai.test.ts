import assert from "node:assert/strict";
import { test } from "node:test";
import { adsPrompt, cleanAdsInsights } from "./ads-ai.ts";
import type { AdsData } from "./ads-insights.ts";
import type { ScanResult } from "../scan/types.ts";

const T = { cost: 500, clicks: 200, impressions: 9000, conversions: 10, value: 0 };
const d: AdsData = {
  customer: "1",
  name: null,
  currency: "USD",
  range: { start: "2026-10-16", end: "2026-11-12" },
  prevRange: { start: "2026-09-18", end: "2026-10-15" },
  totals: T,
  prev: T,
  daily: [],
  campaigns: [],
  landing: [{ url: "https://example.com/pricing/?gclid=1", cost: 300, clicks: 100, conversions: 2 }],
  keywords: [],
  terms: [],
};
const res = {
  host: "example.com",
  url: "https://example.com/",
  scannedAt: "2026-11-12T00:00:00Z",
  overall: 70,
  modules: [],
  findings: [{ id: "slow-lcp", module: "performance", severity: "high", title: "Slow", why: "", fix: "Make it faster", pages: { cols: [], rows: [{ url: "https://example.com/pricing", cells: [] }] } }],
} as unknown as ScanResult;

test("the Ads prompt carries landing pages with their spend and issues", () => {
  assert.match(adsPrompt(d, res), /\/pricing \| spend US\$300 \| clicks 100 \| conversions 2 \| issues slow-lcp/);
});

test("cleanAdsInsights keeps only real landing pages and issue ids", () => {
  const out = cleanAdsInsights({ insights: [{ title: "Spend on slow page", detail: "x", action: "y", priority: "high", pages: ["/pricing", "/nope"], findings: ["slow-lcp", "zzz"] }, { title: "", detail: "" }] }, d, res);
  assert.deepEqual(out, [{ title: "Spend on slow page", detail: "x", action: "y", priority: "high", pages: ["/pricing"], findings: ["slow-lcp"] }]);
});
