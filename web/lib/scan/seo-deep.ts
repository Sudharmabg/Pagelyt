import type { CheerioAPI } from "cheerio";
import type { CrawlPage, Finding, ModuleKey, PageTable, Severity } from "./types";

/* Deeper technical SEO: structured-data field validation, hreflang and pagination.
   Page-level checks run on the homepage (runChecks) and per crawled page (inspect), and the
   cross-page checks (hreflang return links, paginated canonicals) run once the crawl is done. */

type Add = (module: ModuleKey, severity: Severity, id: string, title: string, why: string, fix: string, evidence?: string) => void;
type Node = Record<string, unknown>;

/* ---------------- Structured data ---------------- */

/** Every typed node in the page's JSON-LD, with @graph and nested arrays flattened. Invalid JSON is skipped. */
export function ldNodes($: CheerioAPI): Node[] {
  const out: Node[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 4 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth));
    const n = v as Node;
    if (n["@type"]) out.push(n);
    if (Array.isArray(n["@graph"])) walk(n["@graph"], depth + 1);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      walk(JSON.parse($(el).text()), 0);
    } catch {
      /* reported separately as bad-json-ld */
    }
  });
  return out.slice(0, 40);
}

const types = (n: Node): string[] => (Array.isArray(n["@type"]) ? (n["@type"] as unknown[]) : [n["@type"]]).map(String);
const has = (n: unknown, key: string): boolean => {
  if (!n || typeof n !== "object") return false;
  const v = (Array.isArray(n) ? n[0] : n as Node)?.[key as never] as unknown;
  return v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
};
const get = (n: Node, key: string): unknown => {
  const v = n[key];
  return Array.isArray(v) ? v[0] : v;
};

const LOCAL = /^(LocalBusiness|Restaurant|CafeOrCoffeeShop|Bakery|BarOrPub|Store|.*Store|Dentist|Physician|MedicalClinic|Hospital|Pharmacy|LegalService|Attorney|AccountingService|FinancialService|RealEstateAgent|HomeAndConstructionBusiness|Plumber|Electrician|HVACBusiness|RoofingContractor|GeneralContractor|AutoRepair|AutoDealer|BeautySalon|HairSalon|DaySpa|HealthClub|ExerciseGym|Hotel|LodgingBusiness|TravelAgency|ProfessionalService|ChildCare|Library|VeterinaryCare)$/;
const ARTICLE = /^(Article|NewsArticle|BlogPosting|TechArticle|Report)$/;

type Rule = { label: string; required: [string, (n: Node) => boolean][]; recommended: [string, (n: Node) => boolean][] };

function ruleFor(t: string): Rule | null {
  const f = (k: string) => [k, (n: Node) => has(n, k)] as [string, (n: Node) => boolean];
  if (t === "Product")
    return {
      label: "Product",
      required: [f("name"), ["offers, review or aggregateRating", (n) => has(n, "offers") || has(n, "review") || has(n, "aggregateRating")]],
      recommended: [f("image"), f("description"), ["offers.price", (n) => !has(n, "offers") || has(get(n, "offers"), "price") || has(get(n, "offers"), "lowPrice")], ["offers.priceCurrency", (n) => !has(n, "offers") || has(get(n, "offers"), "priceCurrency")], ["offers.availability", (n) => !has(n, "offers") || has(get(n, "offers"), "availability")], ["brand", (n) => has(n, "brand")], ["sku or gtin", (n) => has(n, "sku") || has(n, "gtin") || has(n, "gtin13") || has(n, "mpn")]],
    };
  if (ARTICLE.test(t)) return { label: t, required: [f("headline")], recommended: [f("image"), f("datePublished"), f("dateModified"), ["author.name", (n) => has(get(n, "author"), "name")], f("publisher")] };
  if (LOCAL.test(t))
    return {
      label: t,
      required: [f("name"), f("address")],
      recommended: [f("telephone"), ["address.streetAddress", (n) => !has(n, "address") || typeof get(n, "address") === "string" || has(get(n, "address"), "streetAddress")], ["address.postalCode", (n) => !has(n, "address") || typeof get(n, "address") === "string" || has(get(n, "address"), "postalCode")], f("openingHoursSpecification"), f("geo"), f("url"), f("image"), f("priceRange")],
    };
  if (t === "Organization" || t === "Corporation") return { label: t, required: [f("name")], recommended: [f("url"), f("logo"), f("sameAs"), f("contactPoint")] };
  if (t === "FAQPage") return { label: "FAQPage", required: [["mainEntity with Question and acceptedAnswer", (n) => has(n, "mainEntity") && has(get(n, "mainEntity"), "acceptedAnswer")]], recommended: [] };
  if (t === "BreadcrumbList") return { label: "BreadcrumbList", required: [f("itemListElement")], recommended: [] };
  if (t === "Event") return { label: "Event", required: [f("name"), f("startDate"), f("location")], recommended: [f("endDate"), f("image"), f("offers"), f("eventStatus")] };
  if (t === "Recipe") return { label: "Recipe", required: [f("name"), f("image")], recommended: [f("recipeIngredient"), f("recipeInstructions"), f("author"), f("totalTime")] };
  return null;
}

