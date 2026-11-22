import { POSTS, postBySlug } from "../../blog-data";
import { OG_SIZE, ogCard } from "../../og-card";

export const alt = "Pagelyt guide";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = postBySlug((await params).slug);
  return ogCard({ kind: `Guide · ${p?.tag ?? "Blog"}`, title: p?.h1 ?? "Pagelyt blog", sub: p?.lead ?? "", color: "#d9622b" });
}
