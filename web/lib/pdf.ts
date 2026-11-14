/* Server-rendered PDFs through Cloudflare Browser Rendering (the BROWSER binding in wrangler.jsonc, which needs
   the Workers Paid plan). Chrome opens our own print page and saves it as an A4 PDF.
   Where the binding is missing (next dev, or before it is configured) this throws NoBrowser and callers fall back
   to the browser's own print-to-PDF. */

import type { Browser } from "@cloudflare/puppeteer";

export class NoBrowser extends Error {}

async function browserBinding(): Promise<unknown> {
  // In `next dev`, OpenNext would start a local Wrangler proxy (slow, and Browser Rendering needs the real
  // Cloudflare account). Off by default there; set PDF_DEV=1 to try it anyway.
  if (process.env.NODE_ENV !== "production" && process.env.PDF_DEV !== "1") return null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as { BROWSER?: unknown }).BROWSER ?? null;
  } catch {
    return null; // not running on Workers
  }
}

/** Runs `fn` in a Browser Rendering session. Starting Chrome takes a few seconds, so an idle session is reused
    when one is free; otherwise a new one is launched and kept warm for a minute after use. Pages `fn` opens are
    always closed afterwards. Throws NoBrowser when unavailable. */
export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const binding = await browserBinding();
  if (!binding) throw new NoBrowser("Browser Rendering is not configured.");
  const puppeteer = (await import("@cloudflare/puppeteer")).default;
  type Binding = Parameters<typeof puppeteer.launch>[0];
  const b = binding as Binding;
  let browser: Browser | null = null;
  try {
    for (const s of (await puppeteer.sessions(b)).filter((x) => !x.connectionId)) {
      try {
        browser = await puppeteer.connect(b, s.sessionId);
        break;
      } catch {
        /* taken by another request a moment ago: try the next one */
      }
    }
  } catch {
    /* listing sessions failed: launch a new one */
  }
  browser ??= await puppeteer.launch(b, { keep_alive: 60_000 });
  const before = new Set(await browser.pages().catch(() => []));
  try {
    return await fn(browser);
  } finally {
    const pages = await browser.pages().catch(() => []);
    await Promise.all(pages.filter((p) => !before.has(p)).map((p) => p.close().catch(() => {})));
    await Promise.resolve(browser.disconnect()).catch(() => {});
  }
}

/** Requests skipped while rendering for HTML: they don't change the page's HTML and cost time. */
const SKIP_TYPES = new Set(["image", "media", "font", "stylesheet"]);
const SKIP_HOSTS = /(^|\.)(googletagmanager\.com|google-analytics\.com|doubleclick\.net|googlesyndication\.com|googleadservices\.com|facebook\.(com|net)|hotjar\.(com|io)|clarity\.ms|segment\.(com|io)|mixpanel\.com|intercom\.io|hs-scripts\.com|hs-analytics\.net|tiktok\.com|ads-twitter\.com|snap\.licdn\.com)$/i;

/** Opens `url` in a new tab with images, fonts, CSS and trackers blocked, waits for the page's own scripts to settle
    (at most `settle` ms after it loads), and returns the tab. */
export async function openForHtml(browser: Browser, url: string, timeout = 10_000, settle = 2_500) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    let host = "";
    try {
      host = new URL(req.url()).hostname;
    } catch {
      /* data: and similar */
    }
    if (SKIP_TYPES.has(req.resourceType()) || SKIP_HOSTS.test(host)) void req.abort();
    else void req.continue();
  });
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  await page.waitForNetworkIdle({ idleTime: 400, timeout: settle }).catch(() => {});
  return { page, res };
}

/** Prints `url` to an A4 PDF. The print page is rendered on the server, so instead of waiting for the network to go
    quiet (trackers and late requests made that slow) it waits for the page's own load event, at most 12 s, and its
    fonts. Trackers and video are skipped. */
export async function renderPdf(url: string): Promise<Uint8Array> {
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      let host = "";
      try {
        host = new URL(req.url()).hostname;
      } catch {
        /* data: and similar */
      }
      if (req.resourceType() === "media" || SKIP_HOSTS.test(host)) void req.abort();
      else void req.continue();
    });
    await page.emulateMediaType("print");
    await page.goto(url, { waitUntil: "load", timeout: 12_000 }).catch((e: unknown) => {
      // A slow image or script shouldn't sink the PDF: the report itself is already in the HTML.
      if (!/timeout/i.test(e instanceof Error ? e.message : "")) throw e;
    });
    await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" } });
    return new Uint8Array(pdf);
  });
}
