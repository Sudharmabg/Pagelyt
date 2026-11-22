import type { CheerioAPI } from "cheerio";
import type { CodeSummary, Finding, PageTable, Severity } from "./types";
import { LIBS, affected, type Lib, type LibRule } from "./code-libs";

/* Code security: basic checks of the files a site sends to every browser, so a URL is all it needs. It reads the
   homepage HTML and the JavaScript files the rendered page loaded (from the Lighthouse run), never asks the site for
   anything a browser wouldn't (no probing, no .map downloads). Pure functions; index.ts does the fetching.
   It can show real problems, but finding nothing is not proof the code is secure, and the copy never says so. */

/** Most script files read per scan, and how much of each. */
export const MAX_CODE_FILES = 8;
const MAX_OWN = 6;
export const MAX_FILE_BYTES = 1_500_000;
const MAX_INLINE = 300_000;

/** Public CDNs that serve fixed, versioned files, where Subresource Integrity is easy and expected. Scripts that change
    on purpose (analytics, tag managers, payment widgets) are left out: SRI would break them. */
const SRI_CDNS = new Set([
  "cdnjs.cloudflare.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "code.jquery.com",
  "stackpath.bootstrapcdn.com",
  "maxcdn.bootstrapcdn.com",
  "netdna.bootstrapcdn.com",
  "ajax.googleapis.com",
  "ajax.aspnetcdn.com",
  "cdn.datatables.net",
  "cdn.rawgit.com",
]);

/** What the code stage needs from the homepage HTML, gathered in the first stage. */
export type CodeInput = {
  page: string;
  csp: boolean;
  scripts: string[];
  noSri: string[];
  inline: string;
  handlers: number;
  httpForms: { action: string; password: boolean }[];
};

export type CodeFile = { url: string; body: string; mapHeader?: boolean };

const base = (h: string) => h.toLowerCase().replace(/^www\./, "");
/** Same site: the page's host or one of its subdomains (static.example.com for example.com). */
export function isOwn(url: string, page: string): boolean {
  try {
    const h = base(new URL(url).hostname);
    const p = base(new URL(page).hostname);
    return h === p || h.endsWith("." + p);
  } catch {
    return false;
  }
}

/** Gather the HTML side of the checks. `$` must be the unmodified homepage. */
export function codeInput($: CheerioAPI, pageUrl: string, headers: Record<string, string | string[] | undefined>): CodeInput {
  const page = new URL(pageUrl);
  const hdr = Object.entries(headers).find(([k]) => k.toLowerCase() === "content-security-policy")?.[1];
  const csp = !!(Array.isArray(hdr) ? hdr.join("") : hdr)?.trim() || $('meta[http-equiv="Content-Security-Policy" i]').length > 0;
  const abs = (v: string | undefined) => {
    if (!v) return null;
    try {
      const u = new URL(v, page);
      return /^https?:$/.test(u.protocol) ? u : null;
    } catch {
      return null;
    }
  };
  const scripts: string[] = [];
  const noSri: string[] = [];
  let inline = "";
  $("script").each((_, el) => {
    const s = $(el);
    const src = s.attr("src");
    if (src) {
      const u = abs(src);
      if (!u) return;
      if (!scripts.includes(u.href)) scripts.push(u.href);
      if (SRI_CDNS.has(u.hostname) && !s.attr("integrity")) noSri.push(u.href);
      return;
    }
    const type = (s.attr("type") ?? "").toLowerCase();
    if (type && !/javascript|module|^text\/babel$/.test(type)) return; // JSON-LD, templates and the like
    if (inline.length < MAX_INLINE) inline += s.text().slice(0, MAX_INLINE - inline.length) + "\n";
  });
  $('link[rel~="stylesheet" i][href]').each((_, el) => {
    const u = abs($(el).attr("href"));
    if (u && SRI_CDNS.has(u.hostname) && !$(el).attr("integrity")) noSri.push(u.href);
  });
  let handlers = 0;
  $("*").each((_, el) => {
    const attribs = (el as { attribs?: Record<string, string> }).attribs;
    if (attribs && Object.keys(attribs).some((a) => /^on[a-z]+$/i.test(a))) handlers++;
  });
  const httpForms: CodeInput["httpForms"] = [];
  if (page.protocol === "https:") {
    $("form[action]").each((_, el) => {
      const u = abs($(el).attr("action"));
      if (u?.protocol === "http:") httpForms.push({ action: u.href, password: $(el).find('input[type="password" i]').length > 0 });
    });
  }
  return { page: page.href, csp, scripts: scripts.slice(0, 60), noSri: [...new Set(noSri)], inline, handlers, httpForms };
}

