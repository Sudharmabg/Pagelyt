import Link from "next/link";

/* Homepage "Continuous monitoring" section: every saved website is rescanned weekly, free. A 4-week score line
   (72 → 84) draws in as it scrolls into view, with a rescan dot each week and an alert card on the week a new issue
   appeared. Decorative numbers, not a real site. */
const WEEKS = [
  { w: "Week 1", score: 72 },
  { w: "Week 2", score: 78 },
  { w: "Week 3", score: 76 },
  { w: "Week 4", score: 84 },
];
const X = [40, 160, 280, 400];
const y = (s: number) => 150 - (s - 65) * 6; // 65 → 150, 85 → 30
const LINE = WEEKS.map((p, i) => `${i ? "L" : "M"}${X[i]} ${y(p.score)}`).join(" ");

const POINTS: { t: string; s: string; d: string }[] = [
  { t: "A fresh scan every week", s: "Every website you save is rescanned automatically, on the free plan too. Change it to daily or monthly any time.", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" },
  { t: "An email when something gets worse", s: "A score drop, a new important issue or a homepage change: you hear about it before your visitors do.", d: "M4 5h16v14H4zM4 7l8 6 8-6" },
  { t: "Progress you can see", s: "Each rescan is compared with the last, so you see what improved, what slipped and what to fix next.", d: "M4 19V5M4 19h16M8 15l4-4 3 3 5-6" },
];

export function MonitorSection() {
  return (
    <section className="sec hmon-sec" id="monitoring" aria-labelledby="hmon-h">
      <div className="container">
        <div className="hmon-wrap" data-r>
          <div className="hmon-copy">
            <p className="hmon-eyebrow"><span className="hmon-live" aria-hidden="true" />Continuous monitoring</p>
            <h2 className="title" id="hmon-h">Your website, checked every week.</h2>
            <p className="lead">
              An audit is a snapshot. Pagelyt keeps watching: every website you save is rescanned weekly, for free,
              and you get an email the moment something slips.
            </p>
            <ul className="hmon-points">
              {POINTS.map((p, i) => (
                <li key={p.t} style={{ ["--i" as string]: i }}>
                  <span className="hmon-pi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.d} /></svg></span>
                  <span><b>{p.t}</b><small>{p.s}</small></span>
                </li>
              ))}
            </ul>
            <Link href="/features/monitoring-reports" className="hmon-more">How monitoring works <span aria-hidden="true">→</span></Link>
          </div>

          <figure className="hmon-viz" aria-label="Example: a website's score over four weekly rescans, from 72 to 84">
            <div className="hmon-viz-head">
              <span className="hmon-viz-site"><span className="hmon-live" aria-hidden="true" />yourwebsite.com</span>
              <span className="hmon-viz-next">Next rescan in 7 days</span>
            </div>
            <div className="hmon-chart">
              <svg viewBox="0 0 440 180" aria-hidden="true" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="hmon-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#14a58e" stopOpacity=".28" />
                    <stop offset="1" stopColor="#14a58e" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="hmon-stroke" x1="0" x2="1">
                    <stop offset="0" stopColor="#0b6f63" />
                    <stop offset="1" stopColor="#2bc0a4" />
                  </linearGradient>
                </defs>
                {[30, 90, 150].map((g) => <line key={g} className="hmon-grid" x1="20" x2="420" y1={g} y2={g} />)}
                <path className="hmon-area" d={`${LINE} L400 170 L40 170 Z`} fill="url(#hmon-fill)" />
                <path className="hmon-line" d={LINE} pathLength={1} stroke="url(#hmon-stroke)" />
              </svg>
              {WEEKS.map((p, i) => (
                <span key={p.w} className={`hmon-pt${i === 2 ? " dip" : ""}`} style={{ left: `${(X[i] / 440) * 100}%`, top: `${(y(p.score) / 180) * 100}%`, ["--i" as string]: i }}>
                  <b>{p.score}</b>
                </span>
              ))}
              <div className="hmon-alert" role="presentation">
                <span className="hmon-alert-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 7l8 6 8-6" /></svg></span>
                <span><b>New issue on /pricing</b><small>Week 3 · score down 2</small></span>
              </div>
            </div>
            <ol className="hmon-weeks">
              {WEEKS.map((p, i) => (
                <li key={p.w} style={{ ["--i" as string]: i }}><i aria-hidden="true" />{p.w}</li>
              ))}
            </ol>
            <figcaption className="hmon-ticks">
              <span>✓ Weekly rescan</span><span>✓ Uptime checks</span><span>✓ Email alerts</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
