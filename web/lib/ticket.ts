/* A short-lived "ticket" proving a visitor just passed the human check and created an account for an email.
   It lets that visitor's report scan start without a second Turnstile check (those tokens are single-use).
   Format: <expiry-seconds>.<user-id>.<signature>, signed with HMAC-SHA256 using a server-only secret. */

const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const enc = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sign(message: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); // constant time
  return diff === 0;
}

/** A ticket for a just-created account: binds the email and the new user's id, so the scan it starts is theirs. */
export async function issueTicket(email: string, userId: string, ttlSec = 900): Promise<string | null> {
  if (!UUID.test(userId)) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = await sign(`${email}|${userId}|${exp}`);
  return sig ? `${exp}.${userId}.${sig}` : null;
}

/** The user id the ticket was issued to, or null when it is missing, expired, forged or for another email. */
export async function checkTicket(ticket: unknown, email: string): Promise<string | null> {
  if (typeof ticket !== "string" || ticket.length > 200) return null;
  const [expRaw, userId, sig] = ticket.split(".");
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || !sig || !UUID.test(userId ?? "") || exp < Math.floor(Date.now() / 1000)) return null;
  const want = await sign(`${email}|${userId}|${exp}`);
  return want && sameString(want, sig) ? userId : null;
}
