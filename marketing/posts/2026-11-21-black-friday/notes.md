# Black Friday reel (idea 1, 2026-11-21)

**Files:**
- `reel-voice.mp4` (36 s): Neerja voiceover. Instagram default; `post.json` uses it, since API posts can't add Instagram music.
- `reel-silent.mp4` (20 s): no voice. Post by hand and add a trending song in the app.
- `reel-linkedin.mp4` (36 s): voiceover plus burned-in subtitles, for LinkedIn.
- `cover.png`: cover frame for all three.

**Post by:** Wednesday 25 Nov at the latest. The hook says "next Friday" and the date chip says Fri 27 Nov.
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

## Editing and re-rendering

Edit `reel.html` (open with `?play`, `?captions&play` or `?silent&play`). If you change a voice line, regenerate it with edge-tts (Neerja Expressive, `--rate=+4%`), trim the silence and update `VLEN`. From `assets/instagram/tools` with `CHROME` set:

- `node record.mjs ../../../marketing/posts/2026-11-21-black-friday/reel.html ../../../marketing/posts/2026-11-21-black-friday/reel-voice.mp4 --width 1080 --height 1920 --scale 1`
- Same command with `--query "?captions"` → `reel-linkedin.mp4`
- Same command with `--query "?silent"` → `reel-silent.mp4`

The voice script says "Page-light" so the TTS pronounces Pagelyt that way. Change it in the voice lines if that's wrong.
