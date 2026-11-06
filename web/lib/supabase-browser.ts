import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Browser client. Uses only the public anon key; row-level security decides what a signed-in user
   can read or change. Returns null when Supabase is not configured (local dev without env vars). */
let client: SupabaseClient | null | undefined;

export function supabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return client;
}
