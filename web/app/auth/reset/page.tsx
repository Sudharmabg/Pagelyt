import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { Reset } from "./reset";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec auth-sec" aria-label="Choose a new password">
          <div className="container">
            <Reset />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
