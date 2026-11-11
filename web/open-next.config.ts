import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/* Prerendered pages are read from the Worker's static files instead of being rendered again on every request.
   This cache is read-only, which fits because no page uses `revalidate`. If a page ever needs revalidation,
   switch to the R2 incremental cache. */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
