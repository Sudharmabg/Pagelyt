import { Arrow } from "../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { USE_CASES } from "../features-data";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";

export const metadata: Metadata = {
  title: "Website Audit Tool for Businesses, Freelancers and Agencies",
  description:
    "See how small businesses, website owners, freelancers, agencies and developers use Pagelyt for website audits, SEO and speed checks, security reviews and monitoring.",
  alternates: { canonical: "/use-cases" },
};

export default function UseCasesPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["Use cases", "/use-cases"],
        ])}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="Whether you manage one website or fifty."
          lead="Pagelyt gives business owners, freelancers, agencies and developers the same clear picture of a website."
        />

        <section className="sec" aria-label="Use cases">
          <div className="container">
            {USE_CASES.map((u) => (
              <div className="uc" key={u.slug} id={u.slug}>
                <div>
                  <h2>{u.h}</h2>
                  <p>{u.p}</p>
                  <div className="cta-line">
                    <Link className="btn ghost" href={u.link[0]}>
                      {u.link[1]} <Arrow />
                    </Link>
                  </div>
                </div>
                <ul>
                  {u.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <CtaBand title="Audit your first website in minutes." />
      </main>
      <SiteFooter />
    </>
  );
}
