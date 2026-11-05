import { Arrow } from "../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { FAQS } from "../content";
import { JsonLd, crumbLd, faqLd } from "../json-ld";
import { PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { FaqList } from "./faq-list";

export const metadata: Metadata = {
  title: "Pagelyt FAQ: Website Analysis, GEO, Plans and Consultations",
  description:
    "Answers about how Pagelyt analyses websites, what GEO means, how scans and reports work, what the plans include and how consultations work.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["FAQ", "/faq"],
        ])}
      />
      <JsonLd data={faqLd(FAQS)} />
      <SiteNav />
      <main>
        <PageHero
          h1="Everything you need to know about Pagelyt."
        />

        <section className="sec" aria-label="Questions and answers">
          <div className="container">
            <FaqList />
          </div>
        </section>

        <section className="sec ice" aria-labelledby="still-h">
          <div className="container head-center">
            <h2 className="title" id="still-h">
              Still have a question?
            </h2>
            <p className="lead">Talk it through with our founder, or run a free analysis and see for yourself.</p>
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <Link className="btn" href="/consultation">
                Book a Consultation <Arrow />
              </Link>
              <Link className="btn ghost" href="/">
                Analyse My Website
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
