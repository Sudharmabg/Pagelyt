import { clientIp } from "@/lib/auth";
import { isDisposable } from "@/lib/disposable";
import { rootDomain } from "@/lib/domain";
import { authConfigured, deleteUser, exchangeCode, readJson, reply, updateUserMeta, type OAuthUser } from "@/lib/gotrue";
import { ownerOf } from "@/lib/owners";
import { LIMITS, guard } from "@/lib/ratelimit";
import { ScanError, checkUrl } from "@/lib/scan";
import { live, rest } from "@/lib/scan/store";

/* Finishes a Google or GitHub sign-in. /auth/callback sends the one-time code Supabase returned plus the PKCE
   verifier the browser kept; we swap them for a session here, so the sign-up rules run before the browser is signed in:
   - no verified email (a GitHub account without one): refused.
   - a brand-new account with a throwaway inbox, or for an inbox that already has an account under another spelling:
     the new account is deleted and the person is told what to do.
   - a brand-new account started from the log-in form of a website registered to someone else: deleted (known
     sites are log-in only, because pricing is per website).
   Turnstile and the 6-digit email code are skipped: Google or GitHub already confirmed the email and the person.
   The website itself is taken by the scan that runs next (/api/scan), exactly as for any signed-in visitor. */

// Created by this very sign-in: made in the last 2 minutes, and this is its first sign-in (Supabase stamps
// last_sign_in_at when the code is exchanged, moments after it created the account). A second sign-in soon after
// sign-up is not "new", so the checks below never delete an account someone is already using.
const NEW_MS = 2 * 60_000;
const FIRST_MS = 60_000;

const nameFrom = (meta: Record<string, unknown>): string | null => {
  for (const k of ["name", "full_name"]) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 100);
  }
  return null;
};

async function refuse(user: OAuthUser, isNew: boolean, error: string, code: string, status = 409) {
  if (isNew) await deleteUser(user.id);
  return reply({ error, code }, status);
}

export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  const code = typeof body.code === "string" && body.code.length <= 512 ? body.code : "";
  const verifier = typeof body.verifier === "string" && /^[\w.~-]{43,128}$/.test(body.verifier) ? body.verifier : "";
  if (!code || !verifier) return reply({ error: "That sign-in link has expired. Please try again.", code: "expired" }, 400);

  let domain: string | null = null;
  if (body.url != null && body.url !== "") {
    try {
      domain = rootDomain(checkUrl(String(body.url).slice(0, 2048)).hostname);
    } catch (e) {
      return reply({ error: e instanceof ScanError ? e.message : "Invalid address." }, 422);
    }
  }

  const limited = await guard(LIMITS.oauth(clientIp(req)));
  if (limited) return limited;

  const r = await exchangeCode(code, verifier);
  if (!r.ok) {
    return r.reason === "invalid"
      ? reply({ error: "That sign-in link has expired or was already used. Please try again.", code: "expired" }, 400)
      : reply({ error: "Sign-in is temporarily unavailable. Please try again shortly." }, 503);
  }
  const { user, session } = r;
  const isNew = Date.now() - user.createdAt < NEW_MS && user.lastSignInAt - user.createdAt < FIRST_MS && !user.providers.includes("email");

  if (!user.email || !user.verified) {
    return refuse(user, isNew, "Your account there has no verified email address. Add one there, or sign up with your email instead.", "no_email", 400);
  }
  if (isNew) {
    if (isDisposable(user.email)) return refuse(user, true, "Please use a permanent email address, not a temporary inbox.", "disposable", 400);
    const other = await rest<boolean>("rpc/inbox_has_other_account", { method: "POST", body: JSON.stringify({ p_email: user.email, p_user: user.id }) }).catch(() => null);
    if (other === null) return refuse(user, true, "Sign-in is temporarily unavailable. Please try again shortly.", "unavailable", 503);
    if (other) return refuse(user, true, "This inbox already has a Pagelyt account under a slightly different address. Please log in with your email and password.", "exists");
    if (domain && body.intent === "login") {
      const owner = await ownerOf(domain).catch(() => null);
      if (owner && owner.user_id !== user.id) {
        return refuse(user, true, `${domain} is registered to another account. Log in with that account to scan it.`, "known");
      }
    }
  }

  // The dashboard header and PDF cover use user_metadata.name. Supabase copies the provider's profile into
  // user_metadata on every Google / GitHub sign-in, which can replace the name the person chose. app_metadata.name
  // (server-written only: sign-up, the name step, here) is the name they chose, so it is put back.
  let needsName = false;
  const kept = typeof user.app.name === "string" && user.app.name.trim() ? user.app.name : null;
  if (kept) {
    if (user.meta.name !== kept) await updateUserMeta(user.id, { user_metadata: { name: kept } });
  } else {
    const name = nameFrom(user.meta); // Google sends "name"; GitHub may send only a username
    if (!name) needsName = true;
    else await updateUserMeta(user.id, { user_metadata: { name }, app_metadata: { name } });
  }

  return reply({ session, isNew, needsName, provider: user.providers.find((p) => p !== "email") ?? null });
}
