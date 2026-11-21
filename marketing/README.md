# Marketing: the Pagelyt social agent

A Claude Code skill (`.claude/skills/pagelyt-social/SKILL.md`) that runs the Instagram and LinkedIn pipeline:

1. **Ideas:** researches trending SEO, AI search and website topics, then writes 6–8 Pagelyt-specific ideas with sources to `ideas/<date>.md`. You approve the ones you like.
2. **Create:** builds each approved reel or carousel with the existing render tools (`assets/instagram/tools`, `assets/linkedin/tools`), writes the captions, and shows you a preview.
3. **Publish:** after you say "post it", posts to Instagram and LinkedIn with the scripts in `publish/`, then logs the post in `log.md`.

Nothing is posted without your OK. The publish scripts are dry runs unless `--yes` is passed.

## Use it

In Claude Code, from the repo:

- `/pagelyt-social ideas`: research and suggest
- "approve 1 and 4": the agent builds them and shows previews
- "post it": dry run, then publish

It can also run on a schedule (for example every Monday) in a fresh cloud session that does the research and notifies you. You approve in that session.

## Files

| Path | What |
|---|---|
| `brand.md` | Product facts, audiences, voice, formats, CTAs, hashtags, learnings |
| `log.md` | Everything posted, with results; used to avoid repeats |
| `ideas/` | One file per research run |
| `posts/<date>-<slug>/` | Source HTML, rendered media, `post.json`, `notes.md` |
| `media/` | Your own clips (face video, voice) to reuse in reels; git-ignored |
| `publish/instagram.mjs` | Instagram Graph API: reel, carousel, image, first comment |
| `publish/linkedin.mjs` | LinkedIn Posts API: video, PDF document, images, text, first comment |

## One-time setup for auto-posting

### LinkedIn (company page)

1. Create an app at developer.linkedin.com and link it to the Pagelyt page.
2. Request the **Community Management API** product (scope `w_organization_social`). LinkedIn reviews this.
3. Generate a token as a page admin, and note the numeric organisation id (it's in the page admin URL).
4. Set `LINKEDIN_ORG_ID`, plus `LINKEDIN_ACCESS_TOKEN` locally. In a cloud session the agent asks for the token through a secure form instead.

### Instagram

1. Switch @pagelyt.dev to a **Business** or **Creator** account and link it to a Facebook Page.
2. Create a Meta app (developers.facebook.com) with Instagram Graph API permissions: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`.
3. Get a long-lived token and your IG user id.
4. Set `IG_USER_ID`, plus `IG_ACCESS_TOKEN` locally.
5. Instagram downloads media from a public URL. Make a public bucket (for example Cloudflare R2, since the site already runs on Cloudflare) and set `PUBLIC_MEDIA_BASE` to its URL.

Until this is set up, the agent hands you the finished files and captions to post by hand.

## Test without posting

```bash
node marketing/publish/linkedin.mjs marketing/posts/2026-11-21-reel4-linkedin
```
