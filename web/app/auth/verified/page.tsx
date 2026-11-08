import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { Verified } from "./verified";

export const metadata: Metadata = {
  title: "Confirming your email",
  robots: { index: false, follow: false },
};

export default function VerifiedPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec auth-sec" aria-label="Confirming your email">
          <div className="container">
            <Verified />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