export type SchemaIssue = { label: string; level: "required" | "recommended"; missing: string[] };

export function schemaIssues(nodes: Node[]): SchemaIssue[] {
  const out: SchemaIssue[] = [];
  for (const n of nodes) {
    for (const t of types(n)) {
      const r = ruleFor(t);
      if (!r) continue;
      const name = typeof n.name === "string" ? ` “${n.name.slice(0, 40)}”` : typeof n.headline === "string" ? ` “${n.headline.slice(0, 40)}”` : "";
      const req = r.required.filter(([, ok]) => !ok(n)).map(([k]) => k);
      const rec = r.recommended.filter(([, ok]) => !ok(n)).map(([k]) => k);
      if (req.length) out.push({ label: r.label + name, level: "required", missing: req });
      if (rec.length) out.push({ label: r.label + name, level: "recommended", missing: rec });
      break; // one rule per node
    }
  }
  return out;
}

const issueText = (i: SchemaIssue) => `${i.label}: ${i.missing.join(", ")}`;
/** Compact form stored per crawled page (required problems only). */
export const pageSchemaProblems = ($: CheerioAPI): string[] => schemaIssues(ldNodes($)).filter((i) => i.level === "required").map(issueText).slice(0, 4);

/* ---------------- hreflang ---------------- */

const LANG_SHAPE = /^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i;
// Country codes often used by mistake as languages (jp → ja, cn → zh …), and non-ISO regions (UK → GB).
const NOT_LANG = new Set(["jp", "cn", "kr", "gr", "dk", "se", "cz", "ua", "vn", "il", "br", "mx", "us", "gb", "uk"]);
const NOT_REGION = new Set(["uk", "en", "eu", "la"]);
const validLang = (code: string) => {
  if (code.length > 20 || !LANG_SHAPE.test(code)) return false; // bounded regex, short input only
  if (code.toLowerCase() === "x-default") return true;
  const parts = code.toLowerCase().split("-");
  return !NOT_LANG.has(parts[0]) && !(parts.length > 1 && NOT_REGION.has(parts[parts.length - 1]));
};

export type Alt = { lang: string; href: string };

export function hreflangs($: CheerioAPI, base: string): { alts: Alt[]; relative: string[] } {
  const alts: Alt[] = [];
  const relative: string[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = ($(el).attr("hreflang") || "").trim();
    const raw = ($(el).attr("href") || "").trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) relative.push(raw);
    try {
      alts.push({ lang, href: new URL(raw, base).href });
    } catch {
      /* malformed */
    }
  });
  return { alts: alts.slice(0, 60), relative };
}

