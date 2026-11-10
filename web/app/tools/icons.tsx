import type { ToolCategory, ToolSlug } from "./catalog";

/* Line icons for the free tools (24px grid, drawn with currentColor) and each category's colour. */

const PATHS: Record<ToolSlug, React.ReactNode> = {
  "ai-bot-checker": (
    <>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V5M12 4.5h.01M9 13h.01M15 13h.01M9.5 16.5h5M2 12v3M22 12v3" />
    </>
  ),
  "llms-txt-generator": (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
      <path d="M17.5 13.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </>
  ),
  "robots-txt-tester": (
    <>
      <path d="M4 5h16M4 10h10M4 15h7" />
      <circle cx="17" cy="16" r="3.5" />
      <path d="M19.5 18.5 22 21" />
    </>
  ),
  "robots-txt-generator": (
    <>
      <path d="M4 5h16M4 10h16M4 15h9M4 20h6" />
      <path d="M18 14v6M15 17h6" />
    </>
  ),
  "hreflang-checker": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  "serp-preview": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 9h10M7 13h7M7 16.5h5" />
    </>
  ),
  "schema-markup-generator": (
    <>
      <path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5V10l-2 2 2 2v3.5A2.5 2.5 0 0 0 6.5 20H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V10l2 2-2 2v3.5a2.5 2.5 0 0 1-2.5 2.5H16" />
      <path d="M10 12h.01M14 12h.01" />
    </>
  ),
  "security-headers-generator": (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </>
  ),
  "domain-age-checker": (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </>
  ),
  "google-review-link-generator": (
    <>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </>
  ),
  "bulk-schema-checker": (
    <>
      <path d="M7 4H5.5A1.5 1.5 0 0 0 4 5.5V9l-1.5 1.5L4 12v3.5A1.5 1.5 0 0 0 5.5 17H7" />
      <path d="M11 6h9M11 11h6M11 16h4" />
      <path d="m15 19.5 1.8 1.8 3.7-3.8" />
    </>
  ),
  "sitemap-generator": (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1.2" />
      <rect x="3" y="16" width="6" height="5" rx="1.2" />
      <rect x="15" y="16" width="6" height="5" rx="1.2" />
      <path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    </>
  ),
  "raw-vs-rendered-html": (
    <>
      <rect x="2.5" y="4" width="8" height="16" rx="2" />
      <rect x="13.5" y="4" width="8" height="16" rx="2" />
      <path d="M5 8.5h3M5 11.5h2M16 8.5h3M16 11.5h3M16 14.5h3M16 17h2" />
    </>
  ),
};

export function ToolIcon({ slug, size = 24 }: { slug: ToolSlug; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[slug]}
    </svg>
  );
}

/** CSS class that colours a card, chip or icon badge by category (see .tc-* in globals.css). */
export const TONE: Record<ToolCategory, string> = {
  "AI visibility": "tc-ai",
  "Crawling & indexing": "tc-crawl",
  "Search appearance": "tc-serp",
  "Security & domain": "tc-sec",
  "Local business": "tc-local",
};
