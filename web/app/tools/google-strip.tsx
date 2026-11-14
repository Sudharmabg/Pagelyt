import Link from "next/link";
import { Arrow } from "../arrow";

/* "Go further with your Google data": a strip on /tools and on the tools whose job overlaps Search Console
   (sitemap, search preview, robots.txt). Our own icon and text names only. */

const NOTE: Record<string, string> = {
  "sitemap-generator": "Submitted your sitemap? With Search Console connected, Pagelyt shows which of your key pages Google has actually indexed.",
  "serp-preview": "With Search Console connected, Pagelyt shows the real click rate of each page and flags titles that are seen but not clicked.",
  "robots-txt-tester": "With Search Console connected, Pagelyt checks Google's own indexing answer for your homepage and busiest pages.",
  "robots-txt-generator": "With Search Console connected, Pagelyt checks Google's own indexing answer for your homepage and busiest pages.",
};
export const hasGoogleNote = (slug: string) => slug in NOTE;

export function GoogleStrip({ slug }: { slug?: string }) {
  const text = (slug && NOTE[slug]) || "Connect Search Console, Google Analytics and Google Ads to see the real searches, visitors and ad spend on every issue in your report, with AI insights. Read-only, on Professional and Business.";
  return (
    <section className="sec tight" aria-labelledby="gstrip-h">
      <div className="container">
        <div className="gstrip">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10h3v10H5zm5.5 0V4h3v16h-3zM16 20v-7h3v7h-3z" /></svg>
          <div>
            <h2 id="gstrip-h">Go further with your Google data</h2>
            <p>{text}</p>
          </div>
          <Link href="/features/google-integrations" className="btn ghost">How it works <Arrow /></Link>
        </div>
      </div>
    </section>
  );
}