const norm = (u: string) => u.replace(/#.*$/, "").replace(/\/$/, "");

export function hreflangChecks($: CheerioAPI, pageUrl: string, add: Add) {
  const { alts, relative } = hreflangs($, pageUrl);
  if (!alts.length) return;
  const bad = [...new Set(alts.map((a) => a.lang).filter((l) => !validLang(l)))];
  if (bad.length) add("seo", "medium", "hreflang-invalid", `${bad.length} invalid hreflang code${bad.length > 1 ? "s" : ""}`, "Search engines ignore hreflang values they do not recognise, so visitors may get the wrong language version.", "Use ISO 639-1 language codes, optionally with an ISO 3166-1 region (en, en-GB, pt-BR), or x-default. Note it is en-GB, not en-UK.", bad.slice(0, 6).join(", "));
  if (!alts.some((a) => norm(a.href) === norm(pageUrl))) add("seo", "medium", "hreflang-no-self", "hreflang set does not include this page itself", "Each language version must list itself as well as the others; otherwise Google may ignore the whole set.", `Add <link rel="alternate" hreflang="<this page's language>" href="${pageUrl}">.`);
  const byLang = new Map<string, Set<string>>();
  for (const a of alts) byLang.set(a.lang.toLowerCase(), (byLang.get(a.lang.toLowerCase()) ?? new Set()).add(norm(a.href)));
  const clash = [...byLang].filter(([, s]) => s.size > 1).map(([l]) => l);
  if (clash.length) add("seo", "medium", "hreflang-conflict", `hreflang code${clash.length > 1 ? "s" : ""} point to more than one URL`, "When one language code points to two pages, search engines cannot tell which to show.", "Keep exactly one URL per hreflang value.", clash.join(", "));
  if (alts.length >= 2 && !byLang.has("x-default")) add("seo", "low", "hreflang-no-default", "No x-default hreflang", "x-default tells search engines which page to show visitors whose language you do not have a version for.", 'Add <link rel="alternate" hreflang="x-default" href="..."> pointing to your language picker or main version.');
  if (relative.length) add("seo", "medium", "hreflang-relative", "hreflang links use relative URLs", "Google requires fully qualified URLs (with https:// and the domain) in hreflang.", "Write every hreflang href as a full absolute URL.", relative.slice(0, 4).join(" · "));
}

/* ---------------- Pagination ---------------- */

export const PAGED = /(\/page\/\d+\/?$)|([?&](page|p|pg|paged)=\d+)/i;
const PAGE_N = /(\/page\/(\d+)\/?$)|([?&](?:page|p|pg|paged)=(\d+))/i;
const pageNum = (u: string) => {
  const m = u.match(PAGE_N);
  return m ? Number(m[2] ?? m[4]) : null;
};

export function paginationChecks($: CheerioAPI, pageUrl: string, add: Add) {
  const bad: string[] = [];
  for (const rel of ["next", "prev"]) {
    const href = $(`link[rel="${rel}"]`).attr("href");
    if (href == null) continue;
    try {
      const u = new URL(href, pageUrl);
      if (norm(u.href) === norm(pageUrl)) bad.push(`rel=${rel} points to the page itself`);
    } catch {
      bad.push(`rel=${rel} is not a valid URL`);
    }
  }
  if (bad.length) add("seo", "low", "pagination-links", "Pagination links are broken", "rel=next and rel=prev should point to the neighbouring pages in a series.", "Point rel=next and rel=prev to the actual next and previous pages, or remove them.", bad.join(" · "));
}

/* ---------------- Cross-page (after the crawl) ---------------- */

const ex = (list: string[], n = 5) => list.slice(0, n).join(" · ") + (list.length > n ? ` · +${list.length - n} more` : "");
const path = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search || "/";
  } catch {
    return u;
  }
};

