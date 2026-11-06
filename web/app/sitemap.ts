import type { MetadataRoute } from "next";
import { FEATURES } from "./features-data";
import { GUIDES } from "@/lib/scan/guides";
import { SITE_URL } from "./site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/features",
    "/how-it-works",
    "/pricing",
    "/use-cases",
    "/tools",
    "/fix",
    "/consultation",
    "/faq",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    ...Object.keys(GUIDES).map((id) => `/fix/${id}`),
    ...FEATURES.map((f) => `/features/${f.slug}`),
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r}`,
    lastModified: new Date(),
    changeFrequency: r === "" ? "weekly" : "monthly",
    priority: r === "" ? 1 : r.startsWith("/features/") || r.startsWith("/fix/") ? 0.7 : 0.8,
  }));
}
