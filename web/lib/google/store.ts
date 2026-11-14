/* Server only. Google connections, site ↔ property links and the cached data (migration 0010), through Supabase
   REST with the service-role key. Every function that takes a user id must be called only after the route has
   verified that user. */

import { live, rest, getScanRow } from "../scan/store";
import { featuresOpen, getPlan } from "../scan/store-ext";
import { openToken, sealToken } from "./crypto";
import { GoogleError, refreshAccess, revoke, SCOPES, type Product } from "./oauth";
import { fetchGsc } from "./gsc";
import { fetchGa4 } from "./ga4";
import { AdsTokenError, fetchAds } from "./ads";
import type { AdsData } from "./ads-insights";
import type { Ga4Data } from "./ga4-insights";
import type { GscData } from "./gsc-insights";

/** Google data comes with the Professional and Business plans (open to everyone while billing is off). */
export async function canUseGoogle(userId: string) {
  return featuresOpen() || ["professional", "business"].includes(await getPlan(userId));
}

export type Connection = { user_id: string; google_email: string | null; scopes: string[]; refresh_token_enc: string; created_at: string; updated_at: string };
export type Link = { site_id: string; user_id: string; gsc_property: string | null; ga4_property: string | null; ga4_name: string | null; ads_customer: string | null; ads_login: string | null; ads_name: string | null };
export type Source = "gsc" | "gsc_7" | "gsc_90" | "gsc_ai" | "ga4" | "ga4_7" | "ga4_90" | "ga4_ai" | "ads" | "ads_7" | "ads_90" | "ads_ai";
/** The date windows the Google data view offers. 28 days is the main one (findings, AI, PDF use it). */
export type Days = 7 | 28 | 90;
export const asDays = (v: unknown): Days => (v === 7 || v === 90 ? v : 28);
/** The cache row for a product and window: "gsc" for 28 days, "gsc_7" / "gsc_90" for the others. */
export const sourceOf = (p: Product, days: Days): Source => (days === 28 ? p : (`${p}_${days}` as Source));
export type CacheRow<T> = { site_id: string; source: string; data: T | null; error: string | null; fetched_at: string };
export type Site = { id: string; user_id: string; host: string; url: string; last_scan_id: string | null };

const q = encodeURIComponent;

export async function getConnection(userId: string): Promise<Connection | null> {
  if (!live()) return null;
  return (await rest<Connection[]>(`google_connections?user_id=eq.${q(userId)}&select=*&limit=1`))[0] ?? null;
}

export const hasScope = (c: Connection | null, p: Product) => !!c?.scopes.includes(SCOPES[p]);

/** Saves a new grant. Scopes add up (incremental consent); a reply without a refresh token keeps the old one. */
export async function saveConnection(userId: string, g: { refresh: string | null; scopes: string[]; email: string | null }) {
  const old = await getConnection(userId);
  const refresh = g.refresh ? await sealToken(g.refresh) : old?.refresh_token_enc;
  if (!refresh) throw new GoogleError("token", "Google sent no refresh token");
  const scopes = [...new Set([...(g.refresh ? [] : (old?.scopes ?? [])), ...g.scopes])];
  const row = { user_id: userId, google_email: g.email ?? old?.google_email ?? null, scopes, refresh_token_enc: refresh, updated_at: new Date().toISOString() };
  await rest("google_connections?on_conflict=user_id", { method: "POST", body: JSON.stringify(row), prefer: "resolution=merge-duplicates,return=minimal" });
}

/** Revokes the grant at Google and forgets everything Pagelyt stored from it. */
export async function disconnect(userId: string) {
  const c = await getConnection(userId);
  if (c) await revoke(await openToken(c.refresh_token_enc).catch(() => ""));
  const sites = await rest<{ site_id: string }[]>(`google_links?user_id=eq.${q(userId)}&select=site_id`);
  if (sites.length) await rest(`google_cache?site_id=in.(${sites.map((s) => q(s.site_id)).join(",")})`, { method: "DELETE" });
  await rest(`google_links?user_id=eq.${q(userId)}`, { method: "DELETE" });
  await rest(`google_connections?user_id=eq.${q(userId)}`, { method: "DELETE" });
}

