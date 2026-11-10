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

/** Opens a Browser Rendering session, runs `fn`, and always closes the browser. Throws NoBrowser when unavailable. */
export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const binding = await browserBinding();
  if (!binding) throw new NoBrowser("Browser Rendering is not configured.");
  const puppeteer = (await import("@cloudflare/puppeteer")).default;
  const browser = await puppeteer.launch(binding as Parameters<typeof puppeteer.launch>[0]);
  try {
    return await fn(browser);
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function renderPdf(url: string): Promise<Uint8Array> {
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.goto(url, { waitUntil: "networkidle0", timeout: 25_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" } });
    return new Uint8Array(pdf);
  });
}
