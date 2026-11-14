/* Server only. Reads Google Ads through its REST API (GAQL search queries; Pagelyt never changes anything): the
   accounts the connected Google account can see, including the client accounts under a manager (agency) account,
   which one belongs to a site (ads landing on its domain), and the 28-day numbers in six queries. Google retired
   developer tokens in September 2026: access now belongs to the Cloud project behind GOOGLE_CLIENT_ID (Google Ads API
   enabled, Explorer access or higher). Until Google approves that project it refuses real accounts, which comes back
   as AdsTokenError. Account checks are capped so a connect stays inside a Worker's subrequest budget. */

import { googleOn, GoogleError, gUrl } from "./oauth";
import { ga4Ranges } from "./ga4";
import { ZERO, type AdsCampaign, type AdsData, type AdsKeyword, type AdsLanding, type AdsTerm, type AdsTotals } from "./ads-insights";

const VERSION = () => process.env.GOOGLE_ADS_API_VERSION || "v26";
const BASE = () => `https://googleads.googleapis.com/${VERSION()}`;
const MAX_ACCOUNTS = 15, MAX_MANAGERS = 3, MAX_MATCH = 12;

export const adsOn = () => googleOn();

/** Pagelyt's Cloud project can't read real accounts yet: Google Ads API not enabled, or only Test access. */
export class AdsTokenError extends Error {}

/** `login`: the manager account the client is read through, or null when the account is read directly. */
export type AdsAccount = { id: string; name: string; login: string | null; currency: string };

const digits = (s: string) => s.replace(/\D/g, "");

