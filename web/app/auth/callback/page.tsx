import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { OAuthCallback } from "./callback";

export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

export default function CallbackPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec auth-sec" aria-label="Signing you in">
          <div className="container">
            <OAuthCallback />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
