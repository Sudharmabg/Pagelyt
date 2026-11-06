import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAnthropic, parseOpenAI, parsePerplexity } from "./parse.ts";

test("perplexity: content plus citations and search_results, deduped", () => {
  const r = parsePerplexity({
    choices: [{ message: { content: "Acme is good." } }],
    citations: ["https://a.com/x"],
    search_results: [{ url: "https://a.com/x", title: "A" }, { url: "https://b.com" }],
  });
  assert.equal(r.answer, "Acme is good.");
  assert.deepEqual(r.citations, ["https://a.com/x", "https://b.com"]);
});

test("openai: message text and url_citation annotations, ignoring tool calls", () => {
  const r = parseOpenAI({
    output: [
      { type: "web_search_call", id: "ws_1" },
      { type: "message", content: [{ type: "output_text", text: "Use Acme. ", annotations: [{ type: "url_citation", url: "https://acme.in/p" }] }, { type: "output_text", text: "Also Pipe.", annotations: [] }] },
    ],
  });
  assert.equal(r.answer, "Use Acme. Also Pipe.");
  assert.deepEqual(r.citations, ["https://acme.in/p"]);
});

test("anthropic: text blocks with citations and search results", () => {
  const r = parseAnthropic({
    content: [
      { type: "server_tool_use", name: "web_search" },
      { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://r.com/1", title: "R" }] },
      { type: "text", text: "Acme leads.", citations: [{ type: "web_search_result_location", url: "https://acme.in" }] },
    ],
  });
  assert.equal(r.answer, "Acme leads.");
  assert.deepEqual(r.citations, ["https://r.com/1", "https://acme.in"]);
});

test("garbage input yields an empty answer, not a crash", () => {
  assert.deepEqual(parsePerplexity({}), { answer: "", citations: [] });
  assert.deepEqual(parseOpenAI({ output: "nope" }), { answer: "", citations: [] });
  assert.deepEqual(parseAnthropic({ content: null }), { answer: "", citations: [] });
});
