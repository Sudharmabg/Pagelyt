import type { Metadata } from "next";
import { JsonLd, crumbLd } from "../json-ld";
import { PageHero } from "../page-shell";
import { CONTACT_EMAIL } from "../site-config";
import { SiteFooter, SiteNav } from "../site-chrome";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use Pagelyt for website analysis, monitoring and consultations.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["Terms of Service", "/terms"],
        ])}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="Terms of Service."
          lead="Last updated 5 November 2026. By using Pagelyt you agree to these terms."
        />
        <section className="sec">
          <div className="container legal">
            <h2>Using Pagelyt</h2>
            <p>
              Pagelyt provides website analysis, monitoring, recommendations and consultations. Use it only for
              websites you own or have permission to analyse, and do not misuse or disrupt the service.
            </p>
            <h2>Reports and recommendations</h2>
            <p>
              Scores and recommendations are guidance based on automated checks and publicly available information.
              They are not a guarantee of search rankings, security or legal compliance.
            </p>
            <h2>Plans and billing</h2>
            <p>
              Paid plans are billed annually per website, in Indian rupees. Prices and features are shown on the
              pricing page and may change for future billing periods.
            </p>
            <h2>Consultations</h2>
            <p>
              Consultations are advisory sessions of the length you book. Advice is given in good faith and you remain
              responsible for decisions about your website.
            </p>
            <h2>Liability</h2>
            <p>
              Pagelyt is provided as is. To the extent the law allows, we are not liable for indirect or consequential
              loss arising from use of the service.
            </p>
            <h2>Changes and contact</h2>
            <p>
              We may update these terms and will change the date above when we do. Questions? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
