export type Tone = "good" | "warn" | "bad";
export const tone = (s: number): Tone => (s >= 80 ? "good" : s >= 50 ? "warn" : "bad");
const toneVar = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" };
const word = { good: "Good", warn: "Needs work", bad: "Poor" };

export type ModScore = { name: string; score: number };

export function Ring({ v, size = 64, stroke = 7, text }: { v: number; size?: number; stroke?: number; text?: string }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const t = tone(v);
  return (
    <div className="rg" style={{ width: size, height: size }} role="img" aria-label={`Score ${v}, ${word[t]}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="tr" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="vl"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={toneVar[t]}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - v / 100)}
        />
      </svg>
      <b style={{ fontSize: size * 0.32 }}>{text ?? v}</b>
    </div>
  );
}

export function Spark({
  data,
  color = "var(--i500)",
  fill = true,
  height = 90,
}: {
  data: number[];
  color?: string;
  fill?: boolean;
  height?: number;
}) {
  const w = 300;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, height - 8 - ((d - min) / (max - min || 1)) * (height - 20)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{ height }}>
      {fill && <path d={`${line} L${w} ${height} L0 ${height} Z`} fill={color} opacity="0.14" />}
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Top({ title, sub, pill }: { title: string; sub?: string; pill?: [string, string] }) {
  return (
    <div className="mock-top">
      <div>
        <div className="mock-title">{title}</div>
        {sub && <div className="mock-sub">{sub}</div>}
      </div>
      {pill ? (
        <span className={`pill ${pill[0]}`}>{pill[1]}</span>
      ) : (
        <div className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}

const Row = ({ t, p }: { t: string; p: [string, string] }) => (
  <div className="lrow">
    <span>{t}</span>
    <span className={`pill ${p[0]}`}>{p[1]}</span>
  </div>
);

/* ---------- hero: scanning preview ---------- */
export function ScanPreview({
  mods,
  overall,
  phase,
  host,
  progress,
  stepText,
}: {
  mods: ModScore[];
  overall: number;
  phase: "sample" | "scanning" | "done";
  host: string;
  progress: number;
  stepText: string;
}) {
  const scanning = phase === "scanning";
  const verdict = overall >= 80 ? "In great shape" : overall >= 65 ? "In good shape" : "Room to grow";
  return (
    <div data-ui className={`mock scan-card${scanning ? " scanning" : ""}`} aria-live="polite">
      <div className="beam" aria-hidden="true" />
      <div className="scan-top">
        <div className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="addr">{host ? `https://${host}` : "https://yourwebsite.com"}</div>
        <span className={`pill ${scanning ? "info" : "lime"}`}>
          {scanning ? "Analysing" : phase === "done" ? "Preview complete" : "Sample report"}
        </span>
      </div>
      <div className="scan-body">
        <div className="scan-list">
          {mods.map((m, i) => {
            const st = scanning ? (i < progress ? "done" : i === progress ? "run" : "wait") : "done";
            return (
              <div className={`srow ${st}`} key={m.name}>
                <span className={`mark ${st}`} aria-hidden="true" />
                <span>{m.name}</span>
                {st === "done" ? (
                  <span className={`pill ${tone(m.score)}`}>{m.score}</span>
                ) : (
                  <span className="pill mute">{st === "run" ? "Analysing" : "Queued"}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="scan-side">
          <div className="score-head">
            <Ring v={scanning ? 35 : overall} size={104} stroke={11} text={scanning ? "…" : String(overall)} />
            <div>
              <div className="mock-sub">Website Intelligence Score</div>
              <h3>{scanning ? "Scanning your website" : verdict}</h3>
              <div className="step-line">{scanning ? stepText : "Preview using sample data"}</div>
            </div>
          </div>
          <Row t="Hero image is 2.4 MB" p={["bad", "High"]} />
          <Row t="4 pages lack meta descriptions" p={["warn", "Medium"]} />
          <Row t="HSTS header is missing" p={["warn", "Medium"]} />
          <div className="opp" style={{ marginTop: 12 }}>
            <b>Next best fix:</b> compress the hero image and gain about 1.8 seconds on mobile.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- capability mockups ---------- */
export function HealthMock() {
  const days = Array.from({ length: 30 }, (_, i) => (i === 11 ? 55 : 100 - ((i * 7) % 4)));
  return (
    <div data-ui className="mock">
      <Top title="Website health" sub="yourwebsite.com" pill={["good", "Healthy"]} />
      <div className="mk-grid c3">
        <div className="tile"><div className="k">Uptime, 30 days</div><div className="v">99.96%</div></div>
        <div className="tile"><div className="k">HTTP status</div><div className="v good-t">200 OK</div></div>
        <div className="tile"><div className="k">Response</div><div className="v">412 ms</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 54, margin: "16px 0 6px" }} aria-hidden="true">
        {days.map((d, i) => (
          <i key={i} style={{ flex: 1, height: `${d}%`, borderRadius: 3, background: d < 80 ? "var(--bad)" : "var(--i500)", opacity: d < 80 ? 1 : 0.85 }} />
        ))}
      </div>
      <div className="mock-sub">Uptime history, last 30 days</div>
      <div style={{ marginTop: 10 }}>
        <Row t="SSL certificate valid, 62 days left" p={["good", "Valid"]} />
        <Row t="DNS records resolve correctly" p={["good", "Pass"]} />
        <Row t="2 redirect chains found" p={["warn", "Review"]} />
      </div>
    </div>
  );
}

export function PerfMock() {
  return (
    <div data-ui className="mock">
      <Top title="Performance" sub="Lighthouse and Core Web Vitals" />
      <div className="mk-grid c2">
        <div className="tile" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Ring v={92} size={64} />
          <div><div className="k">Desktop</div><span className="pill good">Good</span></div>
        </div>
        <div className="tile" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Ring v={74} size={64} />
          <div><div className="k">Mobile</div><span className="pill warn">Needs work</span></div>
        </div>
      </div>
      <div className="mk-grid c3" style={{ marginTop: 10 }}>
        <div className="tile"><div className="k">LCP</div><div className="v good-t">2.1 s</div></div>
        <div className="tile"><div className="k">INP</div><div className="v warn-t">240 ms</div></div>
        <div className="tile"><div className="k">CLS</div><div className="v good-t">0.04</div></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <Row t="Hero image is 2.4 MB" p={["bad", "Save 1.8 s"]} />
        <Row t="3 render-blocking scripts" p={["warn", "Save 0.6 s"]} />
      </div>
    </div>
  );
}

export function SeoGeoMock() {
  return (
    <div data-ui className="mock">
      <Top title="SEO and GEO" sub="42 pages crawled" pill={["info", "2 scores"]} />
      <div className="mk-grid c2">
        <div className="tile"><div className="k">SEO score</div><div className="v good-t">82</div></div>
        <div className="tile"><div className="k">GEO readiness</div><div className="v warn-t">68</div></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <Row t="3 pages missing meta descriptions" p={["warn", "Medium"]} />
        <Row t="2 broken internal links" p={["bad", "High"]} />
        <Row t="Sitemap and robots.txt found" p={["good", "Pass"]} />
        <Row t="AI crawlers can read your pages" p={["good", "Pass"]} />
        <Row t="Structured data on 3 of 8 page types" p={["warn", "Partial"]} />
        <Row t="No llms.txt file" p={["mute", "Optional"]} />
      </div>
    </div>
  );
}

export function SecA11yMock() {
  return (
    <div data-ui className="mock">
      <Top title="Security and accessibility" sub="Publicly observable checks" pill={["warn", "2 areas"]} />
      <div className="mk-grid c2">
        <div className="tile"><div className="k">Security</div><div className="v warn-t">61</div></div>
        <div className="tile"><div className="k">Accessibility</div><div className="v good-t">87</div></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <Row t="Content-Security-Policy missing" p={["bad", "High"]} />
        <Row t="Strict-Transport-Security set" p={["good", "Pass"]} />
        <Row t="6 images without alt text" p={["warn", "Medium"]} />
        <Row t="2 form fields missing labels" p={["bad", "High"]} />
        <Row t="Text contrast meets AA" p={["good", "Pass"]} />
      </div>
    </div>
  );
}

export function CompareMock() {
  const rows: [string, number, number, number][] = [
    ["Performance", 74, 88, 61],
    ["Technical SEO", 82, 79, 70],
    ["Accessibility", 87, 72, 64],
    ["Content structure", 69, 85, 58],
    ["GEO readiness", 68, 54, 41],
  ];
  return (
    <div data-ui className="mock">
      <Top title="Competitor comparison" sub="Publicly observable signals" />
      <div className="cmp-head"><span /><span>You</span><span>Competitor A</span><span>Competitor B</span></div>
      {rows.map(([n, a, b, c]) => (
        <div className="cmp-row" key={n}>
          <b>{n}</b>
          {[a, b, c].map((v, i) => (
            <div key={i}>
              <div className="bar"><i className={i === 0 ? "info" : tone(v)} style={{ width: `${v}%`, opacity: i === 0 ? 1 : 0.7 }} /></div>
              <b>{v}</b>
            </div>
          ))}
        </div>
      ))}
      <div className="opps">
        <div className="opp"><b>Opportunity:</b> Competitor A loads 14 points faster on mobile.</div>
        <div className="opp"><b>Strength:</b> you lead both competitors on accessibility and GEO readiness.</div>
      </div>
      <div className="fine">Illustrative data for this preview.</div>
    </div>
  );
}

export function AiMock() {
  return (
    <div data-ui className="mock">
      <Top title="AI recommendation" sub="Security · yourwebsite.com" pill={["bad", "High priority"]} />
      <div className="mock-title" style={{ fontSize: 20 }}>Important security headers are missing</div>
      <p style={{ margin: "8px 0 12px", color: "var(--n600)" }}>
        Your website does not currently return certain recommended security headers.
      </p>
      <div className="tile">
        <div className="k">Evidence</div>
        <code style={{ display: "block", marginTop: 6, fontSize: 13, color: "var(--n700)", lineHeight: 1.7 }}>
          GET / → 200<br />strict-transport-security: <span className="bad-t">not set</span><br />content-security-policy: <span className="bad-t">not set</span>
        </code>
      </div>
      <div className="mk-grid c3" style={{ marginTop: 10 }}>
        <div className="tile"><div className="k">Impact</div><div className="v" style={{ fontSize: 18 }}>High</div></div>
        <div className="tile"><div className="k">Effort</div><div className="v" style={{ fontSize: 18 }}>Low</div></div>
        <div className="tile"><div className="k">Score gain</div><div className="v good-t" style={{ fontSize: 18 }}>+6</div></div>
      </div>
      <div className="opp" style={{ marginTop: 10 }}>
        <b>Recommended action:</b> review and configure HTTP security headers in your hosting environment.
      </div>
    </div>
  );
}

export function TimelineMock() {
  const ev: [string, string, string][] = [
    ["var(--n400)", "Previous scan, 1 Oct", "Score 71"],
    ["var(--i500)", "Current scan, 1 Nov", "Score 82"],
    ["var(--good)", "Performance improved", "+9 points on mobile"],
    ["var(--warn)", "Newly detected issue", "HSTS header missing"],
    ["var(--good)", "Resolved issue", "2 broken links fixed"],
  ];
  return (
    <div data-ui className="mock">
      <Top title="Intelligence timeline" sub="yourwebsite.com" pill={["good", "Improving"]} />
      <div className="tl">
        <div>
          <Spark data={[62, 64, 63, 68, 71, 70, 76, 82]} height={170} />
          <div className="mock-sub">Website Intelligence Score, last 8 scans</div>
          <div className="opp" style={{ marginTop: 12 }}><b>Monthly summary:</b> 5 improvements, 1 regression, 3 recommended actions.</div>
        </div>
        <div>
          {ev.map(([c, a, b]) => (
            <div className="ev" key={a}>
              <i style={{ background: c }} />
              <div><b>{a}</b><div className="mock-sub">{b}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- journey mockups ---------- */
export function DiscoverMock() {
  const nodes: [string, number][] = [["/", 0], ["/pricing", 1], ["/services", 1], ["/services/audit", 2], ["/blog", 1], ["/blog/launch-notes", 2], ["/contact", 1]];
  return (
    <div data-ui className="mock scan-card scanning">
      <div className="beam" aria-hidden="true" />
      <div style={{ padding: 20 }} className="disc-tree">
        <Top title="Discovering structure" sub="https://yourwebsite.com" pill={["info", "42 pages found"]} />
        {nodes.map(([p, d]) => (
          <div className="lrow" key={p} style={{ paddingLeft: d * 22 }}>
            <b>{p}</b>
            <span className="pill good">200</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyseMock() {
  const m: [string, string][] = [["Website health", "done"], ["Performance", "done"], ["SEO", "done"], ["GEO readiness", "run"], ["Security", "wait"], ["Accessibility", "wait"]];
  return (
    <div data-ui className="mock">
      <Top title="Analysing" sub="Six dimensions, one score" pill={["info", "4 of 6"]} />
      {m.map(([n, s]) => (
        <div className="lrow" key={n}>
          <span>{n}</span>
          <span className={`pill ${s === "done" ? "good" : s === "run" ? "info" : "mute"}`}>{s === "done" ? "Complete" : s === "run" ? "Analysing" : "Queued"}</span>
        </div>
      ))}
    </div>
  );
}

export function HistMock() {
  return (
    <div data-ui className="mock">
      <Top title="Score history" sub="Last two monthly scans" pill={["good", "+11"]} />
      <Spark data={[64, 66, 65, 70, 71, 76, 82]} height={120} />
      <div className="mk-grid c2" style={{ marginTop: 6 }}>
        <div className="tile"><div className="k">Previous scan</div><div className="v">71</div></div>
        <div className="tile"><div className="k">Current scan</div><div className="v good-t">82</div></div>
      </div>
    </div>
  );
}

/* ---------- analytics (used in competitor section) ---------- */
export function CalendarMock() {
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <div data-ui className="mock">
      <Top title="Book a consultation" sub="Choose a day and time" pill={["info", "30 min"]} />
      <div className="cal">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span className="h" key={i}>{d}</span>
        ))}
        {days.map((d) => (
          <span key={d} className={d === 14 ? "on" : [6, 9, 10, 13, 15, 16, 20, 21, 22].includes(d) ? "av2" : ""}>{d}</span>
        ))}
      </div>
      <div className="slots">
        {["10:00", "11:30", "14:00", "16:30"].map((s, i) => <span key={s} className={i === 2 ? "on" : ""}>{s}</span>)}
      </div>
    </div>
  );
}

/* ---------- value-area mini visuals ---------- */
export function SixRings({ mods }: { mods: ModScore[] }) {
  return (
    <div className="six" aria-hidden="true">
      {mods.map((m) => (
        <Ring key={m.name} v={m.score} size={44} stroke={5} />
      ))}
    </div>
  );
}

export function FixList() {
  return (
    <div className="mk-grid" aria-hidden="true">
      <Row t="Compress hero image" p={["lime", "+9 pts"]} />
      <Row t="Add security headers" p={["lime", "+6 pts"]} />
      <Row t="Write meta descriptions" p={["lime", "+5 pts"]} />
    </div>
  );
}

/* ---------- persona icons ---------- */
const P: Record<string, string> = {
  "For Small Businesses": "M4 10l2-5h12l2 5M5 10v9h14v-9M9 19v-5h6v5",
  "For Website Owners": "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  "For Freelancers": "M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3",
  "For Digital Agencies": "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  "For Developers": "M9 7l-5 5 5 5M15 7l5 5-5 5",
};
export function PersonaIcon({ name }: { name: string }) {
  return (
    <div className="av" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={P[name]} />
      </svg>
    </div>
  );
}

export function AnalyticsMock() {
  return (
    <div data-ui className="mock">
      <Top title="Analytics overview" sub="Last 28 days · connected sources" pill={["good", "+12% traffic"]} />
      <div className="mk-grid c3">
        <div className="tile"><div className="k">Sessions</div><div className="v">18.4k</div></div>
        <div className="tile"><div className="k">Search clicks</div><div className="v">6.2k</div></div>
        <div className="tile"><div className="k">Avg. position</div><div className="v">11.3</div></div>
      </div>
      <div style={{ marginTop: 12 }}><Spark data={[40, 44, 41, 50, 49, 58, 55, 63, 60, 72]} height={100} /></div>
      <div className="mk-grid c2" style={{ marginTop: 6 }}>
        <div>
          <div className="mock-sub" style={{ marginBottom: 4 }}>Top pages</div>
          {["/", "/pricing", "/services"].map((p, i) => (
            <div className="lrow" key={p}><span>{p}</span><b>{[4.2, 2.8, 1.9][i]}k</b></div>
          ))}
        </div>
        <div>
          <div className="mock-sub" style={{ marginBottom: 8 }}>Traffic sources</div>
          {([["Search", 58], ["Direct", 24], ["Social", 12], ["Other", 6]] as [string, number][]).map(([n, v]) => (
            <div key={n} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{n}</span><b>{v}%</b></div>
              <div className="bar"><i className="info" style={{ width: `${v}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