/* ---- libraries ---- */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const VER = String.raw`(\d+\.\d+\.\d+)`;
const URL_RX = new Map<Lib, RegExp[]>(
  LIBS.map((l) => [
    l,
    [
      ...l.files.flatMap((f) => [
        // /npm/jquery@3.4.1/…, /ajax/libs/jquery/3.4.1/…, /lodash.js/4.17.15/…
        new RegExp(String.raw`(?:^|[/@])${esc(f)}(?:\.js)?[@/]v?${VER}(?=[/?#-]|$)`, "i"),
        // jquery-3.4.1.min.js, bootstrap.4.3.1.js
        new RegExp(String.raw`/${esc(f)}[-.]v?${VER}(?:[.-](?:slim|min|bundle|umd|esm|full|pack))*\.js(?:[?#]|$)`, "i"),
      ]),
      ...(l.url ?? []),
    ],
  ])
);

export type FoundLib = { lib: Lib; version: string; where: string };

/** Libraries named with a version in a script's URL. */
export function libsFromUrl(url: string): FoundLib[] {
  let path: string;
  try {
    const u = new URL(url);
    path = u.pathname + u.search;
  } catch {
    return [];
  }
  const out: FoundLib[] = [];
  for (const lib of LIBS) {
    // Name patterns look at the path only; a library's own extra patterns may name the host (code.jquery.com/ui/…).
    for (const rx of URL_RX.get(lib)!) {
      const m = rx.exec(lib.url?.includes(rx) ? url : path);
      if (m) {
        out.push({ lib, version: m[1], where: url });
        break;
      }
    }
  }
  return out;
}

/** Libraries whose version banner (or bundled version marker) is inside a file. */
export function libsFromBody(body: string, where: string): FoundLib[] {
  const out: FoundLib[] = [];
  for (const lib of LIBS) {
    for (const rx of lib.body) {
      const m = rx.exec(body);
      if (m) {
        out.push({ lib, version: m[1], where });
        break;
      }
    }
  }
  return out;
}

/* ---- secrets ---- */

type SecretRule = { kind: string; rx: RegExp; severity: Severity; check?: (m: string) => boolean };

/** Only formats that are secret by design. Public browser keys (Stripe pk_, Google/Firebase AIza…, Supabase anon) are
    meant to be in the page and are not reported. */
const SECRETS: SecretRule[] = [
  { kind: "Private key", rx: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g, severity: "high" },
  { kind: "Stripe secret key", rx: /\b(?:sk|rk)_live_[0-9a-zA-Z]{20,}\b/g, severity: "high" },
  { kind: "AWS access key ID", rx: /\bAKIA[0-9A-Z]{16}\b/g, severity: "medium" },
  { kind: "GitHub token", rx: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g, severity: "high" },
  { kind: "Slack token", rx: /\bxox[baprs]-[0-9A-Za-z-]{20,}/g, severity: "high" },
  { kind: "Slack webhook", rx: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,}/g, severity: "medium" },
  { kind: "Discord webhook", rx: /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]{60,}/g, severity: "medium" },
  { kind: "OpenAI API key", rx: /\bsk-(?:proj-[A-Za-z0-9_-]{40,}|[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20})/g, severity: "high" },
  { kind: "Anthropic API key", rx: /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{60,}/g, severity: "high" },
  { kind: "SendGrid API key", rx: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, severity: "high" },
  { kind: "Mailchimp API key", rx: /\b[0-9a-f]{32}-us\d{1,2}\b/g, severity: "medium" },
  { kind: "Shopify access token", rx: /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/g, severity: "high" },
  { kind: "Telegram bot token", rx: /\b\d{8,10}:AA[0-9A-Za-z_-]{33}\b/g, severity: "medium" },
  { kind: "Supabase service role key", rx: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, severity: "high", check: (m) => jwtRole(m) === "service_role" },
];

function jwtRole(jwt: string): string | null {
  try {
    const p = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const j = JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4))) as { role?: unknown };
    return typeof j.role === "string" ? j.role : null;
  } catch {
    return null;
  }
}

const PLACEHOLDER = /x{5,}|example|your[_-]?(?:key|token|secret)|placeholder|dummy/i;

