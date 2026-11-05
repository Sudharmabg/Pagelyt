import { Arrow } from "../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { FEATURES } from "../features-data";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import {
  AiMock,
  AnalyticsMock,
  CompareMock,
  HealthMock,
  PerfMock,
  SecA11yMock,
  SeoGeoMock,
  TimelineMock,
} from "../ui";

const MOCKS: Record<string, () => React.ReactElement> = {
  "website-health": HealthMock,
  performance: PerfMock,
  "seo-geo": SeoGeoMock,
  "security-accessibility": SecA11yMock,
  "competitor-intelligence": CompareMock,
  "ai-recommendations": AiMock,
  "monitoring-reports": TimelineMock,
  "analytics-integrations": AnalyticsMock,
};

const REPLACES: [string, string][] = [
  ["Speed tester", "Performance and Core Web Vitals scores"],
  ["SEO crawler", "Technical SEO and GEO readiness"],
  ["Security scanner", "Security headers and TLS review"],
  ["Accessibility checker", "WCAG-oriented accessibility findings"],
  ["Uptime monitor", "Scheduled scans and monitoring"],
  ["Spreadsheet of fixes", "AI recommendations ranked by impact"],
];

export const metadata: Metadata = {
  title: "Website Analysis Features: Speed, SEO, Security and AI Readiness",
  description:
    "Explore Pagelyt's website analysis features: health checks, Core Web Vitals, technical SEO, GEO, security headers, accessibility, competitor analysis, AI recommendations and monitoring.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["Features", "/features"],
        ])}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="Everything you need to understand your website."
          lead="One URL, one report: website health, speed, SEO, AI search readiness, security and accessibility, with fixes ranked by impact."
        />

        <section className="sec" aria-labelledby="all-h">
          <div className="container">
            <div className="head-center">
              <h2 className="title" id="all-h">
                Eight ways Pagelyt looks at your website.
              </h2>
              <p className="lead">
                Each area has its own score, its own checks and its own fixes. Together they give you one clear
                picture.
              </p>
            </div>
            <div className="frows">
              {FEATURES.map((f, i) => {
                const Mock = MOCKS[f.slug];
                return (
                  <article className={`frow${i % 2 ? " flip" : ""}`} key={f.slug} data-tone={i % 4}>
                    <div className="fr-text">
                      <span className="fr-num">{String(i + 1).padStart(2, "0")}</span>
                      <h3>{f.name}</h3>
                      <p>{f.short}</p>
                      <ul>
                        {f.checks.slice(0, 4).map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                      <Link className="btn ghost" href={`/features/${f.slug}`}>
                        Explore {f.name} <Arrow />
                      </Link>
                    </div>
                    <div className="fr-vis">
                      <Mock />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sec ice" aria-labelledby="one-h">
          <div className="container">
            <div className="head-center">
              <h2 className="title" id="one-h">
                One platform instead of five tools.
              </h2>
              <p className="lead">
                Most website owners juggle several tools that each report in their own format. Pagelyt combines them
                and tells you what to do first.
              </p>
            </div>
            <div className="replace">
              {REPLACES.map(([tool, what]) => (
                <div className="rp" key={tool}>
                  <span className="rp-old">{tool}</span>
                  <span className="rp-arrow" aria-hidden="true">
                    <Arrow />
                  </span>
                  <span className="rp-new">{what}</span>
                </div>
              ))}
            </div>
            <div className="cta-line" style={{ justifyContent: "center" }}>
              <Link className="btn" href="/">
                Analyse My Website <Arrow />
              </Link>
              <Link className="btn ghost" href="/how-it-works">
                See how it works
              </Link>
            </div>
          </div>
        </section>

        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
