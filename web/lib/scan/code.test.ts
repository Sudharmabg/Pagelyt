import { test } from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { codeFindings, codeInput, findSecrets, isOwn, libsFromBody, libsFromUrl, mask, pickScripts, riskyIn, sourceMapOf, type CodeInput } from "./code";
import { LIBS, affected, cmpVersion } from "./code-libs";

/* Fake keys are assembled at runtime so the source never holds a full key pattern: GitHub push protection
   blocks literal Stripe-style keys, even fake ones. */
const SK_LIVE = ["sk", "live", ""].join("_");

const PAGE = "https://www.example.com/";
const lib = (name: string) => LIBS.find((l) => l.name === name)!;
const input = (over: Partial<CodeInput> = {}): CodeInput => ({ page: PAGE, csp: false, scripts: [], noSri: [], inline: "", handlers: 0, httpForms: [], ...over });

test("versions compare numerically and rules pick affected ranges", () => {
  assert.equal(cmpVersion("3.10.0", "3.9.1"), 1);
  assert.equal(cmpVersion("1.12", "1.12.0"), 0);
  assert.deepEqual(affected(lib("jQuery"), "3.4.1").map((r) => r.cve), ["CVE-2020-11022"]);
  assert.equal(affected(lib("jQuery"), "3.5.0").length, 0);
  assert.equal(affected(lib("jQuery"), "1.8.3").length, 4);
  // Bootstrap 4.0–4.3.0 is affected, 3.4.1 and 4.3.1 are not.
  assert.equal(affected(lib("Bootstrap"), "4.1.3").length, 1);
  assert.equal(affected(lib("Bootstrap"), "3.4.1").length, 0);
  assert.equal(affected(lib("Bootstrap"), "4.3.1").length, 0);
  assert.equal(affected(lib("Underscore"), "1.2.0").length, 0);
});

test("libraries are found from CDN paths and file names", () => {
  const v = (u: string) => libsFromUrl(u).map((f) => `${f.lib.name} ${f.version}`);
  assert.deepEqual(v("https://code.jquery.com/jquery-3.4.1.min.js"), ["jQuery 3.4.1"]);
  assert.deepEqual(v("https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js"), ["jQuery 2.2.4"]);
  assert.deepEqual(v("https://cdn.jsdelivr.net/npm/bootstrap@4.3.1/dist/js/bootstrap.bundle.min.js"), ["Bootstrap 4.3.1"]);
  assert.deepEqual(v("https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.15/lodash.min.js"), ["Lodash 4.17.15"]);
  assert.deepEqual(v("https://example.com/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"), ["jQuery 3.7.1"]);
  assert.deepEqual(v("https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"), ["jQuery UI 1.12.1"]);
  // jQuery's patterns don't fire on its plugins.
  assert.deepEqual(v("https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.19.1/jquery.validate.min.js"), ["jQuery Validation 1.19.1"]);
  assert.deepEqual(v("https://example.com/js/app.4f2a.js"), []);
});

test("libraries are found from banners inside files", () => {
  const v = (b: string) => libsFromBody(b, "x").map((f) => `${f.lib.name} ${f.version}`);
  assert.deepEqual(v("/*! jQuery v3.4.1 | (c) JS Foundation and other contributors | jquery.org/license */"), ["jQuery 3.4.1"]);
  assert.deepEqual(v('!function(){var t={jquery:"1.12.4",constructor:x}}'), ["jQuery 1.12.4"]);
  assert.deepEqual(v("/**\n * @license AngularJS v1.7.9\n * (c) 2010-2018 Google"), ["AngularJS 1.7.9"]);
  // Lodash's banner credits Underscore.js; that is not Underscore itself.
  assert.deepEqual(v("/**\n * @license\n * Lodash lodash.com/license | Underscore.js 1.8.3 underscorejs.org/LICENSE\n */"), []);
  assert.deepEqual(v("//     Underscore.js 1.9.1\n//     https://underscorejs.org"), ["Underscore 1.9.1"]);
});

