import { live, rest } from "./scan/store";

/* One owner per website (root domain), because Pagelyt is priced per website: a second account can't scan a
   site that already belongs to someone. Tables from migration 0009; server only (service-role key).
   Memory mode (no Supabase) has no accounts, so every lookup answers "nobody owns it". */

export type Owner = { domain: string; user_id: string; verified: boolean; claimed_at: string };

const PENDING_MS = 24 * 3_600_000; // an unverified sign-up holds its domain this long
const UUID = /^[0-9a-f-]{36}$/i;
const enc = encodeURIComponent;

const active = (o: Owner) => o.verified || Date.now() - Date.parse(o.claimed_at) < PENDING_MS;

export async function emailConfirmed(userId: string): Promise<boolean> {
  if (!live() || !UUID.test(userId)) return false;
  return (await rest<boolean>("rpc/email_confirmed", { method: "POST", body: JSON.stringify({ p_user: userId }) })) === true;
}

/** The account that already scanned or saved this domain before ownership existed (oldest first), if verified. */
async function legacyOwner(domain: string): Promise<string | null> {
  const hostIs = [`host=eq.${enc(domain)}`, `host=like.${enc(`*.${domain}`)}`];
  const found: { user_id: string; created_at: string }[] = [];
  for (const h of hostIs) {
    const [sites, scans] = await Promise.all([
      rest<{ user_id: string; created_at: string }[]>(`sites?${h}&select=user_id,created_at&order=created_at.asc&limit=1`),
      rest<{ user_id: string; created_at: string }[]>(`scans?${h}&user_id=not.is.null&select=user_id,created_at&order=created_at.asc&limit=3`),
    ]);
    found.push(...sites, ...scans);
  }
  found.sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const f of found) if (await emailConfirmed(f.user_id)) return f.user_id;
  return null;
}

/** Who owns the domain right now, or null if it is free. Copies an existing saved site in on first lookup. */
export async function ownerOf(domain: string): Promise<Owner | null> {
  if (!live()) return null;
  const rows = await rest<Owner[]>(`site_owners?domain=eq.${enc(domain)}&select=*&limit=1`);
  if (rows[0]) return active(rows[0]) ? rows[0] : null;
  const uid = await legacyOwner(domain);
  if (!uid) return null;
  const row: Owner = { domain, user_id: uid, verified: true, claimed_at: new Date().toISOString() };
  await rest("site_owners", { method: "POST", body: JSON.stringify(row), prefer: "resolution=ignore-duplicates,return=minimal" });
  return row;
}

/** Gives a free domain to this account. Returns false if somebody else holds it. */
export async function claimDomain(domain: string, userId: string, verified: boolean): Promise<boolean> {
  if (!live()) return true;
  const cur = await ownerOf(domain);
  if (cur) {
    if (cur.user_id !== userId) return false;
    if (verified && !cur.verified) await setOwner(domain, userId, true);
    return true;
  }
  await setOwner(domain, userId, verified); // free, or an expired unverified hold
  const now = await ownerOf(domain);
  return !now || now.user_id === userId;
}

/** Writes the owner row outright (used for a free domain and after a successful proof of ownership). */
export async function setOwner(domain: string, userId: string, verified: boolean): Promise<void> {
  await rest("site_owners?on_conflict=domain", {
    method: "POST",
    body: JSON.stringify({ domain, user_id: userId, verified, claimed_at: new Date().toISOString() }),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

/** After someone enters their email code: every domain they hold becomes theirs for good. */
export async function confirmOwner(userId: string): Promise<void> {
  if (!live() || !UUID.test(userId)) return;
  await rest(`site_owners?user_id=eq.${enc(userId)}&verified=eq.false`, { method: "PATCH", body: JSON.stringify({ verified: true }), prefer: "return=minimal" });
}

/* ---------- proof of ownership ---------- */

export async function claimToken(domain: string, userId: string): Promise<string> {
  const rows = await rest<{ token: string }[]>(`site_claims?domain=eq.${enc(domain)}&user_id=eq.${enc(userId)}&select=token&limit=1`);
  if (rows[0]) return rows[0].token;
  const b = crypto.getRandomValues(new Uint8Array(16));
  const token = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  await rest("site_claims", { method: "POST", body: JSON.stringify({ domain, user_id: userId, token }), prefer: "resolution=ignore-duplicates,return=minimal" });
  return token;
}

export async function dropClaims(domain: string): Promise<void> {
  await rest(`site_claims?domain=eq.${enc(domain)}`, { method: "DELETE", prefer: "return=minimal" });
}
