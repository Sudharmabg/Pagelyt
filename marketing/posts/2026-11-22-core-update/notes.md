# Google core update reels (idea 2, 2026-11-21 batch)

**Files:**
- `reel-silent.mp4` (26 s): **main Instagram post**. Post by hand and add a trending song.
- `reel-voice.mp4` (52 s): Instagram with Neerja voice. `post.json` uses this one for API posting, since API posts can't add Instagram music.
- `reel-linkedin.mp4` (40 s): the LinkedIn "client message" version, for agencies, with voice and word-by-word captions.
- `cover.png` (Instagram, "Traffic dropped?" + DON'T PANIC stamp) and `cover-linkedin.png` (the client message).
- Sources: `reel.html` + `voice.txt` (Instagram) and `reel-li.html` + `voice-li.txt` (LinkedIn), built on `marketing/tools/reel-base.{css,js}`.

**Timing:** the reels say the update "is rolling out". It's expected to finish around 24 Nov; check Google's Search Status Dashboard before posting.
- **If posting after it has finished,** change the voice lines and on-screen text, then re-run tts and re-render:
  - Instagram line 2 → "Google's core update just finished rolling out, and rankings moved for a lot of sites."
  - LinkedIn line 2 → "Most likely, it's Google's November core update, which just finished rolling out."
  - The chip "since 10 Nov" stays; in the rollout card, the bar already ends on "finished ✓".
- **The angle stays relevant** for about two weeks after the rollout, while people compare their data.
- Best slots: Instagram 7–9 pm IST; LinkedIn Tuesday to Thursday, 8–10 am.

## Instagram: when someone comments GOOGLE

1. Reply publicly: "Sent! Check your DMs 📩"
2. DM:
   "Hey! Here's our step-by-step Search Console guide, so you can compare before and after the update yourself 👉 https://pagelyt.dev/blog/google-search-console-setup-guide?utm_source=instagram&utm_medium=dm&utm_campaign=core-update
   Want to rule out technical problems too? Run a free audit at pagelyt.dev 🙌"
3. DMs closed: "Your DMs look closed, here's the guide: pagelyt.dev/blog/google-search-console-setup-guide"

## Reply templates

- "My traffic dropped a lot, what do I fix?":
  "First check it's not technical (noindex, robots.txt, broken pages). The free audit does that in a minute. If that's clean, it's likely the update: wait for it to finish, then compare which pages dropped."
- "Can Pagelyt recover my rankings?":
  "No tool can promise that after a core update, since it's about how Google judges relevance. Pagelyt rules out technical problems and shows which pages lost clicks, so you know where to focus."
- "How long until things settle?":
  "Google said the rollout takes about two weeks. Give it a few days after it finishes before comparing."
- LinkedIn, "How do you explain it to clients?": thank them and share one line from your own process; agencies like comparing notes.

## Critic pass (2026-11-22)

`check-reel.mjs`: all ✓ apart from one ! on the Instagram voice cut.
- Length (voice cut 40.4 s, over the 35 s attention target): kept, because the don'ts plus three steps need the time. The **silent cut (22.4 s) is the main Instagram post**. LinkedIn at 40 s is within its 60 s target.
- Sound: −14 LUFS, true peak −1.5 dBTP on both voice cuts.
- Layout (new guideline): pass. Every scene uses the centred `.block` from `reel-base.css`, with no empty bands. Fixed a gap in the chat card (scene 1, LinkedIn) and filled out the sparse Step 1 scene with a rollout timeline.
- Hook: pass. "Traffic dropped?" with the plunging line, then the DON'T PANIC stamp on "Don't touch anything" (Instagram). The client message bubble on LinkedIn.
- Readability: pass. Kicker pills, headlines at 96 px and up, zoomed real screenshots (Fix first table, Google numbers).
- Captions: pass. Word-by-word on LinkedIn; "noindex" and "robots.txt" spelled correctly.
- Brand: pass (house style, logo at start and end, real Pagelyt UI for the Google data and Fix first).
- Truth: pass. Dates match Google's rollout (10 Nov, about two weeks). No promise of recovery; Pagelyt is positioned as ruling out technical causes and showing clicks per page.
- CTA: pass. "Comment GOOGLE" appears on screen, in the caption, in the pinned comment and in the DM. Shortened the end line so it doesn't wrap.

## Revision 2 (user feedback, 22 Nov)

- Pagelyt logo on every scene.
- "Panic" in red everywhere: the DON'T PANIC stamp is now red, slams in, shakes the chart card and then pulses. The word "panic" in "Don't panic-edit" and on the end card is red, and wobbles on the end card.
- More motion on every scene: staggered entrances (`autoIn` in `reel-base.js`), pulsing chip, the ranking row bumping as it moves, ✕ badges shaking as each row is struck, a scan progress bar with checks flashing green, a slow zoom and highlight ring on the Google numbers, and a beating CTA pill.
- **Stronger close:** a new scene "Pagelyt does all 3 steps" (compares Google clicks, rules out site problems, shows which pages dropped; numbers flip to ✓), then the end card "Don't panic. Use Pagelyt." with pagelyt.dev. New voice lines 7 and 8; the caption is updated to match.
- Re-checked: all ✓. Silent 26.2 s. The voice cut is 51.9 s (! over 35 s), kept because the new ending was asked for; the silent cut stays the main post.

## Editing and re-rendering

From `assets/instagram/tools` with `CHROME` set (`/opt/pw-browsers/chromium` in the cloud):
- Voice: `python3 marketing/tools/tts.py marketing/posts/2026-11-22-core-update` (add `--script voice-li.txt --out voice-li` for LinkedIn)
- `node record.mjs ../../../marketing/posts/2026-11-22-core-update/reel.html ../../../marketing/posts/2026-11-22-core-update/reel-silent.mp4 --width 1080 --height 1920 --scale 1 --query "?silent"`
- Same without `--query` → `reel-voice.mp4`
- `reel-li.html` with `--query "?captions"` → `reel-linkedin.mp4`
