import { safeFetch } from "@/lib/scan/fetcher";
import { withBrowser } from "@/lib/pdf";
import { compareHtml, type RenderReport } from "./rendered";

/* Fetches the raw HTML, renders the same page in Cloudflare Browser Rendering, and compares the two.
   Images, media and fonts are skipped while rendering: they don't change the HTML and cost time.
   Throws NoBrowser (from lib/pdf) where Browser Rendering is not available. */

export async function compareRendered(u: URL): Promise<RenderReport> {
  const raw = await safeFetch(u);
  if (!/html/i.test(String(raw.headers["content-type"] ?? "html"))) throw new Error("Not an HTML page");
  const rendered = await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "media", "font"].includes(req.resourceType())) void req.abort();
      else void req.continue();
    });
    await page.goto(raw.url, { waitUntil: "networkidle2", timeout: 20_000 });
    return { html: await page.content(), url: page.url() };
  });
  return compareHtml(raw.body, rendered.html, raw.url, rendered.url, raw.status);
}
