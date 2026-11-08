# Admin dashboard: trigger scans manually instead of cron

## Context
Early traffic is low, so you'll trigger scheduled rescans and AI visibility checks yourself from an admin page. The cron Worker stays off until there's more traffic. The endpoints the cron would call already exist (`app/api/internal/due`, `start`, `ai-due`, `ai-run`), and the scan step loop already runs from the browser (`lib/run-scan.ts`). So the admin page can drive the same flow.

## Approach
1. **Admin gate.** Add an `ADMIN_EMAILS` env var and an `isAdmin(req)` helper built on `userFromRequest` in `lib/auth.ts`. `CRON_SECRET` is never sent to the browser.
2. **Admin API (`app/api/admin/*`).** Reuse `dueSites`, `getSite`, `createScan`, `scheduleSiteScan` (lib/scan/store.ts) and `dueAiSites`, `getSiteAi`, `listPrompts`, `runPrompts`, `bumpAiSchedule` (lib/scan/store-ext.ts, lib/ai/run.ts):
   - list saved sites (due or all), with last scan and score
   - start a rescan for a site, then the browser loops `/api/scan/:id/step` as runScan does. `alertAfterScan` fires as normal.
   - run the AI visibility check for a site
   - optional: ping uptime for all sites and write rows to `uptime_checks`
3. **`/admin` page.** A due-sites table with "Run now" and "Run all due" buttons, live progress, and an AI checks table. Later: users, plans (set a plan by hand until Razorpay exists), leads, and funnel stats.

## Verification
- Sign in as an admin email: `/admin` loads. A non-admin gets 403.
- "Run now" on a saved site creates a new report and moves `next_run_at` forward. The alert email goes out when the score drops.
- The AI run adds rows to `ai_runs`.
