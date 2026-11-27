/* Google Analytics 4 for Pagelyt's own site, behind the cookie banner (app/cookie-consent.tsx).

   GA loads with Consent Mode v2 and every storage type denied, so it sets no cookies until the visitor accepts
   analytics; before that Google only receives cookieless pings. Ads storage stays denied for good: we don't
   advertise with this data. The choice lives in a first-party cookie (pl_consent) for 6 months.
   Nothing loads without NEXT_PUBLIC_GA_ID, and nothing is sent from /admin or /print (the PDF renderer). */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
/* Google Tag Manager runs beside gtag.js, not instead of it: gtag.js stays the only GA4 sender, and the container
   (NEXT_PUBLIC_GTM_ID, e.g. GTM-XXXXXXX) is for everything else (Ads, Meta, LinkedIn...). It loads behind the same
   consent defaults, so its Google tags honour the banner. No <noscript> iframe: it would run without consent. */
export const GTM_ID = /^GTM-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GTM_ID ?? "") ? (process.env.NEXT_PUBLIC_GTM_ID as string) : "";
export const CONSENT_COOKIE = "pl_consent";
/** Window event that reopens the cookie banner (the footer's "Cookie settings" link). */
export const CONSENT_OPEN_EVENT = "pagelyt:cookie-settings";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 182; // about 6 months

export type Consent = "granted" | "denied";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/** Paths that never send analytics and never show the banner. */
export const isUntracked = (path: string) => /^\/(admin|print)(\/|$)/.test(path);

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=(granted|denied)`));
  return m ? (m[1] as Consent) : null;
}

export function saveConsent(c: Consent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${c}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  ensureGa();
  window.gtag?.("consent", "update", { analytics_storage: c });
  if (c === "denied") clearGaCookies();
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

/** Removes GA's own cookies after someone withdraws consent. */
function clearGaCookies() {
  const host = location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const name of document.cookie.split("; ").map((c) => c.split("=")[0])) {
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ""}`;
  }
}

let started = false;

/** Sets up gtag once: consent defaults first, then config, then the gtag.js script. */
function ensureGa(): boolean {
  if (started) return true;
  if ((!GA_ID && !GTM_ID) || typeof window === "undefined" || isUntracked(location.pathname)) return false;
  started = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the arguments object itself, so this must push `arguments`, not an array.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: readConsent() === "granted" ? "granted" : "denied",
  });
  if (GA_ID) {
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { send_page_view: false });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);
  }
  if (GTM_ID) {
    // Standard GTM start: the container replays everything already in the dataLayer (consent defaults, page_context).
    window.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const g = document.createElement("script");
    g.async = true;
    g.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
    document.head.appendChild(g);
  }
  return true;
}

/** Sends a GA4 event. Safe to call anywhere: it does nothing without an ID, on the server, or on admin pages. */
export function track(name: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === "undefined" || isUntracked(location.pathname) || !ensureGa()) return;
  window.gtag?.("event", name, params);
}

export function trackPageView() {
  track("page_view", { page_location: location.href, page_path: location.pathname, page_title: document.title });
}

/* ---- dataLayer ----
   Structured objects on window.dataLayer (page, user, scan, consent, environment) so Google Tag Manager or any
   other tag can read them later. Only ids, buckets and slugs go in: never an email, name, URL typed by a
   visitor, or form value. Nothing is pushed from /admin or /print. */

export type PageType =
  | "home" | "pricing" | "feature" | "features_hub" | "tool" | "tools_hub" | "blog_post" | "blog_hub"
  | "use_case" | "compare" | "consultation" | "dashboard" | "report" | "account" | "auth" | "legal"
  | "contact" | "about" | "faq" | "how_it_works" | "other";

/** Classifies a path into a page type plus its section slug (tool, feature, post). */
export function pageInfo(path: string): { page_type: PageType; page_section: string; page_slug?: string } {
  const seg = path.split("?")[0].split("/").filter(Boolean);
  const [a, b] = seg;
  if (!a) return { page_type: "home", page_section: "home" };
  const one = (page_type: PageType, section = a) => ({ page_type, page_section: section });
  switch (a) {
    case "pricing": return one("pricing");
    case "features": return b ? { ...one("feature"), page_slug: b } : one("features_hub");
    case "tools": return b ? { ...one("tool"), page_slug: b } : one("tools_hub");
    case "blog": return b ? { ...one("blog_post"), page_slug: b } : one("blog_hub");
    case "use-cases": return { ...one("use_case"), page_slug: b };
    case "compare": return one("compare");
    case "consultation": return one("consultation");
    case "dashboard": return one("dashboard");
    case "r": case "fix": return one("report");
    case "account": return one("account");
    case "login": case "auth": case "claim": case "check-email": return one("auth");
    case "privacy": case "terms": return one("legal");
    case "contact": return one("contact");
    case "about": return one("about");
    case "faq": return one("faq");
    case "how-it-works": return one("how_it_works");
    default: return one("other");
  }
}

/** Pushes one object to the dataLayer (created on demand, so it works before gtag.js loads). */
export function dl(data: Record<string, unknown>) {
  if (typeof window === "undefined" || isUntracked(location.pathname)) return;
  ensureGa(); // sets the consent defaults first, so they always precede any other push
  (window.dataLayer = window.dataLayer || []).push(data);
}

/** One-way id for the dataLayer: SHA-256 of the account id, so tags can count people without knowing who. */
export async function hashId(id: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
    return Array.from(new Uint8Array(buf)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

export type DlUser = { logged_in: boolean; user_hash?: string; account_age?: "new" | "week" | "month" | "older" };

const ageBucket = (createdAt?: string): DlUser["account_age"] => {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(t)) return undefined;
  const days = (Date.now() - t) / 86_400_000;
  return days < 1 ? "new" : days < 7 ? "week" : days < 30 ? "month" : "older";
};
export { ageBucket };

/** Where the visitor came from: "direct", "internal", or the referring host. */
function referrerKind(): string {
  try {
    if (!document.referrer) return "direct";
    const h = new URL(document.referrer).hostname;
    return h === location.hostname ? "internal" : h.replace(/^www\./, "");
  } catch {
    return "direct";
  }
}

/** The full page_context push: page, user, consent and environment, once per route change. */
export function pushPageContext(user: DlUser) {
  const w = window.innerWidth;
  dl({
    event: "page_context",
    page: {
      path: location.pathname,
      title: document.title,
      ...pageInfo(location.pathname),
      referrer: referrerKind(),
      language: document.documentElement.lang || "en",
    },
    user,
    consent: { analytics: readConsent() ?? "unset" },
    env: {
      device: w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop",
      viewport: `${w}x${window.innerHeight}`,
      theme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    },
  });
}

/** Scan result summary for the dashboard: score and issue counts only, plus the host (a public site, not a person). */
export type DlScan = {
  host: string;
  overall: number;
  band: "poor" | "needs_work" | "good" | "great";
  open_issues: number;
  high_issues: number;
  modules: Record<string, number>;
};

export const scoreBand = (n: number): DlScan["band"] => (n >= 90 ? "great" : n >= 75 ? "good" : n >= 50 ? "needs_work" : "poor");

export function pushScanContext(scan: DlScan, extra: Record<string, unknown> = {}) {
  dl({ event: "scan_context", scan, ...extra });
  track("scan_viewed", { score: scan.overall, band: scan.band, open_issues: scan.open_issues, high_issues: scan.high_issues });
}
