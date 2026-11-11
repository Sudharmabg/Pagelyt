import type { ToolSlug } from "./catalog";

/* An example of what each tool gives back, shown on the home page's featured tools and on each tool's page
   ("What you'll get"). Illustrative only: made-up sites and results. */

type Tone = "ok" | "warn" | "bad" | "na";
type Sample =
  | { kind: "rows"; rows: [string, string, Tone][] }
  | { kind: "code"; file: string; lines: string[] }
  | { kind: "serp"; url: string; title: string; desc: string };

export const SAMPLES: Record<ToolSlug, Sample> = {
  "ai-bot-checker": {
    kind: "rows",
    rows: [
      ["GPTBot", "Allowed", "ok"],
      ["ClaudeBot", "Allowed", "ok"],
      ["PerplexityBot", "Blocked in robots.txt", "bad"],
      ["CCBot", "Turned away by server", "warn"],
    ],
  },
  "llms-txt-generator": {
    kind: "code",
    file: "llms.txt",
    lines: ["# Sharma Dental Clinic", "> Family dental care in Pune since 2009.", "", "## Services", "- [Teeth whitening](/whitening)", "- [Braces](/braces)"],
  },
  "robots-txt-tester": {
    kind: "rows",
    rows: [
      ["/blog/ · Googlebot", "Allowed", "ok"],
      ["/admin/ · Googlebot", "Blocked", "bad"],
      ["/blog/ · GPTBot", "Allowed", "ok"],
      ["Rule used", "Disallow: /admin/", "na"],
    ],
  },
  "raw-vs-rendered-html": {
    kind: "rows",
    rows: [
      ["Title", "Same in both", "ok"],
      ["Main text", "Only after JavaScript", "warn"],
      ["Links", "38 raw · 112 rendered", "warn"],
      ["Structured data", "Same in both", "ok"],
    ],
  },
  "robots-txt-generator": {
    kind: "code",
    file: "robots.txt",
    lines: ["User-agent: *", "Allow: /", "Disallow: /admin/", "", "User-agent: GPTBot", "Allow: /", "", "Sitemap: https://example.com/sitemap.xml"],
  },
  "hreflang-checker": {
    kind: "rows",
    rows: [
      ["en-IN → /en-in/", "Links back", "ok"],
      ["hi-IN → /hi/", "Links back", "ok"],
      ["en-US → /us/", "Missing return link", "bad"],
      ["x-default → /", "Links back", "ok"],
    ],
  },
  "sitemap-generator": {
    kind: "code",
    file: "sitemap.xml",
    lines: ['<urlset xmlns="…sitemap/0.9">', "  <url><loc>https://example.com/</loc></url>", "  <url><loc>https://example.com/services</loc></url>", "  <url><loc>https://example.com/contact</loc></url>", "</urlset>"],
  },
  "serp-preview": {
    kind: "serp",
    url: "example.com › services › whitening",
    title: "Teeth Whitening in Pune | Sharma Dental Clinic",
    desc: "Professional whitening in a single 60-minute visit. Book online, see transparent prices and read 400+ patient reviews.",
  },
  "schema-markup-generator": {
    kind: "code",
    file: "schema.json",
    lines: ["{", '  "@context": "https://schema.org",', '  "@type": "Dentist",', '  "name": "Sharma Dental Clinic",', '  "telephone": "+91 20 0000 0000"', "}"],
  },
  "bulk-schema-checker": {
    kind: "rows",
    rows: [
      ["/", "Organization: complete", "ok"],
      ["/services", "LocalBusiness: no address", "warn"],
      ["/blog/braces", "Article: complete", "ok"],
      ["/contact", "No structured data", "na"],
    ],
  },
  "security-headers-generator": {
    kind: "code",
    file: "_headers",
    lines: ["Strict-Transport-Security: max-age=31536000", "Content-Security-Policy: default-src 'self'", "X-Content-Type-Options: nosniff", "Referrer-Policy: strict-origin-when-cross-origin"],
  },
  "domain-age-checker": {
    kind: "rows",
    rows: [
      ["example.com", "15 years old", "ok"],
      ["Expires", "In 22 days", "warn"],
      ["Registrar", "Example Registrar Ltd", "na"],
      ["shop-example.in", "Registered last month", "na"],
    ],
  },
  "google-review-link-generator": {
    kind: "code",
    file: "review-link.txt",
    lines: ["https://search.google.com/local/writereview", "  ?placeid=ChIJ…your-place-id", "", "Share it by WhatsApp, email or a QR code."],
  },
};

const MARK: Record<Tone, string> = { ok: "✓", warn: "!", bad: "✕", na: "•" };

/** The example result for one tool. Decorative copy, so screen readers get a short label instead. */
export function ToolSample({ slug, compact = false }: { slug: ToolSlug; compact?: boolean }) {
  const s = SAMPLES[slug];
  const rows = s.kind === "rows" ? (compact ? s.rows.slice(0, 3) : s.rows) : [];
  return (
    <div className={`tsample tsample-${s.kind}${compact ? " compact" : ""}`} role="img" aria-label="Example result">
      {s.kind === "rows" && (
        <ul>
          {rows.map(([k, v, t], i) => (
            <li key={k} className={`ts-${t}`} style={{ ["--k" as string]: i }}>
              <span className="ts-mark">{MARK[t]}</span>
              <span className="ts-k">{k}</span>
              <span className="ts-v">{v}</span>
            </li>
          ))}
        </ul>
      )}
      {s.kind === "code" && (
        <div className="ts-code">
          <span className="ts-file">{s.file}</span>
          <pre>
            {(compact ? s.lines.slice(0, 4) : s.lines).map((l, i) => (
              <span key={i} style={{ ["--k" as string]: i }}>
                {l || " "}
              </span>
            ))}
          </pre>
        </div>
      )}
      {s.kind === "serp" && (
        <div className="ts-serp">
          <span className="ts-url">{s.url}</span>
          <b>{s.title}</b>
          <span>{s.desc}</span>
        </div>
      )}
    </div>
  );
}
