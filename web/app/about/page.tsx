import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";

export const metadata: Metadata = {
  title: "About Pagelyt: Website Intelligence in Plain English",
  description:
    "Pagelyt turns a single URL into a scored website report with clear, prioritised fixes. Learn what we build, what we believe and how we work.",
  alternates: { canonical: "/about" },
};

const BELIEFS: [string, string][] = [
  ["Answers, not just numbers", "A score only helps if it tells you what to do next. Every finding comes with a plain-English fix, ranked by impact."],
  ["Clear for everyone", "You should not need a technical background to understand your website. We explain issues the way a good colleague would."],
  ["Honest about limits", "We show what we measured and how. Where a check needs your access or a third-party tool, we say so."],
];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["About", "/about"],
        ])}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="We help every website tell its story."
          lead="Pagelyt is a website analysis and monitoring platform. One URL becomes a clear, scored report on health, speed, SEO, AI search readiness, security and accessibility."
        />

        <section className="sec" aria-labelledby="what-h">
          <div className="container">
            <div className="prose" style={{ maxWidth: 760 }}>
              <h2 id="what-h">What we build.</h2>
              <p>
                Most website tools hand you dozens of charts and leave the interpretation to you. Pagelyt does the
                reading. It checks your site across six areas, gives you one clear score, and lists the fixes in the
                order that will help most.
              </p>
              <p>
                After the first report, Pagelyt keeps watching. Rescans show whether changes worked, monitoring warns
                you when something breaks, and competitor analysis shows where you stand in your market.
              </p>
              <p>
                When a report is not enough, you can book a one-to-one consultation and walk through the findings with
                a person.
              </p>
            </div>
            <div className="info-grid">
              {BELIEFS.map(([t, d]) => (
                <div className="info-card" key={t}>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec ice" aria-labelledby="who-h">
          <div className="container">
            <div className="prose" style={{ maxWidth: 760 }}>
              <h2 id="who-h">Who it is for.</h2>
              <p>
                Business owners who want to know if their website is healthy. Freelancers and agencies who audit client
                sites. Developers who want a fast second opinion. Read the{" "}
                <Link href="/use-cases">use cases</Link>, explore the <Link href="/features">features</Link>, or see{" "}
                <Link href="/pricing">pricing</Link>.
              </p>
              <p>
                Questions or feedback? <Link href="/contact">Get in touch</Link>. We read every message.
              </p>
            </div>
          </div>
        </section>

        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
