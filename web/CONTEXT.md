# Pagelyt code map

This is a quick lookup of where things live, so you don't have to search the whole tree. Paths are relative to `web/`. Update this file whenever you add, move or rename a file.

**Stack:**
- Next.js 16 (App Router; see AGENTS.md, since APIs differ from older versions) with React 19.
- Runs on Cloudflare Workers through OpenNext (`wrangler.jsonc`, `open-next.config.ts`).
- Supabase handles Auth (GoTrue) and the database (PostgREST with RLS).
- Resend sends email.

**Commands:**

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run dev:mock` | Runs against a fake in-memory Supabase and Resend (`scripts/`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run cf:deploy` | Build and deploy to Cloudflare |

Tests sit next to the code as `lib/**/*.test.ts`. Run them all with `node --import ./scripts/test-resolve.mjs --experimental-strip-types --test "lib/**/*.test.ts"` (`scripts/test-resolve.mjs` adds the missing `.ts` extensions and the `@/` alias). The Claude preview servers are configured in `../.claude/launch.json`.

**Docs:**
- `DEPLOY.md`: secrets, environment variables, the email switch and the deploy steps.
- `../product_roadmap.md`: product positioning and roadmap.
- `../admin_panel.md`: design of the admin panel.

---

## Scan engine (`lib/scan/`)

A scan runs as short stages, one HTTP request each, because a Worker request has only about 50 subrequests. `index.ts` defines `advanceScan`. Every scan start (`POST /api/scan`) opens `/dashboard/<id>` straight away. The dashboard's live view drives the stages through `lib/run-scan.ts` (`stepScan`), which calls `POST /api/scan/[id]/step`. Each step returns `areas`: the area scores that are already final (see `AREA_DONE_AT`).

| File | Key exports | Purpose |
|---|---|---|
| `index.ts` | `advanceScan`, `checkUrl`, `ScanError`, `Progress` | Stage orchestrator |
| `labels.ts` | `STAGE_LABELS`, `TOTAL_STAGES`, `AREA_DONE_AT` | Stage names, and after how many stages each area's score is final (client-safe) |
| `types.ts` | `ScanResult`, `Finding` (optional `pages`: every affected page, as a `PageTable`), `evidenceText` (full evidence for copy/CSV), `Severity`, `ModuleKey`, `MODULE_NAMES`, `Vitals`, `CrawlSummary` (optional `stop`: a `CrawlStop` saying why the crawl stopped), `DomainInfo`, `ChangeInfo` | Shared scan types |
| `fetcher.ts` | `safeFetch`, `normaliseUrl`, `isPrivateIp` | Edge-safe fetch with SSRF guards; the `range` option sends a Range header and skips the body |
| `checks.ts` | `runChecks`, `Ctx` | Main static page checks (robots, meta, SEO and more) |
| `checks-extra.ts` | `extraChecks` | ARIA and keyboard, content and privacy checks |
| `seo-deep.ts` | `schemaFindings`, `hreflangChecks`, `paginationChecks`, `crawlDeepFindings` | Structured data, hreflang and pagination |
| `crawl.ts` | `crawlBatch` (also returns `missed`: pages that didn't answer in time), `crawlQueue` (`{ queue, found }`), `crawlSummary`, `crawlFindings`, `MAX_PAGES` | Multi-page crawl. `index.ts` records pages found, homepage links, unvisited links, timeouts and the sitemap kind (none / index / list) into `crawl.stop`; `crawl` is now kept even for a one-page crawl |
| `crawl-why.ts` | `crawlWhy`, `CRAWL_LIMIT`, `CRAWL_WAIT_S` | Browser-safe: why the crawl stopped and what would find more pages (exact for newer scans, a best guess for older ones). Used by `CrawlWhyPanel` |
| `images.ts` | `imageList`, `ownScripts`, `imagesInCode`, `probeImages`, `mergeRendered`, `imageFindings` | Image audit: images from the homepage HTML (lazy-load attributes before placeholder `src`, srcset, `<picture>`, `<noscript>`, backgrounds, preloads); when the HTML has fewer than `FEW_IMAGES` (a JavaScript-built app), stagePage also reads up to 3 of the site's own script files for image paths. Up to 16 are checked with a one-byte ranged GET (size from Content-Range; a non-image reply, such as an app's HTML fallback, counts as missing); `imagesIn` also runs on every crawled page (`crawl.ts`), so the count covers the whole crawl (up to 600) and `spreadSample` picks 24 more to check, spread across pages, during the PageSpeed stage; plus the images Lighthouse saw on the rendered homepage. Each checked image records the `page` it was on (Images panel: Found on) |
| `extras.ts` | `domainIntel`, `exposedFiles`, `securityTxt`, `checkLinks`, `detectTech` | DNS and email records, domain expiry, broken links, tech stack |
| `vitals.ts` | `fetchVitals`, `vitalsFindings`, `Shot`, `RenderedImage` | Core Web Vitals through the PageSpeed Insights API; also returns the images the rendered page loaded (`network-requests`) |
| `a11y.ts` | `parseA11y`, `a11yFindings` | Lighthouse accessibility (axe) results |
| `visual.ts` | `visualDiff`, `textDiff`, `compareSnapshots`, `isBigChange`, `defacementChecks` | Visual change and defacement monitoring |
| `score.ts` | `scoreModules`, `overallScore`, `finishedAreas`, `WEIGHTS`, `PENALTY`, `findingKey` | Scoring, including the area scores so far in a running scan (client-safe) |
| `effort.ts` | `effortOf`, `quickWins` | Effort to fix each finding, and "quick wins" |
| `guides.ts` | `GUIDES`, `GUIDE_AREAS`, `GUIDE_ORDER` | Fix guides keyed by finding id (why, steps, verify, dev snippet, tool link); area order and display order for `/fix` |
| `history.ts` | `siteHistory`, `previousSnap`, `toSnap` | Score history per saved site |
| `alerts.ts` | `alertAfterScan` | Emails the owner when the score drops, a new high-severity issue appears, or the site changes |
| `store.ts` | `live`, `rest`, `createScan`, `getScanRow`, `updateScan`, `saveLead`, `claimScansByEmail`, `saveSite`, `dueSites`, `scheduleSiteScan`, `setScanFixed`, `rateLimit` | Scans, leads and sites storage (Supabase REST) |
| `store-ext.ts` | `getPlan`, `canWhiteLabel`, `canTrackAi`, `BILLING_ON`, `getBrand`, `createShare`, `getShare`, `loadSharedReport`, AI prompt and run functions | White-label sharing, plan checks and AI visibility data |
| `agency.ts` | `getAccount`, `setAccountType`, `isPaid`, `sitesOverview`, `createComparison`, `getComparison` | Agency account type, multi-site overview, competitor comparisons |
| `admin.ts` | `startSiteRescan`, `runSiteAi`, `adminOverview`, `pingUptime`, `authUsers` | Operator actions (admin panel and cron) |
| `analytics.ts` | `adminAnalytics` | Admin usage analytics |
| `tools-context.ts` | `toolContext`, `TOOL_FIXES` | Data the free tools pre-fill from a scan |

