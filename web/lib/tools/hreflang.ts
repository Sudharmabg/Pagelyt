import * as cheerio from "cheerio";
import { safeFetch } from "../scan/fetcher";
import { hreflangChecks, hreflangs } from "../scan/seo-deep";

/* hreflang tester: reads a page's language alternates, checks the codes, then opens each alternate to confirm it
   loads, links back (hreflang must be two-way) and is not canonicalised somewhere else. */

export type HreflangAlt = {
  lang: string;
  href: string;
  /** HTTP status of the alternate (after redirects are NOT followed: a redirect is itself a problem). */
  status: number | null;
  /** Does the alternate list the tested page in its own hreflang set? null for the page itself or when unreachable. */
  returns: boolean | null;
  /** The alternate's canonical, when it points somewhere other than itself. */
  canonicalElsewhere: string | null;
  self: boolean;
  /** We opened it (only the first 12 alternates are followed). */
  checked: boolean;
};

export type HreflangReport = {
  url: string;
  alts: HreflangAlt[];
  issues: { title: string; fix: string; evidence?: string }[];
  /** More alternates than we open; only the first ones were followed. */
  truncated: boolean;
};

const MAX_FOLLOW = 12;
const norm = (u: string) => u.replace(/#.*$/, "").replace(/\/$/, "");

export async function checkHreflang(start: URL): Promise<HreflangReport> {
  const page = await safeFetch(start);
  const url = page.url;
  const $ = cheerio.load(page.body);
  const issues: HreflangReport["issues"] = [];
  hreflangChecks($, url, (_m, _s, _id, title, _why, fix, evidence) => issues.push({ title, fix, evidence }));
  const { alts } = hreflangs($, url);

  const seen = new Set<string>();
  const unique = alts.filter((a) => {
    const k = `${a.lang.toLowerCase()}|${norm(a.href)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Keyed by the normalised address, but fetched exactly as written in the tag (a trailing slash can matter).
  const exact = new Map<string, string>();
  for (const a of unique) if (!exact.has(norm(a.href))) exact.set(norm(a.href), a.href);
  const toOpen = [...exact.keys()].filter((h) => h !== norm(url)).slice(0, MAX_FOLLOW);

  const opened = new Map<string, { status: number | null; returns: boolean | null; canonicalElsewhere: string | null }>();
  await Promise.all(
    toOpen.map(async (h) => {
      try {
        const r = await safeFetch(new URL(exact.get(h)!), { follow: false });
        if (r.status !== 200) {
          opened.set(h, { status: r.status, returns: null, canonicalElsewhere: null });
          return;
        }
        const $a = cheerio.load(r.body);
        const back = hreflangs($a, r.url).alts.some((x) => norm(x.href) === norm(url));
        const canon = $a('link[rel="canonical"]').attr("href");
        let canonicalElsewhere: string | null = null;
        if (canon) {
          try {
            const c = new URL(canon, r.url).href;
            if (norm(c) !== h) canonicalElsewhere = c;
          } catch {
            /* malformed canonical: not our check */
          }
        }
        opened.set(h, { status: r.status, returns: back, canonicalElsewhere });
      } catch {
        opened.set(h, { status: null, returns: null, canonicalElsewhere: null });
      }
    })
  );

  const rows: HreflangAlt[] = unique.map((a) => {
    const h = norm(a.href);
    const self = h === norm(url);
    const o = opened.get(h);
    return { lang: a.lang, href: a.href, status: self ? page.status : (o?.status ?? null), returns: self ? null : (o?.returns ?? null), canonicalElsewhere: o?.canonicalElsewhere ?? null, self, checked: self || !!o };
  });

  const noReturn = rows.filter((r) => r.returns === false);
  if (noReturn.length) issues.push({ title: `${noReturn.length} alternate${noReturn.length > 1 ? "s don't" : " doesn't"} link back to this page`, fix: "hreflang only counts when both pages point to each other. Add this page to the hreflang set on each one.", evidence: noReturn.slice(0, 4).map((r) => r.href).join(" · ") });
  const broken = rows.filter((r) => !r.self && r.status !== null && r.status !== 200);
  if (broken.length) issues.push({ title: `${broken.length} alternate${broken.length > 1 ? "s don't" : " doesn't"} load directly`, fix: "Each hreflang URL should return 200 itself, not redirect or error. Point the tag at the final address.", evidence: broken.slice(0, 4).map((r) => `${r.href} (${r.status})`).join(" · ") });
  const canon = rows.filter((r) => r.canonicalElsewhere);
  if (canon.length) issues.push({ title: `${canon.length} alternate${canon.length > 1 ? "s are" : " is"} canonicalised to another page`, fix: "A page that says its canonical is somewhere else is ignored in hreflang. Use the canonical address in the tag, or fix the canonical.", evidence: canon.slice(0, 3).map((r) => `${r.href} → ${r.canonicalElsewhere}`).join(" · ") });

  return { url, alts: rows, issues, truncated: new Set(unique.map((a) => norm(a.href))).size - 1 > MAX_FOLLOW };
}
