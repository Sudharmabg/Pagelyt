import * as cheerio from "cheerio";
import { safeFetch, type FetchResult } from "./fetcher";
import type { DomainInfo, Finding, TechItem } from "./types";

/* Network-backed checks beyond the page itself: DNS and email records, domain expiry,
   exposed files, a sampled link check, and technology detection. Every probe is
   best-effort: a failure means "unknown", never a false finding. */

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu", "ltd", "plc"]);

/** Registrable domain, using a small heuristic for country-code second levels. */
export function registrable(host: string): string {
  const p = host.replace(/^www\./, "").split(".");
  if (p.length <= 2) return p.join(".");
  const tld = p[p.length - 1];
  return SECOND_LEVEL.has(p[p.length - 2]) && tld.length === 2 ? p.slice(-3).join(".") : p.slice(-2).join(".");
}

/* DNS over HTTPS (Cloudflare). Works anywhere fetch works, including Workers. */
type DohAnswer = { type: number; data: string };
async function doh(name: string, type: "MX" | "NS" | "TXT"): Promise<string[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 3500);
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" }, signal: ctl.signal });
    if (!r.ok) return [];
    const j = (await r.json()) as { Answer?: DohAnswer[] };
    const want = { MX: 15, NS: 2, TXT: 16 }[type];
    return (j.Answer ?? []).filter((a) => a.type === want).map((a) => a.data);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

const unquote = (d: string) => (d.match(/"([^"]*)"/g) ?? [d]).map((x) => x.replace(/^"|"$/g, "")).join("");
const stripDot = (d: string) => d.replace(/\.$/, "");

async function domainExpiry(domain: string): Promise<string | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4500);
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { signal: ctl.signal, headers: { "user-agent": "PagelytBot/0.1 (+https://pagelyt.com/bot)" } });
    if (!r.ok) return null;
    const j = (await r.json()) as { events?: { eventAction: string; eventDate: string }[] };
    return j.events?.find((e) => e.eventAction === "expiration")?.eventDate ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function domainIntel(host: string): Promise<DomainInfo> {
  const domain = registrable(host);
  const [mxRaw, nsRaw, spfRows, dmarcRows, expires] = await Promise.all([
    doh(domain, "MX"),
    doh(domain, "NS"),
    doh(domain, "TXT").then((r) => r.map(unquote)),
    doh(`_dmarc.${domain}`, "TXT").then((r) => r.map(unquote)),
    domainExpiry(domain),
  ]);
  const mx = mxRaw
    .map((d) => {
      const [pr, ex] = d.split(" ");
      return { pr: Number(pr), ex: stripDot(ex ?? "") };
    })
    .filter((m) => m.ex)
    .sort((a, b) => a.pr - b.pr)
    .map((m) => m.ex);
  const ns = nsRaw.map(stripDot).filter(Boolean);
  return {
    mx,
    ns,
    spf: spfRows.find((r) => /^v=spf1/i.test(r)) ?? null,
    dmarc: dmarcRows.find((r) => /^v=DMARC1/i.test(r)) ?? null,
    expires,
  };
}

export function domainFindings(d: DomainInfo): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Finding["severity"], id: string, title: string, why: string, fix: string, evidence?: string) =>
    out.push({ id, module: "domain", severity, title, why, fix, evidence });

  if (d.expires) {
    const days = Math.floor((new Date(d.expires).getTime() - Date.now()) / 86_400_000);
    if (days < 0) add("high", "domain-expired", "Domain registration has expired", "The site can go offline and the name can be taken by someone else.", "Renew the domain with your registrar now.", d.expires.slice(0, 10));
    else if (days < 30) add("high", "domain-expiring", `Domain expires in ${days} days`, "If it lapses your website and email stop working.", "Renew now and turn on auto-renew.", d.expires.slice(0, 10));
    else if (days < 90) add("medium", "domain-expiring", `Domain expires in ${days} days`, "Renewing early avoids last-minute surprises.", "Turn on auto-renew with your registrar.", d.expires.slice(0, 10));
  }
  if (d.ns.length === 1) add("low", "single-ns", "Only one nameserver", "If it is unreachable, your whole domain is unreachable.", "Add at least two nameservers on separate networks.", d.ns[0]);

  const sendsMail = d.mx.length > 0;
  if (!sendsMail) {
    add("low", "no-mx", "No email (MX) records", "Nobody can send email to addresses at this domain.", "If you use email at this domain, add the MX records your mail provider gives you.");
  } else {
    if (!d.spf) add("medium", "no-spf", "No SPF record", "Receivers cannot tell which servers may send mail for you, so your mail is more likely to land in spam or be spoofed.", "Publish a TXT record such as v=spf1 include:<your provider> ~all.");
    else if (/\+all\b/i.test(d.spf)) add("high", "spf-open", "SPF allows anyone to send as you", "A +all rule makes the record useless: anyone can pass the check.", "End the record with ~all or -all.", d.spf);
    if (!d.dmarc) add("medium", "no-dmarc", "No DMARC policy", "Without DMARC, scammers can send mail that appears to come from your domain.", "Publish a TXT record at _dmarc.<domain>, starting with v=DMARC1; p=none; rua=mailto:you@<domain>.");
    else if (/;\s*p=none/i.test(d.dmarc) || /^v=DMARC1;\s*p=none/i.test(d.dmarc)) add("low", "dmarc-none", "DMARC is monitoring only (p=none)", "Spoofed mail is reported but not blocked.", "Once reports look clean, move to p=quarantine and then p=reject.", d.dmarc);
  }
  return out;
}