/** A fresh access token, or null when the person has revoked access at Google (the connection is then removed). */
export async function accessFor(c: Connection): Promise<string | null> {
  try {
    return await refreshAccess(await openToken(c.refresh_token_enc));
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "revoked") {
      await rest(`google_connections?user_id=eq.${q(c.user_id)}`, { method: "DELETE" });
      return null;
    }
    throw e;
  }
}

export async function ownSite(siteId: string, userId: string): Promise<Site | null> {
  if (!live() || !/^[0-9a-f-]{36}$/i.test(siteId)) return null;
  return (await rest<Site[]>(`sites?id=eq.${q(siteId)}&user_id=eq.${q(userId)}&select=id,user_id,host,url,last_scan_id&limit=1`))[0] ?? null;
}

export async function siteForHost(host: string, userId: string): Promise<Site | null> {
  if (!live()) return null;
  return (await rest<Site[]>(`sites?host=eq.${q(host)}&user_id=eq.${q(userId)}&select=id,user_id,host,url,last_scan_id&limit=1`))[0] ?? null;
}

export async function getLink(siteId: string): Promise<Link | null> {
  return (await rest<Link[]>(`google_links?site_id=eq.${q(siteId)}&select=site_id,user_id,gsc_property,ga4_property,ga4_name,ads_customer,ads_login,ads_name&limit=1`))[0] ?? null;
}

export async function setGscProperty(siteId: string, userId: string, property: string | null) {
  const row = { site_id: siteId, user_id: userId, gsc_property: property, updated_at: new Date().toISOString() };
  await rest("google_links?on_conflict=site_id", { method: "POST", body: JSON.stringify(row), prefer: "resolution=merge-duplicates,return=minimal" });
  // A different property makes the cached numbers wrong.
  await rest(`google_cache?site_id=eq.${q(siteId)}&source=in.(gsc,gsc_7,gsc_90,gsc_ai)`, { method: "DELETE" });
}

export async function setGa4Property(siteId: string, userId: string, property: string | null, name: string | null) {
  const row = { site_id: siteId, user_id: userId, ga4_property: property, ga4_name: name, updated_at: new Date().toISOString() };
  await rest("google_links?on_conflict=site_id", { method: "POST", body: JSON.stringify(row), prefer: "resolution=merge-duplicates,return=minimal" });
  await rest(`google_cache?site_id=eq.${q(siteId)}&source=in.(ga4,ga4_7,ga4_90,ga4_ai)`, { method: "DELETE" });
}

export async function setAdsAccount(siteId: string, userId: string, acct: { id: string; login: string | null; name: string } | null) {
  const row = { site_id: siteId, user_id: userId, ads_customer: acct?.id ?? null, ads_login: acct?.login ?? null, ads_name: acct?.name ?? null, updated_at: new Date().toISOString() };
  await rest("google_links?on_conflict=site_id", { method: "POST", body: JSON.stringify(row), prefer: "resolution=merge-duplicates,return=minimal" });
  await rest(`google_cache?site_id=eq.${q(siteId)}&source=in.(ads,ads_7,ads_90,ads_ai)`, { method: "DELETE" });
}

export async function getCache<T>(siteId: string, source: Source): Promise<CacheRow<T> | null> {
  return (await rest<CacheRow<T>[]>(`google_cache?site_id=eq.${q(siteId)}&source=eq.${source}&select=*&limit=1`))[0] ?? null;
}

