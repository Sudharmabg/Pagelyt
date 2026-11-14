# Deploying Pagelyt on Cloudflare + Supabase (free tiers)

Architecture

| Piece | Where | What it does |
|---|---|---|
| Web app (Next.js, OpenNext) | Cloudflare Workers + static assets (`wrangler.jsonc`) | Marketing site, dashboard, tools, API routes |
| Database, auth | Supabase (`supabase/migrations/0001_init.sql`) | Scans, leads, saved sites, uptime history, magic-link sign-in |

Cloudflare now recommends Workers with static assets for Next.js. Connect the repo with **Workers Builds**
(Git integration) and it behaves like Pages: push to deploy. `@opennextjs/cloudflare` is the adapter.

## One-time setup

1. **Supabase**
   - Create a project. In *SQL editor* run `supabase/migrations/0001_init.sql`.
   - *Authentication > URL configuration*: set Site URL to your domain and add `https://YOUR-DOMAIN/account` as a redirect.
   - *Authentication > SMTP*: set your own sender (Resend free tier works). The built-in sender is limited to a couple of emails an hour.
   - Then run `supabase/migrations/0002_whitelabel_ai.sql` (brands, shared reports, plans, AI visibility), `0003_alerts_history.sql`,
     `0004_password_auth.sql` (saved progress, the email-check function) and `0005_visual_monitoring.sql` (homepage screenshots
     for the before/after view; without it scans still work, just with no screenshots) and `0006_agency_compare.sql` (agency/owner
     answer, competitor comparisons) and `0007_admins.sql` (who can open `/admin`). Then follow **Password accounts** and **Admin panel** below.
   - Copy the project URL, anon key and service-role key (*Project settings > API*).
2. **Cloudflare Turnstile** (recommended): create a widget, copy site key and secret.
3. **Google PageSpeed key** (for Core Web Vitals): Google Cloud console, enable *PageSpeed Insights API*, create an API key.
4. **Edit `wrangler.jsonc`**: replace `YOUR-PROJECT` and the domain.
5. **Secrets** (never commit these):
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put CRON_SECRET            # any long random string
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put PAGESPEED_API_KEY
   npx wrangler secret put RESEND_API_KEY         # optional: alert and client report emails
   npx wrangler secret put OPENAI_API_KEY         # AI visibility (ChatGPT) and Pagelyt Assistant
   ```
   Emails stay off until you also set the variable `EMAILS_ON=1` (do that once the Resend domain is
   verified). One switch covers score alerts (`ALERT_FROM`, default `Pagelyt <alerts@pagelyt.dev>`) and
   "Share branded report" emails to clients (`REPORTS_FROM`, default `reports@pagelyt.dev`; the sender shows
   as "<Brand> via Pagelyt" and replies go to the brand's contact email, else the account email). Client
   emails: one address per send, 20 a day per account, 3 a day to the same address.
6. **Build-time public variables** (Workers Builds > Settings > Variables, or `.env.local` locally):
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   (the other `NEXT_PUBLIC_*` values are in `wrangler.jsonc`).

## Domain (`pagelyt.dev`)

The domain is registered with Cloudflare, so its DNS is already in the same account. `pagelyt.dev` is the main
address; `www.pagelyt.dev` redirects to it.

1. *Workers & Pages > pagelyt > Settings > Domains & Routes*: add custom domains `pagelyt.dev` and `www.pagelyt.dev`.
2. *pagelyt.dev > Rules > Redirect Rules*: hostname equals `www.pagelyt.dev` → dynamic redirect to
   `concat("https://pagelyt.dev", http.request.uri.path)`, status 301, preserve query string.
3. Build variable `NEXT_PUBLIC_SITE_URL=https://pagelyt.dev`, then redeploy (it is baked in at build time; canonical
   links, the sitemap, share links and PDF rendering all use it).
