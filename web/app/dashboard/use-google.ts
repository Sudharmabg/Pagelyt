"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { GscData } from "@/lib/google/gsc-insights";
import type { Ga4Ai, Ga4Data } from "@/lib/google/ga4-insights";

/* The Google connection for one saved site, as the dashboard sees it. Loads the status and the cached Search Console
   and Analytics data, and refreshes each in the background when it is older than 24 hours (there is no cron job).
   Shared by the Google data view, the numbers shown on findings and the Overview, so it is fetched once per report.
   The AI's Analytics insights load with the status and are (re)made only on request. */

type Cached<T> = { data: T | null; error: string | null; fetchedAt: string; stale: boolean };
export type Ga4Property = { property: string; name: string; account: string };
export type AiInsights = Ga4Ai & { at: string; current: boolean };
export type Product = "gsc" | "ga4";

export type GoogleStatus = {
  configured: boolean;
  allowed: boolean;
  connected: boolean;
  email: string | null;
  gsc: boolean;
  ga4: boolean;
  property?: string | null;
  properties?: string[];
  cache?: Cached<GscData> | null;
  ga4Property?: string | null;
  ga4Name?: string | null;
  ga4Properties?: Ga4Property[];
  ga4Cache?: Cached<Ga4Data> | null;
  ai?: AiInsights | null;
  printToken?: string;
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

type Busy = null | "load" | "refresh" | "ga4refresh" | "connect" | "link" | "props" | "analyse";

export function useGoogle(siteId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState<Busy>(enabled ? "load" : null);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");

  const run = useCallback(async (b: Busy, fn: () => Promise<void>, onErr = setError) => {
    setBusy(b);
    onErr("");
    try {
      await fn();
    } catch (e) {
      onErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((x) => (x === b ? null : x));
    }
  }, []);

  const load = useCallback(async (props?: Product) => {
    if (!siteId) return null;
    const s = await call<GoogleStatus>(`/api/google/status?siteId=${encodeURIComponent(siteId)}${props === "gsc" ? "&props=1" : props === "ga4" ? "&ga4props=1" : ""}`);
    setStatus((old) => (old && props ? { ...old, ...s, properties: s.properties ?? old.properties, ga4Properties: s.ga4Properties ?? old.ga4Properties } : s));
    return s;
  }, [siteId]);

  const fetchFresh = useCallback(async (product: Product, force: boolean) => {
    const cache = await call<Cached<GscData | Ga4Data>>("/api/google/refresh", { siteId, force, product });
    setStatus((s) => (s ? (product === "ga4" ? { ...s, ga4Cache: cache as Cached<Ga4Data>, ai: s.ai ? { ...s.ai, current: s.ai.basedOn === cache.fetchedAt } : s.ai } : { ...s, cache: cache as Cached<GscData> }) : s));
  }, [siteId]);

  const refresh = useCallback(async (force = false, product: Product = "gsc") => {
    if (!siteId) return;
    await run(product === "ga4" ? "ga4refresh" : "refresh", () => fetchFresh(product, force));
  }, [siteId, run, fetchFresh]);

  useEffect(() => {
    if (!enabled || !siteId) return;
    let live = true;
    (async () => {
      try {
        const s = await load();
        if (!live || !s?.connected) return;
        const jobs: Promise<void>[] = [];
        if (s.gsc && s.property && (!s.cache || s.cache.stale)) jobs.push(fetchFresh("gsc", false));
        if (s.ga4 && s.ga4Property && (!s.ga4Cache || s.ga4Cache.stale)) jobs.push(fetchFresh("ga4", false));
        if (jobs.length) setBusy("refresh");
        const out = await Promise.allSettled(jobs);
        const bad = out.find((x): x is PromiseRejectedResult => x.status === "rejected");
        if (live && bad) setError(bad.reason instanceof Error ? bad.reason.message : String(bad.reason));
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (live) setBusy((b) => (b === "load" || b === "refresh" ? null : b));
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled, siteId, load, fetchFresh]);

  const connect = useCallback(async (scanId: string, product: Product = "gsc") => {
    if (!siteId) return;
    setBusy("connect");
    setError("");
    try {
      const { url } = await call<{ url: string }>("/api/google/connect", { siteId, scanId, product });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }, [siteId]);

  const loadProps = useCallback(async (product: Product = "gsc") => {
    await run("props", async () => void (await load(product)));
  }, [load, run]);

  const link = useCallback(async (property: string, product: Product = "gsc") => {
    if (!siteId) return;
    await run("link", async () => {
      await call("/api/google/link", { siteId, property, product });
      if (product === "ga4") {
        const name = status?.ga4Properties?.find((p) => p.property === property)?.name ?? null;
        setStatus((s) => (s ? { ...s, ga4Property: property, ga4Name: name, ga4Cache: null, ai: null } : s));
      } else setStatus((s) => (s ? { ...s, property, cache: null } : s));
      await fetchFresh(product, true);
    });
  }, [siteId, run, fetchFresh, status?.ga4Properties]);

  const analyse = useCallback(async (scanId: string, force = false) => {
    if (!siteId) return;
    await run("analyse", async () => {
      const ai = await call<AiInsights>("/api/google/analyse", { siteId, scanId, force });
      setStatus((s) => (s ? { ...s, ai } : s));
    }, setAiError);
  }, [siteId, run]);

  /** A fresh pass for the print page's Analytics section (it lasts 15 minutes), or undefined without Analytics data. */
  const printPass = useCallback(async (scanId: string) => {
    if (!siteId || !status?.ga4Cache?.data) return undefined;
    try {
      return (await call<GoogleStatus>(`/api/google/status?siteId=${encodeURIComponent(siteId)}&scanId=${encodeURIComponent(scanId)}`)).printToken;
    } catch {
      return undefined;
    }
  }, [siteId, status?.ga4Cache?.data]);

  return { status, busy, error, aiError, gsc: status?.cache?.data ?? null, ga4: status?.ga4Cache?.data ?? null, ai: status?.ai ?? null, refresh, connect, loadProps, link, analyse, printPass };
}

export type GoogleState = ReturnType<typeof useGoogle>;

export async function disconnectGoogle() {
  await call("/api/google/disconnect", {});
}

export async function googleAccount() {
  return call<GoogleStatus>("/api/google/status");
}
