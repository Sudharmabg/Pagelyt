import assert from "node:assert/strict";
import { test } from "node:test";

process.env.GOOGLE_TOKEN_KEY = "test-key-for-google-token-encryption-0123";
const { makeState, openToken, pkceChallenge, readState, sealToken } = await import("./crypto.ts");

test("refresh tokens round-trip and are not stored in the clear", async () => {
  const sealed = await sealToken("1//refresh-token-value");
  assert.match(sealed, /^v1\.[\w-]+\.[\w-]+$/);
  assert.ok(!sealed.includes("refresh-token-value"));
  assert.notEqual(sealed, await sealToken("1//refresh-token-value")); // fresh IV each time
  assert.equal(await openToken(sealed), "1//refresh-token-value");
  const [v, iv, ct] = sealed.split(".");
  await assert.rejects(openToken(`${v}.${iv}.${ct.slice(0, -2)}AA`));
});

test("state is signed, carries its data and gives the same PKCE verifier back", async () => {
  const { state, verifier } = await makeState({ u: "user-1", s: "site-1", r: "scan123", p: "gsc" });
  assert.equal(verifier.length, 43);
  const st = await readState(state);
  assert.equal(st?.u, "user-1");
  assert.equal(st?.s, "site-1");
  assert.equal(st?.verifier, verifier);
  assert.match(await pkceChallenge(verifier), /^[\w-]{43}$/);
});

test("a tampered or foreign state is refused", async () => {
  const { state } = await makeState({ u: "user-1", s: "site-1", r: "scan123", p: "gsc" });
  const [body, sig] = state.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), u: "attacker" })).toString("base64url");
  assert.equal(await readState(`${forged}.${sig}`), null);
  assert.equal(await readState("nonsense"), null);
});
