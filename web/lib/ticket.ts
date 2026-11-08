/* A short-lived "ticket" proving a visitor just passed the human check and created an account for an email.
   It lets that visitor's report scan start without a second Turnstile check (those tokens are single-use).
   Format: <expiry-seconds>.<signature>, signed with HMAC-SHA256 using a server-only secret. */

const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const enc = new TextEncoder();

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

export async function issueTicket(email: string, ttlSec = 900): Promise<string | null> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = await sign(`${email}|${exp}`);
  return sig ? `${exp}.${sig}` : null;
}

export async function checkTicket(ticket: unknown, email: string): Promise<boolean> {
  if (typeof ticket !== "string" || ticket.length > 200) return false;
  const [expRaw, sig] = ticket.split(".");
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || !sig || exp < Math.floor(Date.now() / 1000)) return false;
  const want = await sign(`${email}|${exp}`);
  return !!want && sameString(want, sig);
}
