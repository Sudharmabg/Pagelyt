"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { GscData } from "@/lib/google/gsc-insights";
import type { Ga4Ai, Ga4Data } from "@/lib/google/ga4-insights";
import type { AdsAi, AdsData } from "@/lib/google/ads-insights";

/* The Google connection for one saved site, as the dashboard sees it. Loads the status and the cached Search Console,
   Analytics and Google Ads data, and refreshes each in the background when it is older than 24 hours (there is no
   cron job). Shared by the Google data view, the numbers shown on findings and the Overview, so it is fetched once per
   report. The AI's insights (Analytics and Ads, separately) load with the status and are (re)made only on request. */

export type Cached<T> = { data: T | null; error: string | null; fetchedAt: string; stale: boolean };
export type Ga4Property = { property: string; name: string; account: string };
export type AiInsights = Ga4Ai & { at: string; current: boolean };
export type AdsAiInsights = AdsAi & { at: string; current: boolean };
export type GscAiInsights = Ga4Ai & { at: string; current: boolean };
/** The date windows the Google data view offers. 28 days is the main one: findings, AI insights and the PDF use it. */
export type Days = 7 | 28 | 90;
/** Data for a 7- or 90-day window, fetched when the owner picks it (cached on the server for 24 hours). */
type RangeSet = { gsc?: Cached<GscData>; ga4?: Cached<Ga4Data>; ads?: Cached<AdsData>; error?: string };
export type AdsAccount = { id: string; name: string; login: string | null; currency: string };
export type Product = "gsc" | "ga4" | "ads";

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
  gscAi?: GscAiInsights | null;
  ga4Property?: string | null;
  ga4Name?: string | null;
  ga4Properties?: Ga4Property[];
  ga4Cache?: Cached<Ga4Data> | null;
  ai?: AiInsights | null;
  adsOn?: boolean;
  ads?: boolean;
  adsCustomer?: string | null;
  adsName?: string | null;
  adsAccounts?: AdsAccount[];
  adsCache?: Cached<AdsData> | null;
  adsAi?: AdsAiInsights | null;
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

type Busy = null | "load" | "refresh" | "ga4refresh" | "adsrefresh" | "connect" | "link" | "props" | "analyse" | "adsanalyse" | "gscanalyse" | "range";

