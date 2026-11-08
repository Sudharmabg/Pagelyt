import { runChecks } from "./checks";
import { STAGE_LABELS, TOTAL_STAGES } from "./labels";
import { checkLinks, collectLinks, detectTech, domainFindings, domainIntel, exposedFiles, linkFindings, securityTxt } from "./extras";
import { MAX_PAGES, PER_STAGE, crawlBatch, crawlFindings, crawlQueue, crawlSummary, inspect, internalLinks, sitemapLocs } from "./crawl";
import { normaliseUrl, safeFetch } from "./fetcher";
import { overallScore, scoreModules } from "./score";
import { alertAfterScan } from "./alerts";
import { setSiteLastScan } from "./agency";
import { getScanRow, previousResult, saveShot, updateScan, type ScanRow } from "./store";
import type { ChangeInfo, CrawlPage, DomainInfo, Finding, ImageAudit, ScanResult, Snapshot, TechItem, Vitals } from "./types";
import { fetchVitals, vitalsFindings } from "./vitals";
import { imageFindings, imageList, probeImages } from "./images";
import { a11yFindings, coveredStaticIds } from "./a11y";
import { compareSnapshots, textSignature, visualSignature } from "./visual";
import * as cheerio from "cheerio";

/* A scan runs as a series of short stages, each its own request. Workers allow only ~50 outbound
   requests (and little CPU) per invocation, so one request cannot do the whole scan. Each stage
   stays well under that budget and parks its results in `scans.state` for the next one.
   The browser drives the loop (POST /api/scan, then POST /api/scan/:id/step until done), which
   also gives the progress screen real progress instead of guessed timings. */

export class ScanError extends Error {}

export { STAGE_LABELS, TOTAL_STAGES };

type State = {
  finalUrl?: string;
  host?: string;
  findings?: Finding[];
  tech?: TechItem[];
  linkSample?: string[];
  imageSample?: string[];
  images?: ImageAudit | null;
  snapshot?: Snapshot;
  domain?: DomainInfo | null;
  links?: { checked: number; broken: number } | null;
  vitals?: Vitals | null;
  crawlQueue?: string[];
  sitemapUrls?: string[];
  crawlPages?: CrawlPage[];
  crawlLinked?: string[];
};

async function tryText(u: URL): Promise<{ ok: boolean; body: string }> {
  try {
    const r = await safeFetch(u);
    const html = /^\s*<(!doctype|html)/i.test(r.body);
    return { ok: r.status === 200 && !html, body: r.body };
  } catch {
    return { ok: false, body: "" };
  }
}

function crawlHome(page: { url: string; status: number; body: string }, host: string): CrawlPage {
  return inspect(page.url, page.status, page.body, host).page;
}

export function checkUrl(raw: string): URL {
  const u = normaliseUrl(raw);
  if (!u) throw new ScanError("Enter a full public address such as https://example.com");
  return u;
}

