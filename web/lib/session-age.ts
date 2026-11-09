/* Sessions last 7 days from sign-in, on the device that signed in. Supabase keeps refreshing a session forever,
   so the limit is ours: the access token records when the person signed in (`amr[].timestamp`, kept across
   refreshes), and both the server and the browser refuse a session that started more than 7 days ago.
   Shared by both sides; no dependencies. */

export const SESSION_DAYS = 7;
const MAX_MS = SESSION_DAYS * 86_400_000;

function payload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** When this session signed in (ms since epoch), or null if the token doesn't say. */
export function signedInAt(token: string): number | null {
  const p = payload(token);
  if (!p) return null;
  const amr = Array.isArray(p.amr) ? (p.amr as { timestamp?: unknown }[]) : [];
  const times = amr.map((a) => Number(a?.timestamp)).filter((t) => Number.isFinite(t) && t > 0);
  // The earliest sign-in step is when the session began. Older tokens without amr fall back to issued-at.
  const t = times.length ? Math.min(...times) : Number(p.iat);
  return Number.isFinite(t) && t > 0 ? t * 1000 : null;
}

/** True while the session is inside its 7 days. A token that doesn't say when it started is allowed. */
export function sessionFresh(token: string, now = Date.now()): boolean {
  const at = signedInAt(token);
  return at == null || now - at < MAX_MS;
}
