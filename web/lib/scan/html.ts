import * as cheerio from "cheerio";

/* Cheap HTML parsing for pages we only read tags, attributes and text from. Workers allow little CPU per request,
   and a few heavy pages (500 KB–1 MB each, mostly framework script payload) were enough to exceed it. */

/** Empties every inline script except JSON-LD. Framework payloads (e.g. Next.js RSC data) can be half of a page's
    HTML and nothing that reads the parsed tree uses them. Keep the original HTML where inline code matters (code.ts). */
export function lighten(html: string): string {
  return html.replace(/(<script\b(?![^>]*ld\+json)[^>]*>)[\s\S]*?(<\/script\s*>)/gi, "$1$2");
}

/** Parse with htmlparser2 instead of parse5: about 3x less CPU on large pages. It builds no implied tags and parses
    <noscript> content as elements (so its <img> tags are found by a plain `img` query). */
export function loadFast(html: string): cheerio.CheerioAPI {
  return cheerio.load(html, { xml: { xmlMode: false, decodeEntities: true } });
}
