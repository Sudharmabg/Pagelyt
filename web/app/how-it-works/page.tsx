import { Arrow } from "../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { Funnel } from "../art";
import { FAQS } from "../content";
import { HOW_DETAIL } from "../features-data";
import { JsonLd, crumbLd, faqLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SITE_URL } from "../site-config";
import { SiteFooter, SiteNav } from "../site-chrome";
import { AiMock, AnalyseMock, DiscoverMock, HistMock } from "../ui";

export const metadata: Metadata = {
  title: "How Website Analysis Works: From URL to Improvement",
  description:
    "Enter a URL, run six checks at once, get AI-ranked recommendations and track your score over time. See how a Pagelyt website analysis works, step by step.",
  alternates: { canonical: "/how-it-works" },
};

const MOCKS = [DiscoverMock, AnalyseMock, AiMock, HistMock];
const COLOURS = ["#6a30bd", "#1a6b4c", "#a35a0c", "#b8244f"];
const REPORT = [
  {
    name: "Website health",
    slug: "website-health",
    tone: 0,
    score: 92,
    q: "Is your site up, secure and reachable?",
    checks: ["Availability and response time", "SSL certificate and expiry", "DNS and redirects"],
    find: "Your SSL certificate expires in 62 days. Renew it before then.",
  },
  {
    name: "Performance",
    slug: "performance",
    tone: 1,
    score: 74,
    q: "How fast does it feel to visitors?",
    checks: ["Core Web Vitals (LCP, INP, CLS)", "Mobile and desktop speed", "Page weight and images"],
    find: "Three hero images are over 1 MB. Compress them to cut load time.",
  },
  {
    name: "SEO",
    slug: "seo-geo",
    tone: 2,
    score: 82,
    q: "Can search engines find and read you?",
    checks: ["Titles and meta descriptions", "Headings, links and structure", "Sitemap and robots rules"],
    find: "Four pages share the same title. Give each page its own.",
  },
  {
    name: "GEO readiness",
    slug: "seo-geo",
    tone: 3,
    score: 68,
    q: "Are AI search tools able to use your content?",
    checks: ["AI crawler access", "Structured data", "Clear, quotable answers"],
    find: "Your robots file blocks AI crawlers. Allow them if you want to be cited.",
  },
  {
    name: "Security",
    slug: "security-accessibility",
    tone: 0,
    score: 61,
    q: "Are the basic protections in place?",
    checks: ["Security headers", "HTTPS and TLS setup", "Mixed content"],
    find: "Content-Security-Policy and X-Frame-Options headers are missing.",
  },
  {
    name: "Accessibility",
    slug: "security-accessibility",
    tone: 1,
    score: 87,
    q: "Can everyone use your website?",
    checks: ["Colour contrast", "Alt text and labels", "Keyboard and structure basics"],
    find: "Nine images have no alt text. Describe them for screen readers.",
  },
];

const EXTRAS = [
  { slug: "ai-recommendations", name: "AI recommendations", text: "Every finding ranked by impact and effort." },
  { slug: "competitor-intelligence", name: "Competitor analysis", text: "See how you compare in your market." },
  { slug: "monitoring-reports", name: "Monitoring and reports", text: "Rescans and alerts that show progress." },
];

const FAQ = [FAQS[1], FAQS[2], FAQS[3]] as [string, string][];

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["How it works", "/how-it-works"],
        ])}
      />
      <JsonLd data={faqLd(FAQ)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to analyse your website with Pagelyt",
          url: `${SITE_URL}/how-it-works`,
          step: HOW_DETAIL.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.k,
            text: s.p.join(" "),
          })),
        }}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="From URL to improvement in four steps."
          lead="No setup, no code and no technical knowledge. Paste your address and Pagelyt does the rest."
        />

        <section className="sec tight" aria-label="From numbers to answers">
          <div className="container">
            <Funnel />
          </div>
        </section>

        <section className="sec" aria-labelledby="steps-h">
          <div className="container">
            <h2 className="title" id="steps-h">
              The four steps in detail.
            </h2>
            {HOW_DETAIL.map((s, i) => {
              const M = MOCKS[i];
              return (
                <div className="how-row" key={s.k} style={{ ["--c" as string]: COLOURS[i], ["--si" as string]: i }}>
                  <div className="how-copy">
                    <div className="hnum" aria-hidden="true">
                      0{i + 1}
                    </div>
                    <p className="stage-k">{s.k}</p>
                    <h2>{s.h}</h2>
                    {s.p.map((t) => (
                      <p key={t}>{t}</p>
                    ))}
                  </div>
                  <M />
                </div>
              );
            })}
          </div>
        </section>

        <section className="sec ice" aria-labelledby="report-h">
          <div className="container">
            <div className="head-center">
              <h2 className="title" id="report-h">
                What is in your report.
              </h2>
              <p className="lead">
                Six scored areas, each with plain-English findings. Sample scores are shown below; yours come from your
                own website.
              </p>
            </div>
            <div className="rep-grid">
              {REPORT.map((r) => (
                <Link className="rep" href={`/features/${r.slug}`} key={r.name} data-tone={r.tone}>
                  <div className="rep-top">
                    <h3>{r.name}</h3>
                    <span className="rep-score">
                      {r.score}
                      <small>/100</small>
                    </span>
                  </div>
                  <div className="rep-bar" aria-hidden="true">
                    <i style={{ width: `${r.score}%` }} />
                  </div>
                  <p className="rep-q">{r.q}</p>
                  <ul>
                    {r.checks.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="rep-find">
                    <b>Example finding:</b> {r.find}
                  </p>
                  <span className="go">See what we check <Arrow /></span>
                </Link>
              ))}
            </div>
            <h3 className="rep-more-h">And three things that keep it useful.</h3>
            <div className="rep-more">
              {EXTRAS.map((e) => (
                <Link className="rep-x" href={`/features/${e.slug}`} key={e.slug}>
                  <b>{e.name}</b>
                  <span>{e.text}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" aria-labelledby="hiw-faq-h">
          <div className="container">
            <h2 className="title" id="hiw-faq-h">
              Common questions.
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
            <div className="cta-line">
              <Link className="btn ghost" href="/faq">
                Read all FAQs
              </Link>
            </div>
          </div>
        </section>

        <CtaBand title="Ready to try it on your website?" />
      </main>
      <SiteFooter />
    </>
  );
}
