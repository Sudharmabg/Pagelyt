import Home from "./home";
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
      <Home />
    </>
  );
}
