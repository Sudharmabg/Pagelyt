import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionFresh, signedInAt } from "./session-age.ts";
test("sessions end 7 days after sign-in, however often they were refreshed", () => {
  const tok = (p: object) => `x.${Buffer.from(JSON.stringify(p)).toString("base64url")}.s`;
  const now = Date.now(), s = Math.floor(now / 1000);
  assert.equal(sessionFresh(tok({ amr: [{ method: "password", timestamp: s - 6 * 86400 }], iat: s })), true);
  assert.equal(sessionFresh(tok({ amr: [{ method: "password", timestamp: s - 8 * 86400 }], iat: s })), false); // refreshed, but signed in 8 days ago
  assert.equal(sessionFresh(tok({ amr: [{ method: "otp", timestamp: s - 7 * 86400 - 5 }] })), false);
  assert.equal(sessionFresh("garbage"), true);
  assert.equal(signedInAt(tok({ iat: s })), s * 1000);
});
