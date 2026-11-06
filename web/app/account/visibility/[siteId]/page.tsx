import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../../../site-chrome";
import { Visibility } from "./visibility";

export const metadata: Metadata = {
  title: "AI visibility",
  robots: { index: false, follow: false },
};

export default async function VisibilityPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec acct" aria-label="AI visibility">
          <div className="container">
            <Visibility siteId={siteId} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
