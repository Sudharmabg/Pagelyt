import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { BrandEditor } from "./brand-editor";

export const metadata: Metadata = {
  title: "Brand settings",
  robots: { index: false, follow: false },
};

export default function BrandPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec acct" aria-label="Brand settings">
          <div className="container">
            <BrandEditor />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
