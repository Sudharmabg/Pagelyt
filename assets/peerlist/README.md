# Peerlist launch media

Upload in this order (16:9, 1600×900):

1. `pagelyt-peerlist-1.png`: cover, "Find what's holding your site back. And how to fix it."
2. `pagelyt-peerlist-2.png`: the audit, score and 8 area cards
3. `pagelyt-peerlist-3.png`: the fix, security headers generator with copy-paste code
4. `pagelyt-peerlist-4.png`: AI search, AI bot access checker
5. `pagelyt-peerlist-5.png`: free tools grid

Video: `pagelyt-demo.mp4` (37 s, 1920×1080, no sound). If Peerlist asks for a link instead of a file, upload it to YouTube (unlisted is fine) or Loom and paste that link.

## Editing

- Images: edit `launch-images.html`, then from `assets/instagram/tools` run `node shoot.mjs peerlist.json`
- Video: edit `demo.html` (open it with `?play` to watch in a browser), then from `assets/instagram/tools` run
  `node record.mjs ../../peerlist/demo.html ../../peerlist/pagelyt-demo.mp4`
- Screenshots live in `assets/instagram/shots/peerlist/`. They come from the local mock site (demo report for example.com).
