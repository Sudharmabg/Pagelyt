# Post 4 (reel): caption

**Files:**
- `pagelyt-reel-4-silent.mp4`: about 25 s, no voice. Post this one with a trending song.
- `pagelyt-reel-4-voice.mp4`: about 40 s, Indian English voiceover. Keep it for a later post, LinkedIn or Peerlist.
- `pagelyt-reel-4-cover.png`: cover for either.

## Caption

Your website is losing visitors, and most audit tools just hand you 200 warnings 😵

Pagelyt does it differently:
1️⃣ Paste your URL
2️⃣ 8 areas checked in under a minute: SEO, speed, AI search, security and more
3️⃣ One clear score, with every issue ranked
4️⃣ The fix in plain English, often with code you can copy
5️⃣ Connect Google: Search Console, Analytics and Ads, with fixes ranked by your real traffic
6️⃣ Stuck? Ask Pagelyt, the AI assistant that knows your whole report

It's free to start, with nothing to install.

🔗 Free audit at the link in bio

#websiteaudit #seotips #seo #aisearch #googlesearchconsole #webdesign #smallbusinesstips #websitetips #buildinpublic #digitalmarketing

## When posting

- Silent version: add a trending song in Instagram at normal volume.
- Voice version (Neerja Expressive, Microsoft neural voice): if you add music, keep it at about 10–15% so the voice stays clear.
- Set `pagelyt-reel-4-cover.png` as the cover, and choose "Also share to feed" so it appears on your profile grid.
- Make sure pagelyt.dev is the link in your bio.

## Editing

Edit `reel4.html` (open it with `?play` to watch and hear it). Voice clips are in `shots/reel4/voice` (made with edge-tts, voice en-IN-NeerjaExpressiveNeural, rate +4%); if you change a line, update its length in `VLEN`. Then from `assets/instagram/tools` run:

- Voice: `node record.mjs ../reel4.html ../pagelyt-reel-4-voice.mp4 --width 1080 --height 1920 --scale 1`
- Silent: `node record.mjs ../reel4.html ../pagelyt-reel-4-silent.mp4 --width 1080 --height 1920 --scale 1 --query "?silent"`

Open `reel4.html?silent&play` to watch the silent timing.
