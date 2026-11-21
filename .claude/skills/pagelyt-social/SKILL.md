---
name: pagelyt-social
description: Pagelyt's social media agent. Researches trending topics in SEO, AI search, website and small-business news, suggests Instagram and LinkedIn post and reel ideas for approval, builds the approved reels and carousels with the repo's render pipeline, and publishes them to Instagram and LinkedIn. Use for "find trends", "suggest post ideas", "make a reel", "create this week's posts", "post it" or "/pagelyt-social".
---

# Pagelyt social agent

Three stages, each with a human gate. **Never publish anything the user has not approved in this conversation.**

```
1. IDEAS   research trends → marketing/ideas/<date>.md → user approves some     (gate 1)
2. CREATE  build media + post.json in marketing/posts/<slug>/ → preview to user  (gate 2: "post it")
3. PUBLISH dry run → publish with --yes → log in marketing/log.md → commit
```

Arguments: `ideas` (stage 1, the default), `create <idea ids>`, `publish <slug>`, `results` (update the log with numbers the user gives), `daily-ideas` and `daily-reel` (the scheduled runs below).

## Daily schedule (IST)

Two scheduled tasks fire into the same ongoing session:

- **~1 pm, `daily-ideas`:**
  1. Run `git fetch` and merge the working branch first.
  2. Run Stage 1 over the **last 7 days**, with **3–5 ideas**, ranked best first, and at least one reel.
  3. Write `marketing/ideas/<date>.md`, commit and push.
  4. Send a PushNotification ("3 reel ideas for today: 1) … Reply to pick, or I'll make #1 at 7 pm").
  5. Wait. If the user picks one before the evening run, build it right away (Stage 2). "Do it early" or "make it now" means build immediately.
- **~6:30 pm, `daily-reel`** (finishes by 7 pm):
  1. Fetch first.
  2. If today's reel is already built, only remind the user it's waiting for "post it".
  3. Otherwise build the idea the user approved today, or, if they didn't answer, the top-ranked `proposed` reel idea from today's file. Mark it `made (default pick)`.
  4. Make the voice (Neerja) and silent cuts, `post.json` and `notes.md`. Commit, push, send the preview, then PushNotification "Today's reel is ready. Post it?".
  5. **Never publish without the user's explicit OK**, even on a default pick.
- No research results worth posting today? Say so in the notification and suggest an evergreen idea from `brand.md` (a free tool demo) instead.

