import { OG_SIZE, ogCard } from "../../og-card";
import { TOOL_LIST, TOOLS_BY_SLUG, type ToolSlug } from "../catalog";

export const alt = "Free Pagelyt tool";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return TOOL_LIST.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const t = TOOLS_BY_SLUG.get((await params).slug as ToolSlug);
  return ogCard({ kind: `Free tool · ${t?.category ?? "SEO"}`, title: t?.name ?? "Pagelyt", sub: t?.blurb ?? "", color: "#0f8a62" });
}
