import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sessionFresh } from "./session-age";

/* Browser client. Uses only the public anon key; row-level security decides what a signed-in user
   can read or change. Returns null when Supabase is not configured (local dev without env vars).
   The session is kept in this browser (localStorage) and ends 7 days after sign-in: an older session is
   signed out here, and the server refuses it too (lib/session-age.ts). */
let client: SupabaseClient | null | undefined;

export function supabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  if (client && typeof window !== "undefined") {
    const sb = client;
    sb.auth.onAuthStateChange((_event, session) => {
      // Deferred: calling back into the auth client inside its own listener can deadlock it.
      if (session && !sessionFresh(session.access_token)) window.setTimeout(() => void sb.auth.signOut({ scope: "local" }), 0);
    });
  }
  return client;
}
