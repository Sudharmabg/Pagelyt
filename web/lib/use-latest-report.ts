"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase-browser";
import { useSignedInUser } from "./use-signed-in";

export type LatestReport = { id: string; host: string; score: number | null; at: string };

/* One request per page view, shared by every component that asks (header, welcome strip, CTAs). */
let cache: { user: string; p: Promise<LatestReport | null> } | null = null;

export function fetchLatestReport(userId: string): Promise<LatestReport | null> {
  if (cache?.user === userId) return cache.p;
  const p = (async () => {
    try {
      const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
      if (!token) return null;
      const r = await fetch("/api/account/latest", { headers: { authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return ((await r.json()) as { report?: LatestReport | null }).report ?? null;
    } catch {
      return null;
    }
  })();
  cache = { user: userId, p };
  return p;
}

/** The signed-in person's newest report: `undefined` while checking (or signed out), `null` when they have none. */
export function useLatestReport(): LatestReport | null | undefined {
  const user = useSignedInUser();
  const [got, setGot] = useState<{ user: string; report: LatestReport | null } | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    fetchLatestReport(user.id).then((report) => live && setGot({ user: user.id, report }));
    return () => {
      live = false;
    };
  }, [user]);
  return user && got?.user === user.id ? got.report : undefined;
}
