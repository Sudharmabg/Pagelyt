import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, crumbLd } from "../json-ld";
import { PageHero } from "../page-shell";
import { CONTACT_EMAIL } from "../site-config";
import { SiteFooter, SiteNav } from "../site-chrome";

export const metadata: Metadata = {
  title: "PagelytBot: What It Is and What It Fetches",
  description:
    "PagelytBot is the crawler behind Pagelyt website reports. See when it visits, which pages and files it requests, and how to block it.",
  alternates: { canonical: "/bot" },
};

const FETCHES: [string, string][] = [
  ["Your pages", "The homepage, then up to 30 pages of the same site, taken from your sitemap first and then from internal links."],
  ["Standard files", "robots.txt, sitemap.xml, llms.txt and security.txt, to report on whether they exist and are set up correctly."],
  ["A sample of links and images", "A handful of links and images from the page, to find broken links and oversized files."],
  ["Exposure checks", "A few well-known paths such as /.env and /.git/config, only to warn you if private files are publicly readable."],
];

export default function BotPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["PagelytBot", "/bot"],
        ])}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="PagelytBot"
          lead="If you found PagelytBot in your server logs, someone used Pagelyt to check a website. This page explains what it fetched and why."
        />

        <section className="sec" aria-labelledby="ua-h">
          <div className="container">
            <div className="prose" style={{ maxWidth: 760 }}>
              <h2 id="ua-h">How to recognise it.</h2>
              <p>Requests from Pagelyt carry this user agent:</p>
              <pre className="post-code">
                <code>PagelytBot/0.1 (+https://pagelyt.dev/bot)</code>
              </pre>
              <p>
                Requests come from Cloudflare&apos;s network, so the IP addresses belong to Cloudflare and can change.
              </p>

              <h2>When it visits.</h2>
              <p>
                PagelytBot does not crawl the web on its own. It only visits a website when a person asks for a report on
                it, when an owner has scheduled rescans of their own site, or when a paid account compares its site with a
                competitor. Each report makes a small, fixed number of requests and then stops.
              </p>
            </div>
            <div className="info-grid">
              {FETCHES.map(([t, d]) => (
                <div className="info-card" key={t}>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec ice" aria-labelledby="other-h">
          <div className="container">
            <div className="prose" style={{ maxWidth: 760 }}>
              <h2 id="other-h">Other requests in a report.</h2>
              <p>Some checks can&apos;t use the PagelytBot name, because they test how your site treats other visitors:</p>
              <ul className="prose-list">
                <li>
                  The <Link href="/tools">AI crawler checker</Link> requests your homepage once with a normal browser
                  user agent and once with each AI crawler&apos;s name, to show whether your server treats them
                  differently.
                </li>
                <li>Speed scores come from Google PageSpeed Insights, which loads the page from Google&apos;s servers.</li>
                <li>
                  Uptime checks, which owners can turn on for their own sites, send one homepage request at a time as{" "}
                  <code>PagelytUptime/1.0</code>.
                </li>
                <li>Screenshots and PDFs are taken with a headless Chrome browser run by Cloudflare.</li>
              </ul>

              <h2>How to block it.</h2>
              <p>
                Reports are started by people for a specific site, so PagelytBot reads your robots.txt to report on it but
                doesn&apos;t use it to skip pages. To stop it, block requests whose user agent contains{" "}
                <code>PagelytBot</code> (and <code>PagelytUptime</code>) in your firewall or server settings. Pagelyt will then show an error instead of a
                report.
              </p>
              <p>
                Something wrong, or too many requests? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or{" "}
                <Link href="/contact">get in touch</Link>, and include the site and the time from your logs.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
