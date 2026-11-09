"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sessionFresh } from "./session-age";
import { supabaseBrowser } from "./supabase-browser";

export type SignedInUser = { id: string; email: string; name: string };

const toUser = (s: Session | null): SignedInUser | null => {
  if (!s || !sessionFresh(s.access_token)) return null;
  const meta = s.user.user_metadata as { name?: unknown } | undefined;
  const email = s.user.email ?? "";
  const name = typeof meta?.name === "string" && meta.name.trim() ? meta.name.trim() : email.split("@")[0];
  return { id: s.user.id, email, name };
};

/** The signed-in person on this device, `null` when signed out, `undefined` while it is still being checked (and on
    the server), so pages can render the signed-out version first and swap without a layout jump. */
export function useSignedInUser(): SignedInUser | null | undefined {
  // Without Supabase there is never a session, so that case is known from the start.
  const [user, setUser] = useState<SignedInUser | null | undefined>(() => (supabaseBrowser() ? undefined : null));
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let live = true;
    sb.auth.getSession().then(({ data }) => live && setUser(toUser(data.session)));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setUser(toUser(session)));
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return user;
}

/** Whether this browser has a signed-in session (`undefined` while checking). */
export function useSignedIn(): boolean | undefined {
  const u = useSignedInUser();
  return u === undefined ? undefined : !!u;
}

export const firstName = (name: string) => name.split(" ")[0] || name;
