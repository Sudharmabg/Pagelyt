/* Word-by-word captions for reels, timed by marketing/tools/tts.py (voice/words.js → window.VOICE_DATA).
   Usage in a reel:
     <script src="voice/words.js"></script><script src="../../tools/captions.js"></script>
     const cap = Captions.mount(document.getElementById("stage"), { top: 1600 });
     // in setT(t):  cap.update(t, VOICE)      // VOICE = [{ src, at }] in the same order as VOICE_DATA
   Words are grouped into short phrases (max 4 words / ~24 characters, breaking after punctuation).
   The word being spoken gets a purple highlight; words not yet spoken are dimmed. */
(function () {
  const CSS = `
  .capx { position:absolute; left:50%; transform:translateX(-50%); width:max-content; max-width:960px; display:flex; flex-wrap:wrap; justify-content:center;
    gap:4px 6px; padding:14px 16px; border-radius:28px; background:rgba(18,48,63,.92); box-shadow:0 20px 50px rgba(18,48,63,.3); pointer-events:none; z-index:20; }
  .capx span { padding:6px 14px 10px; border-radius:16px; font:800 66px/1.05 Archivo, Inter, sans-serif; font-variation-settings:"wdth" 82; letter-spacing:-.01em; color:#fff; }
  .capx span.dim { color:rgba(255,255,255,.42); }
  .capx span.on { background:#6a30bd; }`;

  function phrases(words) {
    const out = []; let cur = [];
    words.forEach((w, i) => {
      cur.push(w);
      const chars = cur.map((x) => x.w).join(" ").length, next = words[i + 1];
      const punct = /[,.;:!?…]$/.test(w.w);
      // a length break waits one word if the next word closes the clause, so no word is left on its own
      const full = (cur.length >= 4 || chars >= 24) && !(next && /[,.;:!?…]$/.test(next.w) && cur.length < 6);
      const brk = punct || full || i === words.length - 1;
      if (brk) { out.push(cur); cur = []; }
    });
    return out;
  }

  function mount(stage, opts = {}) {
    if (!document.getElementById("capx-css")) { const s = document.createElement("style"); s.id = "capx-css"; s.textContent = CSS; document.head.appendChild(s); }
    const el = document.createElement("div"); el.className = "capx"; el.style.top = (opts.top ?? 1600) + "px"; stage.appendChild(el);
    const data = (window.VOICE_DATA || []).map((d) => ({ ...d, groups: phrases(d.words) }));
    let shown = null;
    return {
      update(t, voice) {
        let html = "", key = null;
        for (let i = 0; i < voice.length && i < data.length; i++) {
          const local = t - voice[i].at, d = data[i];
          if (local < -0.05 || local > d.len + 0.25) continue;
          const g = d.groups.findIndex((grp, k) => local >= grp[0].s - 0.05 && (k === d.groups.length - 1 || local < d.groups[k + 1][0].s - 0.05));
          if (g < 0) continue;
          const grp = d.groups[g];
          const on = grp.findIndex((w, k) => local >= w.s && (k === grp.length - 1 ? local <= w.e + 0.2 : local < grp[k + 1].s));
          key = `${i}:${g}:${on}`;
          html = grp.map((w, k) => `<span class="${k === on ? "on" : local < w.s ? "dim" : ""}">${w.w.replace(/</g, "&lt;")}</span>`).join("");
          break;
        }
        if (key !== shown) { el.innerHTML = html; shown = key; }
        el.style.display = html ? "flex" : "none";
      },
    };
  }
  window.Captions = { mount, phrases };
})();
