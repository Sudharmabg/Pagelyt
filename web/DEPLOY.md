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
     answer, competitor comparisons). Then follow **Password accounts** below.
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
   npx wrangler secret put RESEND_API_KEY         # optional: score-drop alert emails (also set ALERT_FROM)
   ```
6. **Build-time public variables** (Workers Builds > Settings > Variables, or `.env.local` locally):
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   (the other `NEXT_PUBLIC_*` values are in `wrangler.jsonc`).

## Password accounts (modal sign-up, `/login`)

Visitors enter an email in the scan modal. A new email gets name, phone, password and confirm password, plus one
confirmation link; a known email just asks for the password. Reports opened with only a link are **view only**; the
signed-in owner can edit, mark findings fixed and rescan.

Do these once, in this order:

1. **Run `supabase/migrations/0004_password_auth.sql`** (SQL editor). Deploy the code only after it has run.
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
6. **Supabase > Authentication > Email Templates**: edit *Confirm signup* and *Reset password* to Pagelyt wording. Keep `{{ .ConfirmationURL }}`.
7. **Supabase > Authentication > Rate Limits**: with custom SMTP on, raise *emails per hour* (default is only a few).
8. **Turnstile**: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Without them the human check is skipped,
   which leaves sign-up and sign-in open to bots (the rate limits below still apply).

Security behaviour worth knowing:

- Every field is validated twice (browser and server) from one shared set of rules in `lib/validate.ts`
  (`node --experimental-strip-types --test lib/validate.test.ts`).
- Rate limits (Postgres `rate_limit_hit`, keyed by IP and by a hash of the email): email check 10/15 min per IP and 5/15 min per
  address; sign-up 3/hour; password sign-in 5/15 min per address and 20/15 min per IP; resend 1/min and 5/hour. They answer `429`
  with `Retry-After`, and sign-up and sign-in **block** (not allow) if the limiter is unreachable.
- The caller's IP comes only from Cloudflare's `cf-connecting-ip` header in production.
- Passwords are sent to our own `/api/auth/*` routes over HTTPS only to be forwarded to Supabase. They are never logged or stored by the app.
- A static Content-Security-Policy is sent in production (`next.config.ts`). It allows inline scripts because Next.js needs them;
  a nonce-based policy would force every page to render per request and lose caching.

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

- Per site (`/account/visibility/<siteId>`): add the questions people ask, optional brand names and competitors, run a check, and see how often each AI system names and cites the site, average position, share of voice and a trend. Automatic weekly checks are paused until the cron Worker is rebuilt (see Phase 2).
- Systems: Perplexity, ChatGPT (OpenAI) and Claude (Anthropic), each switched on by its API key secret. Each call uses the provider's web search, so it costs money: 5 questions × 3 systems × weekly is about 60 calls a month per site. Keep an eye on provider spend.
- Honest limits: answers vary by assistant, wording, location and time, and API answers can differ from the consumer apps. A failed call is stored as an error and is never counted as "not named".
- Request and response shapes follow each provider's public docs; if a provider changes its format, runs will show errors rather than wrong numbers. Parsers are covered by `node --experimental-strip-types --test lib/ai/*.test.ts`.
- Plan gate: Professional and Business (or `PAGELYT_OPEN_FEATURES=1`).

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
- [ ] **Phase 2b** AI explanations and assistant (needs an Anthropic API key held as a Worker secret and a cost cap)
- [ ] **Phase 2c** server-rendered PDF reports (Cloudflare Browser Rendering)
- [ ] **Phase 3** Razorpay plans and quotas, consultation booking, admin dashboard
- [x] **Phase 4a** white-label reports (brands, shareable branded reports) and AI visibility tracking
- [ ] **Phase 4b** competitor site comparison, Search Console and Analytics
