import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCode, checkEmail, checkLead, checkName, checkPassword, passwordsMatch } from "./validate.ts";

const val = <T>(r: { ok: boolean; value?: T }) => (r.ok ? r.value : null);

test("name: accepts real names, normalises spacing", () => {
  assert.equal(val(checkName("  Asha   Rao ")), "Asha Rao");
  assert.equal(val(checkName("Mary-Anne O'Neil Jr.")), "Mary-Anne O'Neil Jr.");
  assert.equal(val(checkName("José Müller")), "José Müller");
  assert.equal(val(checkName("राहुल शर्मा")), "राहुल शर्मा");
  assert.equal(val(checkName("李小龍")), "李小龍");
});

test("name: rejects markup, URLs, digits, control characters and bad lengths", () => {
  for (const bad of ["<script>alert(1)</script>", "Bob <b>x</b>", "http://evil.com", "a@b.com", "Bob1", "x", "", "  ", "A\u0000B", "A\nB\rC", " -Bob", "'; DROP TABLE leads;--"]) {
    assert.equal(checkName(bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(checkName("a".repeat(101)).ok, false);
  assert.equal(checkName("a".repeat(100)).ok, true);
  for (const nonString of [null, undefined, 5, {}, [], ["Bob"]]) assert.equal(checkName(nonString).ok, false);
});

test("email: lowercases and trims, accepts normal addresses", () => {
  assert.equal(val(checkEmail("  Asha.Rao+news@Example.CO.in ")), "asha.rao+news@example.co.in");
  assert.equal(val(checkEmail("a@b.io")), "a@b.io");
});

test("email: rejects header injection, spaces, bad shapes and over-long values", () => {
  const bad = [
    "a@b.com\r\nBcc: victim@x.com", "a@b.com\nSubject: hi", "a b@c.com", "a@b", "@b.com", "a@.com", "a@b..com", "a..b@c.com",
    ".a@b.com", "a.@b.com", "a@-b.com", "a@b-.com", "a@b.c", "a@b.com,c@d.com", "<a@b.com>", "a@b.com;", "a@@b.com", "",
  ];
  for (const e of bad) assert.equal(checkEmail(e).ok, false, JSON.stringify(e));
  assert.equal(checkEmail(`${"a".repeat(65)}@b.com`).ok, false); // local part over 64
  assert.equal(checkEmail(`a@${"b".repeat(250)}.com`).ok, false); // over 254 overall
  assert.equal(checkEmail(undefined).ok, false);
});

test("email: a hostile long input is rejected quickly (no catastrophic backtracking)", () => {
  const t0 = Date.now();
  checkEmail("a".repeat(60) + "@" + "a-".repeat(120) + "!");
  checkEmail("a.".repeat(120) + "@b.com");
  checkEmail(`${"a".repeat(64)}@${("b".repeat(61) + ".").repeat(4)}`);
  assert.ok(Date.now() - t0 < 200);
});

test("password: length, byte limit, common and personal passwords", () => {
  assert.equal(checkPassword("correct horse battery").ok, true);
  assert.equal(checkPassword("Tr0ub4dor&3x").ok, true);
  assert.equal(checkPassword("short1").ok, false);
  assert.equal(checkPassword("a".repeat(73)).ok, false);
  assert.equal(checkPassword("éa".repeat(24) + "é").ok, false); // 49 characters but 74 bytes
  assert.equal(checkPassword("éa".repeat(24)).ok, true); // 48 characters, exactly 72 bytes
  assert.equal(checkPassword("é".repeat(40)).ok, false); // one repeated character is too easy to guess
  for (const weak of ["password", "Password123", "12345678", "aaaaaaaa", "qwertyuiop", "PAGELYT123"]) assert.equal(checkPassword(weak).ok, false, weak);
  assert.equal(checkPassword("asharao@example.com", "asharao@example.com").ok, false);
  assert.equal(checkPassword("asharao12", "asharao12@example.com").ok, false); // local part
  assert.equal(checkPassword("abc\u0000defgh").ok, false);
  assert.equal(checkPassword(undefined).ok, false);
});

test("passwords must match", () => {
  assert.equal(passwordsMatch("abc", "abc"), null);
  assert.ok(passwordsMatch("abc", "abd"));
});

test("lead: returns normalised name and email or the first error", () => {
  assert.deepEqual(checkLead({ name: " Asha  Rao ", email: "ASHA@Example.com" }), { lead: { name: "Asha Rao", email: "asha@example.com" } });
  assert.deepEqual(checkLead({ name: "<b>", email: "a@b.com" }), { error: "Names can only use letters, spaces, apostrophes, full stops and hyphens." });
  assert.ok("error" in checkLead({ name: "Asha Rao", email: "nope" }));
  assert.ok("error" in checkLead(undefined));
});

test("lead: a phone number is ignored, never stored", () => {
  assert.deepEqual(checkLead({ name: "Asha Rao", email: "asha@example.com", phone: "+91 98765 43210" } as never), { lead: { name: "Asha Rao", email: "asha@example.com" } });
});

test("code: six digits, spaces and dashes allowed", () => {
  assert.equal(val(checkCode(" 123 456 ")), "123456");
  assert.equal(val(checkCode("123-456")), "123456");
  for (const bad of ["12345", "1234567", "abcdef", "", undefined, 123456]) assert.equal(checkCode(bad).ok, false, String(bad));
});
