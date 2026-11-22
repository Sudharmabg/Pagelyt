import Link from "next/link";
import { LIBS } from "@/lib/scan/code-libs";

/* Homepage "Code security" section: a sample "What we checked" card (the files a browser downloaded, the libraries
   in them turning red when a version has known flaws, a leaked key shown masked) next to three short points.
   Sample data, not a real site. The copy says what these are: basic checks of what the browser receives, not a
   full security audit. On phones the card sits above the copy. */

type Tone = "bad" | "ok";
const LIB_CHIPS: { name: string; v: string; tone: Tone }[] = [
  { name: "jQuery", v: "3.4.1", tone: "bad" },
  { name: "Bootstrap", v: "4.6.2", tone: "ok" },
  { name: "Lodash", v: "4.17.15", tone: "bad" },
  { name: "Swiper", v: "8.4.7", tone: "ok" },
];
const FILES: { name: string; where: string; kb: number }[] = [
  { name: "main.4f2a.js", where: "your site", kb: 182 },
  { name: "vendor.91c3.js", where: "your site", kb: 264 },
  { name: "jquery-3.4.1.min.js", where: "code.jquery.com", kb: 87 },
];
const BAD = LIB_CHIPS.filter((l) => l.tone === "bad").length;

const POINTS: { t: string; s: string; d: string }[] = [
  { t: "Old libraries with known flaws", s: `We recognise jQuery, Bootstrap, Lodash and ${LIBS.length - 3} more, and check each version against published vulnerabilities.`, d: "M12 3 3 20h18L12 3zM12 10v4M12 17v.5" },
  { t: "Keys that should never be public", s: "Stripe, AWS, OpenAI and other secret keys left in your scripts, shown masked so the report itself is safe to share.", d: "M15 7a4 4 0 1 1-3.5 6L5 19.5V21H3v-2l6.5-6.5A4 4 0 0 1 15 7zM16 9h.01" },
  { t: "Just your URL, nothing to install", s: "We read the same files a real browser downloads. No code access, no login. Basic checks, not a full audit.", d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" },
];

export function CodeSection({ onGo }: { onGo: () => void }) {
  return (
    <section className="sec hcs-sec" id="code-security" aria-labelledby="hcs-h">
      <div className="container">
        <div className="hcs-wrap" data-r>
          <figure className="hcs-viz" aria-label={`Example code check: ${FILES.length + 1} files read, ${LIB_CHIPS.length} libraries found, ${BAD} with known flaws, and a secret key found in main.js`}>
            <div className="hcs-viz-head">
              <span className="hcs-viz-site">yourwebsite.com</span>
              <span className="hcs-viz-tag"><span aria-hidden="true">{"{ }"}</span> What we checked</span>
            </div>
            <dl className="hcs-nums">
              <div><dt>Files read</dt><dd>{FILES.length + 1}</dd></div>
              <div><dt>Libraries</dt><dd>{LIB_CHIPS.length}</dd></div>
              <div className="bad"><dt>Known flaws</dt><dd>{BAD}</dd></div>
            </dl>
            <ul className="hcs-libs" aria-hidden="true">
              {LIB_CHIPS.map((l, i) => (
                <li key={l.name} className={l.tone} style={{ ["--i" as string]: i }}>
                  <span className="hcs-dot" />
                  {l.name} <b>{l.v}</b>
                </li>
              ))}
            </ul>
            <div className="hcs-code" aria-hidden="true">
              <span className="hcs-code-file">main.4f2a.js</span>
              <code>
                <span className="k">const</span> stripe = <span className="s">&quot;sk_live_<span className="hcs-mask">••••••••••••</span>7dc&quot;</span>;
              </code>
              <span className="hcs-flag">Secret key</span>
            </div>
            <ul className="hcs-files" aria-hidden="true">
              {FILES.map((f, i) => (
                <li key={f.name} style={{ ["--i" as string]: i }}>
                  <span className="hcs-fname">{f.name}</span>
                  <span className="hcs-fmeta">{f.where} · {f.kb} KB</span>
                </li>
              ))}
              <li style={{ ["--i" as string]: FILES.length }}>
                <span className="hcs-fname">Inline scripts</span>
                <span className="hcs-fmeta">homepage HTML</span>
              </li>
            </ul>
            <figcaption className="hcs-cap">Sample report. Basic checks of what browsers receive, not a full security audit.</figcaption>
          </figure>

          <div className="hcs-copy">
            <p className="hcs-eyebrow"><span className="hcs-new">New</span>Code security</p>
            <h2 className="title" id="hcs-h">See what your JavaScript gives away.</h2>
            <p className="lead">
              Every visitor downloads your site&apos;s JavaScript, and anyone can read it. Pagelyt reads the same files a real browser
              loads and flags old libraries with known flaws, leaked keys, public source maps and missing integrity checks.
            </p>
            <ul className="hcs-points">
              {POINTS.map((p, i) => (
                <li key={p.t} style={{ ["--i" as string]: i }}>
                  <span className="hcs-pi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.d} /></svg></span>
                  <span><b>{p.t}</b><small>{p.s}</small></span>
                </li>
              ))}
            </ul>
            <div className="hcs-act">
              <button type="button" className="btn" onClick={onGo}>Check my site <span aria-hidden="true">→</span></button>
              <Link href="/features/code-security" className="hcs-more">How the code check works <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
