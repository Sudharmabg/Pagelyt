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
  | { ok: true; session: Tokens | null; created: boolean; userId: string | null } // session is null while the email still has to be confirmed
  | { ok: false; reason: "weak" | "invalid_email" | "email_limit" | "unavailable" };

export async function signUp(email: string, password: string, meta: { name: string }, redirectTo: string): Promise<SignUpResult> {
  const { status, json } = await call("signup", { email, password, data: meta }, redirectTo);
  if (status >= 200 && status < 300) {
    // When the address already has an account Supabase answers with a look-alike user that has no identities.
    const user = (json.user && typeof json.user === "object" ? json.user : json) as { id?: unknown; identities?: unknown };
    const created = Array.isArray(user.identities) ? user.identities.length > 0 : true;
    const userId = created && typeof user.id === "string" ? user.id : null;
    return { ok: true, created, userId, session: isTokens(json) ? { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: Number(json.expires_in) || undefined } : null };
  }
  const code = codeOf(json);
  if (code === "weak_password") return { ok: false, reason: "weak" };
  // An address that already has an account is reported exactly like success, so this endpoint cannot be used
  // to discover which emails are registered (the email-check endpoint is the only, rate-limited, place that does).
  if (code === "user_already_exists" || code === "email_exists") return { ok: true, session: null, created: false, userId: null };
  if (code === "email_address_invalid" || code === "validation_failed") return { ok: false, reason: "invalid_email" };
  if (code === "over_email_send_rate_limit" || status === 429) return { ok: false, reason: "email_limit" };
  // Everything else is a setup problem (for example "email_address_not_authorized": Supabase's built-in mailer only
  // sends to the project's team, so a custom SMTP sender is needed). Logged without the password, for `wrangler tail`.
  console.error(`signup: Supabase answered ${status} ${code || "(no code)"} ${String((json as GoTrueError).msg ?? "")}`.trim());
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

export type VerifyResult = { ok: true; session: Tokens } | { ok: false; reason: "wrong" | "unavailable" };

/** Confirms a new account with the 6-digit code from its sign-up email, and signs it in. */
export async function verifyEmailCode(email: string, code: string): Promise<VerifyResult> {
  let last = 0;
  // "email" is the current type for an email code; older projects still issue sign-up codes as "signup".
  for (const type of ["email", "signup"]) {
    const { status, json } = await call("verify", { type, email, token: code });
    if (status === 200 && isTokens(json)) return { ok: true, session: { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: Number(json.expires_in) || undefined } };
    last = status;
    if (status >= 500 || status === 429) break;
  }
  return last >= 400 && last < 500 && last !== 429 ? { ok: false, reason: "wrong" } : { ok: false, reason: "unavailable" };
}

/** Sends the confirmation email again. Always resolves quietly: the caller never reveals whether the address exists. */
export async function resendConfirmation(email: string, redirectTo: string): Promise<void> {
  await call("resend", { type: "signup", email }, redirectTo);
}

/** Sends a password-reset email. Always resolves quietly: the caller never reveals whether the address exists. */
/** Asks Supabase to email the reset code. Supabase answers the same for known and unknown addresses, so the result
    says only whether the email could be sent: "limited" (its email rate limit) or "failed" (SMTP or setup). */
export async function recover(email: string, redirectTo: string): Promise<"sent" | "limited" | "failed"> {
  const { status, json } = await call("recover", { email }, redirectTo);
  if (status >= 200 && status < 300) return "sent";
  console.error(`recover: Supabase answered ${status} ${codeOf(json) || String(json.msg ?? json.message ?? "").slice(0, 120)}`);
  return status === 429 ? "limited" : "failed";
}

/** Checks the 6-digit code from a password-reset email. On success the person holds a short recovery session. */
export async function verifyRecoveryCode(email: string, code: string): Promise<VerifyResult> {
  const { status, json } = await call("verify", { type: "recovery", email, token: code });
  if (status === 200 && isTokens(json)) return { ok: true, session: { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: Number(json.expires_in) || undefined } };
  return status >= 400 && status < 500 && status !== 429 ? { ok: false, reason: "wrong" } : { ok: false, reason: "unavailable" };
}

export type PasswordResult = { ok: true } | { ok: false; reason: "weak" | "same" | "reauth" | "unavailable" };

/** Sets a new password for the account the access token belongs to. */
export async function setPassword(accessToken: string, password: string): Promise<PasswordResult> {
  try {
    const r = await fetch(`${base()}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: anon()!, authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (r.ok) return { ok: true };
    const code = codeOf((await r.json().catch(() => ({}))) as Record<string, unknown>);
    if (code === "weak_password") return { ok: false, reason: "weak" };
    if (code === "same_password") return { ok: false, reason: "same" };
    if (code === "reauthentication_needed" || code === "reauthentication_not_valid") return { ok: false, reason: "reauth" };
    console.error(`password: Supabase answered ${r.status} ${code || "(no code)"}`);
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** Ends every other session of this account (other browsers and devices). This one stays signed in. */
export async function signOutOthers(accessToken: string): Promise<void> {
  await fetch(`${base()}/auth/v1/logout?scope=others`, { method: "POST", headers: { apikey: anon()!, authorization: `Bearer ${accessToken}` } }).catch(() => {});
}

/* ---- Google and GitHub sign-in ---- */

export type OAuthUser = {
  id: string;
  email: string | null;
  verified: boolean;
  createdAt: number;
  lastSignInAt: number;
  providers: string[];
  meta: Record<string, unknown>;
  app: Record<string, unknown>;
};

function toOAuthUser(u: Record<string, unknown>): OAuthUser | null {
  if (typeof u.id !== "string") return null;
  const ids = Array.isArray(u.identities) ? (u.identities as { provider?: unknown }[]) : [];
  return {
    id: u.id,
    email: typeof u.email === "string" && u.email ? u.email.toLowerCase() : null,
    verified: !!u.email_confirmed_at,
    createdAt: Date.parse(String(u.created_at ?? "")) || 0,
    lastSignInAt: Date.parse(String(u.last_sign_in_at ?? "")) || 0,
    providers: ids.map((i) => String(i.provider ?? "")).filter(Boolean),
    meta: u.user_metadata && typeof u.user_metadata === "object" ? (u.user_metadata as Record<string, unknown>) : {},
    app: u.app_metadata && typeof u.app_metadata === "object" ? (u.app_metadata as Record<string, unknown>) : {},
  };
}

export type ExchangeResult = { ok: true; session: Tokens; user: OAuthUser } | { ok: false; reason: "invalid" | "unavailable" };

/** Swaps the one-time code Supabase sent back from Google or GitHub (PKCE) for a session. */
export async function exchangeCode(code: string, verifier: string): Promise<ExchangeResult> {
  const { status, json } = await call("token?grant_type=pkce", { auth_code: code, code_verifier: verifier });
  if (status === 200 && isTokens(json)) {
    const user = toOAuthUser((json.user ?? {}) as Record<string, unknown>);
    if (user) return { ok: true, user, session: { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: Number(json.expires_in) || undefined } };
  }
  if (status >= 400 && status < 500 && status !== 429) return { ok: false, reason: "invalid" };
  console.error(`oauth: Supabase answered ${status} ${codeOf(json) || "(no code)"}`);
  return { ok: false, reason: "unavailable" };
}

/** The account behind an access token, with its sign-in methods. */
export async function userWithIdentities(accessToken: string): Promise<OAuthUser | null> {
  try {
    const r = await fetch(`${base()}/auth/v1/user`, { headers: { apikey: anon()!, authorization: `Bearer ${accessToken}` } });
    return r.ok ? toOAuthUser((await r.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const service = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

async function admin(method: "PUT" | "DELETE", userId: string, body?: unknown): Promise<boolean> {
  const key = service();
  if (!key) return false;
  try {
    const r = await fetch(`${base()}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method,
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) console.error(`auth admin ${method}: Supabase answered ${r.status}`);
    return r.ok;
  } catch {
    return false;
  }
}

/** Removes an account that a Google or GitHub sign-in just created but our sign-up rules don't allow. */
export const deleteUser = (userId: string) => admin("DELETE", userId);
/** Merges keys into the account's user_metadata (which the person can also change) and app_metadata (only we can). */
export const updateUserMeta = (userId: string, patch: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }) => admin("PUT", userId, patch);

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
