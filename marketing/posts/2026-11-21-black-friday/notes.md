# Black Friday reel (idea 1, 2026-11-21)

**Files:**
- `reel-voice.mp4` (34 s): Neerja voiceover. Instagram default; `post.json` uses it, since API posts can't add Instagram music.
- `reel-silent.mp4` (20 s): no voice. Post by hand and add a trending song in the app.
- `reel-linkedin.mp4` (34 s): voiceover plus word-by-word captions, for LinkedIn.
- `cover.png`: cover frame for all three.

**Post by:** 26–27 Nov. The hook now says "Black Friday is here" (v2); the date chip says Fri 27 Nov. After the 27th, swap the hook for Cyber Monday (30 Nov) or a general "before the Christmas rush".
Best slots: Instagram 7–9 pm IST; LinkedIn Tuesday or Wednesday, 8–10 am.

## Instagram: when someone comments SALE

1. Reply publicly: "Sent! Check your DMs 📩"
2. DM:
   "Hey! Here's our guide to the 10 most common reasons a site is slow, and how to fix each one 👉 https://pagelyt.dev/blog/why-is-my-website-slow?utm_source=instagram&utm_medium=dm&utm_campaign=black-friday
   Want to see which ones your store has? Run a free audit at pagelyt.dev before Friday 🙌"
3. DMs closed: "Your DMs look closed, here's the guide: pagelyt.dev/blog/why-is-my-website-slow"

Pin the first comment straight after posting (the API can't pin).

## Reply templates

- "My site is on Shopify/Wix, can I still fix this?":
  "Yes. Most fixes are settings or apps: compress images, remove apps you don't use and lazy-load what's below the fold. The audit tells you which ones apply to your store."
- "Is 300 KB a hard rule?":
  "A rule of thumb, not a limit. Hero images can be bigger if they're compressed and sized right. The aim is no surprise multi-MB photos."
- "How do I know which app is slowing me down?":
  "Run the free audit: it lists render-blocking scripts and heavy third-party files by name, so you can see which app adds them."
- "Will this survive a traffic spike?":
  "A faster page uses less server time per visitor, which helps, but for big spikes also check your hosting plan and use a CDN. Pagelyt shows the page-side fixes."

## Source

61% and 50% figures: Network Solutions survey of 507 online store owners, reported by TechRadar:
https://www.techradar.com/pro/your-small-business-could-lose-out-on-black-friday-business-if-your-website-isnt-resilient-enough-heres-what-you-need-to-know

## Critic pass (2026-11-21)

`check-reel.mjs`: all ✓ on all three cuts. Voice cuts are 34.4 s at −14.2 LUFS with true peak −1.5 dBTP; the silent cut is 20 s.
- Hook: pass. The first frame is the cover: "Will your website survive it?" plus the date chip.
- Pacing: was 37 s. Shortened voice line 2 and the gaps between lines to get to 34 s. Something moves every 1–2 s.
- Readability: pass. Zoomed the Top fixes screenshot (1500 px wide) so the highlighted fix is readable on a phone. Key text stays between y = 250 and 1500.
- Captions: fixed. Outline text looked muddy over the ribbons, so phrases now sit on a dark panel. A word left on its own ("minute,") is merged into its phrase. At most 2 lines.
- Brand: pass (peach, ribbons, logo at start and end, real Top fixes UI and homepage).
- Truth: pass. The 61% figure is on screen with its source; the voice line matches the survey wording. Goes stale after 26 Nov.
- CTA: pass. "Comment SALE" appears on screen, in the caption, in the pinned comment and in the DM template.
- Sound: pass (normalised, 0.2 s or more between lines, no music on the voice cut).

## Revision 2 (26 Nov)

- Rebuilt on `marketing/tools/reel-base.{css,js}` (`reel.html`; v1 kept as `reel-v1.html`). Every scene is one centred block with no empty space above or below; logo on every scene; staggered entrances.
- The phone scene is a compact, centred phone (568 px screen) so the headline and phone fit together.
- Hook: "Black Friday is next Friday" → "Black Friday is here" (voice line 1 regenerated); captions updated to match, and LinkedIn now points to Cyber Monday and Christmas.
- Re-checked: all ✓, no warnings. Voice and LinkedIn cuts are 33.8 s at −14.2 LUFS; the silent cut is 19.8 s.

## Editing and re-rendering

Edit `reel.html` (open with `?play`, `?captions&play` or `?silent&play`). To change a voice line, edit `voice.txt` and run `python3 marketing/tools/tts.py marketing/posts/2026-11-21-black-friday --only <n>` (lengths and word timings update automatically). From `assets/instagram/tools` with `CHROME` set:

- `node record.mjs ../../../marketing/posts/2026-11-21-black-friday/reel.html ../../../marketing/posts/2026-11-21-black-friday/reel-voice.mp4 --width 1080 --height 1920 --scale 1`
- Same command with `--query "?captions"` → `reel-linkedin.mp4`
- Same command with `--query "?silent"` → `reel-silent.mp4`

The voice script says "Page-light" so the TTS pronounces Pagelyt that way. Change it in the voice lines if that's wrong.
