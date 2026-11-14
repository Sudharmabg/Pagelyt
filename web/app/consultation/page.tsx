import { Arrow } from "../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, crumbLd, faqLd } from "../json-ld";
import { PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { Booker } from "./booker";
import { SessionCards } from "./sessions";
import { MainCta } from "../main-cta";

export const metadata: Metadata = {
  title: "Book a Website Consultation: Pick a Time Online",
  description:
    "Book a one-on-one website consultation with the Pagelyt founder. Pick a free 30, 60 or 90 minute slot in your timezone, get instant confirmation and pay later by invoice.",
  alternates: { canonical: "/consultation" },
};

const HOW: [string, string][] = [
  ["Pick a time.", "Choose a session and a free slot. Times show in your own timezone."],
  ["Get it confirmed.", "Your booking is confirmed straight away, with a calendar file by email."],
  ["Get the call link.", "Sudharma emails you the video call link before the session."],
  ["Talk, then pay.", "A one-on-one call with clear next steps. The invoice follows by email."],
];

const WHO: [string, string][] = [
  ["Business owners", "who ran an audit and want to know which fixes matter and what to ask their developer."],
  ["Developers and freelancers", "fixing Core Web Vitals, crawl issues or security headers on a client site."],
  ["Marketers", "planning SEO and AI search (GEO) work, or reading Search Console, Analytics and Ads data next to the audit."],
  ["Agencies", "setting up the client dashboard, branded reports and a workflow for many sites."],
];

const FAQ: [string, string][] = [
  ["Do I pay when I book?", "No. Booking is free and confirmed straight away. We email an invoice after you book, and you pay before or after the call."],
  ["What timezone are the times in?", "Your own. The picker reads your device's timezone and shows every free slot in it. Your confirmation email and calendar file use it too."],
  ["How do I join the call?", "It's a video call. Sudharma emails the link before the session, and it is added to your calendar event."],
  ["Can I cancel or change the time?", "Yes. Cancel any time with the link in your confirmation email. To move it, reply to that email and we'll find a new slot."],
  ["Do I need an account?", "No. Anyone can book. If you're signed in, your details are filled in for you."],
  ["I'm a subscriber. How do I use my free session?", "Book as usual while signed in. Professional plans include one 30-minute session a year and Business plans one 60-minute session, applied on the invoice."],
];

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
      <JsonLd data={faqLd(FAQ)} />
      <SiteNav />
      <main>
        <PageHero
          h1="Sometimes, you need more than a report."
          lead="Book a one-on-one call with our founder. Pick a free time below, get instant confirmation, and pay later by invoice."
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
              <h2 className="title" id="options-h">
                Choose a session.
              </h2>
              <p>
                Whether you need help understanding audit findings, improving website performance, fixing SEO issues or
                planning your website&rsquo;s next steps, you get practical guidance for your site, not a sales pitch.
              </p>
              <SessionCards />
              <div className="benefit">
                <b>Subscription benefit:</b> Professional subscribers get one 30-minute consultation a year and Business
                subscribers one 60-minute consultation a year. Book as usual and it comes off the invoice.{" "}
                <Link href="/pricing">See plans</Link>
              </div>
            </div>
            <div className="cons-vis" id="book">
              <Booker />
            </div>
          </div>
        </section>

        <section className="sec ice" aria-labelledby="how-h">
          <div className="container">
            <h2 className="title" id="how-h">
              How booking works.
            </h2>
            <ol className="cons-how">
              {HOW.map(([t, d], i) => (
                <li key={t}>
                  <span className="cons-n" aria-hidden="true">{i + 1}</span>
                  <b>{t}</b>
                  <p>{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="sec" aria-labelledby="who-h">
          <div className="container cons-who">
            <div>
              <h2 className="title" id="who-h">
                Who it&rsquo;s for.
              </h2>
              <ul className="cons-list">
                {WHO.map(([t, d]) => (
                  <li key={t}>
                    <b>{t}</b> {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className="founder">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="founder-ph" src="/assets/sudharma.webp" alt="Sudharma, founder of Pagelyt" width={112} height={112} />
              <div>
                <div className="mock-title">Sudharma</div>
                <span className="founder-role">Founder, Pagelyt</span>
                <p>
                  Built Pagelyt&rsquo;s audit engine and reviews sites every day. Practical, jargon-free advice: what to
                  fix, in what order, and how, for WordPress, Shopify or custom code.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" aria-labelledby="cons-faq-h">
          <div className="container">
            <h2 className="title" id="cons-faq-h">
              Booking questions.
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
              <MainCta className="btn ghost" label="Analyse a website" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
