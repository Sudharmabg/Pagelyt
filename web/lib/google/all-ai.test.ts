import assert from "node:assert/strict";
import { test } from "node:test";
import { allBasis, cleanAllInsights, journeyTable, productsIn, type AllInput } from "./all-ai.ts";
import { cleanList } from "./ga4-ai.ts";
import type { Ga4Data } from "./ga4-insights.ts";
import type { GscData } from "./gsc-insights.ts";
import type { ScanResult } from "../scan/types.ts";

const T = { sessions: 100, engaged: 60, users: 80, newUsers: 40, views: 200, avgDuration: 90, keyEvents: 2 };
const ga4 = {
  property: "properties/1", name: null,
  range: { start: "2026-10-16", end: "2026-11-12" }, prevRange: { start: "2026-09-18", end: "2026-10-15" },
  totals: T, prev: T, daily: [], channels: [], pageChannels: [],
  pages: [{ path: "/pricing", sessions: 20, engaged: 10, views: 50, prevSessions: 60, prevEngaged: 30 }],
} as Ga4Data;
const gsc = {
  property: "sc-domain:example.com",
  range: { start: "2026-10-16", end: "2026-11-12" }, prevRange: { start: "2026-09-18", end: "2026-10-15" },
  totals: { clicks: 40, impressions: 900, ctr: 0.04, position: 8, prevClicks: 50, prevImpressions: 800 },
  daily: [], queries: [], inspections: [],
  pages: [{ url: "https://example.com/pricing", clicks: 30, impressions: 500, ctr: 0.06, position: 4.25, prevClicks: 45, prevImpressions: 450 }],
} as unknown as GscData;
const res = {
  host: "example.com", url: "https://example.com/", scannedAt: "2026-11-12T00:00:00Z", overall: 70, modules: [],
  findings: [{ id: "slow-lcp", module: "performance", severity: "high", title: "Slow", why: "", fix: "", pages: { cols: [], rows: [{ url: "https://example.com/pricing", cells: [] }] } }],
} as unknown as ScanResult;
const both: AllInput = { gsc: { data: gsc, at: "A" }, ga4: { data: ga4, at: "B" } };

test("allBasis and productsIn follow the connected products in a fixed order", () => {
  assert.equal(allBasis(both), "gsc:A|ga4:B");
  assert.deepEqual(productsIn(both), ["gsc", "ga4"]);
  assert.equal(allBasis({ ga4: { data: ga4, at: "B" }, ads: null }), "ga4:B");
});

test("the page journey joins search and visits on the same path, with its issues", () => {
  const t = journeyTable(both, res);
  assert.match(t, /^\/pricing \| search clicks 30 \(before 45\), position 4\.3 \| visits 20 \(before 60\), engaged 50% \| issues slow-lcp$/);
});

test("cleanList keeps the new metric, now, gain, steps and sources fields", () => {
  const out = cleanList(
    { insights: [{ title: "Pricing loses visits", detail: "x", metric: "visits", now: "20 visits", gain: "+30 visits a month", steps: ["One", "", "Two", "Three", "Four"], priority: "high", pages: ["/pricing"], findings: ["slow-lcp"], sources: ["gsc", "ga4", "bing"] },
      { title: "Odd", detail: "y", metric: "nonsense", action: "Old style", priority: "low", pages: [], findings: [] }] },
    new Set(["/pricing"]), new Set(["slow-lcp"]));
  assert.deepEqual(out, [
    { title: "Pricing loses visits", detail: "x", action: "One", priority: "high", pages: ["/pricing"], findings: ["slow-lcp"], metric: "visits", now: "20 visits", gain: "+30 visits a month", steps: ["One", "Two", "Three"], sources: ["gsc", "ga4"] },
    { title: "Odd", detail: "y", action: "Old style", priority: "low", pages: [], findings: [] },
  ]);
});

test("combined insights may only point at pages from the connected products", () => {
  const out = cleanAllInsights({ insights: [{ title: "t", detail: "d", steps: ["s"], priority: "medium", pages: ["/pricing", "/nope"], findings: [] }] }, both, res);
  assert.deepEqual(out[0].pages, ["/pricing"]);
});
