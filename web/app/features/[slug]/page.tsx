import { Arrow } from "../../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURES, featureBySlug } from "../../features-data";
import { JsonLd, crumbLd, faqLd } from "../../json-ld";
import { CtaBand, PageHero } from "../../page-shell";
import { MainCta } from "../../main-cta";
import { SiteFooter, SiteNav } from "../../site-chrome";
import {
  AiMock,
  AnalyticsMock,
  CompareMock,
  HealthMock,
  PerfMock,
  SecA11yMock,
  SeoGeoMock,
  TimelineMock,
} from "../../ui";

const MOCKS: Record<string, () => React.JSX.Element> = {
  "website-health": HealthMock,
  performance: PerfMock,
  "seo-geo": SeoGeoMock,
  "security-accessibility": SecA11yMock,
  "competitor-intelligence": CompareMock,
  "ai-recommendations": AiMock,
  "monitoring-reports": TimelineMock,
  "analytics-integrations": AnalyticsMock,
};

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = featureBySlug(slug);
  if (!f) return {};
  return {
    title: f.title,
    description: f.description,
    alternates: { canonical: `/features/${f.slug}` },
    openGraph: { title: f.title, description: f.description, url: `/features/${f.slug}` },
  };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = featureBySlug(slug);
  if (!f) notFound();
  const Mock = MOCKS[f.slug];
  const related = f.related.map((s) => featureBySlug(s)).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["Features", "/features"],
          [f.name, `/features/${f.slug}`],
        ])}
      />
      <JsonLd data={faqLd(f.faq)} />
      <SiteNav />
      <main>
        <PageHero
          h1={f.h1}
          lead={f.lead}
        >
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <MainCta arrow />
            <Link className="btn ghost" href="/features">
              All features
            </Link>
          </div>
        </PageHero>

        <section className="sec" aria-labelledby="about-h">
          <div className="container split">
            <div className="prose">
              <h2 id="about-h">What is {f.name}?</h2>
              {f.intro.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <h3>What Pagelyt checks</h3>
              <ul className="checks">
                {f.checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <Mock />
          </div>
        </section>

        <section className="sec ice" aria-labelledby="gain-h">
          <div className="container">
            <h2 className="title" id="gain-h">
              What you get
            </h2>
            <div className="feat-grid">
              {f.gains.map(([t, d]) => (
                <div className="card" key={t}>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" aria-labelledby="q-h">
          <div className="container">
            <h2 className="title" id="q-h">
              Questions about {f.name.toLowerCase()}
            </h2>
            <div className="faq-inline" style={{ marginLeft: 0 }}>
              {f.faq.map(([q, a], i) => (
                <details className="qd" key={q} open={i === 0}>
                  <summary>
                    {q}
                    <span className="pm" aria-hidden="true" />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
            <h3 style={{ marginTop: 56, fontSize: 26 }}>Related features</h3>
            <div className="related">
              {related.map((r) => (
                <Link className="ftile" href={`/features/${r.slug}`} key={r.slug}>
                  <h3>{r.name}</h3>
                  <p>{r.short}</p>
                  <span className="go">Learn more <Arrow /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
