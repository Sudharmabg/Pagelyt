import type { Metadata } from "next";
import { PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { CheckEmail } from "./check-email";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

export default function CheckEmailPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero h1="Check your email." lead="One quick step to confirm it's you. Your report is ready and waiting." />
        <section className="sec auth-sec" aria-label="Confirm your email">
          <div className="container">
            <CheckEmail />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
