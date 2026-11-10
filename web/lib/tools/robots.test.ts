import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRobots, pathMatches, robotsPath, robotsVerdict } from "./robots.ts";

test("prefix, wildcard and end-anchored patterns", () => {
  assert.equal(pathMatches("/admin", "/admin/users"), true);
  assert.equal(pathMatches("/admin", "/adm"), false);
  assert.equal(pathMatches("/*.pdf$", "/files/a.pdf"), true);
  assert.equal(pathMatches("/*.pdf$", "/files/a.pdf?x=1"), false);
  assert.equal(pathMatches("/*?", "/search?q=1"), true);
  assert.equal(pathMatches("/", "/anything"), true);
  assert.equal(pathMatches("/a*b*c$", "/axxbyyc"), true);
  assert.equal(pathMatches("/a*b*c$", "/axxbyycd"), false);
});

test("hostile patterns finish quickly", () => {
  const t = Date.now();
  pathMatches("/" + "a*".repeat(200) + "b", "/" + "a".repeat(5000));
  assert.ok(Date.now() - t < 1000);
});

test("bot-specific group beats *, longest rule wins, Allow wins ties", () => {
  const p = parseRobots(["User-agent: *", "Disallow: /private", "Allow: /private/ok", "", "User-agent: GPTBot", "Disallow: /"].join("\n"));
  assert.equal(robotsVerdict(p, "Googlebot", "/private/x").allowed, false);
  assert.equal(robotsVerdict(p, "Googlebot", "/private/ok/1").allowed, true);
  assert.equal(robotsVerdict(p, "GPTBot", "/blog").allowed, false);
  assert.equal(robotsVerdict(p, "GPTBot", "/blog").group, "GPTBot");
  assert.equal(robotsVerdict(p, "ClaudeBot", "/blog").group, "*");
  const tie = parseRobots("User-agent: *\nDisallow: /page\nAllow: /page\n");
  assert.equal(robotsVerdict(tie, "x", "/page").allowed, true);
});

test("grouped user-agents, merged groups, empty disallow, problems and sitemaps", () => {
  const p = parseRobots(["Disallow: /early", "User-agent: a", "User-agent: b", "Disallow: /x", "User-agent: a", "Disallow: /y", "User-agent: c", "Disallow:", "Sitemap: https://e.com/s.xml", "Foo: bar"].join("\n"));
  assert.equal(robotsVerdict(p, "b", "/x").allowed, false);
  assert.equal(robotsVerdict(p, "a", "/y").allowed, false);
  assert.equal(robotsVerdict(p, "c", "/x").allowed, true);
  assert.deepEqual(p.sitemaps, ["https://e.com/s.xml"]);
  assert.equal(p.problems.length, 2);
  assert.equal(robotsVerdict(parseRobots("User-agent: *\nDisallow: /\n"), "x", "/robots.txt").allowed, true);
});

test("robotsPath keeps path and query", () => {
  assert.equal(robotsPath("https://e.com/a/b?c=1#h"), "/a/b?c=1");
  assert.equal(robotsPath("a/b"), "/a/b");
});
