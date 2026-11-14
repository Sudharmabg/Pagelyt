import { safeFetch } from "@/lib/scan/fetcher";
import { openForHtml, withBrowser } from "@/lib/pdf";
import { compareHtml, type RenderReport } from "./rendered";

/* Fetches the raw HTML, renders the same page in Cloudflare Browser Rendering, and compares the two.
   Images, fonts, CSS and trackers are skipped while rendering, and we stop waiting 2.5 s after the page loads:
   the HTML is settled by then and waiting for every request to finish was the slow part.
   Throws NoBrowser (from lib/pdf) where Browser Rendering is not available. */

export async function compareRendered(u: URL): Promise<RenderReport> {
  const raw = await safeFetch(u);
  if (!/html/i.test(String(raw.headers["content-type"] ?? "html"))) throw new Error("Not an HTML page");
  const rendered = await withBrowser(async (browser) => {
    const { page } = await openForHtml(browser, raw.url);
    return { html: await page.content(), url: page.url() };
  });
  return compareHtml(raw.body, rendered.html, raw.url, rendered.url, raw.status);
}
