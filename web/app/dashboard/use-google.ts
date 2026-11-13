"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { GscData } from "@/lib/google/gsc-insights";

/* The Google connection for one saved site, as the dashboard sees it. Loads the status and cached Search Console
   data, and refreshes it in the background when it is older than 24 hours (there is no cron job). Shared by the
   Google data view and the traffic shown on findings, so it is fetched once per report. */

export type GoogleStatus = {
  configured: boolean;
  allowed: boolean;
  connected: boolean;
  email: string | null;
  gsc: boolean;
  property?: string | null;
  properties?: string[];
  cache?: { data: GscData | null; error: string | null; fetchedAt: string; stale: boolean } | null;
};

const token = async () => (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;

async function call<T>(path: string, body?: unknown): Promise<T> {
  const t = await token();
  const r = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again.");
  return d;
}

export function useGoogle(siteId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState<null | "load" | "refresh" | "connect" | "link" | "props">(enabled ? "load" : null);
  const [error, setError] = useState("");

  const load = useCallback(async (props = false) => {
    if (!siteId) return null;
    const s = await call<GoogleStatus>(`/api/google/status?siteId=${encodeURIComponent(siteId)}${props ? "&props=1" : ""}`);
    setStatus(s);
    return s;
  }, [siteId]);

  const refresh = useCallback(async (force = false) => {
    if (!siteId) return;
    setBusy("refresh");
    setError("");
    try {
      const cache = await call<NonNullable<GoogleStatus["cache"]>>("/api/google/refresh", { siteId, force });
      setStatus((s) => (s ? { ...s, cache } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [siteId]);

  useEffect(() => {
    if (!enabled || !siteId) return;
    let live = true;
    (async () => {
      try {
        const s = await load();
        if (live && s?.connected && s.gsc && s.property && (!s.cache || s.cache.stale)) await refresh(false);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (live) setBusy((b) => (b === "load" ? null : b));
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled, siteId, load, refresh]);

  const connect = useCallback(async (scanId: string) => {
    if (!siteId) return;
    setBusy("connect");
    setError("");
    try {
      const { url } = await call<{ url: string }>("/api/google/connect", { siteId, scanId });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }, [siteId]);

  const loadProps = useCallback(async () => {
    setBusy("props");
    try {
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [load]);

  const link = useCallback(async (property: string) => {
    if (!siteId) return;
    setBusy("link");
    setError("");
    try {
      await call("/api/google/link", { siteId, property });
      setStatus((s) => (s ? { ...s, property, cache: null } : s));
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [siteId, refresh]);

  return { status, busy, error, gsc: status?.cache?.data ?? null, refresh, connect, loadProps, link };
}

export type GoogleState = ReturnType<typeof useGoogle>;

export async function disconnectGoogle() {
  await call("/api/google/disconnect", {});
}

export async function googleAccount() {
  return call<GoogleStatus>("/api/google/status");
}