/* ---------- Exposed files ---------- */

const PROBES: { path: string; test: (b: string) => boolean; id: string; title: string }[] = [
  { path: "/.env", test: (b) => /^[A-Z][A-Z0-9_]{2,}=.+/m.test(b), id: "exposed-env", title: "Environment file (.env) is publicly readable" },
  { path: "/.git/config", test: (b) => /\[core\]/.test(b), id: "exposed-git", title: "Git repository is publicly readable (.git)" },
  { path: "/wp-config.php.bak", test: (b) => /DB_PASSWORD|DB_NAME/.test(b), id: "exposed-wpconfig", title: "WordPress config backup is publicly readable" },
  { path: "/phpinfo.php", test: (b) => /PHP Version/.test(b), id: "exposed-phpinfo", title: "phpinfo() page is publicly reachable" },
];

export async function exposedFiles(origin: string): Promise<Finding[]> {
  const hits = await Promise.all(
    PROBES.map(async (p) => {
      try {
        const r = await safeFetch(new URL(p.path, origin), { follow: false });
        return r.status === 200 && p.test(r.body.slice(0, 20_000)) ? p : null;
      } catch {
        return null;
      }
    })
  );
  return hits.filter((p): p is (typeof PROBES)[number] => !!p).map((p) => ({
    id: p.id,
    module: "security" as const,
    severity: "high" as const,
    title: p.title,
    why: "Secrets, passwords or source code may be downloadable by anyone, including automated scanners that look for exactly this.",
    fix: `Remove ${p.path} from the public web root or block it in your server config, then rotate any secrets it contained.`,
    evidence: p.path,
  }));
}

/* ---------- Link check (sampled) ---------- */

const SKIP = /^(mailto:|tel:|javascript:|#|data:)/i;

/** Pick a sample of links from the page (sync, no network). Internal links first. */
export function collectLinks(page: FetchResult): { sample: string[]; internal: number } {
  const $ = cheerio.load(page.body);
  const base = new URL(page.url);
  const seen = new Set<string>();
  const internal: URL[] = [];
  const external: URL[] = [];
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href || SKIP.test(href)) return;
    try {
      const u = new URL(href, base);
      u.hash = "";
      if (!/^https?:$/.test(u.protocol) || seen.has(u.href) || u.href === base.href) return;
      seen.add(u.href);
      (u.hostname === base.hostname ? internal : external).push(u);
    } catch {
      /* malformed href */
    }
  });
  return { sample: [...internal.slice(0, 14), ...external.slice(0, 4)].map((u) => u.href), internal: internal.length };
}

/** One subrequest per link (redirects are not followed, a 3xx counts as alive). */
export async function checkLinks(urls: string[]): Promise<{ checked: number; broken: string[] }> {
  const run = Promise.all(
    urls.map(async (href) => {
      try {
        const r = await safeFetch(new URL(href), { follow: false });
        return { href, bad: r.status === 404 || r.status === 410 || r.status >= 500 };
      } catch (e) {
        return { href, bad: !/Blocked|timed out/i.test(e instanceof Error ? e.message : "") };
      }
    })
  );
  const results = await Promise.race([run, new Promise<null>((r) => setTimeout(() => r(null), 9000))]);
  if (!results) return { checked: 0, broken: [] };
  return { checked: urls.length, broken: results.filter((r) => r.bad).map((r) => r.href) };
}

export function linkFindings(l: { checked: number; broken: string[] }): Finding[] {
  if (!l.broken.length) return [];
  const n = l.broken.length;
  return [{
    id: "broken-links",
    module: "health",
    severity: n > 2 ? "high" : "medium",
    title: `${n} broken link${n > 1 ? "s" : ""} found`,
    why: "Broken links frustrate visitors and waste search engines' time. This was a sample of the links on the page, so more may exist.",
    fix: "Update each link to a working address, or remove it.",
    evidence: l.broken.slice(0, 6).join(" · "),
  }];
}

/* ---------- Technology detection ---------- */

type Rule = { name: string; category: string; test: (c: { html: string; h: Record<string, string>; $: cheerio.CheerioAPI }) => boolean };

const has = (re: RegExp) => (c: { html: string }) => re.test(c.html);

