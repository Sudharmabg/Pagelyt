"use client";

import { useEffect, useState } from "react";
import { Clouds } from "./art";

const GROUPS = [
  {
    k: "Speed and Core Web Vitals",
    d: "Lighthouse audits on mobile and desktop find the images, scripts and fonts slowing you down.",
    nodes: ["Lighthouse", "Core Web Vitals", "Page weight"],
    c: "#ba8aff",
  },
  {
    k: "SEO and AI readiness",
    d: "Titles, links, sitemaps, structured data, robots.txt and llms.txt show how search engines and AI crawlers see you.",
    nodes: ["robots.txt", "Sitemap", "Structured data"],
    c: "#8fb43a",
  },
  {
    k: "Security and accessibility",
    d: "Security headers, TLS, colour contrast and form labels, checked from public, observable signals.",
    nodes: ["Security headers", "TLS and SSL", "WCAG checks"],
    c: "#e0883a",
  },
  {
    k: "Health and monitoring",
    d: "Uptime, DNS and redirects, rescanned on a schedule so changes never surprise you.",
    nodes: ["DNS", "Uptime", "Redirects"],
    c: "#7a5fe0",
  },
];

const SECONDS = 5;

export function Sources() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  // On phones the rows must not move under a tap, so autoplay is off there.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const sync = () => mq.matches && setAuto(false);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % GROUPS.length), SECONDS * 1000);
    return () => clearTimeout(id);
  }, [active, auto]);

  return (
    <div className="sky">
      <Clouds />
      <div className="container">
        <h2 className="title" id="src-h">
          How Pagelyt analyses your website.
        </h2>
        <div className="src-grid">
          <ul className="src-rows">
            {GROUPS.map((g, i) => (
              <li key={g.k}>
                <button
                  className={`src-row${active === i ? " on" : ""}`}
                  aria-pressed={active === i}
                  onClick={() => {
                    setActive(i);
                    setAuto(false);
                  }}
                >
                  <span className="src-k">{g.k}</span>
                  <span className="src-d">{g.d}</span>
                  {active === i && auto && (
                    <span className="src-bar" aria-hidden="true">
                      <i key={active} style={{ animationDuration: `${SECONDS}s`, background: g.c }} />
                    </span>
                  )}
                  {active === i && !auto && <span className="src-bar solid" aria-hidden="true" style={{ background: g.c }} />}
                </button>
              </li>
            ))}
          </ul>

          <div className="src-card" data-ui>
            <svg viewBox="0 0 560 440" role="img" aria-label="Public signals flowing into Pagelyt and out as a score and fixes">
              {GROUPS.flatMap((g, gi) =>
                g.nodes.map((n, ni) => {
                  const idx = gi * 3 + ni;
                  const y = 28 + idx * 34;
                  const on = active === gi;
                  return (
                    <g key={n} className={`src-node${on ? " on" : ""}`}>
                      <path
                        d={`M178 ${y} C 280 ${y}, 250 220, 342 220`}
                        fill="none"
                        stroke={on ? g.c : "#c9d8e0"}
                        strokeWidth={on ? 3 : 2}
                      />
                      <rect x="14" y={y - 14} width="164" height="28" rx="14" fill={on ? g.c : "#eef3f6"} />
                      <text x="30" y={y + 5} fontSize="13.5" fontWeight="600" fill={on ? "#1d1020" : "#5c4752"}>
                        {n}
                      </text>
                    </g>
                  );
                })
              )}
              <circle cx="362" cy="220" r="40" fill="#0f2b3a" />
              <text x="362" y="225" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">
                Pagelyt
              </text>
              <path d="M402 220 H 440" stroke="#0f2b3a" strokeWidth="3" fill="none" />
              <rect x="440" y="186" width="112" height="68" rx="16" fill="#0f2b3a" />
              <text x="496" y="214" textAnchor="middle" fontSize="13" fontWeight="600" fill="#cfe3ee">
                Score and
              </text>
              <text x="496" y="234" textAnchor="middle" fontSize="15" fontWeight="800" fill="#68cea7">
                fixes
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