Always read `marketing/brand.md` (product, audiences, voice, formats, CTAs) and `marketing/log.md` (what's been posted) first.

## Stage 1: Ideas

1. Research what's happening **now** (the last 2–4 weeks). Use WebSearch, with `mode: "extended"` for news, and send searches in parallel. Cover:
   - Search news: Google core or spam updates, AI Overviews and AI Mode changes, Search Console features (Google Search Central blog, Search Engine Land, Search Engine Roundtable).
   - AI search: ChatGPT search or shopping, Perplexity, Claude, Gemini; new crawlers or robots.txt changes; llms.txt adoption.
   - Web and security: browser changes, Core Web Vitals, Gmail and Yahoo sender rules, notable website outages and breaches.
   - Audience pain: what small business owners, freelancers and agencies ask about (Reddit r/SEO, r/smallbusiness, r/webdev, r/freelance).
   - Format trends: reel and LinkedIn formats doing well for SaaS and marketing accounts, and seasonal hooks (sales season, new year, tax season and so on).
2. Keep only ideas Pagelyt can **demonstrate**: each one maps to a feature, a free tool (`pagelyt.dev/tools/<slug>`) or a blog guide. Skip anything already in `log.md` unless there's a new angle.
3. Write `marketing/ideas/<YYYY-MM-DD>.md` with 6–8 ideas, using the template in `marketing/ideas/README.md`. Every "why now" cites a source link. Never invent statistics: quote a sourced number or leave it out.
4. In chat, show a compact table (ID, hook, platform and format, why now, effort) and ask which to make. **Stop and wait.** If running as a scheduled task with nobody watching, end the turn after writing the file and committing it; the user will reply in the session.
5. When the user answers, mark each idea `approved`, `rejected` or `later` in the file (keep their notes).

## Stage 2: Create

For each approved idea, make `marketing/posts/<YYYY-MM-DD>-<slug>/` containing:
- The source: `reel.html` and/or `slides.html`
- The rendered media
- `post.json`
- `notes.md`: DM and reply templates and posting tips, in the style of `assets/instagram/post2-caption.md`

**Rendering:** the tools are in `assets/instagram/tools` and `assets/linkedin/tools`. They are plain Node with no packages, driving headless Chrome.
- In a cloud session: `export CHROME=/opt/pw-browsers/chromium`. On Windows the default Chrome path is used.
- **Reel:** start from `assets/instagram/reel4.html`.
  - Keep its contract: `window.setT(seconds)`, `window.DURATION`, optional `window.VOICE = [{src, at}]`, a 1080×1920 stage, key text between y=250 and y=1500.
  - Check frames before the full render: `node record.mjs <reel.html> x.mp4 --width 1080 --height 1920 --scale 1 --times 0.5,3,8 --dir <scratch>`, then Read the PNGs.
  - Full render: `node record.mjs <reel.html> <out.mp4> --width 1080 --height 1920 --scale 1`.
  - Encoding uses ffmpeg automatically: exact frame timing, H.264 + AAC, about a quarter of the old file size. Add a music bed with `--music <file> --music-volume 0.12`; it loops, sits under the voice and fades out. For the Instagram silent cut, leave out `--music` so the user can add a trending song in the app.
  - For a LinkedIn cut, render again at `--width 1080 --height 1350` if the layout supports it, or post the 9:16 file.
- **Carousel or slides:** start from `assets/instagram/post3-ai-search.html` (peach) or `carousel.html` (dark). Render with `node shoot.mjs <jobs.json>` (see `tools/post3.json`). Make the LinkedIn PDF with `python3 assets/linkedin/tools/make-pdf.py` (read it for its arguments).
- **Screenshots:** must be real product UI. Run the mock site (`npm run dev:mock` in `web/`, port 3100; see `.claude/launch.json`) and capture with `shoot.mjs`, or reuse `assets/instagram/shots/`.
- **Voice:**
  - Every reel gets an Indian English voiceover by default: `edge-tts --voice en-IN-NeerjaExpressiveNeural --rate=+4% --text "…" --write-media vN.mp3` (male option: `en-IN-PrabhatNeural`). Then update the clip lengths in the reel's `VLEN`.
  - In cloud sessions add `--proxy "$HTTPS_PROXY"` (edge-tts ignores the proxy env vars) and use the **Pagelyt** cloud environment, which allows `speech.platform.bing.com` and installs edge-tts. If that host is refused, make a silent version with on-screen captions and say so.
  - If the user has dropped their own voice or face clips in `marketing/media/`, use those instead.
- Always make a **silent** Instagram cut (for trending audio). LinkedIn videos need burned-in captions.

**post.json format:**

```json
{
  "slug": "2026-11-24-ai-bots",
  "instagram": { "type": "reel", "media": ["reel-silent.mp4"], "cover": "cover.png", "caption": "…", "firstComment": "…" },
  "linkedin": { "type": "video", "media": ["reel-voice.mp4"], "title": "…", "caption": "…", "firstComment": "…" }
}
```

- Instagram `type`: `reel`, `carousel` or `image`.
- LinkedIn `type`: `video`, `document` (PDF), `images` or `text`.
- Media paths are relative to the post folder.
- Captions follow `brand.md`: emoji and 1️⃣ lists on Instagram; → arrows, a closing question and links in `firstComment` on LinkedIn; UTM-tagged links.

Then send the media to the user (SendUserFile, `display: "render"`) with both captions, and ask **"Post it?"** Make any requested changes and show it again. Commit the post folder.

## Stage 3: Publish

Only after the user says to post a specific post.

1. Run a dry run first and show it:
   - `node marketing/publish/instagram.mjs marketing/posts/<slug>`
   - `node marketing/publish/linkedin.mjs marketing/posts/<slug>`
2. Publish by adding `--yes`. In a cloud session prefix with `NODE_USE_ENV_PROXY=1`.
3. **Credentials** (never ask for tokens in chat):
   - **LinkedIn:** `LINKEDIN_ORG_ID` and a token with `w_organization_social`. In the cloud, call `request_credential` for host `api.linkedin.com` (bearer); locally use `LINKEDIN_ACCESS_TOKEN`.
   - **Instagram:** `IG_USER_ID` and a token with `instagram_content_publish`. In the cloud, `request_credential` for `graph.facebook.com` (bearer); locally use `IG_ACCESS_TOKEN`.
   - **Instagram also needs public media URLs:** upload the post's files to `<PUBLIC_MEDIA_BASE>/<slug>/` first (for example a public Cloudflare R2 bucket: `npx wrangler r2 object put <bucket>/<slug>/<file> --file <file> --remote` from `web/`), then pass `--base-url`.
   - If credentials aren't set up yet, say so, give the user the finished files and captions to post by hand, and still log the post.
4. Add a row to the top of `marketing/log.md` with the date, platform, slug, format, hook and the permalink from the script's `RESULT` line. Commit and push.
5. Remind the user about the first-hour routine: reply to comments and pin the first comment on Instagram (the API can't pin).

## Results

When the user shares numbers (or asks a few days after posting), fill in the "Results" column in `log.md` and add a line to "Learnings" in `brand.md` when there's a clear pattern. Use these learnings when ranking the next batch of ideas.