/* Stage 1: the page itself plus the small files around it (about 12 subrequests). */
async function stagePage(row: ScanRow): Promise<State> {
  const start = checkUrl(row.url);
  let page;
  try {
    page = await safeFetch(start);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/Blocked/.test(msg)) throw new ScanError("That address is not publicly reachable.");
    throw new ScanError(`Could not reach ${start.hostname}${msg ? ` (${msg})` : ""}. Is the address correct?`);
  }
  const finalUrl = new URL(page.url);
  const origin = finalUrl.origin;
  const [robots, sitemap, llms, http] = await Promise.all([
    tryText(new URL("/robots.txt", origin)),
    tryText(new URL("/sitemap.xml", origin)),
    tryText(new URL("/llms.txt", origin)),
    finalUrl.protocol === "https:"
      ? safeFetch(new URL(`http://${finalUrl.host}/`)).then((r) => r.chain.some((c) => c.url.startsWith("https://")), () => null)
      : Promise.resolve(null),
  ]);
  const host = finalUrl.hostname.replace(/^www\./, "");
  const imgs = imageList(page);
  const $ = cheerio.load(page.body.slice(0, 400_000));
  const pageTitle = $("title").first().text().trim().replace(/\s+/g, " ");
  $("script,style,noscript,svg,template").remove();
  const snapshot: Snapshot = { title: pageTitle, sig: null, text: textSignature($("body").text()), shot: false };
  const sitemapUrls = sitemap.ok ? sitemapLocs(sitemap.body, host) : [];
  const findings = runChecks({
    page,
    finalUrl,
    robots: robots.ok ? robots.body : null,
    sitemapOk: sitemap.ok || (robots.ok && /^sitemap:/im.test(robots.body)),
    llmsTxt: llms.ok,
    httpRedirectsToHttps: http,
  });
  return {
    finalUrl: page.url,
    host,
    findings,
    tech: detectTech(page),
    linkSample: collectLinks(page).sample,
    imageSample: imgs.sample,
    images: { count: imgs.count, probed: [] },
    snapshot,
    sitemapUrls,
    crawlQueue: crawlQueue(finalUrl.href, host, sitemapUrls, internalLinks(page.body, page.url, host)),
    crawlPages: [crawlHome(page, host)],
    crawlLinked: internalLinks(page.body, page.url, host).slice(0, 600),
  };
}

/* Stage 2: DNS over HTTPS (incl. DS, CAA and up to 8 DKIM selectors), RDAP, nine exposure probes and
   security.txt (about 27 subrequests). */
async function stageDomain(st: State): Promise<State> {
  const finalUrl = new URL(st.finalUrl!);
  const [domain, exposed, sec] = await Promise.all([domainIntel(finalUrl.hostname), exposedFiles(finalUrl.origin), securityTxt(finalUrl.origin)]);
  return { ...st, domain, findings: [...st.findings!, ...domainFindings(domain), ...exposed, ...sec] };
}

/* Stage 3: a sample of up to 18 links and 8 images (HEAD), one subrequest each. */
async function stageLinks(st: State): Promise<State> {
  const [r, probed] = await Promise.all([checkLinks(st.linkSample ?? []), probeImages(st.imageSample ?? [])]);
  return { ...st, links: { checked: r.checked, broken: r.broken.length }, images: { count: st.images?.count ?? 0, probed }, imageSample: undefined, findings: [...st.findings!, ...linkFindings(r)] };
}

/* Stages 4 and 5: crawl up to MAX_PAGES pages (PER_STAGE per stage). */
async function stageCrawl(st: State, part: 0 | 1): Promise<State> {
  const host = st.host!;
  const batch = (st.crawlQueue ?? []).slice(part * PER_STAGE, (part + 1) * PER_STAGE);
  const r = batch.length ? await crawlBatch(batch, host) : { pages: [], linked: [] };
  const pages = [...(st.crawlPages ?? []), ...r.pages].slice(0, MAX_PAGES);
  const linked = [...new Set([...(st.crawlLinked ?? []), ...r.linked])].slice(0, 600);
  const next: State = { ...st, crawlPages: pages, crawlLinked: linked };
  if (part === 1) {
    // Last crawl stage: turn what we saw into findings.
    next.findings = [...st.findings!, ...crawlFindings(pages, { sitemap: st.sitemapUrls ?? [], linked, home: st.finalUrl! })];
    next.crawlQueue = undefined;
    next.crawlLinked = undefined;
  }
  return next;
}

