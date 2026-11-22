import type { CodeSummary, Finding } from "@/lib/scan/types";

/** The Code security area shows "New" badges until this date (30 days from launch). */
export const CODE_NEW_UNTIL = Date.UTC(2026, 11, 22);
export const CODE_IS_NEW = Date.now() < CODE_NEW_UNTIL;
export const CodeNewPill = () => (CODE_IS_NEW ? <span className="wc-new">New</span> : null);

/** Counts for the banner chip, Overview card and Code security page: libraries from the summary, issues from the open findings
    (so ticking a fix off updates them). */
export function codeCounts(open: Finding[], code: CodeSummary | null | undefined) {
  const mine = open.filter((f) => f.module === "code");
  return {
    issues: mine.length,
    libs: code?.libraries.length ?? 0,
    flawed: mine.filter((f) => f.id === "code-vuln-lib").length,
    secrets: mine.some((f) => f.id === "code-secret"),
    files: code ? code.files.length + (code.inline ? 1 : 0) : 0,
    known: !!code,
  };
}
export type CodeCounts = ReturnType<typeof codeCounts>;

/* Top of the Code security area: what the area is, why it matters, what the scan reads, and each check with its
   result on this site (from the open findings, so ticking a fix off turns it green). */
const CHECKS: { id: string; name: string; text: string }[] = [
  { id: "code-vuln-lib", name: "Libraries with known flaws", text: "Versions of jQuery, Bootstrap, Angular and others with published security flaws." },
  { id: "code-eol-lib", name: "Unsupported libraries", text: "Versions that no longer get security fixes, so new flaws stay open." },
  { id: "code-secret", name: "Secret keys in public code", text: "API keys, tokens and passwords left in files anyone can open." },
  { id: "code-source-map", name: "Public source maps", text: "Links that turn minified code back into your original source." },
  { id: "code-no-sri", name: "CDN files without an integrity check", text: "Files from public CDNs loaded without SRI, so a changed file would still run." },
  { id: "code-dom-xss", name: "Unsafe writes to the page", text: "Code that puts web address or user text straight into the page (XSS risk)." },
  { id: "code-risky", name: "Risky code patterns", text: "eval(), new Function() and inline onclick= handlers that weaken protections." },
  { id: "code-form-http", name: "Forms sent over plain HTTP", text: "Forms, including logins, that send what people type without encryption." },
];

