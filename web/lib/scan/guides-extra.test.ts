import assert from "node:assert/strict";
import { test } from "node:test";
import { GUIDES } from "./guides.ts";
import { GUIDE_EXTRA, guidesForArea, guidesForTool } from "./guides-extra.ts";

test("every fix guide has its own extra content, and its links point at real guides", () => {
  for (const id of Object.keys(GUIDES)) {
    const x = GUIDE_EXTRA[id];
    assert.ok(x, `${id} has no extra content`);
    assert.ok(x.time && x.mistakes.length >= 2 && x.faq.length >= 2, `${id} is thin`);
    for (const r of x.related) assert.ok(GUIDES[r] && r !== id, `${id} links to missing guide ${r}`);
  }
  for (const id of Object.keys(GUIDE_EXTRA)) assert.ok(GUIDES[id], `extra content for unknown guide ${id}`);
});

test("guidesForArea spreads links and guidesForTool finds the guides a tool helps with", () => {
  assert.equal(guidesForArea("security", "a", 3).length, 3);
  assert.notDeepEqual(guidesForArea("security", "a", 3), guidesForArea("security", "zz", 3));
  assert.deepEqual(guidesForArea("nope", "a"), []);
  assert.ok(guidesForTool("security-headers-generator").includes("hsts"));
});