const RULES: Rule[] = [
  { name: "WordPress", category: "CMS", test: (c) => /wp-content|wp-includes/.test(c.html) || /WordPress/i.test(c.$('meta[name="generator"]').attr("content") || "") },
  { name: "Shopify", category: "E-commerce", test: (c) => /cdn\.shopify\.com|Shopify\.theme/.test(c.html) },
  { name: "WooCommerce", category: "E-commerce", test: has(/wp-content\/plugins\/woocommerce|woocommerce-(?:page|js)/i) },
  { name: "Wix", category: "CMS", test: (c) => /wixstatic\.com|X-Wix/i.test(c.html + JSON.stringify(c.h)) },
  { name: "Squarespace", category: "CMS", test: has(/squarespace\.com|static1\.squarespace/i) },
  { name: "Webflow", category: "CMS", test: (c) => /webflow/i.test(c.$('meta[name="generator"]').attr("content") || "") || /\.webflow\.com|data-wf-page/.test(c.html) },
  { name: "Drupal", category: "CMS", test: (c) => /Drupal/i.test(c.$('meta[name="generator"]').attr("content") || "") || "x-drupal-cache" in c.h },
  { name: "Ghost", category: "CMS", test: (c) => /Ghost/i.test(c.$('meta[name="generator"]').attr("content") || "") },
  { name: "Next.js", category: "Framework", test: (c) => /__next|_next\/static/.test(c.html) || /Next\.js/i.test(c.h["x-powered-by"] || "") },
  { name: "Nuxt", category: "Framework", test: has(/__nuxt|_nuxt\//) },
  { name: "Gatsby", category: "Framework", test: has(/___gatsby/) },
  { name: "Astro", category: "Framework", test: (c) => /Astro/i.test(c.$('meta[name="generator"]').attr("content") || "") || /astro-island/.test(c.html) },
  { name: "React", category: "JavaScript", test: has(/data-reactroot|react(-dom)?(\.production)?(\.min)?\.js|__REACT/) },
  { name: "Vue", category: "JavaScript", test: has(/vue(\.runtime)?(\.min)?\.js|data-v-[0-9a-f]{6,}/) },
  { name: "Angular", category: "JavaScript", test: has(/ng-version=|ng-app/) },
  { name: "jQuery", category: "JavaScript", test: has(/jquery[.-]?[\d.]*(\.min)?\.js/i) },
  { name: "Bootstrap", category: "CSS", test: has(/bootstrap(\.min)?\.(css|js)/i) },
  { name: "Tailwind CSS", category: "CSS", test: has(/tailwind/i) },
  { name: "Cloudflare", category: "CDN", test: (c) => "cf-ray" in c.h || /cloudflare/i.test(c.h.server || "") },
  { name: "Netlify", category: "Hosting", test: (c) => /netlify/i.test(c.h.server || "") || "x-nf-request-id" in c.h },
  { name: "Vercel", category: "Hosting", test: (c) => /vercel/i.test(c.h.server || "") || "x-vercel-id" in c.h },
  { name: "AWS CloudFront", category: "CDN", test: (c) => "x-amz-cf-id" in c.h || /cloudfront/i.test(c.h.via || "") },
  { name: "Fastly", category: "CDN", test: (c) => "x-served-by" in c.h && /fastly|cache-/i.test(c.h["x-served-by"] || c.h["x-cache"] || "") },
  { name: "nginx", category: "Server", test: (c) => /nginx/i.test(c.h.server || "") },
  { name: "Apache", category: "Server", test: (c) => /apache/i.test(c.h.server || "") },
  { name: "PHP", category: "Language", test: (c) => /PHP/i.test(c.h["x-powered-by"] || "") },
  { name: "Google Analytics", category: "Analytics", test: has(/google-analytics\.com|googletagmanager\.com\/gtag|gtag\(/) },
  { name: "Google Tag Manager", category: "Tag manager", test: has(/googletagmanager\.com\/gtm\.js/) },
  { name: "Plausible", category: "Analytics", test: has(/plausible\.io\/js/) },
  { name: "Hotjar", category: "Analytics", test: has(/static\.hotjar\.com|hotjar-/) },
  { name: "Meta Pixel", category: "Advertising", test: has(/connect\.facebook\.net|fbq\(/) },
  { name: "Stripe", category: "Payments", test: has(/js\.stripe\.com/) },
  { name: "Razorpay", category: "Payments", test: has(/checkout\.razorpay\.com/) },
  { name: "HubSpot", category: "Marketing", test: has(/js\.hs-scripts\.com|hubspot\.com/) },
  { name: "Intercom", category: "Support chat", test: has(/widget\.intercom\.io/) },
];

export function detectTech(page: FetchResult): TechItem[] {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(page.headers)) h[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v || "";
  const ctx = { html: page.body, h, $: cheerio.load(page.body) };
  return RULES.filter((r) => {
    try {
      return r.test(ctx);
    } catch {
      return false;
    }
  }).map(({ name, category }) => ({ name, category }));
}