export function crawlDeepFindings(pages: CrawlPage[]): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Severity, id: string, title: string, why: string, fix: string, evidence?: string, pages?: PageTable) => out.push({ id, module: "seo", severity, title, why, fix, evidence, ...(pages ? { pages } : {}) });
  const ok = pages.filter((p) => p.status >= 200 && p.status < 300);
  const byUrl = new Map(pages.map((p) => [norm(p.url), p]));

  // hreflang return links: if A lists B, B must list A. Only judged where both pages were crawled.
  const missing: string[] = [];
  const broken: string[] = [];
  const missingRows = new Map<string, { url: string; cells: string[] }>();
  const brokenRows = new Map<string, { url: string; cells: string[] }>();
  for (const a of ok) {
    for (const alt of a.alts ?? []) {
      if (norm(alt.href) === norm(a.url)) continue;
      const b = byUrl.get(norm(alt.href));
      if (!b) continue;
      if (b.status === 0 || b.status >= 400) {
        broken.push(`${path(a.url)} → ${path(b.url)} (${b.status || "no response"})`);
        brokenRows.set(`${a.url} ${b.url}`, { url: a.url, cells: [path(b.url), b.status ? String(b.status) : "No response"] });
      } else if (b.alts && !b.alts.some((x) => norm(x.href) === norm(a.url))) {
        missing.push(`${path(b.url)} does not link back to ${path(a.url)}`);
        missingRows.set(`${b.url} ${a.url}`, { url: b.url, cells: [path(a.url)] });
      }
    }
  }
  if (missing.length) add("medium", "hreflang-no-return", `${missing.length} hreflang link${missing.length > 1 ? "s have" : " has"} no return link`, "hreflang only works when every language version links to every other one. Without the return link Google ignores the pair.", "Make each page in a language set list all the others, including itself.", ex([...new Set(missing)]), { cols: ["Should link back to"], rows: [...missingRows.values()] });
  if (broken.length) add("medium", "hreflang-broken", `${broken.length} hreflang link${broken.length > 1 ? "s point" : " points"} to broken pages`, "Search engines drop hreflang annotations that lead to errors.", "Point hreflang links only at pages that load (status 200).", ex([...new Set(broken)]), { cols: ["Links to", "Status"], rows: [...brokenRows.values()] });

  // Paginated pages that canonicalise to page 1 hide pages 2+ from search.
  const toFirst = ok.filter((p) => (pageNum(p.url) ?? 0) > 1 && p.canonicalUrl && norm(p.canonicalUrl) !== norm(p.url) && !PAGED.test(p.canonicalUrl));
  if (toFirst.length) add("low", "pagination-canonical", `${toFirst.length} paginated page${toFirst.length > 1 ? "s" : ""} point their canonical to page 1`, "A canonical to the first page tells search engines that pages 2, 3 and on are duplicates, so products or posts listed only there may never be indexed.", "Give each paginated page a self-referencing canonical (page 2 canonicalises to page 2).", ex(toFirst.map((p) => `${path(p.url)} → ${path(p.canonicalUrl!)}`)), { cols: ["Canonical"], rows: toFirst.map((p) => ({ url: p.url, cells: [path(p.canonicalUrl!)] })) });

  // Structured data problems across crawled pages (the homepage is reported on its own).
  const withLd = ok.slice(1).filter((p) => p.ld && p.ld.length);
  if (withLd.length) add(withLd.length > 3 ? "medium" : "low", "crawl-schema-incomplete", `${withLd.length} page${withLd.length > 1 ? "s have" : " has"} structured data missing required fields`, "Search engines only show rich results (prices, stars, event dates, FAQs) when the required fields are present.", "Fill in the missing fields listed below, then test a page in Google's Rich Results Test.", ex(withLd.map((p) => `${path(p.url)}: ${p.ld![0]}`), 4), { cols: ["Missing fields"], rows: withLd.map((p) => ({ url: p.url, cells: [p.ld!.join("; ")] })) });
  return out;
}

/** Homepage structured-data findings, grouped into one required and one recommended finding. */
export function schemaFindings($: CheerioAPI, add: Add) {
  const issues = schemaIssues(ldNodes($));
  const req = issues.filter((i) => i.level === "required");
  const rec = issues.filter((i) => i.level === "recommended");
  if (req.length) add("seo", "medium", "schema-required", `Structured data is missing required fields (${req.map((i) => i.label.split(" ")[0]).filter((v, i, a) => a.indexOf(v) === i).join(", ")})`, "Without the required fields, search engines will not show rich results such as prices, ratings or business details for this page.", "Add the missing fields to your JSON-LD, then check it with Google's Rich Results Test.", req.map(issueText).slice(0, 4).join(" · "));
  if (rec.length) add("geo", "low", "schema-recommended", "Structured data could be more complete", "Recommended fields (images, dates, phone numbers, prices) make rich results more likely and give AI assistants facts they can quote.", "Add the recommended fields listed in the evidence where they apply.", rec.map(issueText).slice(0, 4).join(" · "));
}
