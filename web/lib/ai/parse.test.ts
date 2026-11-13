import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOpenAI } from "./parse.ts";

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

test("garbage input yields an empty answer, not a crash", () => {
  assert.deepEqual(parseOpenAI({ output: "nope" }), { answer: "", citations: [] });
});