export function CodeAbout({ code, findings }: { code: CodeSummary | null | undefined; findings: Finding[] }) {
  const found = new Set(findings.filter((f) => f.module === "code").map((f) => f.id));
  const bad = CHECKS.filter((c) => found.has(c.id)).length;
  return (
    <section className="cs-about" aria-labelledby="cs-about-h">
      <div className="cs-about-head">
        <p className="cs-about-k">About this area</p>
        <h2 id="cs-about-h">What Code security checks</h2>
      </div>
      <div className="cs-about-grid">
        <article className="cs-about-card">
          <span className="cs-about-ic" aria-hidden="true">{"{ }"}</span>
          <h3>What it is</h3>
          <p>Every page sends JavaScript to your visitors&apos; browsers to make menus, forms and tracking work. Pagelyt opens those same files, the way a browser does, and checks what they give away.</p>
        </article>
        <article className="cs-about-card">
          <span className="cs-about-ic" aria-hidden="true">!</span>
          <h3>Why it matters</h3>
          <p>Anyone can read these files, including attackers. Old libraries with published flaws and keys left in code are easy to find, and automated bots scan the web for exactly that.</p>
        </article>
        <article className="cs-about-card">
          <span className="cs-about-ic" aria-hidden="true">&#8981;</span>
          <h3>What we read</h3>
          <p>Your homepage HTML, its inline scripts and up to 8 script files the page loaded in a real browser. We never log in, probe the server or download anything a browser wouldn&apos;t.</p>
        </article>
      </div>
      <div className="cs-checks-top">
        <h3>The {CHECKS.length} checks</h3>
        {code && <span className={`cs-checks-sum ${bad ? "bad" : "ok"}`}>{bad ? `${bad} found on this site` : "All clear on this site"}</span>}
      </div>
      <ul className="cs-checks">
        {CHECKS.map((c) => {
          const st = !code ? "na" : found.has(c.id) ? "bad" : "ok";
          return (
            <li key={c.id} className={st}>
              <span className="cs-check-dot" aria-hidden="true">{st === "bad" ? "!" : st === "ok" ? "✓" : "–"}</span>
              <span className="cs-check-tx">
                <b>{c.name}</b>
                <small>{c.text}</small>
              </span>
              <span className="cs-check-st">{st === "bad" ? "Found" : st === "ok" ? "Clear" : "Rescan"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* "What we checked" card at the top of the Code security area: which script files the scan read, which libraries it
   recognised (red: known vulnerabilities, amber: no longer supported) and an honest note on the limits. Reports from
   before the Code security checks have no summary and show a rescan hint instead. */

const name = (u: string) => {
  if (u.endsWith("(inline script)")) return "Inline scripts";
  try {
    const x = new URL(u);
    return x.pathname.split("/").filter(Boolean).pop() || x.hostname;
  } catch {
    return u;
  }
};
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export function CodeRead({ code }: { code: CodeSummary | null | undefined }) {
  if (!code) {
    return (
      <section className="cs-read" aria-label="What we checked">
        <p className="cs-read-h">What we checked</p>
        <p className="cs-read-sub">This report was made before the Code security checks existed. Rescan to check your JavaScript files.</p>
      </section>
    );
  }
  const read = code.files.length;
  const bad = code.libraries.filter((l) => l.vulnerable).length;
  return (
    <section className="cs-read" aria-label="What we checked">
      <div className="cs-read-top">
        <div>
          <p className="cs-read-h">What we checked</p>
          <p className="cs-read-sub">
            {read ? `Read ${read} of the ${code.scripts} script file${code.scripts === 1 ? "" : "s"} your homepage loaded` : code.scripts ? `Your homepage loaded ${code.scripts} script file${code.scripts === 1 ? "" : "s"}, but none could be read` : "Your homepage loaded no script files"}
            {code.inline ? ", plus its inline scripts" : ""}. {code.rendered ? "The file list comes from a real browser, so code loaded later by JavaScript is included." : "The real-browser run didn't finish, so the list comes from the page's HTML."}
          </p>
        </div>
        <ul className="cs-stats">
          <li><b>{read + (code.inline ? 1 : 0)}</b><span>files read</span></li>
          <li><b>{code.libraries.length}</b><span>{code.libraries.length === 1 ? "library" : "libraries"} found</span></li>
          {bad > 0 && <li className="bad"><b>{bad}</b><span>with known flaws</span></li>}
        </ul>
      </div>

      {code.libraries.length > 0 && (
        <ul className="cs-libs" aria-label="Libraries found">
          {code.libraries.map((l) => (
            <li key={l.name + l.version} className={l.vulnerable ? "bad" : l.eol ? "warn" : "ok"}>
              <span className="cs-dot" aria-hidden="true" />
              {l.name} <b>{l.version}</b>
              <span className="sr-only">{l.vulnerable ? ": known vulnerabilities" : l.eol ? ": no longer supported" : ": no known vulnerabilities in our list"}</span>
            </li>
          ))}
        </ul>
      )}

      {read > 0 && (
        <details className="cs-files">
          <summary>Files read</summary>
          <ul>
            {code.files.map((f) => (
              <li key={f.url}>
                <span className="cs-fname" title={f.url}>{name(f.url)}</span>
                <span className="cs-fmeta">{f.own ? "your site" : host(f.url)} · {f.kb < 1 ? "<1" : f.kb} KB</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="cs-note">
        Basic checks of the files your site sends to browsers: libraries against our list of known vulnerabilities, leaked keys, source maps,
        integrity checks and risky patterns. Server code and pages behind a login aren&apos;t checked, so a clean result is a good sign, not a
        full security audit.
      </p>
    </section>
  );
}
