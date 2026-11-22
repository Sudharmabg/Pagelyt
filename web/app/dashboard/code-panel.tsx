import type { CodeSummary, Finding } from "@/lib/scan/types";

/** The Code check star feature shows "New" badges until this date (30 days from launch). */
export const CODE_NEW_UNTIL = Date.UTC(2026, 11, 22);
export const CODE_IS_NEW = Date.now() < CODE_NEW_UNTIL;
export const CodeNewPill = () => (CODE_IS_NEW ? <span className="wc-new">New</span> : null);

/** Counts for the star card, banner chips and Overview card: libraries from the summary, issues from the open findings
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

/* Body of the ★ star card on Overview: the headline count and three tiles. */
export function CodeStarArt({ c }: { c: CodeCounts }) {
  const bad = c.flawed > 0 || c.secrets;
  return (
    <span className="cs-sx">
      <b className={`cs-sx-head ${bad ? "bad" : "ok"}`}>
        {!c.known ? "Rescan to check your code" : c.secrets ? "A secret key is public" : c.flawed ? `${c.flawed} ${c.flawed === 1 ? "library" : "libraries"} with known flaws` : "No known flaws found"}
      </b>
      <span className="cs-sx-tiles" aria-hidden="true">
        <span><b>{c.files}</b>files read</span>
        <span><b>{c.libs}</b>{c.libs === 1 ? "library" : "libraries"}</span>
        <span className={c.issues ? "f" : "p"}><b>{c.issues}</b>{c.issues === 1 ? "issue" : "issues"}</span>
      </span>
    </span>
  );
}

/* Overview "From this scan" card body. */
export function CodeCardBody({ c }: { c: CodeCounts }) {
  return (
    <span className="dc-big">
      <b>{c.issues}</b>
      <span className="dc-n">{c.issues === 1 ? "code issue" : "code issues"} · {c.files} files read</span>
    </span>
  );
}

/* Code security area: a one-line pointer to the ★ Code check page. */
export function CodeStrip({ c, onOpen }: { c: CodeCounts; onOpen: () => void }) {
  const bad = c.flawed > 0 || c.secrets;
  return (
    <button type="button" className={`wc-strip cs-strip ${bad ? "bad" : "ok"}`} onClick={onOpen}>
      <span className="cs-strip-ic" aria-hidden="true">{"{ }"}</span>
      <span className="wc-strip-txt">
        <b>{c.known ? `Read ${c.files} file${c.files === 1 ? "" : "s"}, found ${c.libs} ${c.libs === 1 ? "library" : "libraries"}` : "What we read from your site"}</b>
        <small>{bad ? "Some of it gives too much away. See what we read." : "See every file and library we checked."}</small>
      </span>
      <span className="wc-strip-go">Open Code check <span aria-hidden="true">→</span></span>
    </button>
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
