import Link from "next/link";
import { Arrow } from "./arrow";

/* Home page: "Your Google numbers, next to every fix." Three product cards, a sample finding with its Google badges,
   and the plan line. Text names and our own icons only: no Google product logos on marketing pages. */

const PRODUCTS = [
  {
    name: "Search Console",
    icon: <path d="M11 4a7 7 0 1 0 4.4 12.4l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />,
    lines: ["Clicks and impressions on every issue", "Searches close to page one", "Pages that lost clicks, and Google's indexing answer"],
  },
  {
    name: "Analytics (GA4)",
    icon: <path d="M5 20V10h3v10H5zm5.5 0V4h3v16h-3zM16 20v-7h3v7h-3z" />,
    lines: ["Visitors and engagement per issue", "Drop detective: which pages lost visitors, and why", "Channels, devices and countries"],
  },
  {
    name: "Google Ads",
    icon: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 14.9V19h-2v-1.1c-1.6-.3-2.8-1.3-3-2.9h2c.2.7.9 1.2 2 1.2 1.2 0 1.8-.5 1.8-1.1 0-.7-.6-1-2.2-1.4-1.9-.5-3.3-1.1-3.3-2.9 0-1.4 1-2.4 2.7-2.7V7h2v1.1c1.5.3 2.5 1.3 2.6 2.7h-2c-.1-.6-.7-1.1-1.7-1.1-1 0-1.6.4-1.6 1 0 .6.6.9 2.2 1.3 2 .5 3.3 1.2 3.3 3 0 1.5-1.1 2.5-2.8 2.9z" />,
    lines: ["Ad spend landing on pages with issues", "Keywords with a weak landing-page rating", "Paid searches where you already rank top 3"],
  },
];

export function GoogleSection() {
  return (
    <section className="sec hg" id="google" aria-labelledby="hg-h">
      <div className="container">
        <div className="head-center" data-r>
          <h2 className="title" id="hg-h">Your Google numbers, next to every fix.</h2>
          <p className="lead">Connect Search Console, Google Analytics and Google Ads, and every issue in your report shows the real searches, visitors and ad spend it touches. So you fix what costs you most, first.</p>
        </div>

        <div className="hg-grid" data-r>
          <ul className="hg-cards">
            {PRODUCTS.map((p) => (
              <li key={p.name}>
                <svg viewBox="0 0 24 24" aria-hidden="true">{p.icon}</svg>
                <h3>{p.name}</h3>
                <ul>{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              </li>
            ))}
          </ul>

          <figure className="hg-sample" aria-label="Example finding with Google numbers">
            <figcaption>Example finding</figcaption>
            <p className="hg-sev">High · Performance</p>
            <h3>Largest image on /pricing is 2.4 MB</h3>
            <p className="hg-fix">Compress it and serve WebP: the page shows about 2 seconds sooner on phones.</p>
            <ul className="hg-badges">
              <li><b>1,240</b> search clicks</li>
              <li><b>3,180</b> visits</li>
              <li><b>₹18,400</b> ad spend</li>
            </ul>
            <p className="hg-ai"><span aria-hidden="true">✦</span> AI insight: /pricing lost 31% of its Google clicks this month and is your slowest page.</p>
          </figure>
        </div>

        <p className="hg-foot" data-r>
          <span>Read-only · Professional &amp; Business</span>
          <Link href="/features/google-integrations" className="btn ghost">How it works <Arrow /></Link>
        </p>
      </div>
    </section>
  );
}
