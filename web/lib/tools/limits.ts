/* Limits for the phase 2 tools, shared by the API and the browser.
   Free accounts get the smaller number. The browser sends work in batches so that each request
   stays inside Cloudflare's subrequest limit, and the API caps every batch again. */

export const BULK_SCHEMA = { free: 10, paid: 100, batch: 8 } as const;
export const SITEMAP = { free: 100, paid: 1000, batch: 20 } as const;
/** Sitemap pages loaded in a real browser, for sites whose links are built with JavaScript. */
export const SITEMAP_RENDER = { free: 25, paid: 200, batch: 5 } as const;