async function call<T>(access: string, path: string, body?: unknown, login?: string | null): Promise<T> {
  const r = await fetch(gUrl(`${BASE()}/${path}`), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${access}`,
      ...(login ? { "login-customer-id": digits(login) } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 600);
    if (/CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|SERVICE_DISABLED|accessNotConfigured|DEVELOPER_TOKEN_NOT_APPROVED/.test(t)) throw new AdsTokenError(t.slice(0, 200));
    throw new GoogleError(r.status === 401 ? "revoked" : r.status === 403 ? "denied" : "api", `Google Ads ${r.status}: ${t.slice(0, 300)}`);
  }
  return (await r.json()) as T;
}

type Row = Record<string, Record<string, unknown> | undefined>;

/** One GAQL search; follows up to `pages` result pages (10,000 rows each). */
async function search(access: string, customer: string, query: string, login?: string | null, pages = 1): Promise<Row[]> {
  const out: Row[] = [];
  let token = "";
  for (let i = 0; i < pages; i++) {
    const d = await call<{ results?: Row[]; nextPageToken?: string }>(access, `customers/${digits(customer)}/googleAds:search`, { query, ...(token ? { pageToken: token } : {}) }, login);
    out.push(...(d.results ?? []));
    if (!d.nextPageToken) break;
    token = d.nextPageToken;
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => Number(v ?? 0) || 0;

/** Every advertising (non-manager) account the person can read, directly or through a manager account. */
export async function listAdsAccounts(access: string): Promise<AdsAccount[]> {
  const names = (await call<{ resourceNames?: string[] }>(access, "customers:listAccessibleCustomers")).resourceNames ?? [];
  const out = new Map<string, AdsAccount>();
  const managers: string[] = [];
  const ids = names.map((n) => digits(n.split("/")[1] ?? "")).filter(Boolean).slice(0, MAX_ACCOUNTS);
  await Promise.all(
    ids.map(async (id) => {
      try {
        const c = (await search(access, id, "SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code FROM customer LIMIT 1"))[0]?.customer;
        if (!c) return;
        if (c.manager === true) managers.push(id);
        else out.set(id, { id, name: str(c.descriptiveName) || id, login: null, currency: str(c.currencyCode) || "USD" });
      } catch (e) {
        if (e instanceof AdsTokenError) throw e;
        /* a cancelled or unreadable account: skip it */
      }
    })
  );
  await Promise.all(
    managers.slice(0, MAX_MANAGERS).map(async (m) => {
      try {
        const rows = await search(access, m, "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.currency_code FROM customer_client WHERE customer_client.level = 1 AND customer_client.status = 'ENABLED'", m);
        for (const r of rows) {
          const c = r.customerClient;
          const id = digits(str(c?.id));
          if (id && c?.manager !== true && !out.has(id)) out.set(id, { id, name: str(c?.descriptiveName) || id, login: m, currency: str(c?.currencyCode) || "USD" });
        }
      } catch (e) {
        if (e instanceof AdsTokenError) throw e;
      }
    })
  );
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** The account whose ads land on this host (www or not) in the last 30 days. Falls back to an account named after it. */
export async function matchAdsAccount(access: string, host: string, accounts: AdsAccount[]): Promise<AdsAccount | null> {
  const h = bare(host);
  const word = h.split(".")[0];
  const byName = accounts.find((a) => a.name.toLowerCase().includes(h) || a.name.toLowerCase().includes(word));
  const order = [...accounts].sort((a, b) => Number(b.name.toLowerCase().includes(word)) - Number(a.name.toLowerCase().includes(word))).slice(0, MAX_MATCH);
  const hits = await Promise.all(
    order.map(async (a) => {
      try {
        const rows = await search(access, a.id, "SELECT landing_page_view.unexpanded_final_url FROM landing_page_view WHERE segments.date DURING LAST_30_DAYS LIMIT 50", a.login);
        return rows.some((r) => {
          try {
            return bare(new URL(str(r.landingPageView?.unexpandedFinalUrl)).hostname) === h;
          } catch {
            return false;
          }
        });
      } catch (e) {
        if (e instanceof AdsTokenError) throw e;
        return false;
      }
    })
  );
  return order.find((_, i) => hits[i]) ?? byName ?? null;
}

const totalsOf = (m?: Record<string, unknown>): AdsTotals => ({
  cost: num(m?.costMicros) / 1e6,
  clicks: num(m?.clicks),
  impressions: num(m?.impressions),
  conversions: num(m?.conversions),
  value: num(m?.conversionsValue),
});
const add = (a: AdsTotals, b: AdsTotals): AdsTotals => ({ cost: a.cost + b.cost, clicks: a.clicks + b.clicks, impressions: a.impressions + b.impressions, conversions: a.conversions + b.conversions, value: a.value + b.value });

export async function fetchAds(access: string, acct: { id: string; login: string | null; name: string | null }): Promise<AdsData> {
  const { range, prevRange } = ga4Ranges();
  const now = `segments.date BETWEEN '${range.start}' AND '${range.end}'`;
  const M = "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value";
  const q = (query: string) => search(access, acct.id, query, acct.login);
  const [info, days, camps, lands, kws, ads, terms] = await Promise.all([
    q("SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1"),
    q(`SELECT segments.date, ${M} FROM customer WHERE segments.date BETWEEN '${prevRange.start}' AND '${range.end}'`),
    q(`SELECT campaign.name, campaign.status, campaign.advertising_channel_type, ${M} FROM campaign WHERE ${now} AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT 50`),
    q(`SELECT landing_page_view.unexpanded_final_url, metrics.cost_micros, metrics.clicks, metrics.conversions FROM landing_page_view WHERE ${now} AND metrics.clicks > 0 ORDER BY metrics.cost_micros DESC LIMIT 300`),
    q(`SELECT ad_group.id, campaign.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, ad_group_criterion.quality_info.post_click_quality_score, ad_group_criterion.final_urls, metrics.cost_micros, metrics.clicks, metrics.conversions FROM keyword_view WHERE ${now} AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT 500`),
    q("SELECT ad_group.id, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ad_group_ad.status = 'ENABLED' AND campaign.status = 'ENABLED' LIMIT 2000"),
    q(`SELECT search_term_view.search_term, ${M} FROM search_term_view WHERE ${now} AND metrics.clicks > 0 ORDER BY metrics.cost_micros DESC LIMIT 500`),
  ]);

  let totals = { ...ZERO }, prev = { ...ZERO };
  const daily: AdsData["daily"] = [];
  for (const r of days) {
    const date = str(r.segments?.date);
    const t = totalsOf(r.metrics);
    if (date >= range.start) {
      totals = add(totals, t);
      daily.push({ date, cost: t.cost, clicks: t.clicks });
    } else prev = add(prev, t);
  }

  const campaigns: AdsCampaign[] = camps.map((r) => ({ name: str(r.campaign?.name), status: str(r.campaign?.status), type: str(r.campaign?.advertisingChannelType), ...totalsOf(r.metrics) }));
  const landing: AdsLanding[] = lands.map((r) => { const t = totalsOf(r.metrics); return { url: str(r.landingPageView?.unexpandedFinalUrl), cost: t.cost, clicks: t.clicks, conversions: t.conversions }; }).filter((l) => l.url);

  // A keyword usually has no URL of its own; its ads' final URL is where its clicks land.
  const adUrl = new Map<string, string>();
  for (const r of ads) {
    const id = str(r.adGroup?.id);
    const u = ((r.adGroupAd?.ad as { finalUrls?: string[] } | undefined)?.finalUrls ?? [])[0];
    if (id && u && !adUrl.has(id)) adUrl.set(id, u);
  }
  const keywords: AdsKeyword[] = kws.map((r) => {
    const c = r.adGroupCriterion as { keyword?: { text?: string; matchType?: string }; qualityInfo?: { qualityScore?: number; postClickQualityScore?: string }; finalUrls?: string[] } | undefined;
    const t = totalsOf(r.metrics);
    const lpx = c?.qualityInfo?.postClickQualityScore;
    return {
      text: c?.keyword?.text ?? "",
      match: c?.keyword?.matchType ?? "",
      campaign: str(r.campaign?.name),
      qs: c?.qualityInfo?.qualityScore ? Number(c.qualityInfo.qualityScore) : null,
      lpx: lpx && !["UNSPECIFIED", "UNKNOWN"].includes(lpx) ? lpx : null,
      url: c?.finalUrls?.[0] ?? adUrl.get(str(r.adGroup?.id)) ?? null,
      cost: t.cost,
      clicks: t.clicks,
      conversions: t.conversions,
    };
  }).filter((k) => k.text);
  const termRows: AdsTerm[] = terms.map((r) => { const t = totalsOf(r.metrics); return { term: str(r.searchTermView?.searchTerm), cost: t.cost, clicks: t.clicks, impressions: t.impressions, conversions: t.conversions }; }).filter((t) => t.term);

  const c = info[0]?.customer;
  return {
    customer: digits(acct.id),
    name: str(c?.descriptiveName) || acct.name,
    currency: str(c?.currencyCode) || "USD",
    range,
    prevRange,
    totals,
    prev,
    daily: daily.sort((a, b) => a.date.localeCompare(b.date)),
    campaigns,
    landing,
    keywords,
    terms: termRows,
  };
}
