import { FEATURES, featureBySlug } from "../../features-data";
import { FEATURE_ICON } from "../../feature-icons";
import { OG_SIZE, ogCard } from "../../og-card";

export const alt = "Pagelyt feature";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const f = featureBySlug((await params).slug);
  return ogCard({ kind: f?.area ? "Checked in every scan" : "Feature", title: f?.h1 ?? "Pagelyt", sub: f?.short ?? "", color: (f && FEATURE_ICON[f.slug]?.c1) || undefined });
}
