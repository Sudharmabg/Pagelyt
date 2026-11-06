import Link from "next/link";
import { PageHero } from "../../page-shell";
import { SiteFooter, SiteNav } from "../../site-chrome";

export default function ReportNotFound() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero h1="We can’t find that report." lead="The link may be mistyped, or the report is no longer stored. Reports are private to whoever has the link, so we can’t look it up another way." />
        <section className="sec" aria-label="What to do next">
          <div className="container empty-state">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
              <circle cx="60" cy="60" r="46" stroke="#e6dfd4" strokeWidth="10" />
              <path d="M60 14a46 46 0 0 1 40 23" stroke="#7c5cd6" strokeWidth="10" strokeLinecap="round" />
              <path d="M48 48l24 24M72 48 48 72" stroke="#14202b" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <Link className="btn" href="/">Run a new free scan</Link>
              <Link className="btn ghost" href="/contact">Contact us</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
