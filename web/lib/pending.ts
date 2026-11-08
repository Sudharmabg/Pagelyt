/* Small browser-side helpers shared by the modal, the check-your-email page and the verification landing page. */

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The address we just asked someone to confirm. Session storage: it vanishes when the tab closes. */
const KEY = "pagelyt-verify-email";
const CHANGED = "pagelyt-verify-email-changed";

export function rememberVerifyEmail(email: string) {
  try {
    window.sessionStorage.setItem(KEY, email);
  } catch {
    /* storage blocked: the page then asks for the address */
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function recallVerifyEmail(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetVerifyEmail() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** The remembered address as a hook (empty on the server and until one is stored). */
export function useVerifyEmail(): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(CHANGED, cb);
      return () => window.removeEventListener(CHANGED, cb);
    },
    recallVerifyEmail,
    () => ""
  );
}

/** True when Supabase sent the person back with an error in the address (an expired or already-used link). */
export function useLinkError(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /[#?&]error(_code|_description)?=/.test(window.location.hash + window.location.search),
    () => false
  );
}

export type SessionTokens = { access_token: string; refresh_token: string };

/** Signs the browser in with tokens the server got from Supabase. */
export async function adoptSession(sb: SupabaseClient, t: SessionTokens): Promise<boolean> {
  const { error } = await sb.auth.setSession({ access_token: t.access_token, refresh_token: t.refresh_token });
  return !error;
}

/** After a verified sign-in: attach the scans this email started to the account. Returns the newest report id, if any. */
export async function claimAndFindReport(sb: SupabaseClient): Promise<string | null> {
  const token = (await sb.auth.getSession()).data.session?.access_token;
  if (!token) return null;
  try {
    const r = await fetch("/api/account/claim-leads", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    const j = (await r.json()) as { scans?: string[] };
    return j.scans?.[0] ?? null;
  } catch {
    return null;
  }
}
