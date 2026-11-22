import Link from "next/link";
import { Arrow } from "./arrow";

/* Home page Google section: "Your traffic, explained. And how to grow it." An overall traffic card (28-day totals,
   trend line, channels and AI steps to grow), then three product cards, a sample finding with its Google badges,
   and the plan line. Sample numbers. Text names and our own icons only: no Google product logos on marketing pages. */

const PRODUCTS = [
  {
    name: "Search Console",
    tone: "sc",
    stat: ["1,240", "search clicks"],
    icon: <path d="M11 4a7 7 0 1 0 4.4 12.4l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />,
    lines: ["Clicks and impressions on every issue", "Searches close to page one", "Pages that lost clicks, and Google's indexing answer"],
  },
  {
    name: "Analytics (GA4)",
    tone: "ga",
    stat: ["3,180", "visits"],
    icon: <path d="M5 20V10h3v10H5zm5.5 0V4h3v16h-3zM16 20v-7h3v7h-3z" />,
    lines: ["Visitors and engagement per issue", "Drop detective: which pages lost visitors, and why", "Channels, devices and countries"],
  },
  {
    name: "Google Ads",
    tone: "ads",
    stat: ["₹18,400", "ad spend"],
    icon: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 14.9V19h-2v-1.1c-1.6-.3-2.8-1.3-3-2.9h2c.2.7.9 1.2 2 1.2 1.2 0 1.8-.5 1.8-1.1 0-.7-.6-1-2.2-1.4-1.9-.5-3.3-1.1-3.3-2.9 0-1.4 1-2.4 2.7-2.7V7h2v1.1c1.5.3 2.5 1.3 2.6 2.7h-2c-.1-.6-.7-1.1-1.7-1.1-1 0-1.6.4-1.6 1 0 .6.6.9 2.2 1.3 2 .5 3.3 1.2 3.3 3 0 1.5-1.1 2.5-2.8 2.9z" />,
    lines: ["Ad spend landing on pages with issues", "Keywords with a weak landing-page rating", "Paid searches where you already rank top 3"],
  },
];

const TOTALS: { k: string; v: string; d: string; up: boolean }[] = [
  { k: "Search clicks", v: "4,820", d: "+12%", up: true },
  { k: "Visits", v: "9,340", d: "−4%", up: false },
  { k: "Engaged visits", v: "61%", d: "+3 pts", up: true },
];
const CHANNELS: [string, number][] = [["Organic search", 58], ["Direct", 21], ["Social", 12], ["Paid search", 9]];
const STEPS = [
  "Fix the slow hero image on /pricing: it lost 31% of its clicks this month.",
  "6 searches sit on page two. Add an FAQ to /services to reach page one.",
  "Visits from social fell 18%. Your shared links have no preview image.",
];
const TREND = "M0 52 L30 48 L60 50 L90 40 L120 42 L150 32 L180 34 L210 24 L240 26 L270 14 L300 10";

function OverallTraffic() {
  return (
    <figure className="hg-overall" aria-label="Example: overall traffic for the last 28 days, with AI steps to grow it">
      <div className="hg-ov-head">
        <figcaption><span className="hmon-live" aria-hidden="true" />Overall traffic · last 28 days</figcaption>
        <span className="hg-ov-src">Search Console + Analytics</span>
      </div>
      <div className="hg-ov-body">
        <div className="hg-ov-main">
          <dl className="hg-ov-totals">
            {TOTALS.map((t) => (
              <div key={t.k}>
                <dt>{t.k}</dt>
                <dd><b>{t.v}</b><span className={t.up ? "up" : "down"}>{t.d}</span></dd>
              </div>
            ))}
          </dl>
          <svg className="hg-ov-trend" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="hg-ov-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#1f6fe0" stopOpacity=".22" />
                <stop offset="1" stopColor="#1f6fe0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${TREND} L300 60 L0 60 Z`} fill="url(#hg-ov-fill)" />
            <path className="hg-ov-line" d={TREND} />
          </svg>
          <ul className="hg-ov-ch" aria-label="Visits by channel">
            {CHANNELS.map(([n, v], i) => (
              <li key={n} style={{ ["--v" as string]: `${v}%`, ["--i" as string]: i }}>
                <span>{n}</span><i aria-hidden="true" /><b>{v}%</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="hg-ov-ai">
          <p className="hg-ov-ai-h"><span aria-hidden="true">✦</span> AI: how to grow your traffic</p>
          <ol>
            {STEPS.map((s, i) => <li key={s} style={{ ["--i" as string]: i }}>{s}</li>)}
          </ol>
        </div>
      </div>
    </figure>
  );
}

export function GoogleSection() {
  return (
    <section className="sec hg" id="google" aria-labelledby="hg-h">
      <div className="container">
        <div className="head-center" data-r>
          <h2 className="title" id="hg-h">Your traffic, explained. And how to grow it.</h2>
          <p className="lead">Connect Search Console, Google Analytics and Google Ads for one overall view of your traffic: what&apos;s growing, what&apos;s dropping and why, with AI steps to improve it. Every issue in your report also shows the searches, visitors and ad spend it touches, so you fix what costs you most first.</p>
        </div>

        <div data-r style={{ ["--d" as string]: 1 }}>
          <OverallTraffic />
        </div>

        <div className="hg-grid" data-r>
          <ul className="hg-cards">
            {PRODUCTS.map((p, i) => (
              <li key={p.name} className={`hg-${p.tone}`} style={{ ["--i" as string]: i }}>
                <span className="hg-ic" aria-hidden="true"><svg viewBox="0 0 24 24">{p.icon}</svg></span>
                <div className="hg-body">
                  <div className="hg-top">
                    <h3>{p.name}</h3>
                    <span className="hg-stat"><b>{p.stat[0]}</b> {p.stat[1]}</span>
                  </div>
                  <ul>{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
              </li>
            ))}
          </ul>

          <figure className="hg-sample" aria-label="Example finding with Google numbers">
            <figcaption><span className="hmon-live" aria-hidden="true" />Example finding</figcaption>
            <p className="hg-sev">High · Performance</p>
            <h3>Largest image on /pricing is 2.4 MB</h3>
            <p className="hg-fix">Compress it and serve WebP: the page shows about 2 seconds sooner on phones.</p>
            <ul className="hg-badges">
              <li className="hg-sc" style={{ ["--i" as string]: 0 }}><b>1,240</b> search clicks</li>
              <li className="hg-ga" style={{ ["--i" as string]: 1 }}><b>3,180</b> visits</li>
              <li className="hg-ads" style={{ ["--i" as string]: 2 }}><b>₹18,400</b> ad spend</li>
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
