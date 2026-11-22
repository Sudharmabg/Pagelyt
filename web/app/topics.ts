/* Topic map: which blog posts, tools and feature pages belong together, so every page links to the others on its
   topic. Each post owns one focus keyword (see POST_FOCUS) and no two posts, tools or feature pages target the same
   one, to avoid keyword cannibalisation. Plain data, keyed by slug. */
import { FEATURES } from "./features-data";
import { TOOL_LIST } from "./tools/catalog";

/** The one search phrase each post is written for. Feature and tool pages own the "checker" / "generator" phrases. */
export const POST_FOCUS: Record<string, string> = {
  "what-is-geo-generative-engine-optimisation": "what is GEO",
  "core-web-vitals-explained": "core web vitals",
  "why-is-my-website-slow": "why is my website slow",
  "technical-seo-checklist": "technical SEO checklist",
  "website-security-checklist": "website security checklist",
  "website-accessibility-checklist": "how to check website accessibility",
  "free-website-audit-what-to-check": "free website audit",
  "google-search-console-setup-guide": "Google Search Console setup",
  "google-analytics-4-setup-guide": "Google Analytics 4 setup",
  "google-ads-setup-guide": "Google Ads setup",
  "why-is-my-website-not-showing-on-google": "website not showing on Google",
  "how-to-get-cited-in-google-ai-overviews": "how to appear in Google AI Overviews",
  "robots-txt-for-ai-crawlers": "robots.txt AI crawlers",
  "what-is-llms-txt": "what is llms.txt",
  "schema-markup-guide": "what is schema markup",
  "pagespeed-insights-score-explained": "PageSpeed Insights score",
  "spf-dkim-dmarc-explained": "SPF DKIM DMARC explained",
  "image-optimisation-for-website-speed": "image optimisation for web",
  "meta-title-and-description-guide": "how to write a meta description",
};

/** Post → the feature pages it supports (first one is the main topic). */
const POST_FEATURES: Record<string, string[]> = {
  "what-is-geo-generative-engine-optimisation": ["geo"],
  "core-web-vitals-explained": ["performance"],
  "why-is-my-website-slow": ["performance"],
  "technical-seo-checklist": ["seo"],
  "website-security-checklist": ["security"],
  "website-accessibility-checklist": ["accessibility", "wcag-checklist"],
  "free-website-audit-what-to-check": ["website-health", "ai-recommendations"],
  "google-search-console-setup-guide": ["google-integrations", "seo"],
  "google-analytics-4-setup-guide": ["google-integrations"],
  "google-ads-setup-guide": ["google-integrations"],
  "why-is-my-website-not-showing-on-google": ["seo", "website-health"],
  "how-to-get-cited-in-google-ai-overviews": ["geo"],
  "robots-txt-for-ai-crawlers": ["geo"],
  "what-is-llms-txt": ["geo"],
  "schema-markup-guide": ["seo", "geo"],
  "pagespeed-insights-score-explained": ["performance"],
  "spf-dkim-dmarc-explained": ["domain-email"],
  "image-optimisation-for-website-speed": ["performance"],
  "meta-title-and-description-guide": ["seo"],
};

/** Tool → the feature pages (areas) it belongs to, and the posts that explain its topic. */
const TOOL_TOPICS: Record<string, { features: string[]; posts: string[] }> = {
  "ai-bot-checker": { features: ["geo"], posts: ["robots-txt-for-ai-crawlers", "what-is-geo-generative-engine-optimisation"] },
  "llms-txt-generator": { features: ["geo"], posts: ["what-is-llms-txt"] },
  "robots-txt-tester": { features: ["seo", "geo"], posts: ["robots-txt-for-ai-crawlers", "why-is-my-website-not-showing-on-google"] },
  "raw-vs-rendered-html": { features: ["seo", "geo"], posts: ["how-to-get-cited-in-google-ai-overviews", "technical-seo-checklist"] },
  "robots-txt-generator": { features: ["seo"], posts: ["robots-txt-for-ai-crawlers"] },
  "hreflang-checker": { features: ["seo"], posts: ["technical-seo-checklist"] },
  "sitemap-generator": { features: ["seo"], posts: ["technical-seo-checklist", "why-is-my-website-not-showing-on-google"] },
  "serp-preview": { features: ["seo"], posts: ["meta-title-and-description-guide"] },
  "schema-markup-generator": { features: ["seo", "geo"], posts: ["schema-markup-guide"] },
  "bulk-schema-checker": { features: ["seo", "geo"], posts: ["schema-markup-guide"] },
  "security-headers-generator": { features: ["security"], posts: ["website-security-checklist"] },
  "domain-age-checker": { features: ["domain-email", "website-health"], posts: ["free-website-audit-what-to-check"] },
  "google-review-link-generator": { features: [], posts: [] },
};

const uniq = (a: string[]) => [...new Set(a)];
const ALL_POSTS = Object.keys(POST_FEATURES);
const FEATURE_SLUGS = new Set(FEATURES.map((f) => f.slug));
const TOOL_SLUGS = new Set(TOOL_LIST.map((t) => t.slug as string));

/** Every post on a feature's topic, main-topic posts first. */
export function postsForFeature(slug: string): string[] {
  const main = ALL_POSTS.filter((p) => POST_FEATURES[p][0] === slug);
  const also = ALL_POSTS.filter((p) => POST_FEATURES[p].includes(slug) && !main.includes(p));
  return [...main, ...also];
}
export const toolsForFeature = (slug: string) => Object.keys(TOOL_TOPICS).filter((t) => TOOL_TOPICS[t].features.includes(slug) && TOOL_SLUGS.has(t));

export const featuresForTool = (slug: string) => (TOOL_TOPICS[slug]?.features ?? []).filter((f) => FEATURE_SLUGS.has(f));
export const postsForTool = (slug: string) => TOOL_TOPICS[slug]?.posts ?? [];

export const featuresForPost = (slug: string) => (POST_FEATURES[slug] ?? []).filter((f) => FEATURE_SLUGS.has(f));
/** Tools named for this post, then tools on the same main topic. */
export function toolsForPost(slug: string): string[] {
  const named = Object.keys(TOOL_TOPICS).filter((t) => TOOL_TOPICS[t].posts.includes(slug));
  const main = POST_FEATURES[slug]?.[0];
  return uniq([...named, ...(main ? toolsForFeature(main) : [])]).slice(0, 4);
}
