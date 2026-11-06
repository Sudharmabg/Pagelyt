import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../site-chrome";
import { Account } from "./account";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec acct" aria-label="Your account">
          <div className="container">
            <Account />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
