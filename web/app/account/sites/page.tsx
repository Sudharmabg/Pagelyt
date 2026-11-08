import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { AgencySites } from "./sites";

export const metadata: Metadata = {
  title: "Agency dashboard",
  robots: { index: false, follow: false },
};

export default function AgencyPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec acct" aria-label="Agency dashboard">
          <div className="container">
            <AgencySites />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
