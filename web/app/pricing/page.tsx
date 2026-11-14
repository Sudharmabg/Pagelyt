import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PLANS } from "../content";
import { JsonLd, crumbLd, faqLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { PRICING_ON, SITE_DESCRIPTION, SITE_URL } from "../site-config";
import { SiteFooter, SiteNav } from "../site-chrome";

export const metadata: Metadata = {
  title: "Pricing: Free Website Analysis and Annual Plans",
  description:
    "Start with a free website analysis, then upgrade for monitoring, competitor analysis and reports. Paid plans start at ₹999 per website per year.",
  alternates: { canonical: "/pricing" },
};

const FAQ: [string, string][] = [
  [
    "What does per website mean?",
    "Every paid subscription covers one website. Need to manage more websites? Purchase additional website subscriptions.",
  ],
  ["Are plans billed monthly or annually?", "All paid plans are billed annually per website."],
  [
    "Do any plans include a consultation?",
    "Professional includes one complimentary 30-minute consultation per subscription year, and Business includes one 60-minute consultation. You can also book a standalone consultation without a subscription.",
  ],
  [
    "Do all features work without integrations?",
    "Yes. The audit, monitoring and reports work on their own. The Google data on Professional and Business needs read-only access to your Search Console, Google Analytics or Google Ads, which you connect from the dashboard.",
  ],
];

const priceOf = (p: string) => p.replace(/[^0-9]/g, "");

export default function PricingPage() {
  if (!PRICING_ON) redirect("/"); // pricing is hidden for now (site-config.ts)
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["Pricing", "/pricing"],
        ])}
      />
      <JsonLd data={faqLd(FAQ)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Pagelyt",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: SITE_DESCRIPTION,
          url: `${SITE_URL}/pricing`,
          offers: PLANS.map((p) => ({
            "@type": "Offer",
            name: p.name[0] + p.name.slice(1).toLowerCase(),
            price: priceOf(p.price),
            priceCurrency: "INR",
            description: p.for,
          })),
        }}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="The right intelligence for every website."
          lead="Start free. Upgrade when you need continuous monitoring, competitor analysis and advanced reports. All paid plans are billed annually per website."
        />

        <section className="sec" aria-labelledby="plans-h">
          <div className="container">
            <h2 className="sr-only" id="plans-h">
              Plans and prices
            </h2>
            <div className="plans" style={{ marginTop: 0 }}>
              {PLANS.map((p) => (
                <div className={`plan${p.badge ? " pop" : ""}`} key={p.name}>
                  {p.badge && <span className="badge">Most popular</span>}
                  <p className="nm">{p.name[0] + p.name.slice(1).toLowerCase()}</p>
                  <p className="pc">
                    {p.price}
                    <small>{p.per}</small>
                  </p>
                  <p className="for">{p.for}</p>
                  <p className="hd">{p.head}</p>
                  <ul>
                    {p.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                  <Link className={`btn${p.badge ? "" : " ghost"}`} href="/">
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>
            <div className="price-notes">
              <p>
                Need expert guidance without a subscription?{" "}
                <Link href="/consultation" style={{ color: "var(--i700)", fontWeight: 700 }}>
                  Book a standalone consultation
                </Link>
                .
              </p>
              <p>
                Professional and Business work with Google Search Console, Google Analytics and Google Ads, read-only.{" "}
                <Link href="/features/google-integrations" style={{ color: "var(--i700)", fontWeight: 700 }}>
                  See what they add
                </Link>
                .
              </p>
              <small>Some advanced features require third-party integrations or customer-authorised access.</small>
            </div>
          </div>
        </section>

        <section className="sec ice" aria-labelledby="pf-h">
          <div className="container">
            <h2 className="title" id="pf-h">
              Pricing questions.
            </h2>
            <div className="faq-inline" style={{ marginLeft: 0 }}>
              {FAQ.map(([q, a], i) => (
                <details className="qd" key={q} open={i === 0}>
                  <summary>
                    {q}
                    <span className="pm" aria-hidden="true" />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <CtaBand title="Start free. Upgrade when you need more." />
      </main>
      <SiteFooter />
    </>
  );
}
