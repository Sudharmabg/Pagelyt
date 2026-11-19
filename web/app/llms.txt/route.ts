import { FEATURES } from "../features-data";
import { POSTS } from "../blog-data";
import { GUIDES } from "@/lib/scan/guides";
import { TOOL_LIST } from "../tools/catalog";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../site-config";

// /llms.txt (llmstxt.org): a short Markdown guide to the site for AI assistants. Built from the same data as the sitemap.
export const dynamic = "force-static";

const link = (title: string, path: string, note?: string) => `- [${title}](${SITE_URL}${path})${note ? `: ${note}` : ""}`;

export function GET() {
  const text = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "The audit is free from one URL. Signed-in users get saved reports, monitoring, competitor comparison and an AI assistant that answers questions about their own findings.",
    "",
    "## Main pages",
    link("Home", "/", "run a free audit"),
    link("Features", "/features"),
    link("How it works", "/how-it-works"),
    link("Free tools", "/tools"),
    link("Fix guides", "/fix"),
    link("Blog", "/blog"),
    link("FAQ", "/faq"),
    link("About", "/about"),
    link("Contact", "/contact"),
    link("Pagelyt bot", "/bot", "the crawler that runs audits, and how to allow or block it"),
    "",
    "## Features",
    ...FEATURES.map((f) => link(f.name, `/features/${f.slug}`, f.title)),
    "",
    "## Free tools",
    ...TOOL_LIST.map((t) => link(t.name, `/tools/${t.slug}`, t.blurb)),
    "",
    "## Guides",
    ...POSTS.map((p) => link(p.title, `/blog/${p.slug}`)),
    "",
    "## Optional",
    ...Object.entries(GUIDES).map(([id, g]) => link(g.title, `/fix/${id}`)),
    link("Privacy", "/privacy"),
    link("Terms", "/terms"),
    "",
  ].join("\n");
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
