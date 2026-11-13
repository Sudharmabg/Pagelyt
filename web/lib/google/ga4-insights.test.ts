import assert from "node:assert/strict";
import { test } from "node:test";
import { byVisits, channelRows, ga4Brief, ga4Drops, gaPath, lowEngagement, visitsFor, visitsMap, type Ga4Data, type Ga4Page } from "./ga4-insights.ts";
import type { Finding } from "../scan/types.ts";

const T = { sessions: 1000, engaged: 600, users: 800, newUsers: 400, views: 2000, avgDuration: 90, keyEvents: 20 };
const pg = (path: string, sessions: number, engaged: number, prevSessions = sessions): Ga4Page => ({ path, sessions, engaged, views: sessions * 2, prevSessions, prevEngaged: engaged });
const data = (pages: Ga4Page[], extra: Partial<Ga4Data> = {}): Ga4Data => ({
  property: "properties/1",
  name: "Example – GA4",
  range: { start: "2026-10-16", end: "2026-11-12" },
  prevRange: { start: "2026-09-18", end: "2026-10-15" },
  totals: T,
  prev: { ...T, sessions: 800 },
  daily: [],
  pages,
  channels: [],
  pageChannels: [],
  ...extra,
});
const f = (id: string, module: Finding["module"], severity: Finding["severity"], urls?: string[]): Finding => ({ id, module, severity, title: id, why: "", fix: "", ...(urls ? { pages: { cols: [], rows: urls.map((url) => ({ url, cells: [] })) } } : {}) });
const key = (x: Finding) => x.id;

test("gaPath compares URLs and GA4 paths", () => {
  assert.equal(gaPath("https://www.example.com/about/?x=1#top"), "/about");
  assert.equal(gaPath("/about/"), "/about");
  assert.equal(gaPath("https://example.com"), "/");
  assert.equal(gaPath("pricing"), "/pricing");
});

test("visitsFor sums a finding's pages, the whole site for site-wide areas, the homepage otherwise", () => {
  const d = data([pg("/", 500, 300), pg("/a/", 40, 10), pg("/b", 10, 5)]);
  assert.deepEqual(visitsFor(f("t", "seo", "high", ["https://example.com/a", "https://www.example.com/b/", "https://example.com/zzz"]), d), { sessions: 50, engaged: 15, scope: "pages", pages: 2 });
  assert.deepEqual(visitsFor(f("hsts", "security", "medium"), d), { sessions: 1000, engaged: 600, scope: "site", pages: 0 });
  assert.deepEqual(visitsFor(f("meta", "seo", "low"), d), { sessions: 500, engaged: 300, scope: "homepage", pages: 1 });
  const v = visitsMap([f("a", "seo", "low", ["https://example.com/b"]), f("b", "seo", "high", ["https://example.com/a"])], d, key);
  assert.deepEqual(byVisits([f("a", "seo", "low"), f("b", "seo", "high")], v, key).map((x) => x.id), ["b", "a"]);
});

test("ga4Drops finds pages down 30% or more and the channel that lost most", () => {
  const d = data([pg("/a", 30, 10, 100), pg("/b", 90, 50, 100), pg("/c", 2, 1, 10)], {
    pageChannels: [
      { path: "/a", channel: "Organic Search", sessions: 10, prevSessions: 70 },
      { path: "/a", channel: "Direct", sessions: 20, prevSessions: 30 },
    ],
  });
  const dr = ga4Drops(d);
  assert.deepEqual(dr.map((p) => [p.path, p.lost, p.channel, p.channelLost]), [["/a", 70, "Organic Search", 60]]);
});

test("lowEngagement flags busy pages well under the site's rate", () => {
  const d = data([pg("/busy-bad", 400, 80), pg("/busy-ok", 400, 260), pg("/quiet", 20, 1)]);
  assert.deepEqual(lowEngagement(d).map((p) => p.path), ["/busy-bad"]);
});

test("channelRows and ga4Brief", () => {
  const d = data([pg("/", 500, 300), pg("/a", 100, 20, 200)], { channels: [{ channel: "Direct", sessions: 200, engaged: 100, prevSessions: 0 }, { channel: "Organic Search", sessions: 600, engaged: 400, prevSessions: 500 }] });
  assert.deepEqual(channelRows(d).map((c) => [c.channel, c.change]), [["Organic Search", 20], ["Direct", null]]);
  const brief = ga4Brief(d, [f("slow", "performance", "high", ["https://example.com/a"])], key, { insights: [{ title: "Hello", detail: "x", action: "y", priority: "low", pages: [], findings: [] }], basedOn: "t", model: "m" });
  assert.match(brief, /1,000 visits \(\+25% vs the 28 days before\)/);
  assert.match(brief, /\[slow\] 100 visits, 20% engaged/);
  assert.match(brief, /\/a 200→100, issues: slow/);
  assert.match(brief, /AI insights already shown to the owner: Hello/);
});