## Free tool checks (`lib/tools/`)

| File | Key exports | Purpose |
|---|---|---|
| `robots.ts` | `parseRobots`, `robotsVerdict`, `pathMatches`, `robotsPath` | RFC 9309 robots.txt parsing and matching (no regex, so hostile patterns stay fast). Runs on the server and in the browser. Tests in `robots.test.ts` |
| `ai-bots.ts` | `AI_BOTS`, `checkAiBots` | 14 AI crawlers: robots.txt verdict, plus a request with each bot's user agent compared with a normal browser request |
| `hreflang.ts` | `checkHreflang` | Language codes, then opens up to 12 alternates for status, return links and canonicals |
| `domain-age.ts` | `cleanDomain`, `domainAge` | Registration, expiry and registrar from RDAP (rdap.org) |
| `limits.ts` | `BULK_SCHEMA`, `SITEMAP`, `SITEMAP_RENDER` | Free and paid limits and batch sizes for the bulk tools (shared by the API and the browser). `SITEMAP_RENDER` caps pages loaded in a real browser for JavaScript-built sites |
| `bulk-schema.ts` | `checkSchemaPage`, `schemaOf`, `SchemaPage` | One page's JSON-LD: types, invalid blocks, microdata count, and missing fields by the scan's rules (`schemaIssues`) |
| `sitemap.ts` | `existingSitemap`, `crawlPages`, `renderPages`, `CrawledPage` | Reads the current sitemap (robots.txt lines, then /sitemap.xml; indexes one level deep), and crawls one batch of pages, deciding if each belongs in a sitemap (not a redirect, error, noindex or canonicalised page) (`judge`). `renderPages` does the same in one Browser Rendering session, collecting links that only exist after JavaScript runs (`/api/tools` `sitemap-render`) |
| `sitemap-xml.ts` | `sitemapXml` | Builds sitemap.xml text in the browser (loc and lastmod only) |
| `rendered.ts` | `compareHtml`, `RenderReport` | Pure compare of raw and rendered HTML: key SEO tags, word counts and text that only appears after JavaScript. Tests in `rendered.test.ts` |
| `rendered-live.ts` | `compareRendered` | Fetches the raw HTML and renders the page with Browser Rendering (images, media and fonts skipped), then `compareHtml` |

## AI visibility (`lib/ai/`)

| File | Purpose |
|---|---|
| `providers.ts` | `PROVIDER`, `isTracked`, `configuredProviders`, `askChatGpt`: AI visibility asks ChatGPT only (OpenAI Responses API with web search), on when `OPENAI_API_KEY` is set. Older runs from other providers are hidden |
| `parse.ts` | `parseOpenAI`: turns the OpenAI response into `{answer, citations}` |
| `analyse.ts` | `analyse`, `visibilityScore`: was the brand named or cited, and at what rank |
| `run.ts` | `runPrompts`: asks ChatGPT every prompt and stores the runs |
| `chat-knowledge.ts` | Pure: `rankDocs` (keyword match of guides and blog posts), `reportBrief` (report as text for the model), `cleanTurns`, `CHAT_LIMITS`. Tests in `chat-knowledge.test.ts` |
| `chat.ts` | Pagelyt Assistant: `buildInstructions` (scope rules, report, source index, best-matching sources), `streamAnswer` (OpenAI streaming to plain text), `chatModel` (`OPENAI_CHAT_MODEL`, default `gpt-5`) |

## Google integrations (`lib/google/`)

Search Console, Analytics (GA4) and Google Ads. Setup and design notes in DEPLOY.md (Google integrations).

