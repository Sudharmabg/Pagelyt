"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase-browser";

/** Whether this browser has a signed-in session. `undefined` while it is still being checked (and on the server),
    so pages can render the signed-out version first and swap without a layout jump. */
export function useSignedIn(): boolean | undefined {
  // Without Supabase there is never a session, so that case is known from the start.
  const [signedIn, setSignedIn] = useState<boolean | undefined>(() => (supabaseBrowser() ? undefined : false));
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let live = true;
    sb.auth.getSession().then(({ data }) => live && setSignedIn(!!data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return signedIn;
}
