import { Arrow } from "./arrow";
import Link from "next/link";
import type { ReactNode } from "react";
import { BANDS } from "./art";
import { AiMock, AnalyseMock, DiscoverMock } from "./ui";

/* ---------- three numbered rows: a text card and a graphic card, alternating ---------- */
const ROWS = [
  {
    n: "01",
    c: "#6a30bd",
    h: "Paste a URL. Pagelyt maps your site.",
    p: "No setup and no code. Pagelyt reads your public pages, links and technology signals, then lines up every check.",
    link: ["/how-it-works", "See how it works"],
    vis: <DiscoverMock />,
  },
  {
    n: "02",
    c: "#1a6b4c",
    h: "Six checks run at once.",
    p: "Health, speed and Core Web Vitals, technical SEO, GEO, security and accessibility combine into one Website Intelligence Score.",
    link: ["/features", "Explore the checks"],
    vis: <AnalyseMock />,
  },
  {
    n: "03",
    c: "#a35a0c",
    h: "Fixes ranked by impact.",
    p: "AI explains what was found, why it matters and what to do next, in plain English.",
    link: ["/features/ai-recommendations", "See recommendations"],
    vis: <AiMock />,
  },
] as const;

export function NumberedRows() {
  return (
    <div className="nrows">
      {ROWS.map((r, i) => (
        <div className={`nrow${i % 2 ? " flip" : ""}`} key={r.n}>
          <div className="ncard text" style={{ ["--c" as string]: r.c }}>
            <span className="nnum" aria-hidden="true">
              {r.n}
            </span>
            <div>
              <h3>{r.h}</h3>
              <p>{r.p}</p>
              <Link className="tlink" href={r.link[0]}>
                {r.link[1]} <Arrow />
              </Link>
            </div>
          </div>
          <div className="ncard vis">{r.vis}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- a card framed by curved ribbons ---------- */
export function RibbonFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rframe">
      <svg className="rframe-bg" viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
        {BANDS.map((c, i) => (
          <path
            key={`l${c}`}
            d={`M ${120 - i * 22} 0 C ${-30 - i * 22} 170, ${-30 - i * 22} 390, ${120 - i * 22} 560`}
            stroke={c}
            strokeWidth="22"
            fill="none"
          />
        ))}
        {BANDS.map((c, i) => (
          <path
            key={`r${c}`}
            d={`M ${1080 + i * 22} 0 C ${1230 + i * 22} 170, ${1230 + i * 22} 390, ${1080 + i * 22} 560`}
            stroke={c}
            strokeWidth="22"
            fill="none"
          />
        ))}
      </svg>
      <div className="rframe-card">{children}</div>
    </div>
  );
}

/* ---------- at a glance: honest product facts in a bento grid ---------- */
export function Glance() {
  return (
    <div className="glance">
      <div className="gt g1">
        <span className="gnum">6 checks.</span>
        <span className="gnum">1 score.</span>
        <p>Health, speed, SEO, GEO, security and accessibility in every analysis.</p>
      </div>
      <Link className="gt g2" href="/features">
        <span className="gnum">8</span>
        <p>feature areas, each with evidence and a next step</p>
      </Link>
      <div className="gt g3">
        <span className="gnum">₹0</span>
        <p>to start a free website analysis</p>
      </div>
      <Link className="gt g4" href="/consultation">
        <span className="gnum">30/60/90</span>
        <p>minute consultations with the founder</p>
      </Link>
      <div className="gt g5">
        <span className="gnum">1 URL</span>
        <p>is all the setup you need</p>
      </div>
      <Link className="gt g6" href="/features/monitoring-reports">
        <span className="gnum">Daily</span>
        <p>scans on Business, weekly on Professional</p>
      </Link>
      <Link className="gt g7" href="/features/ai-recommendations">
        <span className="gnum">AI fixes</span>
        <p>in plain English, ranked by impact</p>
      </Link>
    </div>
  );
}

/* ---------- oversized price beside a checklist ---------- */
export function PriceBlock() {
  const lines = [
    "Monthly scheduled scans",
    "Advanced performance, SEO and GEO analysis",
    "AI recommendations in plain English",
    "Basic uptime monitoring",
    "Three months of historical reports",
    "Monthly intelligence reports and PDF downloads",
  ];
  return (
    <div className="priceblock">
      <div className="pb-left">
        <span className="pb-from">From</span>
        <span className="pb-price">₹999</span>
        <span className="pb-per">/ website / year</span>
      </div>
      <ul className="pb-list">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
