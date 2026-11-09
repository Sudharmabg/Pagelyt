import type { Metadata } from "next";
import { PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { Claim } from "./claim";

export const metadata: Metadata = {
  title: "Prove you own a website",
  robots: { index: false, follow: false },
};

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ domain?: string | string[] }> }) {
  const { domain } = await searchParams;
  const d = typeof domain === "string" ? domain.trim().toLowerCase().slice(0, 253) : "";
  return (
    <>
      <SiteNav />
      <main>
        <PageHero h1="Prove you own this website." lead="Each website belongs to one Pagelyt account. If yours was registered by someone else, add a short code to it and we'll move it to you." />
        <section className="sec auth-sec" aria-label="Prove ownership">
          <div className="container">
            <Claim domain={d} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
