import Home from "./home";
import { POSTS } from "./blog-data";
import { PLANS } from "./content";
import { JsonLd } from "./json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "./site-config";

export default function Page() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", name: SITE_NAME, url: SITE_URL, slogan: SITE_TAGLINE },
            { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
            {
              "@type": "SoftwareApplication",
              name: SITE_NAME,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: SITE_DESCRIPTION,
              featureList: [
                "Technical SEO audit",
                "GEO: readiness for AI search and answer engines",
                "Page speed and Core Web Vitals",
                "Accessibility checks (WCAG)",
                "Security headers, SSL and domain checks",
                "Google Search Console clicks and impressions on every issue",
                "Google Analytics 4 visitors and engagement on every issue",
                "Google Ads spend on pages with issues",
                "AI insights and prioritised fixes",
                "Scheduled monitoring and PDF reports",
              ],
              url: SITE_URL,
              offers: PLANS.map((p) => ({
                "@type": "Offer",
                name: p.name[0] + p.name.slice(1).toLowerCase(),
                price: p.price.replace(/[^0-9]/g, ""),
                priceCurrency: "INR",
              })),
            },
          ],
        }}
      />
      <Home guides={POSTS.map(({ slug, tag, h1, lead }) => ({ slug, tag, h1, lead }))} />
    </>
  );
}
