import type { Metadata } from "next";
import { ReportView, type ReportBrand } from "../report-view";
import type { ScanResult } from "@/lib/scan/types";

export const metadata: Metadata = {
  title: { absolute: "Sample white-label report | Pagelyt" },
  description: "See what a white-label Pagelyt report looks like when it carries your agency's brand. Sample data.",
  robots: { index: true, follow: true },
};

const SAMPLE: ScanResult = {
  url: "https://client-site.com/",
  host: "client-site.com",
  scannedAt: "2026-11-01T09:30:00.000Z",
  overall: 72,
  modules: [
    { key: "health", name: "Website health", score: 94 },
    { key: "performance", name: "Performance", score: 66 },
    { key: "seo", name: "SEO", score: 78 },
    { key: "geo", name: "GEO readiness", score: 58 },
    { key: "security", name: "Security", score: 62 },
    { key: "accessibility", name: "Accessibility", score: 84 },
    { key: "domain", name: "Domain & email", score: 90 },
    { key: "privacy", name: "Privacy & compliance", score: 78 },
  ],
  findings: [
    { id: "hsts", module: "security", severity: "high", title: "Missing HSTS header", why: "Browsers can be tricked into using insecure HTTP.", fix: "Send Strict-Transport-Security: max-age=31536000 from your host or CDN." },
    { id: "ai-blocked", module: "geo", severity: "medium", title: "robots.txt blocks AI crawlers: GPTBot, ClaudeBot", why: "Blocked crawlers cannot read your pages, so AI assistants may not cite you.", fix: "Remove the Disallow rules for the AI crawlers you want to allow." },
    { id: "no-dmarc", module: "domain", severity: "medium", title: "No DMARC policy", why: "Without DMARC, scammers can send mail that appears to come from your domain.", fix: "Publish a _dmarc TXT record, starting with p=none and tightening over time." },
    { id: "no-llms", module: "geo", severity: "low", title: "No llms.txt file", why: "llms.txt gives AI systems a concise guide to your site.", fix: "Publish /llms.txt summarising your business and key pages." },
  ],
};

/* Public sample so agencies can see the white-label look without an account. ?brand= and ?color= try it on. */
export default async function Demo({ searchParams }: { searchParams: Promise<{ brand?: string; color?: string }> }) {
  const q = await searchParams;
  const brand: ReportBrand = {
    name: (q.brand || "Your Agency").slice(0, 60),
    logo_url: null,
    color: q.color && /^#[0-9a-fA-F]{6}$/.test(q.color) ? q.color : "#6a30bd",
    website: "https://youragency.com",
    contact_email: "hello@youragency.com",
    footer: "Prepared for our clients. Questions? Reply to this email and we’ll walk you through it.",
    show_powered_by: false,
  };
  return <ReportView brand={brand} res={SAMPLE} ai={{ score: 60, byProvider: [{ label: "ChatGPT", score: 60 }], prompts: 5 }} showDetails />;
}
