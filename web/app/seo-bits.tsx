import Link from "next/link";
import { Arrow } from "./arrow";
import { postBySlug } from "./blog-data";
import { FEATURE_ICON } from "./feature-icons";
import { featureBySlug } from "./features-data";
import { GUIDES } from "@/lib/scan/guides";
import { TOOLS_BY_SLUG, type ToolSlug } from "./tools/catalog";

/* Shared SEO pieces for feature, tool and blog pages: the ~100-word answer right under the title, and the
   "On this topic" links between posts, tools and feature pages (from topics.ts). Server components. */

/** The short answer under a page title: what it is and how it helps. Sits inside PageHero. */
export function QuickAnswer({ text, label = "In short" }: { text?: string; label?: string }) {
  if (!text) return null;
  return (
    <div className="qa-box">
      <span className="qa-label">{label}</span>
      <p>{text}</p>
    </div>
  );
}

type Item = { href: string; kind: string; title: string; text: string; color?: string };

/** "On this topic": guides, free tools and feature pages that share the page's topic. Hidden when empty. */
export function TopicLinks({
  posts = [],
  tools = [],
  features = [],
  fixes = [],
  title = "On this topic",
  lead,
}: {
  posts?: string[];
  tools?: string[];
  features?: string[];
  /** Fix guide ids (lib/scan/guides.ts). */
  fixes?: string[];
  title?: string;
  lead?: string;
}) {
  const items: Item[] = [
    ...features.flatMap((s) => {
      const f = featureBySlug(s);
      return f ? [{ href: `/features/${f.slug}`, kind: "Feature", title: f.name, text: f.short, color: FEATURE_ICON[f.slug]?.c1 }] : [];
    }),
    ...tools.flatMap((s) => {
      const t = TOOLS_BY_SLUG.get(s as ToolSlug);
      return t ? [{ href: `/tools/${t.slug}`, kind: "Free tool", title: t.name, text: t.blurb }] : [];
    }),
    ...fixes.flatMap((id) => {
      const g = GUIDES[id];
      return g ? [{ href: `/fix/${id}`, kind: "Fix guide", title: g.title, text: g.summary }] : [];
    }),
    ...posts.flatMap((s) => {
      const p = postBySlug(s);
      return p ? [{ href: `/blog/${p.slug}`, kind: "Guide", title: p.title, text: p.description }] : [];
    }),
  ];
  if (!items.length) return null;
  return (
    <section className="sec tl-sec" aria-labelledby="tl-h">
      <div className="container">
        <h2 className="title" id="tl-h">{title}</h2>
        {lead && <p className="lead">{lead}</p>}
        <ul className="tl-list">
          {items.map((it) => (
            <li key={it.href}>
              <Link className="tl-card" href={it.href} style={it.color ? { ["--tl" as string]: it.color } : undefined}>
                <span className={`tl-kind k-${it.kind === "Guide" || it.kind === "Fix guide" ? "guide" : it.kind === "Feature" ? "feat" : "tool"}`}>{it.kind}</span>
                <b>{it.title}</b>
                <small>{it.text}</small>
                <span className="tl-go">{it.kind === "Guide" ? "Read the guide" : it.kind === "Fix guide" ? "See the steps" : it.kind === "Feature" ? "See the feature" : "Try it free"} <Arrow /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