test("secrets: real formats found and masked, public keys and placeholders skipped", () => {
  const live = SK_LIVE + "4eC39HqLyjWDarjtT1zdp7dc";
  const found = findSecrets(`const a="${live}"; const b="pk_live_abcdefghijklmnopqrstuvwx"; const c="AIzaSyD-abcdefghijklmnopqrstuvwxyz12345";`, "main.js");
  assert.deepEqual(found.map((s) => s.kind), ["Stripe secret key"]);
  assert.ok(!found[0].masked.includes(live.slice(12)));
  assert.equal(findSecrets(`key="${SK_LIVE}xxxxxxxxxxxxxxxxxxxxxxxx"`, "x").length, 0);
  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ iss: "supabase", role })).toString("base64url")}.abcdefghijklmnopqrstuvwxyz0123456789`;
  assert.deepEqual(findSecrets(`a("${jwt("service_role")}")`, "x").map((s) => s.kind), ["Supabase service role key"]);
  assert.equal(findSecrets(`a("${jwt("anon")}")`, "x").length, 0);
  assert.equal(mask("-----BEGIN PRIVATE KEY-----"), "-----BEGIN PRIVATE KEY-----");
});

test("risky patterns and source maps", () => {
  assert.deepEqual(riskyIn("x.eval(1); retrieval(2)"), { eval: false, write: false, domXss: false });
  assert.equal(riskyIn("eval(code)").eval, true);
  assert.equal(riskyIn('el.innerHTML = "<b>" + decodeURIComponent(location.hash.slice(1))').domXss, true);
  assert.equal(riskyIn("el.textContent = location.hash").domXss, false);
  assert.equal(sourceMapOf("var a=1;\n//# sourceMappingURL=main.js.map\n"), "file");
  assert.equal(sourceMapOf("var a=1;\n//# sourceMappingURL=data:application/json;base64,eyJ2"), "inline");
  assert.equal(sourceMapOf("var a=1;"), null);
});

test("codeInput reads the HTML side", () => {
  const html = `<html><head>
    <script src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/x@1.0.0/x.js" integrity="sha384-abc"></script>
    <script src="https://www.googletagmanager.com/gtm.js?id=G-1"></script>
    <script src="/static/app.js"></script>
    <script type="application/ld+json">{"@type":"Organization"}</script>
    <script>window.cfg={a:1}</script>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
  </head><body><button onclick="go()">Go</button><form action="http://example.com/login"><input type="password"></form></body></html>`;
  const i = codeInput(cheerio.load(html), PAGE, { "content-security-policy": undefined });
  assert.equal(i.csp, false);
  assert.equal(i.scripts.length, 4);
  assert.deepEqual(i.noSri, ["https://code.jquery.com/jquery-3.4.1.min.js", "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css"]);
  assert.ok(i.inline.includes("window.cfg") && !i.inline.includes("Organization"));
  assert.equal(i.handlers, 1);
  assert.deepEqual(i.httpForms, [{ action: "http://example.com/login", password: true }]);
  assert.equal(codeInput(cheerio.load(html), PAGE, { "Content-Security-Policy": "default-src 'self'" }).csp, true);
});

test("pickScripts reads own files first and skips analytics", () => {
  assert.ok(isOwn("https://static.example.com/a.js", PAGE));
  assert.ok(!isOwn("https://notexample.com/a.js", PAGE));
  const pick = pickScripts(input({ scripts: ["https://www.googletagmanager.com/gtm.js", "https://cdn.jsdelivr.net/npm/chart.js"] }), [
    "https://www.example.com/_next/static/chunks/vendor.js",
    "https://www.example.com/_next/static/chunks/main-abc.js",
    "https://code.jquery.com/jquery-3.4.1.min.js",
  ]);
  assert.deepEqual(pick, ["https://www.example.com/_next/static/chunks/main-abc.js", "https://www.example.com/_next/static/chunks/vendor.js", "https://cdn.jsdelivr.net/npm/chart.js"]);
});

test("codeFindings: library, secret, maps, SRI, risky only without CSP, forms", () => {
  const files = [
    { url: "https://www.example.com/app.js", body: `eval(x);var k="${SK_LIVE}4eC39HqLyjWDarjtT1zdp7dc";\n//# sourceMappingURL=app.js.map` },
    { url: "https://cdn.other.net/lib.js", body: "/*! jQuery v1.12.4 */ eval(y)" },
  ];
  const inp = input({ noSri: ["https://code.jquery.com/jquery-1.12.4.min.js"], handlers: 2, httpForms: [{ action: "http://example.com/x", password: false }] });
  const { findings, summary } = codeFindings(inp, files.map((f) => f.url), files, true);
  const ids = findings.map((f) => f.id);
  assert.deepEqual(ids, ["code-vuln-lib", "code-secret", "code-source-map", "code-no-sri", "code-risky", "code-form-http"]);
  assert.ok(findings.every((f) => f.module === "code"));
  assert.equal(findings[0].title, "jQuery 1.12.4 has known vulnerabilities (CVE-2020-11022 and 2 more)");
  // eval in a third-party file isn't the site's to fix.
  assert.equal(findings.find((f) => f.id === "code-risky")!.pages!.rows.length, 2);
  assert.equal(summary.files.length, 2);
  assert.deepEqual(summary.libraries, [{ name: "jQuery", version: "1.12.4", vulnerable: true, eol: false }]);
  // With a CSP, the risky-code findings are left out.
  const withCsp = codeFindings({ ...inp, csp: true }, [], files, true).findings.map((f) => f.id);
  assert.ok(!withCsp.includes("code-risky") && !withCsp.includes("code-dom-xss"));
  // Nothing to read, nothing found.
  assert.deepEqual(codeFindings(input(), [], [], false).findings, []);
});
