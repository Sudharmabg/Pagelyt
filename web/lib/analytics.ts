/* Google Analytics 4 for Pagelyt's own site, behind the cookie banner (app/cookie-consent.tsx).

   GA loads with Consent Mode v2 and every storage type denied, so it sets no cookies until the visitor accepts
   analytics; before that Google only receives cookieless pings. Ads storage stays denied for good: we don't
   advertise with this data. The choice lives in a first-party cookie (pl_consent) for 6 months.
   Nothing loads without NEXT_PUBLIC_GA_ID, and nothing is sent from /admin or /print (the PDF renderer). */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
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
  if (!GA_ID || typeof window === "undefined" || isUntracked(location.pathname)) return false;
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
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
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