export function useGoogle(siteId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState<Busy>(enabled ? "load" : null);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");
  const [adsAiError, setAdsAiError] = useState("");
  const [gscAiError, setGscAiError] = useState("");
  const [days, setDaysState] = useState<Days>(28);
  const [ranges, setRanges] = useState<Partial<Record<Days, RangeSet>>>({});

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
    const s = await call<GoogleStatus>(`/api/google/status?siteId=${encodeURIComponent(siteId)}${props === "gsc" ? "&props=1" : props === "ga4" ? "&ga4props=1" : props === "ads" ? "&adsprops=1" : ""}`);
    setStatus((old) => (old && props ? { ...old, ...s, properties: s.properties ?? old.properties, ga4Properties: s.ga4Properties ?? old.ga4Properties, adsAccounts: s.adsAccounts ?? old.adsAccounts } : s));
    return s;
  }, [siteId]);

  const fetchFresh = useCallback(async (product: Product, force: boolean) => {
    const cache = await call<Cached<GscData | Ga4Data | AdsData>>("/api/google/refresh", { siteId, force, product });
    setStatus((s) => {
      if (!s) return s;
      if (product === "ga4") return { ...s, ga4Cache: cache as Cached<Ga4Data>, ai: s.ai ? { ...s.ai, current: s.ai.basedOn === cache.fetchedAt } : s.ai };
      if (product === "ads") return { ...s, adsCache: cache as Cached<AdsData>, adsAi: s.adsAi ? { ...s.adsAi, current: s.adsAi.basedOn === cache.fetchedAt } : s.adsAi };
      return { ...s, cache: cache as Cached<GscData> };
    });
  }, [siteId]);

  const refresh = useCallback(async (force = false, product: Product = "gsc") => {
    if (!siteId) return;
    await run(product === "ga4" ? "ga4refresh" : product === "ads" ? "adsrefresh" : "refresh", () => fetchFresh(product, force));
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
        if (s.adsOn && s.ads && s.adsCustomer && (!s.adsCache || s.adsCache.stale)) jobs.push(fetchFresh("ads", false));
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
      if (product === "ads") {
        const name = status?.adsAccounts?.find((a) => a.id === property)?.name ?? null;
        setStatus((s) => (s ? { ...s, adsCustomer: property, adsName: name, adsCache: null, adsAi: null } : s));
      } else if (product === "ga4") {
        const name = status?.ga4Properties?.find((p) => p.property === property)?.name ?? null;
        setStatus((s) => (s ? { ...s, ga4Property: property, ga4Name: name, ga4Cache: null, ai: null } : s));
      } else setStatus((s) => (s ? { ...s, property, cache: null } : s));
      await fetchFresh(product, true);
    });
  }, [siteId, run, fetchFresh, status?.ga4Properties, status?.adsAccounts]);

  const analyse = useCallback(async (scanId: string, force = false) => {
    if (!siteId) return;
    await run("analyse", async () => {
      const ai = await call<AiInsights>("/api/google/analyse", { siteId, scanId, force });
      setStatus((s) => (s ? { ...s, ai } : s));
    }, setAiError);
  }, [siteId, run]);

  const analyseGsc = useCallback(async (scanId: string, force = false) => {
    if (!siteId) return;
    await run("gscanalyse", async () => {
      const gscAi = await call<GscAiInsights>("/api/google/analyse", { siteId, scanId, force, product: "gsc" });
      setStatus((s) => (s ? { ...s, gscAi } : s));
    }, setGscAiError);
  }, [siteId, run]);

  /** Switches the Google data view to another date window, fetching each linked product's numbers for it once. */
  const setDays = useCallback(async (d: Days, force = false) => {
    setDaysState(d);
    if (d === 28 || !siteId || !status) return;
    if (ranges[d] && !force) return;
    const want: Product[] = [];
    if (status.gsc && status.property) want.push("gsc");
    if (status.ga4 && status.ga4Property) want.push("ga4");
    if (status.adsOn && status.ads && status.adsCustomer) want.push("ads");
    if (!want.length) return void setRanges((x) => ({ ...x, [d]: {} }));
    setBusy("range");
    const out = await Promise.allSettled(want.map((p) => call<Cached<GscData | Ga4Data | AdsData>>("/api/google/refresh", { siteId, product: p, days: d, force })));
    const next: RangeSet = {};
    out.forEach((o, i) => {
      if (o.status === "fulfilled") (next as Record<string, unknown>)[want[i]] = o.value;
      else next.error = o.reason instanceof Error ? o.reason.message : String(o.reason);
    });
    setRanges((r) => ({ ...r, [d]: next }));
    setBusy((b) => (b === "range" ? null : b));
  }, [siteId, status, ranges]);

  const analyseAds = useCallback(async (scanId: string, force = false) => {
    if (!siteId) return;
    await run("adsanalyse", async () => {
      const adsAi = await call<AdsAiInsights>("/api/google/analyse", { siteId, scanId, force, product: "ads" });
      setStatus((s) => (s ? { ...s, adsAi } : s));
    }, setAdsAiError);
  }, [siteId, run]);

  /** A fresh pass for the print page's Analytics and Ads sections (it lasts 15 minutes), or undefined without either. */
  const printPass = useCallback(async (scanId: string) => {
    if (!siteId || !(status?.ga4Cache?.data || status?.adsCache?.data)) return undefined;
    try {
      return (await call<GoogleStatus>(`/api/google/status?siteId=${encodeURIComponent(siteId)}&scanId=${encodeURIComponent(scanId)}`)).printToken;
    } catch {
      return undefined;
    }
  }, [siteId, status?.ga4Cache?.data, status?.adsCache?.data]);

  // The numbers for the window on screen (28 days comes with the status; 7 and 90 from `ranges`).
  const r = days === 28 ? null : ranges[days];
  const inRange = {
    days,
    loading: days !== 28 && !r,
    error: r?.error ?? "",
    gsc: days === 28 ? (status?.cache ?? null) : (r?.gsc ?? null),
    ga4: days === 28 ? (status?.ga4Cache ?? null) : (r?.ga4 ?? null),
    ads: days === 28 ? (status?.adsCache ?? null) : (r?.ads ?? null),
  };

  return { status, busy, error, aiError, adsAiError, gscAiError, days, setDays, inRange, gscAi: status?.gscAi ?? null, analyseGsc, gsc: status?.cache?.data ?? null, ga4: status?.ga4Cache?.data ?? null, ai: status?.ai ?? null, ads: status?.adsCache?.data ?? null, adsAi: status?.adsAi ?? null, refresh, connect, loadProps, link, analyse, analyseAds, printPass };
}

export type GoogleState = ReturnType<typeof useGoogle>;

export async function disconnectGoogle() {
  await call("/api/google/disconnect", {});
}

export async function googleAccount() {
  return call<GoogleStatus>("/api/google/status");
}