/** Show only the start of a secret: enough to recognise it, not enough to use it. */
export function mask(s: string): string {
  if (s.startsWith("-----BEGIN")) return s;
  if (s.startsWith("https://")) return s.replace(/(\/[^/]{4})[^/]*$/, "$1…");
  return s.slice(0, Math.min(10, Math.max(4, Math.floor(s.length / 4)))) + "…";
}

export type FoundSecret = { kind: string; masked: string; severity: Severity; where: string };

export function findSecrets(body: string, where: string): FoundSecret[] {
  const out: FoundSecret[] = [];
  const seen = new Set<string>();
  for (const r of SECRETS) {
    r.rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = r.rx.exec(body)) && n++ < 20) {
      const v = m[0];
      if (seen.has(v) || PLACEHOLDER.test(v) || (r.check && !r.check(v))) continue;
      seen.add(v);
      out.push({ kind: r.kind, masked: mask(v), severity: r.severity, where });
    }
  }
  return out;
}

/* ---- risky code and source maps ---- */

const EVAL = /(?<![\w$.])eval\s*\(/;
const DOC_WRITE = /\bdocument\.write(?:ln)?\s*\(/;
const DOM_XSS = /(?:\.(?:inner|outer)HTML\s*\+?=|\.insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\()[^;\n]{0,120}?\blocation\.(?:hash|search|href)\b/;

export function riskyIn(body: string): { eval: boolean; write: boolean; domXss: boolean } {
  return { eval: EVAL.test(body), write: DOC_WRITE.test(body), domXss: DOM_XSS.test(body) };
}

/** A `sourceMappingURL` comment at the end of the file: "file" (a .map next to it) or "inline" (the original code is
    inside the file itself). We never download the map. */
export function sourceMapOf(body: string): "file" | "inline" | null {
  const m = /[#@]\s*sourceMappingURL=([^\s'"]+)\s*(?:\*\/)?\s*$/.exec(body.slice(-600));
  if (!m) return null;
  return m[1].startsWith("data:") ? "inline" : "file";
}

/* ---- picking files ---- */

const APP_FIRST = /\b(main|index|app|bundle|_app|pages|chunk)\b/i;

/** Which script files to read: the site's own first (app entry first), then CDN or library files whose URL didn't
    already give away their version. `rendered` is what the real browser loaded (Lighthouse); the HTML list fills in
    when Lighthouse didn't run. */
export function pickScripts(input: CodeInput, rendered: string[]): string[] {
  const all = [...new Set([...rendered, ...input.scripts])].filter((u) => /^https?:/i.test(u));
  const own = all.filter((u) => isOwn(u, input.page)).sort((a, b) => Number(APP_FIRST.test(b)) - Number(APP_FIRST.test(a)));
  const libName = new RegExp(String.raw`/(?:${LIBS.flatMap((l) => l.files).map(esc).join("|")})(?:[./-][^/]*)?\.js(?:[?#]|$)`, "i");
  const other = all.filter((u) => {
    if (isOwn(u, input.page) || libsFromUrl(u).length) return false;
    try {
      return SRI_CDNS.has(new URL(u).hostname) || libName.test(new URL(u).pathname);
    } catch {
      return false;
    }
  });
  const pick = own.slice(0, MAX_OWN);
  return [...pick, ...other].slice(0, MAX_CODE_FILES);
}

/* ---- findings ---- */

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const worst = (list: Severity[]): Severity => list.reduce<Severity>((a, b) => (RANK[b] < RANK[a] ? b : a), "low");
const short = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname.split("/").filter(Boolean).pop() || x.hostname;
  } catch {
    return u;
  }
};
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const table = (cols: string[], rows: { url: string; cells: string[] }[]): PageTable | undefined => (rows.length ? { cols, rows } : undefined);

/**
 * All Code security findings, plus the summary the dashboard shows ("what we read"). `seen` is every script URL the
 * page loaded (rendered and HTML), `files` the ones we read, `rendered` whether the browser's list was available.
 */
export function codeFindings(input: CodeInput, seen: string[], files: CodeFile[], rendered: boolean): { findings: Finding[]; summary: CodeSummary } {
  const out: Finding[] = [];
  const add = (severity: Severity, id: string, title: string, why: string, fix: string, evidence?: string, pages?: PageTable) =>
    out.push({ id, module: "code", severity, title, why, fix, evidence, pages });
  const inlineWhere = `${input.page} (inline script)`;
  // Labels for evidence ("inline scripts", "homepage HTML", a file name) and the page each table row links to.
  const label = (u: string) => (u === inlineWhere ? "inline scripts" : u === input.page ? "homepage HTML" : short(u));
  const link = (u: string) => (u === inlineWhere ? input.page : u);
  const ownFiles = files.filter((f) => isOwn(f.url, input.page));
  const sources: CodeFile[] = input.inline.trim() ? [...files, { url: inlineWhere, body: input.inline }] : files;

  // Libraries: from every URL the page loaded, then from the banners inside the files we read.
  const found: FoundLib[] = [...[...new Set([...seen, ...input.scripts])].flatMap(libsFromUrl), ...sources.flatMap((f) => libsFromBody(f.body, f.url))];
  const libs = new Map<string, FoundLib>();
  for (const f of found) {
    const key = `${f.lib.name}@${f.version}`;
    if (!libs.has(key)) libs.set(key, f);
  }
  const libSummary: CodeSummary["libraries"] = [];
  for (const f of libs.values()) {
    const hits: LibRule[] = affected(f.lib, f.version);
    const eol = !!f.lib.eol && f.version.split(".")[0] === f.lib.eol.major;
    libSummary.push({ name: f.lib.name, version: f.version, vulnerable: hits.length > 0, eol });
    if (hits.length) {
      const cves = [...new Set(hits.map((h) => h.cve))];
      const risks = hits.map((h) => `${h.risk} (${h.cve})`);
      add(
        worst(hits.map((h) => h.severity)),
        "code-vuln-lib",
        `${f.lib.name} ${f.version} has known vulnerabilities (${cves.slice(-1)[0]}${cves.length > 1 ? ` and ${cves.length - 1} more` : ""})`,
        `This version of ${f.lib.name} has publicly listed security flaws: ${[...new Set(risks)].join("; ")}. Attackers scan the web for old library versions because the exploits are already written.`,
        `Upgrade ${f.lib.name} to ${f.lib.fixed} or later${eol ? ` (${f.lib.eol!.note}, so plan a move to a supported version)` : ""}, then test the pages that use it. If a plugin or theme bundles it, update that plugin or theme.`,
        f.where
      );
    } else if (eol) {
      add(
        "low",
        "code-eol-lib",
        `${f.lib.name} ${f.version} no longer gets security fixes`,
        `${f.lib.eol!.note}. New flaws found from now on will not be fixed in this version.`,
        `Plan an upgrade to a supported version of ${f.lib.name} (${f.lib.fixed} or later), or replace it.`,
        f.where
      );
    }
  }

  // Secrets: only in the site's own files and inline scripts (a third party's file is theirs to fix).
  const secrets = [...ownFiles, ...(input.inline.trim() ? [{ url: inlineWhere, body: input.inline }] : [])].flatMap((f) => findSecrets(f.body, f.url));
  if (secrets.length) {
    const kinds = [...new Set(secrets.map((s) => s.kind))];
    add(
      worst(secrets.map((s) => s.severity)),
      "code-secret",
      secrets.length === 1 ? `${secrets[0].kind} found in your JavaScript` : `${secrets.length} secret keys found in your JavaScript (${kinds.slice(0, 2).join(", ")}${kinds.length > 2 ? "…" : ""})`,
      "Anyone can open your JavaScript files in a browser, so a secret key in them is a public key. It can be used to read data, send email or run up charges in your name.",
      "Revoke the key in that service's dashboard now and create a new one. Then move the call that needs it to your server (or a serverless function) so the key never reaches the browser.",
      secrets.slice(0, 3).map((s) => `${s.kind}: ${s.masked} in ${label(s.where)}`).join(" · "),
      table(["Key", "Starts with", "Where"], secrets.map((s) => ({ url: link(s.where), cells: [s.kind, s.masked, label(s.where)] })))
    );
  }

  // Source maps on the site's own files.
  const maps = ownFiles.map((f) => ({ f, kind: f.mapHeader ? ("file" as const) : sourceMapOf(f.body) })).filter((m) => m.kind);
  if (maps.length) {
    const inline = maps.some((m) => m.kind === "inline");
    add(
      "low",
      "code-source-map",
      `${plural(maps.length, "script")} ${maps.length === 1 ? "points" : "point"} to a source map`,
      `Source maps turn your minified JavaScript back into the original code, comments and file names. If the map is public, anyone can read how your app works and look for weak spots.${inline ? " Some files carry the map inside them, so the original code is already public." : ""} We didn't download the maps; a .map file that isn't public is fine.`,
      "Turn off public source maps in your production build, or upload them only to your error tracker (Sentry and similar tools accept private uploads).",
      maps.slice(0, 4).map((m) => short(m.f.url)).join(" · "),
      table(["Map"], maps.map((m) => ({ url: m.f.url, cells: [m.kind === "inline" ? "Inside the file" : "Separate .map file"] })))
    );
  }

  // CDN files without Subresource Integrity.
  if (input.noSri.length) {
    add(
      "low",
      "code-no-sri",
      `${plural(input.noSri.length, "CDN file")} load${input.noSri.length === 1 ? "s" : ""} without an integrity check (SRI)`,
      "If the CDN is ever compromised or the file is swapped, every visitor runs the changed code. An integrity hash makes the browser refuse a file that doesn't match.",
      'Add integrity="sha384-…" and crossorigin="anonymous" to these tags. CDNs such as cdnjs and jsDelivr show the tag with the hash ready to copy.',
      input.noSri.slice(0, 4).map(short).join(" · "),
      table(["File"], input.noSri.map((u) => ({ url: u, cells: [short(u)] })))
    );
  }

  // Risky code, only when nothing (no Content-Security-Policy) limits what injected code can do.
  if (!input.csp) {
    const own = [...ownFiles, ...(input.inline.trim() ? [{ url: inlineWhere, body: input.inline }] : [])].map((f) => ({ f, r: riskyIn(f.body) }));
    const xss = own.filter((x) => x.r.domXss);
    if (xss.length) {
      add(
        "medium",
        "code-dom-xss",
        "Page address written into the page as HTML (possible DOM XSS)",
        "Code that puts part of the address bar (location.hash, search or href) into innerHTML or document.write can run a script an attacker hides in a link. There's no Content-Security-Policy to stop it.",
        "Use textContent instead of innerHTML for values from the URL, or clean them with a sanitiser such as DOMPurify. Adding a Content-Security-Policy limits the damage.",
        xss.slice(0, 4).map((x) => label(x.f.url)).join(" · "),
        table(["Where"], xss.map((x) => ({ url: link(x.f.url), cells: [label(x.f.url)] })))
      );
    }
    const rows: { url: string; cells: string[] }[] = [];
    for (const x of own) {
      const what = [x.r.eval && "eval()", x.r.write && "document.write()"].filter(Boolean) as string[];
      if (what.length) rows.push({ url: link(x.f.url), cells: [what.join(", "), label(x.f.url)] });
    }
    if (input.handlers) rows.push({ url: input.page, cells: [`${plural(input.handlers, "inline event handler")} (onclick= and similar)`, "homepage HTML"] });
    if (rows.length) {
      add(
        "low",
        "code-risky",
        "Risky JavaScript patterns and no Content-Security-Policy",
        "eval(), document.write() and inline onclick= handlers make injected code easier to run and stop you adding a strict Content-Security-Policy, the main browser defence against cross-site scripting.",
        "Replace eval() with JSON.parse or plain functions, document.write() with DOM methods, and onclick= attributes with addEventListener. Then add a Content-Security-Policy.",
        rows.slice(0, 3).map((r) => `${r.cells[0]} in ${r.cells[1]}`).join(" · "),
        table(["Found", "Where"], rows)
      );
    }
  }

  // Forms on an HTTPS page that send to plain HTTP.
  if (input.httpForms.length) {
    const pw = input.httpForms.some((f) => f.password);
    add(
      pw ? "high" : "medium",
      "code-form-http",
      pw ? "Login form sends the password over plain HTTP" : `${plural(input.httpForms.length, "form")} send${input.httpForms.length === 1 ? "s" : ""} data over plain HTTP`,
      "The page itself is secure, but the form posts to an http:// address, so what visitors type travels unencrypted and anyone on the same network can read it. Browsers also warn visitors before sending.",
      "Change the form's action to https:// (or a relative path such as /contact) and make sure that address works over HTTPS.",
      input.httpForms.slice(0, 3).map((f) => f.action).join(" · ")
    );
  }

  const summary: CodeSummary = {
    rendered,
    scripts: new Set([...seen, ...input.scripts]).size,
    inline: input.inline.trim().length > 0,
    files: files.map((f) => ({ url: f.url, kb: Math.round(f.body.length / 1024), own: isOwn(f.url, input.page) })),
    libraries: libSummary.sort((a, b) => Number(b.vulnerable) - Number(a.vulnerable) || a.name.localeCompare(b.name)),
  };
  return { findings: out, summary };
}
