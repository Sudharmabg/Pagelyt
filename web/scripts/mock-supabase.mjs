/* A tiny fake Supabase (Auth + PostgREST) for trying Pagelyt's sign-up and sign-in flow on your own machine
   with no Supabase project, no keys and no email. Everything lives in memory and is lost when it stops.
   Run it with `npm run dev:mock` (starts this and the site together).

   MOCK_CONFIRM=off (default)  accounts are confirmed instantly, so sign-up goes straight to the dashboard.
   MOCK_CONFIRM=on             like real Supabase with "Confirm email" on: sign-up waits for a confirmation link.
                               Confirm by hand with  http://localhost:54321/__confirm?email=you@example.com  */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.MOCK_PORT || 54321);
const SERVICE_KEY = process.env.MOCK_SERVICE_KEY || "service-test-secret";
const CONFIRM_EMAIL = process.env.MOCK_CONFIRM === "on";

const users = new Map(); // email -> { id, email, password, confirmed, meta }
const sessions = new Map(); // access token -> email
const tables = { scans: [], leads: [], sites: [], profiles: [], comparisons: [], scan_shots: [], brands: [], shared_reports: [] };
// The account plan for every new profile. MOCK_PLAN=professional lets you try the paid-only agency features.
const MOCK_PLAN = process.env.MOCK_PLAN || "free";
const hits = new Map();
const log = { resends: [], signups: 0, logins: 0, redirects: [] };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function tokensFor(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
  sessions.set(access, u.email);
  return { access_token: access, refresh_token: crypto.randomUUID(), token_type: "bearer", expires_in: 3600, expires_at: exp, user: userJson(u) };
}
const userJson = (u) => ({ id: u.id, email: u.email, email_confirmed_at: u.confirmed ? new Date().toISOString() : null, user_metadata: u.meta, identities: [{ id: u.id }] });

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
    const body = raw ? JSON.parse(raw) : {};
    const p = url.pathname;

    // ---- test helpers ----
    if (p === "/__confirm") { const u = users.get(url.searchParams.get("email")); if (u) u.confirmed = true; return send(res, 200, { ok: !!u }); }
    if (p === "/__tokens") { const u = users.get(url.searchParams.get("email")); return send(res, u ? 200 : 404, u ? tokensFor(u) : {}); }
    if (p === "/__state") return send(res, 200, { users: [...users.values()].map((u) => ({ ...u, password: "***" })), leads: tables.leads, scans: tables.scans.map((s) => ({ id: s.id, user_id: s.user_id, status: s.status, url: s.url })), log });
    if (p === "/__seed-scan") { tables.scans.push(body); return send(res, 200, { ok: true }); }

    // ---- GoTrue ----
    if (p === "/auth/v1/signup") {
      log.signups++;
      log.redirects.push(url.searchParams.get("redirect_to"));
      const { email, password, data } = body;
      if (users.has(email)) {
        // Real Supabase: with confirmation on it answers with a look-alike user; with it off it returns an error.
        return CONFIRM_EMAIL ? send(res, 200, { id: crypto.randomUUID(), email, identities: [], user_metadata: {} }) : send(res, 422, { error_code: "user_already_exists", msg: "User already registered" });
      }
      const u = { id: crypto.randomUUID(), email, password, confirmed: !CONFIRM_EMAIL, meta: data ?? {} };
      users.set(email, u);
      return CONFIRM_EMAIL ? send(res, 200, { ...userJson(u), email_confirmed_at: null }) : send(res, 200, tokensFor(u)); // a session straight away
    }
    if (p === "/auth/v1/token") {
      log.logins++;
      const u = users.get(body.email);
      if (!u || u.password !== body.password) return send(res, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
      if (!u.confirmed) return send(res, 400, { error_code: "email_not_confirmed", msg: "Email not confirmed" });
      return send(res, 200, tokensFor(u));
    }
    if (p === "/auth/v1/recover") { log.recovers = (log.recovers || []).concat(body.email); log.recoverRedirect = url.searchParams.get("redirect_to"); return send(res, 200, {}); }
    if (p === "/auth/v1/resend") { log.resends.push(body.email); return send(res, 200, {}); }
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
        const saved = [];
        for (const r of Array.isArray(body) ? body : [body]) {
          const hit = merge && rows.find((x) => conflict.every((c) => String(x[c]) === String(r[c])));
          if (hit) saved.push(Object.assign(hit, r));
          else {
            const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(m[1] === "profiles" ? { plan: MOCK_PLAN, account_type: null } : {}), ...r };
            rows.push(row);
            saved.push(row);
          }
        }
        return /return=representation/.test(String(req.headers.prefer || "")) ? send(res, 201, saved) : send(res, 201);
      }
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
