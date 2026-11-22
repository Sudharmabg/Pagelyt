# Pagelyt social brand brief

The social agent reads this before suggesting ideas or writing a caption. Keep it current: if a post does well or badly, add what we learned under "Learnings".

## What we're selling

- **Pagelyt** (https://pagelyt.dev): a free website audit. You paste a URL and get one score across 8 areas: SEO, speed, AI search (GEO), security, accessibility, domain & email, privacy and site health.
- Every issue is ranked by impact and explained in plain English, often with copy-paste code filled in for your site.
- **Extras:**
  - Google Search Console, GA4 and Google Ads data next to each fix ("fix the page that gets traffic")
  - Ask Pagelyt, an AI assistant that knows your report
  - Competitor compare, shareable and white-label reports, weekly rescans with alerts
  - Consultation booking
- **Free tools** (pagelyt.dev/tools/<slug>):
  - ai-bot-checker, llms-txt-generator
  - robots-txt-tester, robots-txt-generator, raw-vs-rendered-html, hreflang-checker, sitemap-generator
  - serp-preview, schema-markup-generator, bulk-schema-checker
  - security-headers-generator, domain-age-checker, google-review-link-generator
- **Blog guides** (pagelyt.dev/blog/<slug>, see `web/app/blog-data.ts`): GEO, Core Web Vitals, slow websites, the technical SEO checklist, the security checklist, accessibility, Search Console / GA4 / Ads setup, "not showing on Google", AI Overviews, robots.txt for AI crawlers, llms.txt, schema, PageSpeed score, SPF/DKIM/DMARC, image optimisation, title tags.
- **Pricing is hidden** (`PRICING_ON = false`). Always say "free audit" or "free to start". Never quote prices.

## Audiences

1. **Small business owners** (Instagram first): they don't know whether their site works. Talk about lost customers, Google, ChatGPT and spam emails, never jargon.
2. **Freelancers and agencies** (LinkedIn first, the roadmap's wedge customer): audit client sites faster and report professionally (white-label, share links).
3. **Developers and marketers:** technical tips, GEO, schema, Core Web Vitals.

## Voice

- Plain English, short sentences, confident and friendly. Explain any term in five words or fewer.
- One idea per post. Each one gives a fix people can act on today.
- Honest: never promise rankings or guarantee being recommended by AI. GEO is "readiness", made of measurable signals.
- Spelling: British ("optimise", "colour"), matching the site.
- Instagram uses emoji and numbered 1️⃣ 2️⃣ 3️⃣ lists. LinkedIn uses → arrows, ends with a question, uses fewer emoji and keeps links in the first comment.

## Visual style

- **Default:** the pagelyt.dev homepage look. Peach background `#f8e5d4`, ink `#12303f`, purple `#6a30bd`, rainbow ribbons (`#ba8aff → #fe79a2 → #febc77 → #68cea7`), Archivo for headings and Inter for body text. See `assets/instagram/reel4.html` and `assets/instagram/post3-ai-search.html`.
- **Alternative:** the dark launch carousel style (`assets/instagram/carousel.html`).
- Use real product screenshots (from `npm run dev:mock` in `web/`, or pagelyt.dev). Never use made-up UI.

## Voiceover

- Every reel uses **en-IN-NeerjaExpressiveNeural** (Indian English, female, expressive), made with edge-tts at `--rate=+4%`. This is the user's chosen voice, so don't switch it unless asked.
- With music under the voice, keep the music at about 10–15%.

## Reel and post design guidelines

The **Black Friday reel** (`marketing/posts/2026-11-21-black-friday/`) is the reference for every new reel and post. Start new reels from its `reel.html`.

**Look**
- Peach `#f8e5d4` background with the faint purple grid, rainbow ribbons as the backdrop, and the Pagelyt logo on the first and last scene.
- Archivo extra-bold headlines (condensed, tight letter-spacing) with **one key phrase in purple** ("Will your website *survive it?*"). Inter for body text.
- Small purple uppercase kicker pills ("THE RISK") above a section when needed, and a dark chip for dates or context ("Black Friday · Fri 27 Nov").
- White rounded cards (radius about 40 px, soft shadow) for lists and screenshots; numbered badges in brand colours (pink, orange, lilac).
- Big stat numbers in purple (about 400 px) that count up, with the source in small muted text underneath.
- Real Pagelyt UI only (homepage on a phone, real report screenshots), zoomed until the key line is readable on a phone.
- End card: logo → headline → purple pill "Free website audit / pagelyt.dev" → comment keyword line.

**Layout: centred, with no extra space**
- **Everything is centred horizontally:** titles, headlines, body text, stats, cards, pills and captions. Cards use equal side margins (60–70 px).
- **Content is centred vertically too.** Each scene's content (title + body + visual) forms one block placed in the middle of the usable area, so there's no big empty gap above or below it.
  - Instagram reels (1080×1920): centre the block in the safe area y = 250–1500 (middle about y = 875). Key content never goes outside it.
  - Posts and carousels (1080×1350) and LinkedIn cuts: centre the block in the frame, inside the margins.
- Space between the title and the content, and between items, stays tight and even (about 30–60 px). There should be no leftover empty band at the top or bottom; if a scene looks short, scale the content up rather than leaving blank space.
- Ribbons and the grid are background only and don't count as content when judging empty space.

**Motion and sound**
- Something moves every 1–2 s (count-ups, staggered card slide-ins, cursor taps, pulsing highlight rings); scenes cross-fade.
- Neerja Expressive voiceover, word-by-word captions on the LinkedIn cut, and a silent cut for Instagram trending audio.

## Formats and sizes

| Platform | Format | Size | Notes |
|---|---|---|---|
| Instagram | Reel | 1080×1920, 15–30 s | Hook in the first second. Keep text between y=250 and y=1500 (Instagram's UI covers the rest). Silent version for trending audio. |
| Instagram | Carousel | 1080×1350 (4:5), 3–8 slides | Slide 1 is the hook, the last slide is the CTA. |
| LinkedIn | Video | 1080×1350 (4:5) or 1080×1080, 30–60 s | Burned-in captions (most people watch muted). |
| LinkedIn | Document (PDF carousel) | 1080×1350 pages | Best organic reach. Built with `assets/linkedin/tools/make-pdf.py`. |

## CTAs and tracking

- **Instagram:** "🔗 Free audit at the link in bio", or a comment-keyword → DM loop (used so far: PAGELYT → technical SEO checklist, AI → GEO guide). Pick a new keyword per post and write the DM text in the post's notes.
- **LinkedIn:** links go in the first comment, never in the post body.
- **UTM on every link:** `?utm_source=<instagram|linkedin>&utm_medium=<social|dm>&utm_campaign=<post-slug>`.

## Hashtags

- **Instagram (8–12):** #websiteaudit #seo #seotips #aisearch #geo #chatgpt #smallbusinesstips #websitetips #digitalmarketing #webdesign #buildinpublic, plus 2–3 for the topic.
- **LinkedIn (3–5):** #SEO #AISearch #GEO #SmallBusiness #WebDevelopment #TechnicalSEO.

## Posting rhythm

- Instagram: 2 posts a week, at least 1 of them a reel.
- LinkedIn: 1–2 posts a week, Tuesday to Thursday, 8–10am in the audience's timezone.
- Don't post two pieces on the same topic back to back on one platform.
- Reply to comments in the first hour.

## Learnings

_(Add what worked and what didn't after each post.)_
