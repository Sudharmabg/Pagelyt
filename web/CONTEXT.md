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

Tests sit next to the code as `lib/**/*.test.ts`. The Claude preview servers are configured in `../.claude/launch.json`.

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
| `types.ts` | `ScanResult`, `Finding`, `Severity`, `ModuleKey`, `MODULE_NAMES`, `Vitals`, `CrawlSummary`, `DomainInfo`, `ChangeInfo` | Shared scan types |
| `fetcher.ts` | `safeFetch`, `normaliseUrl`, `isPrivateIp` | Edge-safe fetch with SSRF guards |
| `checks.ts` | `runChecks`, `Ctx` | Main static page checks (robots, meta, SEO and more) |
| `checks-extra.ts` | `extraChecks` | ARIA and keyboard, content and privacy checks |
| `seo-deep.ts` | `schemaFindings`, `hreflangChecks`, `paginationChecks`, `crawlDeepFindings` | Structured data, hreflang and pagination |
| `crawl.ts` | `crawlBatch`, `crawlQueue`, `crawlSummary`, `crawlFindings`, `MAX_PAGES` | Multi-page crawl |
| `images.ts` | `probeImages`, `imageFindings` | Image audit (HEAD request per sampled image) |
| `extras.ts` | `domainIntel`, `exposedFiles`, `securityTxt`, `checkLinks`, `detectTech` | DNS and email records, domain expiry, broken links, tech stack |
| `vitals.ts` | `fetchVitals`, `vitalsFindings`, `Shot` | Core Web Vitals through the PageSpeed Insights API |
| `a11y.ts` | `parseA11y`, `a11yFindings` | Lighthouse accessibility (axe) results |
| `visual.ts` | `visualDiff`, `textDiff`, `compareSnapshots`, `isBigChange`, `defacementChecks` | Visual change and defacement monitoring |
| `score.ts` | `scoreModules`, `overallScore`, `finishedAreas`, `WEIGHTS`, `PENALTY`, `findingKey` | Scoring, including the area scores so far in a running scan (client-safe) |
| `effort.ts` | `effortOf`, `quickWins` | Effort to fix each finding, and "quick wins" |
| `guides.ts` | `GUIDES` | Fix guides keyed by finding id (used by `/fix/[id]`) |
| `history.ts` | `siteHistory`, `previousSnap`, `toSnap` | Score history per saved site |
| `alerts.ts` | `alertAfterScan` | Emails the owner when the score drops, a new high-severity issue appears, or the site changes |
| `store.ts` | `live`, `rest`, `createScan`, `getScanRow`, `updateScan`, `saveLead`, `claimScansByEmail`, `saveSite`, `dueSites`, `scheduleSiteScan`, `setScanFixed`, `rateLimit` | Scans, leads and sites storage (Supabase REST) |
| `store-ext.ts` | `getPlan`, `canWhiteLabel`, `canTrackAi`, `BILLING_ON`, `getBrand`, `createShare`, `getShare`, `loadSharedReport`, AI prompt and run functions | White-label sharing, plan checks and AI visibility data |
| `agency.ts` | `getAccount`, `setAccountType`, `isPaid`, `sitesOverview`, `createComparison`, `getComparison` | Agency account type, multi-site overview, competitor comparisons |
| `admin.ts` | `startSiteRescan`, `runSiteAi`, `adminOverview`, `pingUptime`, `authUsers` | Operator actions (admin panel and cron) |
| `analytics.ts` | `adminAnalytics` | Admin usage analytics |
| `tools-context.ts` | `toolContext` | Data the free tools pre-fill from a scan |

## Free tool checks (`lib/tools/`)

| File | Key exports | Purpose |
|---|---|---|
| `robots.ts` | `parseRobots`, `robotsVerdict`, `pathMatches`, `robotsPath` | RFC 9309 robots.txt parsing and matching (no regex, so hostile patterns stay fast). Runs on the server and in the browser. Tests in `robots.test.ts` |
| `ai-bots.ts` | `AI_BOTS`, `checkAiBots` | 14 AI crawlers: robots.txt verdict, plus a request with each bot's user agent compared with a normal browser request |
| `hreflang.ts` | `checkHreflang` | Language codes, then opens up to 12 alternates for status, return links and canonicals |
| `domain-age.ts` | `cleanDomain`, `domainAge` | Registration, expiry and registrar from RDAP (rdap.org) |
| `limits.ts` | `BULK_SCHEMA`, `SITEMAP` | Free and paid limits and batch sizes for the bulk tools (shared by the API and the browser) |
| `bulk-schema.ts` | `checkSchemaPage`, `schemaOf`, `SchemaPage` | One page's JSON-LD: types, invalid blocks, microdata count, and missing fields by the scan's rules (`schemaIssues`) |
| `sitemap.ts` | `existingSitemap`, `crawlPages`, `CrawledPage` | Reads the current sitemap (robots.txt lines, then /sitemap.xml; indexes one level deep), and crawls one batch of pages, deciding if each belongs in a sitemap (not a redirect, error, noindex or canonicalised page) |
| `sitemap-xml.ts` | `sitemapXml` | Builds sitemap.xml text in the browser (loc and lastmod only) |
| `rendered.ts` | `compareHtml`, `RenderReport` | Pure compare of raw and rendered HTML: key SEO tags, word counts and text that only appears after JavaScript. Tests in `rendered.test.ts` |
| `rendered-live.ts` | `compareRendered` | Fetches the raw HTML and renders the page with Browser Rendering (images, media and fonts skipped), then `compareHtml` |

