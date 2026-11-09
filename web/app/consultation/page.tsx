import { Arrow } from "../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, crumbLd } from "../json-ld";
import { PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { RequestForm } from "../request-form";
import { SessionCards } from "./sessions";

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
              <SessionCards />
              <div className="btn-row">
                <a className="btn" href="#book">
                  Book your consultation <Arrow />
                </a>
                <Link className="btn ghost" href="/pricing">
                  Explore subscription benefits
                </Link>
              </div>
            </div>
            <div className="cons-vis" id="book">
              <div className="founder">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="founder-ph" src="/assets/sudharma.webp" alt="Sudharma, founder of Pagelyt" width={112} height={112} />
                <div>
                  <div className="mock-title">Sudharma</div>
                  <span className="founder-role">Founder, Pagelyt</span>
                  <p>Practical, jargon-free advice on your website, from the person who built Pagelyt.</p>
                </div>
              </div>
              <h3 className="cons-sub" id="how-h">How it works</h3>
              <ol className="cons-steps" aria-labelledby="how-h">
                <li><b>Send a request.</b> Pick a session and tell us what you need help with.</li>
                <li><b>Confirm a time.</b> We email you within one business day to schedule the call.</li>
                <li><b>Talk it through.</b> A one-on-one video call about your website, with clear next steps.</li>
              </ol>
              <RequestForm kind="consultation" />
              <div className="benefit">
                <b>Subscription benefit:</b> Professional subscribers receive one 30-minute consultation annually.
                Business subscribers receive one 60-minute consultation annually.
              </div>
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
