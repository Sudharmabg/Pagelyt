# Reel critic checklist

Run this before showing any reel to the user. It has two parts:

1. **Automatic:** `node marketing/tools/check-reel.mjs <post>/*.mp4 --sheet <scratch>/sheet.png`. Every ✗ must be fixed; each ! needs a reason to keep it.
2. **By eye:** open the contact sheet plus a frame from the middle of each scene (`record.mjs --times …`). Go through the list below, fix what fails, and re-render.

Record the result in the post's `notes.md` under "Critic pass": one line per section, saying either "pass" or what you changed.

## Hook (first 1–2 s)
- [ ] The first frame works on its own as a thumbnail: big text, readable at phone-grid size, not blank, not mid-transition.
- [ ] It states a stake or question for the audience ("Will your website survive it?"), not a product name.
- [ ] The cover image matches the first frame.

## Story and pacing
- [ ] One idea per scene; the whole reel makes one point.
- [ ] Something moves or changes at least every ~2 s; no static hold longer than ~3 s, except the end card.
- [ ] On-screen text stays up long enough to read: at least 1 s per 3 words.
- [ ] Voice and picture match: whatever the voice names is on screen while it's said.
- [ ] Length fits the platform: Instagram silent 15–25 s; voice cuts ideally ≤ 35 s; LinkedIn ≤ 60 s.

## Layout (brand guideline)
- [ ] Every title, headline, text block, card, pill and caption is **centred horizontally**.
- [ ] Each scene's content block is **centred vertically**: in y = 250–1500 for Instagram reels, and in the frame for 4:5 posts and LinkedIn. There's **no extra empty space above or below** it. Compare the top and bottom gaps on the contact sheet; they should look about equal.
- [ ] Spacing between the title, content and items is tight and even. If a scene looks sparse, enlarge the content rather than leaving blank bands.

## Readability
- [ ] Headlines at least 70 px, body text at least 28 px on the 1080-wide stage; product screenshots are zoomed until their key line is readable on a phone.
- [ ] Strong contrast (dark ink on peach, white on purple); no text over busy ribbons.
- [ ] **Instagram safe zone:** key text and UI stay between y = 250 and y = 1500 (the top bar and caption/buttons cover the rest).
- [ ] The silent cut tells the whole story without sound.

## Captions (voice cuts with captions)
- [ ] Word-by-word, at most 2 lines, never covering a key UI element or headline.
- [ ] The highlight follows the voice. Spot-check 3 words; drift should be under ~0.15 s.
- [ ] Names are spelled correctly on screen (Pagelyt, pagelyt.dev, 61%) even when the voice script spells them phonetically.

## Brand
- [ ] House style from `brand.md`: peach background, rainbow ribbons, Archivo headings, Inter body, purple accents.
- [ ] Logo on the first or last scene; the end card gives pagelyt.dev.
- [ ] Only real Pagelyt UI. Illustrative cards are fine but must not pose as product screens.
- [ ] The voice is Neerja Expressive (en-IN) unless the user asked otherwise.

## Truth
- [ ] Every number has a source, shown on screen or in the caption or first comment, and the source says exactly that.
- [ ] No promises about rankings, AI recommendations, revenue or "never crash".
- [ ] Dates and time words ("next Friday") are still true on the planned posting date; `notes.md` says when the post goes stale.
- [ ] Free and paid claims match the site (pricing is hidden, so say "free audit").

## CTA
- [ ] The last 2–3 s carry one clear action, matching the caption: the comment keyword, link in bio, or first-comment link.
- [ ] The comment keyword, DM text and UTM links in `notes.md` and `post.json` agree with each other.

## Sound
- [ ] Loudness about −14 LUFS and true peak ≤ −1 dBTP (the checker reports both).
- [ ] No clipped words at clip starts or ends; at least 0.2 s of air between lines.
- [ ] If there's music: under the voice (about 12%) and fading out at the end.