export async function putCache(siteId: string, source: Source, data: unknown, error: string | null) {
  // After a failure the row counts as stale again an hour later, so the next dashboard open after that retries.
  const at = error ? Date.now() - STALE_MS + 60 * 60 * 1000 : Date.now();
  const row = { site_id: siteId, source, data, error, fetched_at: new Date(at).toISOString() };
  await rest("google_cache?on_conflict=site_id,source", { method: "POST", body: JSON.stringify(row), prefer: "resolution=merge-duplicates,return=minimal" });
}

/** Cached data is refetched when it is older than this (on dashboard open; there is no cron job). */
export const STALE_MS = 24 * 60 * 60 * 1000;
export const isStale = (c: { fetched_at: string } | null) => !c || Date.now() - Date.parse(c.fetched_at) > STALE_MS;

/** Fetches Search Console for a site and caches it. On a Google error the old data is kept and the error stored. */
export async function refreshGsc(site: Site, conn: Connection, property: string, days: Days = 28): Promise<CacheRow<GscData> | { revoked: true }> {
  const access = await accessFor(conn);
  if (!access) return { revoked: true };
  const scan = site.last_scan_id ? await getScanRow(site.last_scan_id) : null;
  const src = sourceOf("gsc", days);
  try {
    const data = await fetchGsc(access, property, { url: scan?.result?.url ?? site.url, findings: scan?.result?.findings ?? [] }, days);
    await putCache(site.id, src, data, null);
  } catch (e) {
    const old = await getCache<GscData>(site.id, src);
    const msg = e instanceof GoogleError && e.kind === "denied" ? "This Google account can no longer read that Search Console property." : "Google didn't answer just now. Try again in a few minutes.";
    console.error("gsc refresh", e instanceof Error ? e.message : e);
    await putCache(site.id, src, old?.data ?? null, msg);
  }
  return (await getCache<GscData>(site.id, src))!;
}

/** Fetches Google Analytics for a site and caches it. On a Google error the old data is kept and the error stored. */
export async function refreshGa4(site: Site, conn: Connection, link: Link, days: Days = 28): Promise<CacheRow<Ga4Data> | { revoked: true }> {
  const access = await accessFor(conn);
  if (!access) return { revoked: true };
  const src = sourceOf("ga4", days);
  try {
    const data = await fetchGa4(access, link.ga4_property!, link.ga4_name, days);
    await putCache(site.id, src, data, null);
  } catch (e) {
    const old = await getCache<Ga4Data>(site.id, src);
    const msg = e instanceof GoogleError && e.kind === "denied" ? "This Google account can no longer read that Analytics property." : "Google didn't answer just now. Try again in a few minutes.";
    console.error("ga4 refresh", e instanceof Error ? e.message : e);
    await putCache(site.id, src, old?.data ?? null, msg);
  }
  return (await getCache<Ga4Data>(site.id, src))!;
}

/** Fetches Google Ads for a site and caches it. On a Google error the old data is kept and the error stored. */
export async function refreshAds(site: Site, conn: Connection, link: Link, days: Days = 28): Promise<CacheRow<AdsData> | { revoked: true }> {
  const access = await accessFor(conn);
  if (!access) return { revoked: true };
  const src = sourceOf("ads", days);
  try {
    const data = await fetchAds(access, { id: link.ads_customer!, login: link.ads_login, name: link.ads_name }, days);
    await putCache(site.id, src, data, null);
  } catch (e) {
    const old = await getCache<AdsData>(site.id, src);
    const msg =
      e instanceof AdsTokenError
        ? "Pagelyt's Google Ads access is still waiting for Google's approval, so it can't read real accounts yet."
        : e instanceof GoogleError && e.kind === "denied"
          ? "This Google account can no longer read that Google Ads account."
          : "Google didn't answer just now. Try again in a few minutes.";
    console.error("ads refresh", e instanceof Error ? e.message : e);
    await putCache(site.id, src, old?.data ?? null, msg);
  }
  return (await getCache<AdsData>(site.id, src))!;
}
