import { test } from "node:test";
import assert from "node:assert/strict";
import { compareHtml } from "./rendered.ts";

const page = (head: string, body: string) => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

test("a server-rendered page reads the same", () => {
  const html = page('<title>Plumbers in Pune</title><meta name="description" content="Fast call-outs">', "<h1>Plumbers</h1><p>We fix leaks across Pune, day and night.</p>");
  const r = compareHtml(html, html, "https://example.com/");
  assert.equal(r.verdict, "same");
  assert.equal(r.facts.filter((f) => f.changed).length, 0);
  assert.deepEqual(r.onlyRendered, []);
});

test("a client-rendered app needs JavaScript", () => {
  const raw = page("<title></title>", '<div id="root"></div><script>render()</script>');
  const ren = page(
    '<title>Shop</title><link rel="canonical" href="/shop"><script type="application/ld+json">{"@type":"Product","name":"Mug"}</script>',
    '<div id="root"><h1>Mugs</h1><ul><li><a href="/a">Blue mug with a long handle</a></li></ul><p>Hand-made stoneware mugs, shipped across India.</p></div>',
  );
  const r = compareHtml(raw, ren, "https://example.com/shop");
  assert.equal(r.verdict, "heavy");
  const f = Object.fromEntries(r.facts.map((x) => [x.key, x]));
  assert.equal(f.title.changed, true);
  assert.equal(f.canonical.rendered, "https://example.com/shop");
  assert.equal(f.jsonld.rendered, "Product");
  assert.equal(f.h1.raw, "");
  // The link text sits inside the list item, so it is listed once.
  assert.deepEqual(r.onlyRendered, ["Mugs", "Blue mug with a long handle", "Hand-made stoneware mugs, shipped across India."]);
});

test("text that moved to another tag is not reported as new", () => {
  const raw = page("<title>A</title>", "<div>Opening hours: 9 to 5</div>");
  const ren = page("<title>A</title>", "<p>Opening hours: 9 to 5</p>");
  const r = compareHtml(raw, ren, "https://example.com/");
  assert.deepEqual(r.onlyRendered, []);
  assert.equal(r.verdict, "same");
});