/* Stage 6: PageSpeed Insights, mobile and desktop (2 subrequests, slow), plus storing its screenshot. */
async function stageSpeed(row: ScanRow, st: State): Promise<State> {
  const { vitals, shot, a11y } = await fetchVitals(st.finalUrl!);
  const img = st.images ? imageFindings(st.images, vitals?.weight) : [];
  let snapshot = st.snapshot;
  if (snapshot && shot) {
    snapshot = { ...snapshot, sig: visualSignature(shot.thumb ?? shot.full) };
    if (shot.full) {
      await saveShot(row.id, shot.full);
      snapshot.shot = true;
    }
  }
  // Rendered accessibility results replace the static checks Lighthouse re-ran on the real page.
  const covered = a11y ? coveredStaticIds(a11y) : new Set<string>();
  const base = st.findings!.filter((f) => !(f.module === "accessibility" && covered.has(f.id)));
  return { ...st, vitals, snapshot, findings: [...base, ...(vitals ? vitalsFindings(vitals) : []), ...img, ...(a11y ? a11yFindings(a11y) : [])] };
}

/** Difference from the previous scan of the same site; never fails the scan. */
async function changeSince(row: ScanRow, snap: Snapshot | undefined): Promise<ChangeInfo | null> {
  if (!snap) return null;
  try {
    const prev = await previousResult(row);
    return prev?.result.snapshot ? compareSnapshots({ id: prev.id, at: prev.result.scannedAt, snap: prev.result.snapshot }, snap) : null;
  } catch {
    return null;
  }
}

/* Last stage: scoring and comparing with the previous scan. */
async function build(row: ScanRow, st: State): Promise<ScanResult> {
  const order = { high: 0, medium: 1, low: 2 };
  const findings = [...st.findings!].sort((a, b) => order[a.severity] - order[b.severity]);
  const modules = scoreModules(findings);
  return {
    url: st.finalUrl!,
    host: st.host ?? row.host,
    scannedAt: new Date().toISOString(),
    overall: overallScore(modules),
    modules,
    findings,
    tech: st.tech,
    vitals: st.vitals ?? null,
    domain: st.domain ?? null,
    links: st.links ?? null,
    images: st.images ?? null,
    snapshot: st.snapshot ?? null,
    change: await changeSince(row, st.snapshot),
    crawl: st.crawlPages && st.crawlPages.length > 1 ? crawlSummary(st.crawlPages, st.sitemapUrls?.length ?? 0) : null,
  };
}

export type Progress = { id: string; stage: number; total: number; done: boolean; label: string; host: string };

/** Run the next stage of a scan. Safe to call again after it finishes. */
export async function advanceScan(id: string): Promise<Progress> {
  const row = await getScanRow(id);
  if (!row) throw new ScanError("Report not found.");
  const total = TOTAL_STAGES;
  const prog = (stage: number, done: boolean, host = row.host): Progress => ({ id, stage, total, done, host, label: STAGE_LABELS[Math.min(stage, total - 1)] });
  if (row.status === "done") return prog(total, true);
  if (row.status === "failed") throw new ScanError(row.error || "The scan failed. Please try again.");

  const st = row.state as State;
  try {
    let next: State;
    switch (row.stage) {
      case 0: next = await stagePage(row); break;
      case 1: next = await stageDomain(st); break;
      case 2: next = await stageLinks(st); break;
      case 3: next = await stageCrawl(st, 0); break;
      case 4: next = await stageCrawl(st, 1); break;
      case 5: next = await stageSpeed(row, st); break;
      default: {
        const result = await build(row, st);
        await updateScan(id, { status: "done", stage: total, result, state: {}, host: result.host });
        if (row.site_id) await setSiteLastScan(row.site_id, id).catch(() => {});
        await alertAfterScan(row, result).catch(() => {}); // never let an email problem fail a finished scan
        return prog(total, true, result.host);
      }
    }
    const stage = row.stage + 1;
    await updateScan(id, { stage, state: next as Record<string, unknown>, host: next.host ?? row.host });
    return prog(stage, false, next.host ?? row.host);
  } catch (e) {
    const msg = e instanceof ScanError ? e.message : "The scan failed unexpectedly. Please try again.";
    await updateScan(id, { status: "failed", error: msg });
    throw e instanceof ScanError ? e : new ScanError(msg);
  }
}
