import { Arrow } from "../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { CONSULTS } from "../content";
import { JsonLd, crumbLd } from "../json-ld";
import { PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { RequestForm } from "../request-form";

export const metadata: Metadata = {
  title: "Book a Website Consultation with the Pagelyt Founder",
  description:
    "Book a one-on-one website consultation: 30, 60 or 90 minutes of practical guidance on performance, technical SEO, security and your website's growth plan.",
  alternates: { canonical: "/consultation" },
};

export default async function ConsultationPage({ searchParams }: { searchParams: Promise<{ topic?: string | string[] }> }) {
  const agency = (await searchParams).topic === "agency";
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["Consultation", "/consultation"],
        ])}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="Sometimes, you need more than a report."
          lead="Book a one-on-one website consultation and talk through your audit findings directly with our founder."
        >
          {agency && (
            <p className="agency-note" role="status">
              <b>Managing sites for clients?</b> The agency dashboard (every client site, score trends, bulk rescans, competitor
              comparisons and branded PDF reports) comes with any paid plan. Book a call or <Link href="/contact">contact us</Link>{" "}
              and we&rsquo;ll set your account up.
            </p>
          )}
        </PageHero>

        <section className="sec" aria-labelledby="options-h">
          <div className="container cons-grid">
            <div className="copy">
              <h2 className="sr-only" id="options-h">
                Consultation options
              </h2>
              <p>
                Whether you need help understanding audit findings, improving website performance, addressing SEO
                issues or planning your website&rsquo;s next steps, get practical guidance based on your requirements.
              </p>
              <div className="opts">
                {CONSULTS.map((c) => (
                  <div className="opt" key={c.t}>
                    <h3>{c.t}</h3>
                    <span className="mins">{c.m}</span>
                    <p>{c.d}</p>
                    <div className="pr">
                      <small>Starting at</small>
                      {c.p}
                    </div>
                  </div>
                ))}
              </div>
              <div className="benefit">
                <b>Subscription benefit:</b> Professional subscribers receive one 30-minute consultation annually.
                Business subscribers receive one 60-minute consultation annually.
              </div>
              <div className="btn-row">
                <Link className="btn" href="/consultation">
                  Book Your Consultation <Arrow />
                </Link>
                <Link className="btn ghost" href="/pricing">
                  Explore Subscription Benefits
                </Link>
              </div>
            </div>
            <div className="cons-vis" id="book">
              <div className="founder">
                <div className="ph" aria-hidden="true">
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c1-5 15-5 16 0" />
                  </svg>
                </div>
                <div>
                  <div className="mock-title">Talk to our founder</div>
                  <p>Practical, jargon-free advice on your website, from the person who built Pagelyt.</p>
                </div>
              </div>
              <RequestForm kind="consultation" />
            </div>
          </div>
        </section>

        <section className="sec ice" aria-labelledby="more-h">
          <div className="container head-center">
            <h2 className="title" id="more-h">
              Have a quick question first?
            </h2>
            <p className="lead">Many answers are in the FAQ, including how scans, plans and consultations work.</p>
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <Link className="btn" href="/faq">
                Read the FAQ <Arrow />
              </Link>
              <Link className="btn ghost" href="/">
                Analyse a website
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
