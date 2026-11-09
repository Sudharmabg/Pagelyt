import { live, rest } from "./scan/store";
import { sessionFresh } from "./session-age";

/* Server-side helpers for Supabase auth. The browser signs in with the anon key; API routes receive
   the user's access token as `Authorization: Bearer <jwt>` and verify it with Supabase. */

export type AuthUser = { id: string; email: string | null; verified: boolean; name: string | null };

export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  // The anon key is a build-time variable; fall back to the service key so a missing one cannot lock everyone out.
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !base || !anon) return null;
  // Sessions end 7 days after sign-in, however often they were refreshed (lib/session-age.ts).
  if (!sessionFresh(token)) return null;
  try {
    const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string; email?: string; email_confirmed_at?: string | null; user_metadata?: { name?: unknown } };
    const name = typeof u.user_metadata?.name === "string" ? u.user_metadata.name : null;
    return u.id ? { id: u.id, email: u.email ?? null, verified: !!u.email_confirmed_at, name } : null;
  } catch {
    return null;
  }
}

/** Cloudflare Turnstile. Only enforced when TURNSTILE_SECRET_KEY is set. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    return !!((await r.json()) as { success?: boolean }).success;
  } catch {
    return false;
  }
}

/** The caller's IP, used for rate limits. On Cloudflare the `cf-connecting-ip` header is set by Cloudflare itself.
    Anywhere else `x-forwarded-for` is just whatever the caller typed, so it is only trusted in local development;
    in production a request without the Cloudflare header shares one strict "unknown" bucket. */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  if (process.env.NODE_ENV !== "production") return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  return "unknown";
}

/** Admins are the email addresses in the Supabase `admins` table (migration 0007; service role only).
    Only a verified address counts, so an unconfirmed sign-up with an admin's email cannot get in. */
export async function isAdmin(user: AuthUser): Promise<boolean> {
  if (!user.verified || !user.email || !live()) return false;
  const rows = await rest<{ email: string }[]>(`admins?email=eq.${encodeURIComponent(user.email.toLowerCase())}&select=email&limit=1`).catch(() => []);
  return rows.length > 0;
}

/** The signed-in admin, or the error response to send back (401 signed out, 403 not an admin). */
export async function adminFromRequest(req: Request): Promise<{ user: AuthUser } | { error: Response }> {
  const user = await userFromRequest(req);
  if (!user) return { error: Response.json({ error: "Please sign in first." }, { status: 401 }) };
  if (!(await isAdmin(user))) return { error: Response.json({ error: "Admins only." }, { status: 403 }) };
  return { user };
}
