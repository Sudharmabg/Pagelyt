"use client";

import Link from "next/link";
import { useRef } from "react";

/* Home page media: a "works with" ticker and a carousel of the blog guides. */

const PLATFORMS = [
  "WordPress", "Shopify", "Wix", "Squarespace", "Webflow", "Next.js", "Framer", "Ghost",
  "Google Search Console", "Google Analytics 4", "Google Ads", "Any HTML site",
];

/* An endless ticker of the platforms a scan works on. Drawn twice so the loop is seamless; the second copy is
   hidden from screen readers. Pauses on hover; stands still under reduced motion. */
export function WorksWith() {
  const row = (hidden: boolean) => (
    <ul className="ww-row" aria-hidden={hidden || undefined}>
      {PLATFORMS.map((p) => (
        <li key={p}>
          <span className="ww-dot" aria-hidden="true" />
          {p}
        </li>
      ))}
    </ul>
  );
  return (
    <section className="ww" aria-label="Works with">
      <p className="ww-k">Works with every website, including</p>
      <div className="ww-track">
        <div className="ww-belt">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}

export type GuideCard = { slug: string; tag: string; h1: string; lead: string };

const TINTS = ["#7a3fd0", "#0e8f7e", "#d4561e", "#2563eb", "#b5288a", "#3d7a13"];

/* The blog guides as a swipeable row of cards. Native horizontal scroll with snap points (touch, trackpad and
   keyboard all work); the card in the middle stands forward and the others turn away slightly, driven by
   scroll position where the browser supports it. Arrow buttons step one card at a time. */
export function GuidesCarousel({ guides }: { guides: GuideCard[] }) {
  const track = useRef<HTMLUListElement>(null);
  const step = (dir: number) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("li");
    const w = card ? card.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * w, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  if (!guides.length) return null;
  return (
    <div className="gcar">
      <ul className="gcar-track" ref={track} aria-label="Guides">
        {guides.map((g, i) => (
          <li key={g.slug} style={{ ["--gt" as string]: TINTS[i % TINTS.length] }}>
            <Link href={`/blog/${g.slug}`} className="gcar-card">
              <span className="gcar-tag">{g.tag}</span>
              <h3>{g.h1}</h3>
              <p>{g.lead}</p>
              <span className="gcar-go">
                Read the guide <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="gcar-nav">
        <button type="button" onClick={() => step(-1)} aria-label="Previous guides">‹</button>
        <button type="button" onClick={() => step(1)} aria-label="More guides">›</button>
        <Link href="/blog" className="fnd-link">All guides</Link>
      </div>
    </div>
  );
}