| File | Key exports | Purpose |
|---|---|---|
| `crypto.ts` | `sealToken`, `openToken`, `makeState`, `readState`, `pkceChallenge`, `signPrint`, `readPrint` | Server only. AES-GCM for stored refresh tokens, the signed OAuth `state` (product `p`: gsc, ga4 or ads; PKCE verifier derived from it) and the 15-minute print pass that lets `/print/[id]?g=` show the Analytics and Google Ads sections, keyed from `GOOGLE_TOKEN_KEY`. Tests in `crypto.test.ts` |
| `oauth.ts` | `SCOPES`, `googleOn`, `authUrl`, `exchangeCode`, `refreshAccess`, `revoke`, `gJson`, `GoogleError`, `gUrl` | Server only. OAuth web flow with incremental consent, and fetch for Google APIs. `GOOGLE_MOCK_URL` sends every call to the dev mock |
| `gsc.ts` | `listProperties`, `matchProperty`, `fetchGsc`, `ranges` | Server only. Search Analytics (28 days and the 28 before: pages, query+page, dates, totals) and URL Inspection for up to 15 pages |
| `gsc-insights.ts` | `GscData`, `Traffic`, `pageKey`, `trafficFor`, `trafficMap`, `byTraffic`, `strikingDistance`, `lowCtr`, `drops`, `findingsOn`, `notIndexed`, `gscBrief` | Client-safe. The cached data shape and every calculation on it (clicks per finding, near page one, low click rate, drops, the assistant's summary). Tests in `gsc-insights.test.ts` |
| `ga4.ts` | `listGa4Properties`, `matchGa4Property`, `fetchGa4`, `ga4Ranges` | Server only. GA4 Admin API (properties, web streams to match the site) and one Data API `batchRunReports` (totals, daily, pages, channels, page × channel; 28 days and the 28 before) |
| `ga4-insights.ts` | `Ga4Data`, `Ga4Ai`, `Ga4Insight`, `gaPath`, `visitsFor`, `visitsMap`, `byVisits`, `ga4Drops`, `findingsOnPath`, `lowEngagement`, `channelRows`, `ga4Brief` | Client-safe. Analytics data shape and calculations (visits per finding, drop detective, low engagement, channels, the assistant's summary). Tests in `ga4-insights.test.ts` |
| `ga4-ai.ts` | `analyseGa4`, `analyseOn`, `analysePrompt`, `cleanInsights`, `askJson`, `SCHEMA` | Server only. "Analyse with AI": OpenAI Responses API with a strict JSON schema (`chatModel()`), reply re-checked so only real paths and finding ids stay (max 6). `OPENAI_MOCK_URL` for the dev mock. Tests in `ga4-ai.test.ts` |
| `ads.ts` | `adsOn`, `AdsTokenError`, `AdsAccount`, `listAdsAccounts`, `matchAdsAccount`, `fetchAds` | Server only. Google Ads REST API (GAQL `googleAds:search`, no developer token: access comes from the OAuth client's Cloud project, version from `GOOGLE_ADS_API_VERSION`, default v26): accessible accounts plus manager clients, the account whose ads land on the site, and 7 queries for the 28-day numbers (totals by day, campaigns, landing pages, keywords with landing-page rating, ad final URLs, search terms). Read only |
| `ads-insights.ts` | `AdsData`, `AdsAi`, `AdsInsight`, `AdSpend`, `money`, `cpa`, `cpc`, `spendFor`, `spendMap`, `findingsOnUrl`, `landingHealth`, `weakLanding`, `paidOrganicOverlap`, `organicValue`, `campaignRows`, `wastedTerms`, `adsBrief` | Client-safe. Ads data shape and calculations (spend on pages with issues and per finding, below-average landing pages, paid vs organic top 3, organic clicks priced as ads, wasted searches, the assistant's summary). Tests in `ads-insights.test.ts` |
| `ads-ai.ts` | `analyseAds`, `adsPrompt`, `cleanAdsInsights` | Server only. "Analyse with AI" on the Ads tab (reuses `askJson`), checked so only real landing paths and finding ids stay. Tests in `ads-ai.test.ts` |
| `store.ts` | `canUseGoogle`, `getConnection`, `saveConnection`, `disconnect`, `accessFor`, `ownSite`, `siteForHost`, `getLink`, `setGscProperty`, `setGa4Property`, `setAdsAccount`, `getCache`, `putCache`, `refreshGsc`, `refreshGa4`, `refreshAds`, `isStale`, `STALE_MS` | Server only. `google_connections`, `google_links`, `google_cache` (migrations 0010–0012; cache sources gsc, ga4, ga4_ai, ads, ads_ai) and the 24-hour refresh |

## Auth, ownership, limits (`lib/`)

| File | Key exports | Purpose |
|---|---|---|
| `auth.ts` | `userFromRequest`, `adminFromRequest`, `isAdmin`, `verifyTurnstile`, `clientIp`, `AuthUser` | Server-side auth helpers (Bearer token) |
| `gotrue.ts` | `signUp`, `signInWithPassword`, `verifyEmailCode`, `resendConfirmation`, `recover`, `reply`, `NO_STORE` | Supabase Auth calls |
| `session-age.ts` | `SESSION_DAYS` (7), `sessionFresh`, `signedInAt` | Hard 7-day session limit |
| `supabase-browser.ts` | `supabaseBrowser` | Browser client (anon key) |
| `use-signed-in.ts` | `useSignedInUser`, `useSignedIn`, `firstName` | Client hook for the signed-in user |
| `use-latest-report.ts` | `useLatestReport`, `fetchLatestReport` | Client hook for the signed-in person's newest report (one shared request per page view) |
| `pending.ts` | `rememberVerifyEmail`, `useVerifyEmail`, `adoptSession`, `claimAndFindReport` | Browser helpers for the email-code flow |
| `ticket.ts` | `issueTicket`, `checkTicket` | Short-lived proof that the visitor passed the human check |
| `validate.ts` | `checkName`, `checkEmail`, `checkPassword`, `checkCode`, `checkLead`, `LIMITS` | Input rules (pure; shared by client and server) |
| `disposable.ts` | `isDisposable` | Blocklist of throwaway email domains |
| `domain.ts` | `rootDomain` | Registrable root domain, the unit a site is owned by |
| `owners.ts` | `ownerOf`, `claimDomain`, `setOwner`, `confirmOwner`, `claimToken`, `dropClaims` | One owner per site (`site_owners`, `site_claims`) |
| `ownership-proof.ts` | `provesOwnership`, `META_NAME` | Ownership proof via a meta tag or DNS TXT record |
| `ratelimit.ts` | `guard`, `digest`, `LIMITS`, `Rule` | Rate limits for auth, email and the tools (`tool`, `toolBatch` for batched tools, `render` for Browser Rendering, `renderBatch` for sitemap rendering batches) |
| `email.ts` | `emailsOn`, `sendEmail`, `headerName`, `escapeHtml` | Resend; on only when `EMAILS_ON=1` and `RESEND_API_KEY` are set |
| `requests.ts` | `checkRequest`, `saveRequest`, `listRequests`, `setRequestStatus` | Consultation and contact requests |
| `pdf.ts` | `renderPdf`, `withBrowser`, `NoBrowser` | Server PDF through Cloudflare Browser Rendering (opens `/print/[id]`). `withBrowser` opens and always closes a browser session (also used by raw vs rendered) |
| `download-pdf.ts` | `downloadPdf`, `fullReportPrintUrl` | Client: fetch the PDF, or fall back to printing (`printUrl`: the dashboard opens `/print/[id]?auto=1`, so every issue is in it; `&g=` adds the owner's Analytics section) |
| `run-scan.ts` | `beginScan` (start only; `fresh` skips the 10-min cache), `runScan`, `stepScan` (callback gets `StepInfo` with `areas`) | Starts scans and drives their stages from the browser |

## API routes (`app/api/`)

| Route | Purpose |
|---|---|
| `scan` POST | Start a scan: validation, limits, site-ownership check, lead, row. A finished scan of the same URL from the last 10 minutes is reused, unless `siteId` is given or a signed-in user sends `fresh: true`. A bearer token the server no longer accepts gets 401 `code: "signed_out"` (the homepage then signs out locally and shows the form) |
| `scan/[id]/step` POST | Run the next stage. Returns `{stage, done, label, areas}` |
| `scan/[id]/fixed` PUT | Owner marks findings as fixed |
| `auth/signup`, `auth/login`, `auth/verify`, `auth/resend`, `auth/forgot` | Sign-up, password sign-in, 6-digit code check, resend the code, reset link |
| `auth/site` POST | Asks whether a site is already registered (a known site forces login) |
| `sites/claim` POST | Ownership proof for a site registered to another account |
| `account/claim` | Save a report to the account and make it the saved site's latest scan. Changes the schedule, uptime and email alerts only when `cadence` / `uptime` / `alerts` are sent |
| `account/claim-leads` | After confirmation, attach earlier scans made with that email |
| `account/sites` | Agency overview data |
| `account/type` | Plan, and the "are you an agency?" answer |
| `account/tools-context` | Data the free tools pre-fill from |
| `tools` POST | The free checkers that fetch another site: `ai-bots`, `hreflang`, `robots` (returns the file; testing runs in the browser), `domain-age` (up to 10), `plan` (the caller's limits), `sitemap-urls` (current sitemap; `for: "schema"` caps it at the schema limit), `schema-bulk` and `sitemap-crawl` (one batch each, driven by the browser), `rendered` (paid only; 503 where Browser Rendering is off). Signed-in only (open without Supabase). Single checks: 40 per account and 60 per IP per 15 minutes; batches 150/200; rendered 20/30 per hour |
| `share` POST | Branded client link, plus an optional email to the client (20 a day per account, 3 a day per address) |
| `report/pdf` POST | Branded PDF (paid plans) |
| `compare` POST | Save a competitor comparison |
| `ai/run` | List AI providers (GET) and run visibility prompts (POST) |
| `google/connect` POST, `google/callback` GET | Connect Google for a saved site (`product`: gsc, ga4 or ads): returns Google's consent URL; the callback stores the encrypted token, matches the Search Console or GA4 property or the Ads account and returns to `?view=google&google=<status>` (`&gtab=analytics&google=ga4<status>` for Analytics, `&gtab=ads&google=ads<status>` for Ads) |
| `google/status` GET | Connection, the site's properties and cached data, plus the AI insights (`?siteId=`; `&props=1` / `&ga4props=1` / `&adsprops=1` list the account's properties or Ads accounts; `&scanId=` adds a `printToken` for the owner's PDF). Without `siteId`: the connection only (account page) |
| `google/link` POST, `google/refresh` POST, `google/disconnect` POST | Pick the property or Ads account (`product`: gsc, ga4 or ads; checked against Google's list), refetch when older than 24 hours (`force`: 6 an hour per site and product), revoke and delete everything |
| `google/analyse` POST | "Analyse with AI" on the Analytics data (`{siteId, scanId, force?}`): cached 24 hours in `google_cache` (`ga4_ai`) while the Analytics data is unchanged; 4 a day per site, 20 per account; not part of the chat quota. `product: "ads"` does the same for the Google Ads data (`ads_ai`, its own caps) |
| `chat` POST | Pagelyt Assistant: signed in, own report only; streams plain text, sources in the `x-chat-sources` header. 6 a minute; 10 a day free, 100 paid |
| `request` POST | Consultation and contact forms |
| `admin/*` | `ai`, `analytics`, `requests`, `scan`, `sites`, `uptime`; admin only (`admins` table) |
| `internal/*` | `due`, `start`, `ai-due`, `ai-run`; for the cron Worker |

## Pages and components (`app/`)

**Core flow:**
- `page.tsx` / `home.tsx`: the homepage; `home.tsx` runs the scan and then opens the dashboard.
- `lead-modal.tsx` (`LeadModal`): the scan modal. The URL decides between login and signup. Also defines `ScanStart` and `ScanProblem`. After submitting, it only says "Opening your dashboard…"; the scan runs on the dashboard. With the `tool` prop it is the tool sign-in modal: login if a session was saved before, otherwise signup, with no website lookup, and it hands back to the tool instead of opening the dashboard.
- `code-form.tsx`: the 6-digit code form.
- `login/`: password sign-in.
- `check-email/`: entering the code later.
- `auth/verified`, `auth/reset`: landing pages for email links.
- `claim/`: ownership-proof UI (meta tag or DNS record).
- `auth-link.tsx`: account control in the header.

**Dashboard (`dashboard/`):**
- `[id]/page.tsx`: server page. It shows `PendingDashboard` while the scan runs or the email code is missing, and `Dashboard` once the scan is done. `?new=1` means a signed-in visitor's fresh scan of a site they have no report for, saved to their account when it finishes. `?scan=<newId>` on an existing report means a rescan is running behind it (see `rescan.tsx`).
- `pending.tsx` (`PendingDashboard`): the live scan in the dashboard layout. Area cards and sidebar go from "Checking…" to ✓ with their score, the overall ring builds from the finished areas, and a step list shows progress. It drives `stepScan`. While locked, the email code is asked for in a modal (`CodeModal`) over the live scan that cannot be closed.
- `dashboard.tsx` (`Dashboard`): the main report.
  - The open section is `?view=` in the URL, via `history.pushState` and `useSearchParams`. Values: `overview`, `all`, the area keys, the scan details (`INSIGHTS`: `speed`, `pages`, `images`, `tech`, `changes`), the star features (`monitor`, `ai`, `compare`, `share`), `tools` (all tools grid) and each tool slug (`?view=<slug>`; the old `?view=tools&tool=<slug>` still works).
  - `INSIGHTS`, `STAR` and `ALL_TOOLS` define the sections. The sidebar reads Overview, All findings, ★ Star features (`.nav-star`), Tools (the `MAIN_TOOLS` = 5 with the most missing items, `toolsByNeed` order, plus the open tool if it isn't one of them), then More tools (`.nav-more`, the all tools grid). The scan details are not in the sidebar. Areas and scan details open from the Overview cards and Ctrl K. There are no back buttons or Previous / Next cards; ← / → step through the sidebar order (`useShortcuts` `step`).
  - Animated banners (`.bn`, decoration from `BannerFx`; all motion off with reduced motion, plain in print): the Website Intelligence Score (`.bn-score`), Do more (`.bn-more`), the tools (`ToolsBanner`, `.bn-tools`, also the heading of the All tools page) and each tool page (`.bn-tool`, in its category colour).
  - Overview order: score banner; 13 cards in one grid (`.dash-cards-13`: 8 area rings, then 5 scan-detail cards `.dc-ins` styled like the area cards, with the key number in a ring `.dc-stat`, laid out 4-4-3-2). The light dashboard background is the homepage's `--cream`; Top fixes; Quick wins; Do more (`.star-strip`: banner, then the star feature cards two per row); the tools banner; How scores work.
  - A tool view shows its banner and `DashTool`. The Pages crawled view shows `CrawlWhyPanel`, then the crawl table when there are two or more pages.
  - Header: Search, Rescan, Share, Export, More. Share, Export and More each open an `ActionModal` (`action-modal.tsx`) of option tiles; Share also shows the report link with a Copy button.
  - Dashboard CTAs use the site's "Analyse My Website" lilac (`--cta`, `--cta-h` in the "Dashboard CTAs" block of globals.css): primary buttons at rest, every button on hover. The same lilac is the main colour for fills (`--d-main`, `--d-main-tint`, `--d-grad` in the "Main colour" block): active nav item, tabs, badges, icon tiles, always with dark ink. Small text keeps the deeper `--d-accent`.
  - The Overview has a "From this scan" card per insight section (five cards, laid out 3 + 2) (headline number from `sectionStats`). `pitchFor` writes each star card's headline, short line and button verb from this report. Insight and area headers show `sectionStats` as a stat row, with Why it matters folded (`WhyItMatters`). Colours come from the `--d-*` tokens on `.dash` (redefined for `.dash.dark`), in the "Dashboard refresh" block at the end of globals.css.
  - `useSiteId` finds the saved site, so the AI visibility view can show the whole `Visibility` tool (embedded).
  - Star feature **Ask Pagelyt** (`?view=assistant`, owner only) renders `Assistant`; a floating Ask button (`.asst-fab`) opens it from other views.
- Star feature **Google data** (`?view=google`, owner only, paid badge): `google-data.tsx` `GoogleData` (connect card, property picker, totals with sparkline, issues ranked by traffic, near page one, seen but not clicked, pages that lost clicks, indexing check, footer with Refresh now / Change property; `?google=<status>` after the consent screen shows a notice). `use-google.ts` `useGoogle` loads the status once per report and refreshes stale data; the dashboard passes its `traffic` map to `Findings` (a "Google clicks" badge, `.trf`), `FindingsExplorer` ("Most Google clicks" sort) and Top fixes (`byTraffic`). Styles in the "Google data" block at the end of globals.css. The account page shows the connection and Disconnect.
- Google data has three tabs (`.gd-tabs`; `gTab` state in the dashboard, `?gtab=analytics` / `?gtab=ads` open the others): Search Console (`GscTab`), Analytics (`analytics-data.tsx` `AnalyticsTab`: connect card, GA4 property picker, `AiPanel` with Analyse with AI, `Ga4View` with totals, channels, issues ranked by visitors, drop detective and pages that don't hold visitors). `AiOverviewCard` shows the top 3 AI insights on the Overview. The dashboard passes `visitsMap` to `Findings` / `FindingsExplorer` ("N visits" badge, `.trf.vis`). `useGoogle` also returns `ga4`, `ai`, `analyse` and `printPass` (the PDF fallback's `?g=` pass). Google Ads (`ads-data.tsx` `AdsTab`: connect card, `AdsPicker`, `AdsAiPanel`, `AdsView` with the 28-day summary and campaigns, spend on pages with issues and issues ranked by ad spend, below-average landing pages, paid vs organic, organic traffic value and searches with no conversions). The dashboard passes `spendMap` to `Findings` / `FindingsExplorer` ("£X ad spend" badge, `.trf.ads`). `useGoogle` also returns `ads`, `adsAi` and `analyseAds`.
- `assistant.tsx`: `Assistant`, the chat: header with site and score, grouped starter questions from this report, streamed answers with a small safe markdown renderer (only `/` and `https:` links), source chips, Copy, follow-up suggestions, auto-growing input, Stop and New chat, and a jump-to-newest button. The conversation is kept in sessionStorage per report. `mini` (with `onExpand`/`onClose`) is the small widget the dashboard's floating Ask button opens (`.asst-pop`: a bottom-right panel, a sheet on phones); it shares the conversation with the full view. Styles in the "Pagelyt Assistant" block of globals.css.
- `panels.tsx`: `FindingsExplorer`, `ExportTiles` (PDF, checklist, CSV and JSON tiles for the Export modal; every export has every issue, most important first, with a summary and where each was found), `VitalsPanel` (plain-English summary, loading timeline, metric cards with a scale and a "what this means" panel), `useInView`, `CrawlWhyPanel` (pages crawled, why it stopped, how to find more), `CrawlPanel`, `ImagesPanel`, `QuickWins`, `ChangePanel`, `ComparePanel`, `DomainPanel`, `TechPanel`, `HowScores`, `useHistory`.
- `action-modal.tsx`: `ActionModal` (a `<dialog>` with title and tile grid; a bottom sheet on phones) and `Tile`.
- `../modal-close.tsx`: `ModalX` (the × every modal uses) and `onBackdrop` (close on a click outside the dialog's box). Every modal closes with ×, Esc or a click outside, except while busy and the email-code lock in `pending.tsx`.
- `extras.tsx`: `CommandPalette`, `useShortcuts`, `ShortcutHelp`.
- `icons.tsx`: `AreaIcon` and `IconKey`, covering the areas plus the section icons.
- Used inside the sections:
  - `share-report.tsx`: the share modal, with a brand preview and an optional email to the client.
  - `save-site.tsx`: `SaveSite`, the Save & monitor section: rescan cadence cards, uptime and email-alert switches, and a "what happens next" list; loads the saved site's settings when there is one.
  - `compare-button.tsx`: `CompareButton`, the Compare competitors section on the page (no modal): up to three competitor URLs with progress for each scan, plus a preview of the comparison (`.rv-*` styles).
  - `rescan.tsx`: `RescanButton` runs a fresh scan in the background while the current report stays up (button reads "Scanning…"), saves it to the account, then opens the new report. Also runs a scan the home page started (`?scan=<id>`; `/api/scan` returns `prevId`, from `latestScanForHost` in `lib/scan/store.ts`).
- `brand-share.tsx`: `BrandShare`, the Brand & share section: sub-tabs Share report (`ShareTab`: how it works, the share button, a live preview of the first brand, and this report's share links to copy or withdraw), Brand settings (`BrandEditor embedded`) and Sample report (`/r/demo` in a frame with the owner's first brand). The tab is `?tab=` in the URL.
- `agency-modal.tsx`: the "are you an agency?" question, plus `useAccount` (plan and paid status).

**Reports:**
- `r/[token]`: the white-label shared report.
- `r/report-view.tsx`: presentational part of the report. Lists every issue with a summary; with `showDetails`, the fix and affected pages (`Evidence`). In print, a footer on every page (a `<tfoot>` that repeats) shows "Website report by Pagelyt · pagelyt.dev" and the scanned site's link, white-label included.
- `r/demo`: public sample.
- `print/[id]`: print layout used for the PDF ("Prepared for"). With a valid `?g=` print pass (owner only) it adds the Analytics section (`r/report-analytics.tsx` `ReportAnalytics`: totals, channels, drops, AI insights) and the Google Ads section (`r/report-ads.tsx` `ReportAds`: summary, campaigns, spend on pages with issues, weak landing pages, paid vs organic, organic value, AI insights) before the findings. `?auto=1` opens the print window (`auto-print.tsx`); the dashboard's free "Save as PDF" uses it.
- `compare/[id]`: comparison page.
- `findings.tsx`: plain-language findings list. `traffic` / `visits` / `spend` maps add "Google clicks", "N visits" and "£X ad spend" badges. A finding with `pages` shows them in a table under Technical details (first 10, then "Show all" in a 400px scroll box); older reports show the short evidence text.

**Account:**
- `account/`: plan and account details.
- `account/brand`: brand editor; lists and revokes share links. `BrandEditor` takes `embedded` (no heading, breadcrumb or back link) for the dashboard.
- `account/sites`: agency multi-site view.
- `account/visibility/[siteId]`: AI visibility. `visibility.tsx` `Visibility({ siteId, embedded })`: run bar and summary tiles, then the questions beside "who ChatGPT names" and the settings. `embedded` is the same tool inside the dashboard's AI visibility view.

**Admin:** `admin/`, with the panel, analytics and requests tabs.

**Marketing and content:**
- `content.ts`: copy for nav, plans, FAQs, modules and sessions.
- `features-data.ts`: features and homepage copy.
- `features/feature-card.tsx`: `MOCKS` (each feature's dashboard mock), `FeatureGains` (the "What you get" numbered colour cards), `FeatureCard` (a related feature with a mini preview of its mock that pans on hover) and `AllFeaturesBanner` (the "See all features" banner). Used by /features and /features/[slug].
- `reveal.tsx`: `RevealList`, an `<ol>` that gets `.armed` then `.in` when it scrolls into view; each list's CSS sets the animation.
- `blog-data.ts` + `blog-posts-more.ts`: blog posts.
- `blog/`: blog pages, with `rich.tsx` and `toc.tsx`.
- `tools-list.ts`: list of free tools for the Features page, built from `tools/catalog.ts`.
- `site-config.ts`: name, URL and contact.
- Pages: `about`, `pricing`, `faq`, `features`, `fix`, `how-it-works`, `use-cases`, `consultation`, `contact`, `privacy`, `terms`, `tools`, `bot` (what PagelytBot fetches; linked from the scanner user agent).
- `/fix` is the fix guides directory (data in `lib/scan/guides.ts`, ItemList JSON-LD). `/fix?area=<module>` preselects an area chip.
  - `fix/guide-browser.tsx`: `GuideBrowser`, search box, area chips (`.ga-*` tone classes) and guide cards per area (filtering only hides cards).
  - `fix/[id]/page.tsx`: one guide: breadcrumb with area tag, "Why it matters", numbered steps, developer snippet, "Check it worked", tool button, related guides in the same area, previous/next. HowTo JSON-LD.
  - `fix/copy-code.tsx`: `CopyCode`, the developer snippet with a copy button.
- `rail-nav.tsx`: `RailNav`, dots and previous/next arrows under a row of cards that swipes one card at a time on phones (homepage tools, comparison and examples); renders nothing when the row doesn't overflow.
- `chip-rail.tsx`: `ChipRail`, the horizontally scrolling filter chip row on /tools and /fix: arrow buttons and edge fades on the side with more, wheel scrolls sideways, mouse drag, keeps the pressed chip in view.
- `/tools` is the directory of free tools, grouped by category. `/tools?scan=<id>` redirects to that report's `?view=tools`.
- `/tools/[slug]` is one page per tool: hero, the tool itself, "What you'll get" with an example result, a "How it works" timeline, "Why it matters" with icons, FAQ with FAQPage JSON-LD, then the scan CTA band (no related tools or all-tools banner). The pages are public; using a tool needs sign-in.
  - `tools/catalog.ts`: `TOOL_LIST`, `TOOLS_BY_SLUG`, `CATEGORIES`, `ToolSlug`. Every tool's slug, category, copy and FAQ, and `paid` for paid-only tools. Add a tool here first.
  - `tools/tool-browser.tsx`: `ToolBrowser`, the /tools directory: a big search box, sticky category chips, then a coloured header band and `ToolCard`s per category (filtering only hides cards).
  - `tools/icons.tsx`: `ToolIcon` (line icon per tool) and `TONE` (category colour class, `.tc-*`).
  - `tools/tool-view.tsx`: `VIEWS` (each tool's component by slug) and `ToolView`, which picks the tool by slug and always shows it live. Signed out, submitting the form or clicking a `data-gate` button (Copy, Download, Load) opens `LeadModal` with `tool`, then replays that action after sign-in. Signed in, it pre-fills from the latest report.
  - `tools/tool-card.tsx`: `ToolCard` (one tool with its example result; used on the home page, /tools and "More free tools") and `AllToolsBanner` (the "Browse all tools" banner on tool pages).
  - `tools/samples.tsx`: `SAMPLES` and `ToolSample`, an illustrative example result for each tool (rows, a code file or a search snippet). Used by the home featured tools and each tool page.
  - `tools/tool-steps.tsx`: `ToolSteps`, the "How it works" timeline; a line draws across and the steps pop in when it scrolls into view.
  - `tools/tools.tsx`: the five generators (`Llms`, `Robots`, `Schema`, `Serp`, `Headers`, plus `Field`, `Output` (editor-style code box with Copy and Download; `scroll` caps its height)). `Schema` says which pages each type belongs on (`SCHEMA_WHERE`) and how to paste into the `<head>` (`.tplace`). `Headers` has a scrolling header list and `HeaderGuide`, the "Learn about every header" modal (`HDR_INFO`, `.thg`).
  - `tools/dash-tools.tsx`: tools inside the dashboard. `FINDINGS_BY_TOOL` maps each tool to the finding ids it fixes; `missingFor`, `fixableCount`, `toolsByNeed`. `DashTool` shows a "Missing items" table (`.tmiss`) of this scan's findings for that tool, then the tool pre-filled. `DashToolGrid` is the All tools card grid (`?view=<slug>` on click).
  - `tools/checkers.tsx`: `AiBotChecker`, `RobotsTester`, `DomainAgeChecker`, `HreflangChecker`, `ReviewLink`, plus the shared `callTool`, `ErrorNote`, `Chip`, `Verdict` (coloured result banner with icon and big number) and `Working` (spinner and shimmer skeleton while a check runs). Shared tool styles are in the "Free tools: shared polish" block of globals.css.
  - `tools/checkers-bulk.tsx`: `BulkSchemaChecker` (paste URLs or load from sitemap), `SitemapGenerator` (browser-driven crawl with progress and Stop; if the raw HTML yields no links it switches to rendering pages in a real browser, `sitemap-render`), `RenderedChecker` (paid). The bulk ones send batches to `/api/tools` so each request stays inside the Worker subrequest limit.

**Shared UI:**
- `site-chrome.tsx`: nav and footer.
- `page-shell.tsx`: hero and CTA band.
- `ui.tsx`: rings, sparklines and mock graphics.
- `home-parts.tsx`, `home-extras.tsx`, `steps.tsx`: homepage sections. `home-extras.tsx` `TrustRow` is the dark band of four promises with glowing icons just above the footer.
- `home-convert.tsx`: homepage conversion sections: `HeroTitle` (rotating keyword, full list as H1 text), `StatsBar` (product facts, count-up), `ProcessDraw` (timeline: a straight line draws across and three step cards with mini product previews pop in as it reaches them), `Compare` (us vs them table with the Pagelyt column as a raised purple card, ribbon and "Try it free" (`onGo`); one swipeable card per option on phones), `ToolGrid` (every tool as a card with an example result that replays on hover; category chips filter the grid), `Stories` (three illustrative outcome cards (no names or quotes) with before/after score bars that grow in; data in `home-data.ts` `STORIES`), `StickyCta` (phones).
- `home-data.ts`: the copy for those sections (`ROTATOR`, `STATS`, `PROCESS`, `COMPARE`, `REVIEWS`, `FREE_TOOLS`). Pricing and FAQ live only on `/pricing` and `/faq`, not the home page. The reviews are samples: never mark them up as Review schema.
- `art.tsx`, `arcs.tsx`, `arrow.tsx`: decorative art.
- `main-cta.tsx`: `MainCta`, the site's main button. "Analyse My Website" for visitors, "Go to dashboard" (/dashboard) when signed in.
- `welcome-back.tsx`: `WelcomeBack`, the signed-in bar above the home headline with the latest report and an Open dashboard button.
- `dashboard/page.tsx` + `dashboard/open-latest.tsx`: /dashboard sends signed-in people to their newest report (or /account if none) and visitors to sign in.
- `api/account/latest/route.ts`: GET the signed-in person's newest finished report (id, host, score).
- `nav-mobile.tsx`, `scroll-top.tsx`, `json-ld.tsx`, `use-turnstile.ts`, `request-form.tsx`.
- Styles are all in `globals.css`. Modals reuse `.lead-modal`; the share modal is `.share-modal`.

## Database (`supabase/migrations/`)

| Migration | Tables |
|---|---|
| 0001 | `scans`, `leads`, `sites`, `uptime_checks`, `rate_limits` |
| 0002 | `profiles`, `brands`, `shared_reports`, `ai_prompts`, `ai_runs` |
| 0003 | Alerts and history columns |
| 0004 | Password auth |
| 0005 | `scan_shots` |
| 0006 | `comparisons` |
| 0007 | `admins` |
| 0008 | `requests` |
| 0009 | `site_owners`, `site_claims` |
| 0010 | `google_connections`, `google_links`, `google_cache` |
| 0011 | `google_links.ga4_property`, `ga4_name`; cache sources `ga4`, `ga4_ai`, `ads` |
| 0012 | `google_links.ads_customer`, `ads_login`, `ads_name`; cache source `ads_ai` |

## Dev mocks (`scripts/`)

- `dev-mock.mjs`: starts Next against the mock and sets the environment, including `RESEND_API_URL` and the `GOOGLE_*` values for the fake Google (plus `OPENAI_MOCK_URL` when there's no `OPENAI_API_KEY`). Setting `EMAILS_ON=1` switches mock emails on.
- `mock-supabase.mjs`: fake Auth, PostgREST, `POST /emails` and a fake Google under `/google/<host>/…` (consent with incremental scopes, tokens, Search Console, GA4 Admin and Data APIs, Google Ads with a manager account; `MOCK_GOOGLE=deny|noscope|empty|adstoken`) and a fake OpenAI `POST /v1/responses` for the Analytics and Ads AI insights. `GET /__state` shows the data, including `log.emails`.
