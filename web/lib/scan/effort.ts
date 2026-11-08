import type { Finding } from "./types";

/* Rough effort to fix each finding, for "quick wins" (impact ÷ effort).
   1 = minutes: a setting, a header, a DNS record or one tag.
   2 = an hour or two: content or markup edits across a few pages.
   3 = a project: development or performance work.
   Client-safe (no server imports). */

export type Effort = 1 | 2 | 3;

const E: Record<string, Effort> = {
  // minutes
  hsts: 1, nosniff: 1, referrer: 1, clickjacking: 1, "version-leak": 1, "http-no-redirect": 1, "no-compression": 1, "no-caching": 1,
  "no-spf": 1, "spf-open": 1, "no-dmarc": 1, "dmarc-none": 1, "no-dkim": 1, "no-dnssec": 1, "no-caa": 1, "single-ns": 1, "no-mx": 1,
  "domain-expired": 1, "domain-expiring": 1, "ssl-expired": 1, "ssl-expiring": 1, "old-tls": 1,
  "no-security-txt": 1, "security-txt-expired": 1, "no-llms": 1, "no-robots": 1, "no-sitemap": 1, "ai-blocked": 1, noindex: 1,
  "no-viewport": 1, "no-lang": 1, "a11y-lang": 1, "zoom-blocked": 1, "no-title": 1, "a11y-title": 1, "no-description": 1, "no-canonical": 1, "no-og": 1,
  "exposed-env": 1, "exposed-git": 1, "exposed-wpconfig": 1, "exposed-phpinfo": 1, "exposed-svn": 1, "exposed-backup": 1, "exposed-dsstore": 1, "exposed-server-status": 1, "exposed-composer": 1,
  "hreflang-no-default": 1, "pagination-links": 1, "redirect-chain": 1, "positive-tabindex": 1, "no-skip-link": 1, "no-terms": 2,
  // an hour or two
  "title-length": 2, "description-length": 2, "no-h1": 2, "multi-h1": 2, "img-alt-missing": 2, "a11y-alt": 2, "form-labels": 2, "empty-links": 2, "empty-buttons": 2,
  "heading-skip": 2, "no-main": 2, "aria-broken-ref": 2, "focus-removed": 2, "role-button-focus": 2, "no-structured-data": 2, "bad-json-ld": 2, "schema-required": 2, "schema-recommended": 2,
  "hreflang-invalid": 2, "hreflang-no-self": 2, "hreflang-conflict": 2, "hreflang-relative": 2, "hreflang-no-return": 2, "hreflang-broken": 2, "pagination-canonical": 2,
  "broken-links": 2, "crawl-broken-pages": 2, "crawl-missing-titles": 2, "crawl-missing-descriptions": 2, "crawl-missing-canonicals": 2, "crawl-missing-h1": 2, "crawl-duplicate-titles": 2,
  "crawl-duplicate-descriptions": 2, "crawl-noindex-in-sitemap": 1, "crawl-orphan-pages": 2, "crawl-schema-incomplete": 2, "few-internal-links": 2, "no-subheadings": 2, "no-faq": 2,
  "no-privacy-policy": 2, "no-cookie-consent": 2, "mixed-content": 2, "no-lazy": 2, "img-dimensions": 2, "img-oversized": 2, "img-legacy-format": 2, "img-heavy-gif": 2, "img-savings": 2,
  "render-blocking": 2, "many-third-party": 2, "stale-content": 2, "defaced": 2, "spam-injection": 2, "status-4xx": 2,
  // a project
  csp: 3, "no-https": 2, "insecure-form": 2, "slow-response": 3, "heavy-html": 3, "page-weight": 3, "lh-score": 3, lcp: 3, cls: 3, tbt: 3, inp: 3, "thin-text": 3, "crawl-thin-content": 3, "status-5xx": 3,
};

export const effortOf = (f: Finding): Effort => E[f.id] ?? 2;

export const EFFORT_LABEL: Record<Effort, string> = { 1: "Quick fix", 2: "An hour or two", 3: "Bigger project" };

/** Open findings ordered by points gained per unit of effort; ties go to the bigger gain. */
export function quickWins(findings: Finding[], gainOf: (f: Finding) => number, n = 5): { f: Finding; gain: number; effort: Effort }[] {
  return findings
    .map((f) => ({ f, gain: gainOf(f), effort: effortOf(f) }))
    .filter((x) => x.gain > 0 && x.effort < 3)
    .sort((a, b) => b.gain / b.effort - a.gain / a.effort || b.gain - a.gain)
    .slice(0, n);
}
