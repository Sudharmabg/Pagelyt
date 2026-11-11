import Link from "next/link";
import { Arrow } from "./arrow";

export function ToolsAndGuides() {
  return (
    <section className="sec" aria-labelledby="tools-h">
      <div className="container">
        <div className="head-center">
          <h2 className="title" id="tools-h">Fix things yourself, free.</h2>
          <p className="lead">Checkers, generators and guides for the issues scans find most often. Free with a Pagelyt account.</p>
        </div>
        <div className="tg-cards">
          <Link href="/tools" className="tg-card">
            <h3>Free tools</h3>
            <p>Check which AI bots can reach you, test <code>robots.txt</code> and hreflang, and generate <code>llms.txt</code>, schema markup and security headers.</p>
            <span>Open the tools <Arrow /></span>
          </Link>
          <Link href="/fix" className="tg-card">
            <h3>Fix guides</h3>
            <p>Step-by-step help for SEO, security, speed, accessibility, privacy and email problems, written for owners first.</p>
            <span>Browse the guides <Arrow /></span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* four promises in a dark band just above the footer, each with a glowing icon (padlock, magnifier, balance,
   toolbox). Items rise in one by one when the band scrolls into view (the home page's data-r adds .in). */
const TRUST_ICONS = [
  <g key="lock"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path className="tr-shackle" d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><path d="M12 14.5v2" /></g>,
  <g key="find"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5M8 10.5h5" /></g>,
  <g key="scale"><path d="M12 4v16M7 20h10M5 7h14" /><path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" /></g>,
  <g key="tools"><rect x="3.5" y="8" width="17" height="11.5" rx="2.5" /><path d="M9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2M3.5 13h17M10.5 13v2h3v-2" /></g>,
];

export function TrustRow() {
  const items = [
    ["Private by link", "Reports are only visible to people you share the link with, and are never indexed."],
    ["Evidence, not guesses", "Every finding shows what we saw and how to fix it."],
    ["Honest limits", "Automated checks aren’t a compliance certificate. We say what the scan can’t tell you."],
    ["Free tools, no install", "Checkers and generators for the most common fixes, free with an account."],
  ];
  return (
    <section className="sec tight trust-sec" aria-label="Why you can trust Pagelyt">
      <div className="container">
        <ul className="trust-row" data-r>
          {items.map(([h, p], i) => (
            <li key={h} className={`tr-${i}`} style={{ ["--i" as string]: i }}>
              <span className="tr-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24">{TRUST_ICONS[i]}</svg>
              </span>
              <strong>{h}</strong>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
