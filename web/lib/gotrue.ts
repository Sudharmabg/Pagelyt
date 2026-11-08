/* Server-side calls to Supabase Auth (GoTrue). The sign-up and sign-in endpoints go through here so every
   attempt is validated, human-checked and rate-limited in one place before it reaches Supabase.
   Passwords pass through to Supabase over HTTPS and are never logged or stored by this app. */

const base = () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// The anon key is a build-time variable; fall back to the service key so a missing one cannot lock everyone out.
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const authConfigured = () => !!(base() && anon());

export type Tokens = { access_token: string; refresh_token: string; expires_in?: number };
type GoTrueError = { code?: number; error_code?: string; msg?: string; error?: string; error_description?: string };

async function call(path: string, body: unknown, redirectTo?: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const url = new URL(`${base()}/auth/v1/${path}`);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { apikey: anon()!, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: r.status, json };
  } catch {
    return { status: 502, json: {} };
  }
}

const codeOf = (j: Record<string, unknown>) => String((j as GoTrueError).error_code ?? (j as GoTrueError).error ?? "");

const isTokens = (j: Record<string, unknown>): j is Tokens & Record<string, unknown> =>
  typeof j.access_token === "string" && typeof j.refresh_token === "string";

export type SignUpResult =
  | { ok: true; session: Tokens | null; created: boolean } // session is null while the email still has to be confirmed
  | { ok: false; reason: "weak" | "unavailable" };

export async function signUp(email: string, password: string, meta: { name: string; phone: string }, redirectTo: string): Promise<SignUpResult> {
  const { status, json } = await call("signup", { email, password, data: meta }, redirectTo);
  if (status >= 200 && status < 300) {
    // When the address already has an account Supabase answers with a look-alike user that has no identities.
    const created = Array.isArray(json.identities) ? json.identities.length > 0 : true;
    return { ok: true, created, session: isTokens(json) ? { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: Number(json.expires_in) || undefined } : null };
  }
  const code = codeOf(json);
  if (code === "weak_password") return { ok: false, reason: "weak" };
  // An address that already has an account is reported exactly like success, so this endpoint cannot be used
  // to discover which emails are registered (the email-check endpoint is the only, rate-limited, place that does).
  if (code === "user_already_exists" || code === "email_exists") return { ok: true, session: null, created: false };
  return { ok: false, reason: "unavailable" };
}

export type SignInResult =
  | { ok: true; session: Tokens }
  | { ok: false; reason: "invalid" | "unverified" | "unavailable" };

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const { status, json } = await call("token?grant_type=password", { email, password });
  if (status === 200 && isTokens(json)) return { ok: true, session: { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: Number(json.expires_in) || undefined } };
  const code = codeOf(json);
  if (code === "email_not_confirmed") return { ok: false, reason: "unverified" };
  if (status === 400 || status === 401 || status === 422 || code === "invalid_credentials") return { ok: false, reason: "invalid" };
  return { ok: false, reason: "unavailable" };
}

/** Sends the confirmation email again. Always resolves quietly: the caller never reveals whether the address exists. */
export async function resendConfirmation(email: string, redirectTo: string): Promise<void> {
  await call("resend", { type: "signup", email }, redirectTo);
}

/** Sends a password-reset email. Always resolves quietly: the caller never reveals whether the address exists. */
export async function recover(email: string, redirectTo: string): Promise<void> {
  await call("recover", { email }, redirectTo);
}

/** Reads a small JSON body. Returns null for anything oversized, malformed or not an object. */
export async function readJson(req: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const NO_STORE = { "cache-control": "no-store" } as const;

export const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
