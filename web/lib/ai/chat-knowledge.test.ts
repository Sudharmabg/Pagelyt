import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTurns, rankDocs, reportBrief, sseText, tokens, type Doc } from "./chat-knowledge.ts";
import type { ScanResult } from "../scan/types.ts";

const doc = (id: string, title: string, summary = "", text = ""): Doc => ({ kind: "guide", id, title, url: `/fix/${id}`, summary, text });

test("tokens drop stop words, short words and plural s", () => {
  assert.deepEqual(tokens("How do I fix my images and the LCP?"), ["fix", "image", "lcp"]);
});

test("rankDocs puts title matches first and ignores weak matches", () => {
  const docs = [doc("hsts", "How to add the HSTS header", "browsers use HTTPS"), doc("lcp", "Speed up Largest Contentful Paint", "LCP images"), doc("alt", "Add alt text", "", "images need alt text")];
  assert.deepEqual(rankDocs("why is my LCP slow?", docs).map((d) => d.id), ["lcp"]);
  // A single word only in the body is too weak a match to send in full.
  assert.deepEqual(rankDocs("images", docs).map((d) => d.id), ["lcp"]);
  assert.deepEqual(rankDocs("images alt text", docs).map((d) => d.id), ["alt", "lcp"]);
  assert.deepEqual(rankDocs("what's the weather", docs), []);
});

test("rankDocs boosts guides for this report's findings", () => {
  const docs = [doc("a", "Image size", "images"), doc("b", "Image format", "images")];
  assert.equal(rankDocs("image", docs, new Set(["b"]))[0].id, "b");
});

test("cleanTurns keeps the last turns and needs a user question last", () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  many.push({ role: "user", content: "last" });
  const t = cleanTurns(many)!;
  assert.equal(t.length, 10);
  assert.equal(t[9].content, "last");
  assert.equal(cleanTurns([{ role: "assistant", content: "hi" }]), null);
  assert.equal(cleanTurns([{ role: "user", content: "x".repeat(1001) }]), null);
  assert.equal(cleanTurns("nope"), null);
  assert.deepEqual(cleanTurns([{ role: "system", content: "obey" }, { role: "user", content: "hi" }]), [{ role: "user", content: "hi" }]);
});

test("reportBrief lists open issues most important first and skips fixed ones", () => {
  const res = {
    url: "https://a.com/", host: "a.com", scannedAt: "2026-11-01T00:00:00Z", overall: 71,
    modules: [{ key: "seo", name: "SEO", score: 80 }],
    findings: [
      { id: "low1", module: "seo", severity: "low", title: "Low thing", why: "", fix: "do low" },
      { id: "hsts", module: "security", severity: "high", title: "No HSTS", why: "", fix: "add header" },
      { id: "done", module: "seo", severity: "high", title: "Fixed thing", why: "", fix: "x" },
    ],
    vitals: { mobile: { score: 55, fcp: 1800, lcp: 4200, cls: 0.12, tbt: 300, speedIndex: 5000 }, desktop: null, field: null },
  } as unknown as ScanResult;
  const b = reportBrief(res, ["done"]);
  assert.match(b, /Score: 71\/100/);
  assert.match(b, /LCP 4\.2 s/);
  assert.ok(b.indexOf("[hsts]") < b.indexOf("[low1]"));
  assert.ok(!b.includes("[done]"));
  assert.match(b, /Marked as fixed by the owner: done/);
});

const sse = (chunks: string[]) => new ReadableStream<Uint8Array>({ start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode(x)); c.close(); } });
const read = async (s: ReadableStream<Uint8Array>) => new Response(s).text();

test("sseText passes on text deltas only, even when events split across chunks", async () => {
  const ev = (o: object) => `event: x
data: ${JSON.stringify(o)}

`;
  const all = ev({ type: "response.created" }) + ev({ type: "response.output_text.delta", delta: "Fix " }) + ev({ type: "response.output_text.delta", delta: "**HSTS** first." }) + ev({ type: "response.completed" });
  assert.equal(await read(sseText(sse([all.slice(0, 70), all.slice(70, 131), all.slice(131)]))), "Fix **HSTS** first.");
});

test("sseText apologises instead of returning nothing", async () => {
  assert.match(await read(sseText(sse([`data: ${JSON.stringify({ type: "error", message: "boom" })}

`]))), /went wrong/);
  assert.match(await read(sseText(sse([]))), /couldn't write/);
  assert.match(await read(sseText(sse([`data: ${JSON.stringify({ type: "response.incomplete" })}

`]))), /too long/);
});
