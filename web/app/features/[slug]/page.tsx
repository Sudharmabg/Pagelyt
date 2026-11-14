import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURES, featureBySlug } from "../../features-data";
import { JsonLd, crumbLd, faqLd } from "../../json-ld";
import { CtaBand, PageHero } from "../../page-shell";
import { MainCta } from "../../main-cta";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { AllFeaturesBanner, FeatureCard, FeatureGains, MOCKS } from "../feature-card";

const WORDS: Record<number, string> = { 2: "Two", 3: "Three", 4: "Four", 5: "Five" };

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

        {f.products && (
          <section className="sec gp-sec" aria-labelledby="gp-h">
            <div className="container">
              <h2 className="title" id="gp-h">
                Three integrations. Connect any of them.
              </h2>
              <p className="lead">Each one adds its own numbers to your report. All three are read-only and come with the Professional and Business plans.</p>
              <ul className="gp-cards">
                {f.products.map((p, i) => (
                  <li key={p.key} className={`gp-card gp-${p.key}`} style={{ ["--i" as string]: i }}>
                    <span className="gp-ico" aria-hidden="true"><ProductIcon k={p.key} /></span>
                    <p className="gp-tag">{p.tag}</p>
                    <h3>{p.name}</h3>
                    <p className="gp-text">{p.text}</p>
                    <ul className="gp-points">
                      {p.points.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                    <div className="gp-act">
                      <Link className="btn" href={p.open}>Connect in your dashboard</Link>
                      <Link className="gp-guide" href={p.guide}>Read the setup guide <span aria-hidden="true">→</span></Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

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

        <section className="sec ice fgain-sec" aria-labelledby="gain-h">
          <div className="container fgain">
            <div className="fgain-intro">
              <h2 className="title" id="gain-h">
                What you get
              </h2>
              <p className="lead">
                {WORDS[f.gains.length] ?? f.gains.length} ways {f.name} helps you run a better website, from your first scan.
              </p>
              <MainCta arrow />
            </div>
            <FeatureGains f={f} />
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
            <h2 className="frel-h">Related features</h2>
            <ul className="frel">
              {related.map((r, i) => (
                <li key={r.slug} style={{ ["--i" as string]: i }}>
                  <FeatureCard f={r} />
                </li>
              ))}
            </ul>
            <AllFeaturesBanner current={f.slug} />
          </div>
        </section>

        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}

/* Plain line icons for the Google hub cards (no Google logos on marketing pages). */
function ProductIcon({ k }: { k: "gsc" | "ga4" | "ads" }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (k === "gsc") return <svg {...common}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5M8 11.5l2 2 3.5-4" /></svg>;
  if (k === "ga4") return <svg {...common}><path d="M5 20V12M12 20V7M19 20V4" /><path d="M3 20h18" /></svg>;
  return <svg {...common}><path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>;
}
