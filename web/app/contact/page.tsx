import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, crumbLd } from "../json-ld";
import { PageHero } from "../page-shell";
import { RequestForm } from "../request-form";
import { CONTACT_EMAIL } from "../site-config";
import { SiteFooter, SiteNav } from "../site-chrome";

export const metadata: Metadata = {
  title: "Contact Pagelyt",
  description: "Questions about website analysis, plans or consultations? Send Pagelyt a message and we will reply within one business day.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["Contact", "/contact"],
        ])}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="Talk to the Pagelyt team."
          lead="Questions about a report, a plan or a consultation? Send a message and we will reply within one business day."
        />
        <section className="sec" aria-label="Contact details and form">
          <div className="container split-form">
            <div className="prose">
              <h2>Ways to reach us.</h2>
              <p>
                Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use the form. Tell us your website
                address and we can look at it before we reply.
              </p>
              <h3>Need guidance on your audit?</h3>
              <p>
                <Link href="/consultation">Book a consultation</Link> for a one-to-one session from ₹499.
              </p>
              <h3>Looking for quick answers?</h3>
              <p>
                The <Link href="/faq">FAQ</Link> covers scans, plans, billing and integrations.
              </p>
              <h3>Ready to try it?</h3>
              <p>
                <Link href="/">Analyse a website</Link> for free. No setup needed.
              </p>
            </div>
            <RequestForm kind="contact" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
