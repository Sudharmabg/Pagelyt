import type { CheerioAPI } from "cheerio";
import type { FetchResult } from "./fetcher";
import type { Finding, ModuleKey, Severity } from "./types";
import { defacementChecks } from "./visual";

type Add = (module: ModuleKey, severity: Severity, id: string, title: string, why: string, fix: string, evidence?: string) => void;

/* Static checks added after the first release: ARIA and keyboard, content signals, privacy. */
export function extraChecks(o: { $: CheerioAPI; page: FetchResult; finalUrl: URL; bodyText: string; add: Add; hdr: (n: string) => string }) {
  const { $, page, finalUrl, bodyText, add, hdr } = o;
  const isHttps = finalUrl.protocol === "https:";

  /* ---- Accessibility: ARIA and keyboard ---- */
  const badRefs = $("[aria-labelledby], [aria-describedby]").filter((_, el) => {
    const ids = `${$(el).attr("aria-labelledby") || ""} ${$(el).attr("aria-describedby") || ""}`.trim().split(/\s+/).filter(Boolean);
    return ids.some((i) => !$(`[id="${i.replace(/"/g, "")}"]`).length);
  }).length;
  if (badRefs) add("accessibility", "medium", "aria-broken-ref", `${badRefs} ARIA reference${badRefs > 1 ? "s" : ""} point to missing elements`, "Assistive technology reads nothing for a label that does not exist.", "Make aria-labelledby and aria-describedby point to ids that exist on the page.");

  const fakeButtons = $("[role=button]").filter((_, el) => !/^(a|button|input)$/i.test(el.tagName) && $(el).attr("tabindex") === undefined).length;
  if (fakeButtons) add("accessibility", "medium", "role-button-focus", `${fakeButtons} custom button${fakeButtons > 1 ? "s" : ""} cannot be reached with a keyboard`, "Keyboard-only users cannot focus or press them.", 'Use a real <button>, or add tabindex="0" and key handlers.');

  const posTab = $("[tabindex]").filter((_, el) => Number($(el).attr("tabindex")) > 0).length;
  if (posTab) add("accessibility", "low", "positive-tabindex", `${posTab} element${posTab > 1 ? "s use" : " uses"} a positive tabindex`, "Positive values override the natural tab order and confuse keyboard users.", 'Use tabindex="0" or "-1", and order the HTML logically.');

  const links = $("a[href]");
  const early = links.slice(0, 5).toArray().map((el) => $(el).attr("href") || "");
  if (links.length > 15 && !early.some((x) => x.startsWith("#") && x.length > 1)) add("accessibility", "low", "no-skip-link", "No “skip to content” link", "Keyboard users must tab through the whole menu on every page.", 'Add a first link such as <a href="#main">Skip to content</a>.');

  const css = $("style").text();
  if (/outline\s*:\s*(none|0)\b/i.test(css) && !/:focus-visible/i.test(css)) add("accessibility", "medium", "focus-removed", "Focus outlines are removed", "Keyboard users lose track of where they are on the page.", "Replace outline:none with a visible :focus-visible style.");

  /* ---- Content and GEO ---- */
  const ldText = $('script[type="application/ld+json"]').text();
  const questionHeads = $("h2,h3,h4").filter((_, el) => /\?\s*$/.test($(el).text().trim())).length;
  if (!/FAQPage/.test(ldText) && questionHeads < 2 && bodyText.length > 800) add("geo", "low", "no-faq", "No FAQ or question-style content", "AI assistants and search features pull direct answers from clearly asked and answered questions.", "Add a short FAQ with real customer questions as headings, and mark it up with FAQPage structured data.");

  let internal = 0;
  links.each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    try {
      if (new URL(href, finalUrl).hostname === finalUrl.hostname) internal++;
    } catch {
      /* ignore */
    }
  });
  if (internal < 3 && bodyText.length > 300) add("seo", "low", "few-internal-links", `Only ${internal} internal link${internal === 1 ? "" : "s"} on this page`, "Internal links help visitors and search engines discover your other pages.", "Link to your key service, product and contact pages from the main content.");

  const lm = hdr("last-modified");
  if (lm) {
    const age = (Date.now() - new Date(lm).getTime()) / 86_400_000;
    if (age > 730) add("seo", "low", "stale-content", `Page was last modified ${Math.floor(age / 365)} years ago`, "Search and AI systems favour content that is kept up to date.", "Review and refresh the page, or confirm the date is simply a server default.", lm);
  }

  /* ---- Privacy and compliance ---- */
  const linkText = links.map((_, el) => `${$(el).attr("href")} ${$(el).text()}`).get().join(" \n ").toLowerCase();
  if (!/privacy/.test(linkText)) add("privacy", "high", "no-privacy-policy", "No privacy policy link found", "Most privacy laws (GDPR, India's DPDP Act, CCPA) expect a clear policy, and ad and analytics tools require one.", "Publish a privacy policy and link to it from the footer of every page.");
  if (!/(terms|conditions)/.test(linkText)) add("privacy", "low", "no-terms", "No terms of use link found", "Terms set expectations and limit your liability.", "Publish terms and link to them from the footer.");

  const html = page.body;
  const trackers = [...new Set((html.match(/google-analytics\.com|googletagmanager\.com|connect\.facebook\.net|static\.hotjar\.com|snap\.licdn\.com|analytics\.tiktok\.com|clarity\.ms|doubleclick\.net|ads-twitter\.com/gi) || []).map((x) => x.toLowerCase()))];
  const hasConsent = /cookie[-_ ]?(consent|banner|notice|law)|cookiebot|onetrust|osano|termly|iubenda|complianz|cookieyes|consent-manager/i.test(html);
  if (trackers.length && !hasConsent) add("privacy", "medium", "no-cookie-consent", "Tracking scripts found but no cookie consent tool detected", "Loading analytics or ad trackers before consent can breach GDPR and similar laws for visitors in those regions.", "Add a consent banner that blocks trackers until visitors agree.", trackers.join(", "));

  const hosts = new Set<string>();
  $("script[src]").each((_, el) => {
    try {
      const h = new URL($(el).attr("src")!, finalUrl).hostname;
      if (h !== finalUrl.hostname) hosts.add(h);
    } catch {
      /* ignore */
    }
  });
  if (hosts.size > 12) add("privacy", "low", "many-third-party", `${hosts.size} third-party script sources`, "Every outside script can slow the page, leak visitor data and widen your attack surface.", "Remove scripts you no longer use and load the rest only where needed.", [...hosts].slice(0, 8).join(", "));

  defacementChecks($, add);

  if (!isHttps && $("form input[type=password]").length) add("privacy", "high", "insecure-form", "Password field on a non-HTTPS page", "Passwords sent over HTTP can be read by anyone on the network.", "Serve the whole site over HTTPS.");
}

export type { Finding };
