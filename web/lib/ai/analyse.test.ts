import assert from "node:assert/strict";
import { test } from "node:test";
import { analyse, brandTermsFor, visibilityScore } from "./analyse.ts";

const base = { host: "www.acmeplumbing.in", terms: ["Acme Plumbing"], competitors: ["PipePro", "FixIt Fast"] };

test("brand terms include host, label and extras", () => {
  assert.deepEqual(brandTermsFor("www.acmeplumbing.in", ["Acme Plumbing", "A"]), ["acmeplumbing.in", "acmeplumbing", "Acme Plumbing"]);
});

test("mentioned, cited and ranked first", () => {
  const r = analyse({ ...base, answer: "Acme Plumbing is a well reviewed option. PipePro is another.", citations: ["https://www.acmeplumbing.in/services"] });
  assert.equal(r.mentioned, true);
  assert.equal(r.cited, true);
  assert.equal(r.position, 1);
  assert.deepEqual(r.competitorCounts, { PipePro: 1 });
});

test("ranked behind a competitor named earlier", () => {
  const r = analyse({ ...base, answer: "Try PipePro first, then Acme Plumbing.", citations: [] });
  assert.equal(r.position, 2);
  assert.equal(r.cited, false);
});

test("not mentioned means no position", () => {
  const r = analyse({ ...base, answer: "FixIt Fast and PipePro are popular.", citations: ["https://example.com"] });
  assert.equal(r.mentioned, false);
  assert.equal(r.position, null);
  assert.deepEqual(r.competitorCounts, { "FixIt Fast": 1, PipePro: 1 });
});

test("word boundaries: a longer word does not count", () => {
  const r = analyse({ host: "ace.com", terms: [], competitors: [], answer: "Palace hotels are nice.", citations: [] });
  assert.equal(r.mentioned, false);
});

test("citation on a subdomain counts, a lookalike domain does not", () => {
  assert.equal(analyse({ ...base, answer: "x", citations: ["https://blog.acmeplumbing.in/post"] }).cited, true);
  assert.equal(analyse({ ...base, answer: "x", citations: ["https://notacmeplumbing.in"] }).cited, false);
});

test("visibility score ignores failed runs", () => {
  assert.equal(visibilityScore([{ mentioned: true }, { mentioned: false }, { mentioned: true, error: "x" }]), 50);
  assert.equal(visibilityScore([]), null);
});
