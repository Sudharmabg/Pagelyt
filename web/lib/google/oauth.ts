/* Server only. Google OAuth 2.0 (web server flow with PKCE) and a small fetch helper for Google APIs. No SDK: plain
   REST through fetch, so it stays light on the Worker. In development, GOOGLE_MOCK_URL sends every Google call to
   the mock server (scripts/mock-supabase.mjs) instead. */

export const SCOPES = {
  gsc: "https://www.googleapis.com/auth/webmasters.readonly",
} as const;
export type Product = keyof typeof SCOPES;
const IDENTITY = ["openid", "email"];

export const googleOn = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_KEY);

/** A Google URL, or its stand-in on the mock server. */
export function gUrl(real: string): string {
  const mock = process.env.GOOGLE_MOCK_URL;
  if (!mock) return real;
  const u = new URL(real);
  return `${mock.replace(/\/$/, "")}/google/${u.host}${u.pathname}${u.search}`;
}

export function redirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`;
}

export function authUrl(o: { product: Product; state: string; challenge: string; redirect: string; hint?: string | null }) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: o.redirect,
    response_type: "code",
    // Incremental consent: ask only for this product; earlier grants are kept (include_granted_scopes).
    scope: [...IDENTITY, SCOPES[o.product]].join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent", // always returns a refresh token
    state: o.state,
    code_challenge: o.challenge,
    code_challenge_method: "S256",
  });
  if (o.hint) q.set("login_hint", o.hint);
  return gUrl(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}

type TokenReply = { access_token?: string; refresh_token?: string; scope?: string; id_token?: string; expires_in?: number; error?: string; error_description?: string };

async function token(params: Record<string, string>): Promise<TokenReply> {
  const r = await fetch(gUrl("https://oauth2.googleapis.com/token"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params }),
  });
  const d = (await r.json().catch(() => ({}))) as TokenReply;
  if (!r.ok || !d.access_token) throw new GoogleError(d.error === "invalid_grant" ? "revoked" : "token", d.error_description || d.error || `HTTP ${r.status}`);
  return d;
}

export async function exchangeCode(code: string, verifier: string, redirect: string) {
  const d = await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirect });
  return { access: d.access_token!, refresh: d.refresh_token ?? null, scopes: (d.scope ?? "").split(/\s+/).filter(Boolean), email: emailOf(d.id_token) };
}

export async function refreshAccess(refresh: string): Promise<string> {
  return (await token({ grant_type: "refresh_token", refresh_token: refresh })).access_token!;
}

export async function revoke(tok: string): Promise<void> {
  await fetch(gUrl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok)}`), { method: "POST" }).catch(() => {});
}

/* The id_token comes straight from Google's token endpoint over TLS, so reading its email claim needs no signature check. */
function emailOf(idToken?: string): string | null {
  try {
    const p = idToken?.split(".")[1];
    if (!p) return null;
    const j = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: unknown };
    return typeof j.email === "string" ? j.email : null;
  } catch {
    return null;
  }
}

/** "revoked": the person removed access at Google; "denied": no permission for that property; others are temporary. */
export class GoogleError extends Error {
  constructor(public kind: "revoked" | "denied" | "token" | "api", message: string) {
    super(message);
  }
}

export async function gJson<T>(access: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(gUrl(url), {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${access}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    throw new GoogleError(r.status === 401 ? "revoked" : r.status === 403 ? "denied" : "api", `Google ${r.status}: ${t}`);
  }
  return (await r.json()) as T;
}
