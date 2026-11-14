export const SITE_NAME = "Pagelyt";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://pagelyt.dev").replace(/\/$/, "");
export const SITE_TAGLINE = "Illuminate Your Website.";
export const SITE_DESCRIPTION =
  "Pagelyt is a website analysis and monitoring platform. Enter a URL for a scored report on website health, speed and Core Web Vitals, technical SEO, AI search readiness (GEO), security headers and accessibility, with prioritised fixes in plain English. Works with Google Search Console, Google Analytics 4 and Google Ads to show real traffic on every fix.";
/** Pricing is hidden for now: off removes every link to it and sends /pricing to the home page. Flip to true to bring it back. */
export const PRICING_ON = false;
export const CONTACT_EMAIL = "customer_care@pagelyt.dev";