## AI visibility (`lib/ai/`)

| File | Purpose |
|---|---|
| `providers.ts` | `configuredProviders`, `askProvider`: OpenAI, Anthropic and Perplexity, each switched on by its API key |
| `parse.ts` | Turns each provider's response into `{answer, citations}` |
| `analyse.ts` | `analyse`, `visibilityScore`: was the brand named or cited, and at what rank |
| `run.ts` | `runPrompts`: asks every provider every prompt and stores the runs |

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
| `ratelimit.ts` | `guard`, `digest`, `LIMITS`, `Rule` | Rate limits for auth, email and the tools (`tool`, `toolBatch` for batched tools, `render` for Browser Rendering) |
| `email.ts` | `emailsOn`, `sendEmail`, `headerName`, `escapeHtml` | Resend; on only when `EMAILS_ON=1` and `RESEND_API_KEY` are set |
| `requests.ts` | `checkRequest`, `saveRequest`, `listRequests`, `setRequestStatus` | Consultation and contact requests |
| `pdf.ts` | `renderPdf`, `withBrowser`, `NoBrowser` | Server PDF through Cloudflare Browser Rendering (opens `/print/[id]`). `withBrowser` opens and always closes a browser session (also used by raw vs rendered) |
| `download-pdf.ts` | `downloadPdf` | Client: fetch the PDF, or fall back to the browser's print |
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
| `account/claim` | Save a report to the account and make it the saved site's latest scan. Changes the schedule and uptime only when `cadence` / `uptime` are sent |
| `account/claim-leads` | After confirmation, attach earlier scans made with that email |
| `account/sites` | Agency overview data |
| `account/type` | Plan, and the "are you an agency?" answer |
| `account/tools-context` | Data the free tools pre-fill from |
| `tools` POST | The free checkers that fetch another site: `ai-bots`, `hreflang`, `robots` (returns the file; testing runs in the browser), `domain-age` (up to 10), `plan` (the caller's limits), `sitemap-urls` (current sitemap; `for: "schema"` caps it at the schema limit), `schema-bulk` and `sitemap-crawl` (one batch each, driven by the browser), `rendered` (paid only; 503 where Browser Rendering is off). Signed-in only (open without Supabase). Single checks: 40 per account and 60 per IP per 15 minutes; batches 150/200; rendered 20/30 per hour |
| `share` POST | Branded client link, plus an optional email to the client (20 a day per account, 3 a day per address) |
| `report/pdf` POST | Branded PDF (paid plans) |
| `compare` POST | Save a competitor comparison |
| `ai/run` | List AI providers (GET) and run visibility prompts (POST) |
| `request` POST | Consultation and contact forms |
| `admin/*` | `ai`, `analytics`, `requests`, `scan`, `sites`, `uptime`; admin only (`admins` table) |
| `internal/*` | `due`, `start`, `ai-due`, `ai-run`; for the cron Worker |

## Pages and components (`app/`)

**Core flow:**
- `page.tsx` / `home.tsx`: the homepage; `home.tsx` runs the scan and then opens the dashboard.
- `lead-modal.tsx` (`LeadModal`): the scan modal. The URL decides between login and signup. Also defines `ScanStart` and `ScanProblem`. After submitting, it only says "Opening your dashboard…"; the scan runs on the dashboard.
- `code-form.tsx`: the 6-digit code form.
- `login/`: password sign-in.
- `check-email/`: entering the code later.
- `auth/verified`, `auth/reset`: landing pages for email links.
- `claim/`: ownership-proof UI (meta tag or DNS record).
- `auth-link.tsx`: account control in the header.

**Dashboard (`dashboard/`):**
- `[id]/page.tsx`: server page. It shows `PendingDashboard` while the scan runs or the email code is missing, and `Dashboard` once the scan is done. `?new=1` means a signed-in visitor's fresh scan, saved to their account when it finishes.
- `pending.tsx` (`PendingDashboard`): the live scan in the dashboard layout. Area cards and sidebar go from "Checking…" to ✓ with their score, the overall ring builds from the finished areas, and a step list shows progress. It drives `stepScan`. The email-code card sits on top while locked.
- `dashboard.tsx` (`Dashboard`): the main report.
  - The open section is `?view=` in the URL, via `history.pushState` and `useSearchParams`. Values: `overview`, `all`, the area keys, the insights (`speed`, `pages`, `images`, `tech`, `changes`) and the Grow sections (`monitor`, `ai`, `compare`, `share`, `tools`).
  - `INSIGHTS` and `GROW` define the sections. The sidebar is grouped as Findings, Areas, Insights and Grow.
  - Every section except the overview has a sticky "← Back to overview" button (`.back-btn`) and Previous / Next links (`.dash-pn`).
  - Header: Search, Rescan, Share ▾, Export ▾, More ▾.
  - The Overview has a "Do more with this report" strip (`.do-more`).
  - `useSiteId` finds the saved site, for the AI visibility link.
- `panels.tsx`: `FindingsExplorer`, `ExportMenu` (PDF, checklist, CSV and JSON), `VitalsPanel`, `CrawlPanel`, `ImagesPanel`, `QuickWins`, `ChangePanel`, `ComparePanel`, `DomainPanel`, `TechPanel`, `HowScores`, `useHistory`.
- `extras.tsx`: `RadarPanel`, `CommandPalette`, `useShortcuts`, `ShortcutHelp`.
- `icons.tsx`: `AreaIcon` and `IconKey`, covering the areas plus the section icons.
- Used inside the sections:
  - `share-report.tsx`: the share modal, with a brand preview and an optional email to the client.
  - `save-site.tsx`: save the site with a schedule and alerts. `inline` shows it as a form instead of a drop-down.
  - `compare-button.tsx`: scan competitors.
  - `rescan.tsx`: starts a fresh scan and opens its live dashboard with `?new=1`, so the result is saved to the account and the site.
- `agency-modal.tsx`: the "are you an agency?" question, plus `useAccount` (plan and paid status).

**Reports:**
- `r/[token]`: the white-label shared report.
- `r/report-view.tsx`: presentational part of the report.
- `r/demo`: public sample.
- `print/[id]`: print layout used for the PDF ("Prepared for").
- `compare/[id]`: comparison page.
- `findings.tsx`: plain-language findings list.

**Account:**
- `account/`: plan and account details.
- `account/brand`: brand editor; lists and revokes share links.
- `account/sites`: agency multi-site view.
- `account/visibility/[siteId]`: AI visibility.

**Admin:** `admin/`, with the panel, analytics and requests tabs.

**Marketing and content:**
- `content.ts`: copy for nav, plans, FAQs, modules and sessions.
- `features-data.ts`: features and homepage copy.
- `blog-data.ts` + `blog-posts-more.ts`: blog posts.
- `blog/`: blog pages, with `rich.tsx` and `toc.tsx`.
- `tools-list.ts`: list of free tools for the Features page, built from `tools/catalog.ts`.
- `site-config.ts`: name, URL and contact.
- Pages: `about`, `pricing`, `faq`, `features`, `fix`, `how-it-works`, `use-cases`, `consultation`, `contact`, `privacy`, `terms`, `tools`.
- `/tools` is the directory of free tools, grouped by category. `/tools?scan=<id>` redirects to that report's `?view=tools`.
- `/tools/[slug]` is one page per tool (title, description, "Why it matters", FAQ with FAQPage JSON-LD, related tools). The pages are public; using a tool needs sign-in.
  - `tools/catalog.ts`: `TOOL_LIST`, `TOOLS_BY_SLUG`, `CATEGORIES`, `ToolSlug`. Every tool's slug, category, copy and FAQ, and `paid` for paid-only tools. Add a tool here first.
  - `tools/tool-browser.tsx`: `ToolBrowser`, the /tools directory's search box, category chips and tool cards (filtering only hides cards).
  - `tools/icons.tsx`: `ToolIcon` (line icon per tool) and `TONE` (category colour class, `.tc-*`).
  - `tools/tool-view.tsx`: `ToolView` picks the tool by slug. Signed out it shows a disabled preview with a sign-in prompt; signed in it pre-fills from the latest report.
  - `tools/tools.tsx`: the five generators (`Llms`, `Robots`, `Schema`, `Serp`, `Headers`, plus `Field`, `Output`) and `Tools`, the tabbed version used inside the dashboard (`embedded`).
  - `tools/checkers.tsx`: `AiBotChecker`, `RobotsTester`, `DomainAgeChecker`, `HreflangChecker`, `ReviewLink`, plus the shared `callTool`, `ErrorNote`, `Chip`.
  - `tools/checkers-bulk.tsx`: `BulkSchemaChecker` (paste URLs or load from sitemap), `SitemapGenerator` (browser-driven crawl with progress and Stop), `RenderedChecker` (paid). The bulk ones send batches to `/api/tools` so each request stays inside the Worker subrequest limit.

**Shared UI:**
- `site-chrome.tsx`: nav and footer.
- `page-shell.tsx`: hero and CTA band.
- `ui.tsx`: rings, sparklines and mock graphics.
- `home-parts.tsx`, `home-extras.tsx`, `steps.tsx`: homepage sections.
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

## Dev mocks (`scripts/`)

- `dev-mock.mjs`: starts Next against the mock and sets the environment, including `RESEND_API_URL`. Setting `EMAILS_ON=1` switches mock emails on.
- `mock-supabase.mjs`: fake Auth, PostgREST and `POST /emails`. `GET /__state` shows the data, including `log.emails`.
