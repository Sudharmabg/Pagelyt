/* A tiny fake Supabase (Auth + PostgREST) for trying Pagelyt's sign-up and sign-in flow on your own machine
   with no Supabase project, no keys and no email. Everything lives in memory and is lost when it stops.
   Run it with `npm run dev:mock` (starts this and the site together).

   MOCK_CONFIRM=off (default)  accounts are confirmed instantly, so sign-up goes straight to the dashboard.
   MOCK_CONFIRM=on             like real Supabase with "Confirm email" on: sign-up waits for the 6-digit email code.
                               Read the code with  http://localhost:54321/__code?email=you@example.com
                               (or confirm by hand with  /__confirm?email=you@example.com).
   MOCK_SESSION_AGE_DAYS=8     tokens claim the sign-in happened that many days ago (tries the 7-day limit). */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.MOCK_PORT || 54321);
const SERVICE_KEY = process.env.MOCK_SERVICE_KEY || "service-test-secret";
const CONFIRM_EMAIL = process.env.MOCK_CONFIRM === "on";

const users = new Map(); // email -> { id, email, password, confirmed, meta }
const sessions = new Map(); // access token -> email
const tables = { site_owners: [], site_claims: [], scans: [], leads: [], sites: [], profiles: [], comparisons: [], scan_shots: [], brands: [], shared_reports: [], ai_prompts: [], ai_runs: [], uptime_checks: [], admins: [], requests: [], google_connections: [], google_links: [], google_cache: [] };
// MOCK_ADMIN_EMAILS=a@x.test,b@x.test seeds the admins table, so those accounts can open /admin once signed up.
for (const email of (process.env.MOCK_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)) tables.admins.push({ email, created_at: new Date().toISOString() });
// The account plan for every new profile. MOCK_PLAN=professional lets you try the paid-only agency features.
const MOCK_PLAN = process.env.MOCK_PLAN || "free";
const hits = new Map();
const log = { resends: [], signups: 0, logins: 0, redirects: [], emails: [] };
const codes = new Map(); // email -> the current 6-digit sign-up code
const newCode = (email) => { const c = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0"); codes.set(email, c); return c; };
const AGE_DAYS = Number(process.env.MOCK_SESSION_AGE_DAYS || 0);
// Primary keys, so "resolution=ignore-duplicates" skips a row that already exists.
const KEYS = { site_owners: ["domain"], site_claims: ["domain", "user_id"] };
const canon = (e) => { const [l, d] = String(e).toLowerCase().split("@"); const base = l.split("+")[0]; return ["gmail.com", "googlemail.com"].includes(d) ? `${base.replaceAll(".", "")}@gmail.com` : `${base}@${d}`; };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function tokensFor(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const signedIn = Math.floor(Date.now() / 1000) - AGE_DAYS * 86400;
  const access = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp, iat: exp - 3600, amr: [{ method: "password", timestamp: signedIn }] })}.sig`;
  sessions.set(access, u.email);
  return { access_token: access, refresh_token: crypto.randomUUID(), token_type: "bearer", expires_in: 3600, expires_at: exp, user: userJson(u) };
}
const userJson = (u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null, email_confirmed_at: u.confirmed ? new Date().toISOString() : null, user_metadata: u.meta, identities: [{ id: u.id }] });

/* PostgREST column selection: "*", "col", "alias:col", "col->key" (JSON) and "col->>key" (JSON as text). */
function project(rows, select) {
  if (!select || select === "*") return rows;
  const cols = select.split(",").map((c) => {
    const [alias, expr] = c.includes(":") ? c.split(":") : [null, c];
    const [col, ...path] = expr.split(/->>?/);
    return { name: alias || path[path.length - 1] || col, col, path, text: expr.includes("->>") };
  });
  return rows.map((r) => Object.fromEntries(cols.map(({ name, col, path, text }) => {
    let v = r[col];
    for (const k of path) v = v == null ? null : v[k];
    return [name, text && v != null ? String(v) : (v ?? null)];
  })));
}

function matches(row, key, expr) {
  if (expr.startsWith("not.")) return !matches(row, key, expr.slice(4));
  const v = row[key];
  const [op, ...rest] = expr.split(".");
  const arg = rest.join(".");
  if (op === "lt") return String(v) < arg;
  if (op === "gt") return String(v) > arg;
  if (op === "eq") return String(v) === arg;
  if (op === "neq") return String(v) !== arg;
  if (op === "gte") return String(v) >= arg;
  if (op === "lte") return String(v) <= arg;
  if (op === "in") return arg.replace(/^\(|\)$/g, "").split(",").includes(String(v));
  if (op === "like") { const [pre, ...rest] = arg.split("*"); const post = rest.join("*"); const t = String(v); return rest.length ? t.length >= pre.length + post.length && t.startsWith(pre) && t.endsWith(post) : t === arg; } // one "*" wildcard
  if (op === "is") return arg === "null" ? v == null : String(v) === arg;
  return true;
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, accept, prefer, x-client-info, x-supabase-api-version, accept-profile, content-profile, range", "access-control-allow-methods": "*" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "OPTIONS") return send(res, 204);
    let raw = "";
    for await (const c of req) raw += c;
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = Object.fromEntries(new URLSearchParams(raw)); } // Google's token endpoint is form-encoded

    const p = url.pathname;

    // ---- test helpers ----
    if (p === "/__confirm") { const u = users.get(url.searchParams.get("email")); if (u) u.confirmed = true; return send(res, 200, { ok: !!u }); }
    if (p === "/__code") { const c = codes.get(url.searchParams.get("email")); return send(res, c ? 200 : 404, { code: c ?? null }); }
    if (p === "/__tokens") { const u = users.get(url.searchParams.get("email")); return send(res, u ? 200 : 404, u ? tokensFor(u) : {}); }
    if (p === "/__state") return send(res, 200, { owners: tables.site_owners, claims: tables.site_claims, users: [...users.values()].map((u) => ({ ...u, password: "***" })), leads: tables.leads, scans: tables.scans.map((s) => ({ id: s.id, user_id: s.user_id, status: s.status, url: s.url })), log });
    // Stand-in for Resend (dev-mock points RESEND_API_URL here): nothing is sent, /__state shows each email.
    if (p === "/emails" && req.method === "POST") { log.emails.push(body); return send(res, 200, { id: crypto.randomUUID() }); }
    if (p === "/__seed-scan") { tables.scans.push(body); return send(res, 200, { ok: true }); }

    // ---- Google (dev-mock sets GOOGLE_MOCK_URL, so every Google call lands here) ----
    if (p.startsWith("/google/")) return mockGoogle(req, res, url, body);

    // ---- GoTrue ----
    // Admin API (service key only): the admin panel lists accounts for owner emails and analytics.
    if (p === "/auth/v1/admin/users") {
      if ((req.headers.authorization || "") !== `Bearer ${SERVICE_KEY}`) return send(res, 401, { msg: "service key required" });
      return send(res, 200, { users: [...users.values()].map(userJson) });
    }
    if (p === "/auth/v1/signup") {
      log.signups++;
      log.redirects.push(url.searchParams.get("redirect_to"));
      const { email, password, data } = body;
      if (users.has(email)) {
        // Real Supabase: with confirmation on it answers with a look-alike user; with it off it returns an error.
        return CONFIRM_EMAIL ? send(res, 200, { id: crypto.randomUUID(), email, identities: [], user_metadata: {} }) : send(res, 422, { error_code: "user_already_exists", msg: "User already registered" });
      }
      const u = { id: crypto.randomUUID(), email, password, confirmed: !CONFIRM_EMAIL, meta: data ?? {}, created_at: new Date().toISOString() };
      users.set(email, u);
      if (CONFIRM_EMAIL) newCode(email);
      return CONFIRM_EMAIL ? send(res, 200, { ...userJson(u), email_confirmed_at: null }) : send(res, 200, tokensFor(u)); // a session straight away
    }
    if (p === "/auth/v1/token") {
      log.logins++;
      const u = users.get(body.email);
      if (!u || u.password !== body.password) return send(res, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
      if (!u.confirmed) return send(res, 400, { error_code: "email_not_confirmed", msg: "Email not confirmed" });
      u.last_sign_in_at = new Date().toISOString();
      return send(res, 200, tokensFor(u));
    }
    if (p === "/auth/v1/recover") { log.recovers = (log.recovers || []).concat(body.email); log.recoverRedirect = url.searchParams.get("redirect_to"); return send(res, 200, {}); }
    if (p === "/auth/v1/resend") { log.resends.push(body.email); const u = users.get(body.email); if (u && !u.confirmed) newCode(body.email); return send(res, 200, {}); }
    if (p === "/auth/v1/verify") {
      const u = users.get(body.email);
      if (!u || !codes.get(body.email) || codes.get(body.email) !== body.token) return send(res, 403, { error_code: "otp_expired", msg: "Token has expired or is invalid" });
      codes.delete(body.email);
      u.confirmed = true;
      return send(res, 200, tokensFor(u));
    }
    if (p === "/auth/v1/user" && req.method === "PUT") {
      const email = sessions.get((req.headers.authorization || "").replace(/^Bearer /, ""));
      const u = email && users.get(email);
      if (!u) return send(res, 401, { msg: "bad jwt" });
      if (body.password) u.password = body.password;
      return send(res, 200, userJson(u));
    }
    if (p === "/auth/v1/user") {
      const email = sessions.get((req.headers.authorization || "").replace(/^Bearer /, ""));
      const u = email && users.get(email);
      return u ? send(res, 200, userJson(u)) : send(res, 401, { msg: "bad jwt" });
    }

    // ---- PostgREST ----
    if (p === "/rest/v1/rpc/email_confirmed") return send(res, 200, [...users.values()].some((u) => u.id === body.p_user && u.confirmed));
    if (p === "/rest/v1/rpc/inbox_has_account") return send(res, 200, [...users.values()].some((u) => canon(u.email) === canon(body.p_email)));
    if (p === "/rest/v1/rpc/account_exists") return send(res, 200, users.has(String(body.p_email).toLowerCase()));
    if (p === "/rest/v1/rpc/rate_limit_hit") {
      const now = Date.now();
      const recent = (hits.get(body.p_key) ?? []).filter((t) => now - t < body.p_window_seconds * 1000);
      if (recent.length >= body.p_limit) return send(res, 200, false);
      hits.set(body.p_key, [...recent, now]);
      return send(res, 200, true);
    }
    const m = p.match(/^\/rest\/v1\/(\w+)$/);
    if (m && tables[m[1]]) {
      const rows = tables[m[1]];
      const filters = [...url.searchParams].filter(([k]) => !["select", "order", "limit", "on_conflict"].includes(k));
      const pick = () => rows.filter((r) => filters.every(([k, e]) => matches(r, k, e)));
      if (req.method === "POST") {
        // Upsert (on_conflict + resolution=merge-duplicates) updates the matching row; otherwise insert.
        const conflict = url.searchParams.get("on_conflict")?.split(",");
        const merge = conflict && /merge-duplicates/.test(String(req.headers.prefer || ""));
        const ignore = /ignore-duplicates/.test(String(req.headers.prefer || "")) && KEYS[m[1]];
        const saved = [];
        for (const r of Array.isArray(body) ? body : [body]) {
          const hit = merge && rows.find((x) => conflict.every((c) => String(x[c]) === String(r[c])));
          if (ignore && rows.some((x) => ignore.every((c) => String(x[c]) === String(r[c])))) continue;
          if (hit) saved.push(Object.assign(hit, r));
          else {
            const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(m[1] === "profiles" ? { plan: MOCK_PLAN, account_type: null } : {}), ...(m[1] === "requests" ? { status: "new" } : {}), ...(m[1] === "sites" ? { cadence: "none", uptime: false, next_run_at: null, brand_terms: [], competitors: [], ai_track: false } : {}), ...r };
            rows.push(row);
            saved.push(row);
          }
        }
        return /return=representation/.test(String(req.headers.prefer || "")) ? send(res, 201, saved) : send(res, 201);
      }
      if (req.method === "DELETE") { for (const r of pick()) rows.splice(rows.indexOf(r), 1); return send(res, 204); }
      if (req.method === "PATCH") { for (const r of pick()) Object.assign(r, body); return send(res, 204); }
      if (req.method === "GET") {
        let out = pick();
        const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
        if (m[1] === "scans" && bearer !== SERVICE_KEY) {
          const email = sessions.get(bearer); const u = email && users.get(email);
          out = out.filter((r) => u && r.user_id === u.id);
        }
        if (String(req.headers.accept || "").includes("pgrst.object")) {
          if (out.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
          return send(res, 200, out[0]);
        }
        const order = url.searchParams.get("order");
        if (order) { const [c, d] = order.split("."); out = [...out].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (d === "desc" ? -1 : 1)); }
        const lim = Number(url.searchParams.get("limit") || 0);
        // A profile exists for every signed-in user in this mock, created on first read.
        if (m[1] === "profiles" && !out.length) {
          const uid = url.searchParams.get("user_id")?.replace(/^eq\./, "");
          if (uid) { const row = { user_id: uid, plan: MOCK_PLAN, account_type: null, created_at: new Date().toISOString() }; rows.push(row); out = [row]; }
        }
        return send(res, 200, project(lim ? out.slice(0, lim) : out, url.searchParams.get("select")));
      }
    }
    send(res, 404, { msg: `mock: no route ${req.method} ${p}` });
  })
  .listen(PORT, () => console.log(`[mock supabase] listening on ${PORT} (email confirmation ${CONFIRM_EMAIL ? "ON" : "off"}); data is kept in memory only`));

/* ---------- fake Google: consent, tokens, Search Console ----------
   MOCK_GOOGLE=deny makes the consent screen decline; MOCK_GOOGLE=noscope grants sign-in but not Search Console;
   MOCK_GOOGLE=empty gives an account with no Search Console properties. The numbers are made up but stable. */
const MOCK_GOOGLE = process.env.MOCK_GOOGLE || "";
const gCodes = new Map(); // code -> scope
function hashN(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 2 ** 32; }
function mockGoogle(req, res, url, body) {
  const rest = url.pathname.slice("/google/".length);
  const host = rest.split("/")[0];
  const path = rest.slice(host.length);
  if (host === "accounts.google.com" && path === "/o/oauth2/v2/auth") {
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.searchParams.set("state", url.searchParams.get("state") || "");
    if (MOCK_GOOGLE === "deny") back.searchParams.set("error", "access_denied");
    else {
      const code = `mock-${crypto.randomUUID()}`;
      const scope = (url.searchParams.get("scope") || "").split(" ").filter((x) => MOCK_GOOGLE !== "noscope" || !x.includes("webmasters")).join(" ");
      gCodes.set(code, scope);
      back.searchParams.set("code", code);
    }
    res.writeHead(302, { location: back.toString() });
    return res.end();
  }
  if (host === "oauth2.googleapis.com" && path === "/token") {
    if (body.grant_type === "authorization_code") {
      const scope = gCodes.get(body.code);
      if (!scope || !body.code_verifier) return send(res, 400, { error: "invalid_grant" });
      gCodes.delete(body.code);
      return send(res, 200, { access_token: `gat-${crypto.randomUUID()}`, refresh_token: `grt-${crypto.randomUUID()}`, scope: scope.replace(/\bemail\b/, "https://www.googleapis.com/auth/userinfo.email"), expires_in: 3599, id_token: `x.${b64({ email: "owner@gmail.example" })}.y` });
    }
    if (body.grant_type === "refresh_token") return String(body.refresh_token).startsWith("grt-") ? send(res, 200, { access_token: `gat-${crypto.randomUUID()}`, expires_in: 3599 }) : send(res, 400, { error: "invalid_grant" });
    return send(res, 400, { error: "unsupported_grant_type" });
  }
  if (host === "oauth2.googleapis.com" && path === "/revoke") return send(res, 200, {});
  if (!/^Bearer gat-/.test(String(req.headers.authorization || ""))) return send(res, 401, { error: { code: 401 } });
  const props = () => MOCK_GOOGLE === "empty" ? [] : [...new Set(tables.sites.map((x) => x.host.replace(/^www\./, "")))].flatMap((h) => [{ siteUrl: `sc-domain:${h}`, permissionLevel: "siteOwner" }]).concat([{ siteUrl: "https://another-site.example/", permissionLevel: "siteFullUser" }]);
  if (host === "www.googleapis.com" && path === "/webmasters/v3/sites") return send(res, 200, { siteEntry: props() });
  const sa = path.match(/^\/webmasters\/v3\/sites\/(.+)\/searchAnalytics\/query$/);
  if (host === "www.googleapis.com" && sa) {
    const prop = decodeURIComponent(sa[1]);
    const h = prop.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const scan = [...tables.scans].reverse().find((x) => x.result && x.host.replace(/^www\./, "") === h.replace(/^www\./, ""));
    const urls = [...new Set([scan?.result?.url, ...(scan?.result?.crawl?.list ?? []).map((x) => x.url)].filter(Boolean))];
    if (!urls.length) urls.push(`https://${h}/`);
    const seed = body.startDate;
    const page = (u) => { const r = hashN(u + seed); const r0 = hashN(u); const imp = Math.round(200 + r0 * 6000 * (u === urls[0] ? 3 : 1) * (0.6 + r * 0.8)); const pos = 2 + r0 * 22; const ctr = Math.max(0.003, (pos < 10 ? 0.22 / pos : 0.006) * (0.4 + hashN(u + "c") * 1.2)); return { keys: [u], clicks: Math.round(imp * ctr), impressions: imp, ctr, position: pos }; };
    const dims = body.dimensions || [];
    let rows;
    if (!dims.length) { const all = urls.map(page); const c = all.reduce((a, x) => a + x.clicks, 0); const i = all.reduce((a, x) => a + x.impressions, 0); rows = [{ clicks: c, impressions: i, ctr: c / i, position: all.reduce((a, x) => a + x.position * x.impressions, 0) / i }]; }
    else if (dims[0] === "page") rows = urls.map(page);
    else if (dims[0] === "date") { rows = []; const d0 = new Date(body.startDate); for (let k = 0; k < 28; k++) { const d = new Date(d0.getTime() + k * 86400000).toISOString().slice(0, 10); const imp = Math.round(800 + hashN(d) * 600); rows.push({ keys: [d], clicks: Math.round(imp * 0.04), impressions: imp, ctr: 0.04, position: 9 }); } }
    else { const words = ["pricing", "reviews", "near me", "how to", "best", "alternatives", "login", "contact"]; rows = urls.flatMap((u) => words.slice(0, 3 + Math.floor(hashN(u) * 5)).map((w) => { const r = hashN(u + w); const imp = Math.round(20 + r * 900); const pos = 1.5 + hashN(w + u) * 24; return { keys: [`${h.split(".")[0]} ${w}`, u], clicks: Math.round(imp * (pos < 10 ? 0.15 / pos : 0.005)), impressions: imp, ctr: pos < 10 ? 0.15 / pos : 0.005, position: pos }; })); }
    return send(res, 200, { rows, responseAggregationType: "byPage" });
  }
  if (host === "searchconsole.googleapis.com" && path === "/v1/urlInspection/index:inspect") {
    const u = body.inspectionUrl;
    const bad = hashN(u + "idx") < 0.25;
    return send(res, 200, { inspectionResult: { indexStatusResult: { verdict: bad ? "NEUTRAL" : "PASS", coverageState: bad ? "Crawled - currently not indexed" : "Submitted and indexed", lastCrawlTime: new Date(Date.now() - hashN(u) * 20 * 86400000).toISOString(), googleCanonical: u, userCanonical: u } } });
  }
  return send(res, 404, { error: { code: 404, message: `mock Google has no ${host}${path}` } });
}
