/* Server-side helpers for Supabase auth. The browser signs in with the anon key; API routes receive
   the user's access token as `Authorization: Bearer <jwt>` and verify it with Supabase. */

export type AuthUser = { id: string; email: string | null };

export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  // The anon key is a build-time variable; fall back to the service key so a missing one cannot lock everyone out.
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !base || !anon) return null;
  try {
    const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string; email?: string };
    return u.id ? { id: u.id, email: u.email ?? null } : null;
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

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