4. *pagelyt.dev > Email > Email Routing*: add a routing rule forwarding `customer_care@pagelyt.dev` (the contact address on the site) to your inbox.
5. Resend: add `pagelyt.dev` and its SPF/DKIM records (Email Routing's MX records can stay). Once *Verified*, set
   `EMAILS_ON=1` and follow **Password accounts** steps 3 to 5 with `pagelyt.dev` as the domain
   (SMTP sender `no-reply@pagelyt.dev`).
6. Turnstile: add `pagelyt.dev` to the widget's hostnames.

## Admin panel (`/admin`)

Admins are kept in the Supabase `admins` table, not in an environment variable. Sign-in is the normal Supabase
password sign-in, so passwords stay hashed by Supabase Auth and are never stored by this app.

1. Create the account: *Authentication > Users > Add user*, enter the email and a strong password and tick
   *Auto Confirm User* (or sign up on the site and confirm the email).
2. In the *SQL editor*: `insert into public.admins (email) values ('you@example.com');` (lower case).
3. Sign in at `/login`, then open `/admin`. Remove an admin with `delete from public.admins where email = '...';`

Only a verified email in that table gets in. The table has row-level security with no policies, so the browser
cannot read it or add itself; only the server's service-role key can.

## Password accounts (modal sign-up, `/login`)

Entering a website decides the form. The modal asks `/api/auth/site` whether that website (its **root domain**:
`www.`, subdomains, paths and http/https all count as one site) is already registered:

- **Registered** → *Log in* (email + password). Only the account that owns the website can scan it; anyone else is told
  it belongs to another account and can **prove ownership** at `/claim` (a meta tag on the homepage or a DNS TXT record),
  which moves the website to them.
- **New** → *Create account* (name, email, password; no phone number). The scan starts at once and the new account lands on
  its dashboard, **locked** behind the 6-digit code from its email; the scan keeps running from that page. The code is
  asked for once per account. The server sends no report data for an unverified account's scan.
- An unverified sign-up holds its website for 24 hours. Throwaway inboxes are refused, and Gmail-style aliases
  (`name+1@`, `n.ame@gmail.com`) count as the same inbox as an existing account.
- Signed in on a device lasts **7 days from sign-in** (enforced by the server from the token's sign-in time, and by the
  browser, which signs itself out). The header shows the signed-in name with a Log out menu; the owner's dashboard says
  "Hi, <name>" and their PDF cover says "Prepared for <name>". Shared-link viewers never see the name.
- Competitor scans (paid plans) don't take ownership of the rival's website.

Do these once, in this order:

1. **Run `supabase/migrations/0004_password_auth.sql`**, then **`0009_site_owners.sql`** (SQL editor). Deploy the code only
   after 0009 has run: it removes the `leads.phone` column, which the new code no longer sends.
2. **Supabase > Authentication > Sign In / Providers > Email**: keep **Confirm email** ON, set **Minimum password length** to 8.
3. **Resend** (sends the confirmation and password-reset emails). **This needs a domain you own**: without a verified
   domain Resend only sends to your own account address, and Supabase's built-in email only reaches team members, so real
   visitors would never get their confirmation or reset links. Until the domain is bought, sign-up emails will not reach
   the public. (The `workers.dev` address is fine as the Site URL and redirect URL in step 5 in the meantime.)
   1. resend.com > *Domains* > add your sending domain and add the DNS records it shows (SPF and DKIM). Wait for *Verified*.
   2. *API Keys* > create a key with *Sending access* (you can reuse the one used for score-drop alerts).
4. **Supabase > Authentication > SMTP Settings** > enable custom SMTP:
   host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key,
   sender email = an address on the verified domain (for example `no-reply@yourdomain.com`), sender name `Pagelyt`.
5. **Supabase > Authentication > URL Configuration**: Site URL = your live address. Add these Redirect URLs
   (replace the domain): `https://YOUR-DOMAIN/auth/verified`, `https://YOUR-DOMAIN/auth/reset`, `https://YOUR-DOMAIN/account`,
   and for local testing `http://localhost:3000/**`.
6. **Supabase > Authentication > Email Templates**: edit *Confirm signup* so it shows the code, not a link, for example
   `<p>Your Pagelyt code is</p><h2>{{ .Token }}</h2><p>Enter it on your dashboard. It expires in an hour.</p>`.
   In *Sign In / Providers > Email*, keep **Email OTP length** at 6. Edit *Reset password* so it shows the code too,
   for example `<p>Your Pagelyt password reset code is</p><h2>{{ .Token }}</h2><p>Enter it on the sign-in page. It expires in an hour.</p>`
   (Forgot password in the sign-in modal, at `/login?forgot=1` and on the account page asks for this 6-digit code, not a link).
7. **Supabase > Authentication > Rate Limits**: with custom SMTP on, raise *emails per hour* (default is only a few).

   **No reset or confirmation email arriving?** It is almost always steps 3, 4 or 7, not the code. `/api/auth/forgot`
   now checks Supabase's reply: the Worker log shows `recover: Supabase answered <status> <code>`, and visitors see
   "Too many reset emails were sent just now" (Supabase answered 429: raise the limit in step 7) or "We couldn't send
   the email just now" (any other error: usually custom SMTP is off, so Supabase's built-in email only reaches team
   members, or the Resend domain isn't verified). Neither message says whether an account exists.
8. **Turnstile**: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Without them the human check is skipped,
   which leaves sign-up and sign-in open to bots (the rate limits below still apply).

Security behaviour worth knowing:

- Every field is validated twice (browser and server) from one shared set of rules in `lib/validate.ts`
  (`node --experimental-strip-types --test lib/validate.test.ts`).
- Rate limits (Postgres `rate_limit_hit`, keyed by IP and by a hash of the email): website lookup 30/15 min per IP; email
  code 6 tries/15 min per address and 30 per IP; ownership checks 20/hour per IP; sign-up 3/hour; password sign-in 5/15 min per address and 20/15 min per IP; resend 1/min and 5/hour. They answer `429`
  with `Retry-After`, and sign-up and sign-in **block** (not allow) if the limiter is unreachable.
- The caller's IP comes only from Cloudflare's `cf-connecting-ip` header in production.
- Passwords are sent to our own `/api/auth/*` routes over HTTPS only to be forwarded to Supabase. They are never logged or stored by the app.
- Forgot password: 1 code email a minute and 5 an hour per address; 6 code tries per 15 minutes per address. A reset or a change
  from the account page (which asks for the current password first, 5 tries per 15 minutes) signs out other sessions and
  emails a "your password was changed" notice. In *Sign In / Providers > Email*, **Secure password change** can stay off:
  the current-password check happens in `/api/auth/password`.
- A static Content-Security-Policy is sent in production (`next.config.ts`). It allows inline scripts because Next.js needs them;
  a nonce-based policy would force every page to render per request and lose caching.

## Consultation booking (`/consultation`)

Visitors pick a session and a free time on the page (no sign-in; Turnstile instead) and the booking is confirmed straight
away: the visitor gets an email with a calendar file and a cancel link, and `CONTACT_EMAIL` gets a heads-up. Nothing is
paid at booking; send the invoice by email (Professional and Business subscribers' free annual session comes off it).

1. Run `supabase/migrations/0013_google_ranges_bookings.sql` (also listed under Google integrations).
2. Emails need `EMAILS_ON=1` and `RESEND_API_KEY` (as for alerts); without them bookings still work but nobody is emailed.
3. In **/admin > Bookings**: set the weekly hours (default every day 9:00–22:00 IST, shown to visitors in their own timezone),
   minimum notice (24 hours), how far ahead (30 days) and the buffer between calls (15 minutes); block days off. For each
   booking, paste the video call link (the visitor is emailed it with an updated calendar file), move it to another free
   time, mark it done or cancel it (both email the visitor).

Limits: 60 slot lookups per 10 minutes and 5 bookings an hour per IP; the database refuses two bookings at the same start.

## White-label reports

- Brands (logo, colour, contact, footer) are managed at `/account/brand`. Brand rows are protected by row-level security.
- On any dashboard, **Share branded report** creates a link like `/r/<long-token>`. The page carries the agency brand, has no Pagelyt navigation, is `noindex`, can expire and can be withdrawn from `/account/brand`. **Download PDF** is rendered on the server (see **Server PDFs**) for paid plans, and falls back to the browser's print-to-PDF when that is unavailable.
- The report must belong to the signed-in account (use **Save this site** first).
- `/r/demo` is a public sample (`?brand=Acme&color=%23e11d48` tries a brand on).
- Plan gate: Business plan. Until billing exists, set `PAGELYT_OPEN_FEATURES=1` or set `profiles.plan = 'business'` for a user in the SQL editor.

## Server PDFs (Cloudflare Browser Rendering)

- Needs the **Workers Paid plan**. `wrangler.jsonc` binds Browser Rendering as `BROWSER`; nothing else to configure.
- `POST /api/report/pdf` opens our own print page (`/print/<id>` for the owner, `/r/<token>` for a share) in headless Chrome and returns an A4 PDF. Paid plans only, 30 PDFs an hour per account. Without the binding it answers 501 and the button falls back to print-to-PDF.
- Off in `next dev` (OpenNext would start a slow local proxy); set `PDF_DEV=1` to try it there. Set `NEXT_PUBLIC_SITE_URL` so Chrome loads the public domain.

## Agency dashboard and competitor comparisons

- After a signed-in owner's first finished report, a one-time modal asks whether they are an agency (Esc = ask later; changeable under *Account > How you use Pagelyt*). Paid agencies go to `/account/sites`; free agencies go to `/consultation?topic=agency` until checkout exists. Paid agencies also land on `/account/sites` after login.
- `/account/sites`: every saved site with score, change, trend, weakest area and high-priority issues, plus a bulk rescan that runs one site at a time in the open tab (each rescan counts towards the normal scan limit).
- **Compare competitors** on a dashboard scans up to three rival sites (normal scans, same limit) and opens `/compare/<id>`.
- Accessibility now also uses Lighthouse's rendered checks (colour contrast etc.) from the existing PageSpeed call; no new key.
- Plan gate: any paid plan (or `PAGELYT_OPEN_FEATURES=1`).

## AI visibility tracking

- Per site (`/account/visibility/<siteId>`): add the questions people ask, optional brand names and competitors, run a check, and see how often ChatGPT names and cites the site, average position, share of voice and a trend. Automatic weekly checks are paused until the cron Worker is rebuilt (see Phase 2).
- System: ChatGPT only, through the OpenAI Responses API with web search, switched on by the `OPENAI_API_KEY` secret. Model: `OPENAI_MODEL` (default `gpt-4.1-mini`). Each call uses web search, so it costs money: 5 questions weekly is about 20 calls a month per site. Keep an eye on OpenAI spend and set a monthly limit in the OpenAI dashboard.
- Runs saved earlier from Perplexity or Claude stay in `ai_runs` but are hidden everywhere (page, shared reports).
- Honest limits: answers vary by wording, location and time, and API answers can differ from the ChatGPT app. A failed call is stored as an error and is never counted as "not named".
- Request and response shapes follow OpenAI's public docs; if the format changes, runs will show errors rather than wrong numbers. Parsers are covered by `node --experimental-strip-types --test lib/ai/*.test.ts`.
- Plan gate: Professional and Business (or `PAGELYT_OPEN_FEATURES=1`).

## Pagelyt Assistant

- Dashboard star feature **Ask Pagelyt** (`?view=assistant`, plus the floating Ask button), owner only. It answers website-optimisation questions about the open report, using the report, the fix guides (`lib/scan/guides.ts`) and the blog posts as sources; anything else gets a short, polite refusal.
- Needs `OPENAI_API_KEY`. Model: `OPENAI_CHAT_MODEL` (default `gpt-5`, reasoning effort low). Change it to a newer or cheaper model without a code change.
- Limits per account: 6 questions a minute; 10 a day on the free plan, 100 on paid plans (while `BILLING_ON` is false everyone counts as paid). Questions up to 1,000 characters, the last 10 turns sent, answers up to 2,500 output tokens.
- Each question sends the report summary, an index of every guide and post, and the full text of the 3 that match best (not the whole library, which is about 32k tokens).
- When the site has Google Search Console connected, the cached numbers (clicks per issue, near-page-one searches, drops, pages not indexed) go in too, from `gscBrief`.

## Google integrations (Search Console, Analytics and Google Ads)

What it does: dashboard star feature **Google data** (`?view=google`, owner only, saved sites only). One **Connect Google** button; Pagelyt asks Google only for the permission the product needs (Search Console first: `webmasters.readonly`, plus `openid email` to show which account is connected). Then: real clicks and impressions on every finding, Top fixes ordered by Google traffic, searches at positions 8–20, page-one results with a low click rate, pages that lost clicks, URL Inspection for up to 15 key pages, and the same numbers in Ask Pagelyt. Data is cached in `google_cache` and refetched when the dashboard opens and it is older than 24 hours (Refresh now forces it; 6 an hour per site). Plan gate: Professional and Business (open to everyone while `BILLING_ON` is false).

**Analytics tab** (the second tab in Google data, its own Connect button, which asks for `analytics.readonly` on top): the site is matched to its GA4 property through its web stream URL (picker otherwise). It shows visitors and engagement per issue (the "N visits" badges on findings), a traffic-drop detective (pages down 30% or more with the channel that lost most and the issues on them) and the 28-day report (totals, channels, pages that don't hold visitors). One `batchRunReports` call per refresh, cached 24 hours like Search Console. **Analyse with AI** sends the Analytics numbers, the open findings and the Search Console summary to OpenAI (`OPENAI_CHAT_MODEL`) and caches up to 6 insights for 24 hours (source `ga4_ai`); it doesn't use the chat quota but is capped at 4 runs a day per site and 20 per account. The top 3 show on the Overview, and the owner's PDF export includes an Analytics section (the print page only shows it with a signed 15-minute pass, so shared links never do).

**Google Ads tab** (the third tab, its own Connect button, which asks for `adwords` on top; Google has no read-only Ads scope, but Pagelyt only ever runs search queries and never changes campaigns, budgets or bids): the site is matched to the Ads account whose ads land on its domain in the last 30 days, including client accounts under a manager (agency) account; a picker otherwise. It shows the 28-day summary (spend, clicks, conversions, cost per conversion against the 28 days before, campaigns), ad spend on landing pages with issues (and the issues ranked by that spend; the "£X ad spend" badges on findings), keywords Google rates below average for landing-page experience, searches paid for where the site already ranks in Search Console's top 3, what the organic clicks would cost as ads at the account's own prices, and searches with spend and no conversions. Paid vs organic and organic value need Search Console connected too. **Analyse with AI** on this tab is separate from the Analytics one: its own cache (source `ads_ai`, 24 hours) and its own caps (4 a day per site, 20 per account). The owner's PDF gets a Google Ads section with the same pass as Analytics, and Ask Pagelyt gets the Ads summary.

### 1. Database

Run `supabase/migrations/0010_google.sql`, then `0011_google_analytics.sql`, then `0012_google_ads.sql`, then `0013_google_ranges_bookings.sql` (date windows, Search Console AI and consultation bookings), in the Supabase SQL editor before deploying.

### 2. Google Cloud project (one time, about 20 minutes)

1. Go to <https://console.cloud.google.com/>, sign in with the Google account that should own the app (a company account, not a personal one), and **create a project** called `Pagelyt`.
2. **APIs & Services → Library**: enable **Google Search Console API**, **Google Analytics Data API**, **Google Analytics Admin API** and **Google Ads API**.
3. **APIs & Services → OAuth consent screen** (now called **Google Auth Platform**):
   - App name `Pagelyt`, support email, logo (120×120), app home page `https://pagelyt.dev`, privacy policy `https://pagelyt.dev/privacy`, terms `https://pagelyt.dev/terms`.
   - Authorised domain: `pagelyt.dev`. Developer contact email.
   - Audience: **External**.
   - **Data access → Add scopes**: `openid`, `.../auth/userinfo.email`, `.../auth/webmasters.readonly`, `.../auth/analytics.readonly`, `.../auth/adwords`.
   - **Test users**: add your own Google address and anyone testing before verification (up to 100).
4. **Clients → Create client → Web application**, name `Pagelyt web`:
   - Authorised JavaScript origins: `https://pagelyt.dev` (and `http://localhost:3000` for local tests).
   - Authorised redirect URIs: `https://pagelyt.dev/api/google/callback` (and `http://localhost:3000/api/google/callback`). It must match exactly.
   - Copy the **Client ID** and **Client secret**.

### 3. Secrets

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_TOKEN_KEY      # any random string of 32+ characters; encrypts stored refresh tokens
```

Optional: `GOOGLE_REDIRECT_URI` if the callback URL isn't `<site origin>/api/google/callback` (e.g. behind a proxy); `GOOGLE_ADS_API_VERSION` to pin another Google Ads API version than the default `v26` (Google retires each version about a year after release, so bump it when they announce a sunset). **Never change `GOOGLE_TOKEN_KEY` once people have connected**: stored tokens can't be read with a new key, so everyone would have to connect again.

### 4. Testing mode vs verification

- While the consent screen's publishing status is **Testing**, only the test users can connect, Google shows an "unverified app" warning, and **their connection expires after 7 days** (they connect again from the Google data view).
- To open it to everyone: **Publish app**, then submit for **verification**. Search Console, Analytics and Ads read-only scopes are *sensitive* (not restricted), so there is no security assessment, but Google wants: a verified domain in Search Console for `pagelyt.dev`, the privacy policy saying what Google data is used for and that it isn't sold or used for ads (Google's Limited Use rules), and a short **YouTube video** showing the consent screen and where the data appears in Pagelyt. Allow 1–4 weeks. Include the Analytics and Ads scopes in the submission (the video should show the Analytics and Google Ads tabs, that Pagelyt only reads Ads data, and that the AI insights are made from the owner's own numbers).

### 5. Google Ads API access (no developer token)

Google retired Ads developer tokens on 9 September 2026: API access now belongs to the **Cloud project** that owns the OAuth client above, and the API Center in Google Ads no longer handles requests. No manager account or extra secret is needed.

1. In the same Cloud project: **APIs & Services → Library → Google Ads API → Enable**. This gives *Test* access, which only reads test accounts.
2. Open the **Google Ads API** overview page in that project and apply for **Explorer access** (real accounts, up to 2,880 operations a day; usually approved automatically). Basic or Standard access needs brand verification first and is only worth it at much higher volume.
3. Google may refuse projects on the free trial or with billing turned off; turn on billing if the application is rejected.

Until the project is approved, Google refuses real accounts and the Ads tab says so ("still waiting for Google's approval") instead of failing. Pagelyt reads each owner's accounts as them, through their own manager account when they have one.

### Local testing

`npm run dev:mock` points every Google call at the mock server's fake Google (consent, tokens, Search Console, Analytics and Google Ads with made-up but stable numbers; one page loses half its visits so the drop detective has something to show, and a manager account holds one Ads account per saved site with most spend landing on the second page), so the whole flow works with no Google project. Without `OPENAI_API_KEY` it also fakes OpenAI for **Analyse with AI** (`OPENAI_MOCK_URL`). `MOCK_GOOGLE=deny`, `noscope`, `empty` or `adstoken` try a declined consent, an unticked permission, an account with no properties and a Cloud project Google hasn't approved for Ads yet.

Unit tests for the Google and AI helpers: `node --import ./scripts/test-resolve.mjs --experimental-strip-types --test "lib/**/*.test.ts"`.

### How it is built

- Tokens: the refresh token is encrypted with AES-GCM (key from `GOOGLE_TOKEN_KEY`) in `google_connections`; access tokens are fetched per request and never stored. Disconnect (account page) revokes the token at Google and deletes the connection, links and cache. A token Google rejects as revoked removes the connection.
- Consent round trip: `/api/google/connect` returns Google's URL with a signed 15-minute `state` (account, site, report) and PKCE; `/api/google/callback` checks the state, swaps the code, stores the token and matches the site to its Search Console property (`sc-domain:` first, then URL-prefix). If nothing matches, the view shows a property picker.
- Each refresh makes about 22 Google requests (6 Search Analytics queries and up to 15 URL inspections), inside a Worker's subrequest budget. URL Inspection allows 2,000 a day per property.
- Analytics: the callback lists the account's GA4 properties (Admin API) and reads up to 25 properties' web streams to find the one whose URL matches the site. Each refresh is one Data API `batchRunReports` call (5 reports: totals, daily, pages, channels, page × channel) for the last 28 days ending yesterday and the 28 days before.
- Google Ads: REST API with GAQL `googleAds:search`. Connecting lists the accessible accounts (up to 15, plus the client accounts of up to 3 managers) and checks up to 12 for ads landing on the site. Each refresh is 7 search queries (account, daily totals for both periods, campaigns, landing pages, keywords with Quality Score and landing-page rating, ads' final URLs for keywords without their own, search terms). Money comes in micros and is shown in the account's currency.
- AI insights: OpenAI Responses API with a strict JSON schema; the reply is checked again so only real page paths and finding ids are kept.

## Commands

```bash
npm run dev              # local, uses an in-memory store unless Supabase env vars are set
npm run dev:mock         # local with a mock Supabase on :54321 (MOCK_PLAN=professional to test paid features)
npm run cf:preview       # build for Workers and run it locally in workerd
npm run cf:deploy        # build and deploy the web app
```

## How a scan works on the free plan

A Worker invocation gets about 50 outbound requests and little CPU, so a scan is split into five stages and the
browser calls them in turn (`POST /api/scan`, then `POST /api/scan/:id/step` until `done`). Each stage parks its
results in `scans.state`. This also drives the real progress screen. A cron Worker (removed for now) will drive the same endpoints
for scheduled rescans.

| Stage | Work | Outbound requests |
|---|---|---|
| 1 | page, robots.txt, sitemap, llms.txt, http→https check | ~12 |
| 2 | DNS over HTTPS (MX, NS, SPF, DMARC), RDAP expiry, 4 exposure probes | ~9 |
| 3 | up to 18 links, no redirects followed | 18 |
| 4 | PageSpeed Insights, mobile and desktop | 2 |
| 5 | scoring | 0 |

## Free-plan limits to watch (check current numbers on Cloudflare and Supabase pricing pages)

- **CPU per invocation (free Workers: ~10 ms).** Parsing a large page with cheerio may exceed this. If scans fail
  with CPU errors, move to Workers Paid ($5/month): CPU limits rise to seconds. Nothing in the code changes.
- **Requests per day (free Workers: 100,000).** A scan is about 6 requests plus page views.
- **Supabase free projects pause after a week of inactivity.** Without the cron Worker nothing keeps it awake, so open the site or the Supabase dashboard now and then.
- **Supabase free has no backups.** Export periodically (*Database > Backups* or `pg_dump`).

## What changed because of the edge runtime

- Scans use `fetch` only. **SSL expiry and TLS-version checks are not possible** (Workers cannot read certificates), so
  those findings no longer appear. `global_fetch_strictly_public` makes the runtime refuse internal addresses.
- DNS uses Cloudflare DNS over HTTPS.
- Rate limiting uses a Postgres function (`rate_limit_hit`); Turnstile guards the scan form.
- If you ever run this on a plain Node server instead, re-add resolved-IP checks in `lib/scan/fetcher.ts`.

## Phase checklist

- [x] **Phase 0** foundations: edge-safe scanner, Supabase schema + RLS, Cloudflare config, security headers
- [x] **Phase 1** staged scan with real progress, Turnstile, magic-link accounts, saved sites, report history
- [ ] **Phase 2** scheduled rescans, uptime checks, down/recovered and score-drop alerts (cron Worker removed for now; the app-side endpoints in `app/api/internal` are kept)
- [x] **Phase 2b** AI assistant in the dashboard (Pagelyt Assistant, OpenAI, daily caps)
- [ ] **Phase 2c** server-rendered PDF reports (Cloudflare Browser Rendering)
- [ ] **Phase 3** Razorpay plans and quotas, consultation booking, admin dashboard
- [x] **Phase 4a** white-label reports (brands, shareable branded reports) and AI visibility tracking
- [ ] **Phase 4b** competitor site comparison, Search Console and Analytics
