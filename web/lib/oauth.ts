/* Browser only. "Continue with Google / GitHub": PKCE by hand, so the shared Supabase client keeps its default
   (implicit) flow for the email links on /auth/verified and /auth/reset. We send the person to Supabase's authorize
   page with a code challenge, keep the verifier and what they were doing in sessionStorage, and /auth/callback hands
   the returned code plus the verifier to /api/auth/oauth, which runs the sign-up rules and returns the session. */

export type Provider = "google" | "github";
export const PROVIDER_NAMES: Record<Provider, string> = { google: "Google", github: "GitHub" };

/** What to do once the person is back. `scanUrl`: start that scan (the scan modal). `intent: "login"`: the log-in
    form of a registered website, where a brand-new account isn't allowed. */
export type OAuthPending = { provider: Provider; verifier: string; next: string; scanUrl?: string; intent: "login" | "signup"; source: string; at: number };

const KEY = "pagelyt:oauth";

/** Which providers are switched on (NEXT_PUBLIC_OAUTH_PROVIDERS="google,github"), so no button shows before Supabase is set up. */
export function enabledProviders(): Provider[] {
  const list = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "").split(",").map((s) => s.trim().toLowerCase());
  return (["google", "github"] as const).filter((p) => list.includes(p));
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function startOAuth(provider: Provider, o: { next: string; scanUrl?: string; intent: "login" | "signup"; source: string }): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !crypto?.subtle) return false;
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const pending: OAuthPending = { provider, verifier, next: o.next, scanUrl: o.scanUrl || undefined, intent: o.intent, source: o.source, at: Date.now() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    return false; // storage blocked: the callback could not finish
  }
  const q = new URLSearchParams({
    provider,
    redirect_to: `${window.location.origin}/auth/callback`,
    code_challenge: challenge,
    code_challenge_method: "s256",
  });
  window.location.assign(`${base.replace(/\/$/, "")}/auth/v1/authorize?${q}`);
  return true;
}

/** Reads (and forgets) what the person was doing. Older than 30 minutes counts as gone. */
export function takePending(): OAuthPending | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const p = raw ? (JSON.parse(raw) as OAuthPending) : null;
    return p && typeof p.verifier === "string" && Date.now() - p.at < 30 * 60_000 ? p : null;
  } catch {
    return null;
  }
}
