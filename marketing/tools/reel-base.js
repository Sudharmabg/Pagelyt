/* Pagelyt reel runtime: timing, scene fades, voice, captions and the recorder contract (window.setT / DURATION / VOICE).
   In a reel:
     <script src="voice/words.js"></script>            (from marketing/tools/tts.py; skip for silent-only reels)
     <script src="../../tools/captions.js"></script>
     <script src="../../tools/reel-base.js"></script>
     <script>
       const R = Reel.setup({ scenes: ["sc1", …], silent: [2.6, 3.2, …] });   // silent = scene lengths for ?silent
       R.on("sc1", (u, len) => { … });   // u = seconds since the scene started, len = scene length
       R.start();
     </script>
   Query: ?silent (no voice, `silent` lengths) · ?captions (word-by-word captions) · &play (watch in a browser). */
(function () {
  const $ = (id) => document.getElementById(id);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const out = (x) => 1 - Math.pow(1 - x, 3);
  const back = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const lerp = (a, b, x) => a + (b - a) * x;
  /** fade + rise an element in over [a, a + d] of local time */
  const pop = (el, u, a, d = .4, dy = 40) => { const q = out(ramp(u, a, a + d)); el.style.opacity = q; el.style.transform = `translateY(${(1 - q) * dy}px)`; return q; };
  const popScale = (el, u, a, d = .4) => { const q = ramp(u, a, a + d); el.style.opacity = clamp(q * 1.6); el.style.transform = `scale(${lerp(.8, 1, back(q))})`; return q; };

  function setup({ scenes, silent, voiceDir = "voice", lead = .2, gap = .25, endHold = .7, captionsTop = 1610 }) {
    const Q = location.search, SILENT = Q.includes("silent") || !window.VOICE_DATA, CAPTIONS = Q.includes("captions") && !SILENT;
    const S = {}, VOICE = [], handlers = {};
    let at = 0;
    scenes.forEach((id, i) => {
      const a = i === 0 ? 0 : at - .2;
      const len = SILENT ? silent[i] : lead + window.VOICE_DATA[i].len + gap;
      if (!SILENT) VOICE.push({ src: `${voiceDir}/v${i + 1}.mp3`, at: a + lead });
      S[id] = [a, a + len + (i === scenes.length - 1 ? endHold : .2)];
      at = a + len + .2;
    });
    const last = scenes[scenes.length - 1];
    const DURATION = Math.round((S[last][1] - .3) * 10) / 10;
    let cap = null;

    function setT(t) {
      const arcs = $("arcs");
      if (arcs) {
        const mid = t > S[scenes[0]][1] - .3 && t < S[last][0] + .3;
        arcs.style.transform = `translate(${Math.sin(t / 5) * 30}px, ${mid ? 330 : 0}px)`;
        arcs.style.opacity = mid ? .3 : 1;
      }
      scenes.forEach((id) => {
        const [a, b] = S[id], el = $(id);
        const vin = a === 0 ? 1 : out(ramp(t, a, a + .35)), vout = id === last ? 1 : 1 - ramp(t, b - .3, b);
        const v = Math.min(vin, vout);
        el.style.opacity = v; el.style.transform = `translateY(${(1 - vin) * 40}px)`;
        if (v > 0 && handlers[id]) handlers[id](t - a, b - a);
      });
      if (cap) cap.update(t, VOICE);
    }

    return {
      S, VOICE, DURATION, SILENT,
      on(id, fn) { handlers[id] = fn; return this; },
      start() {
        if (CAPTIONS && window.Captions) cap = Captions.mount($("stage"), { top: captionsTop });
        window.setT = setT; window.DURATION = DURATION; window.VOICE = VOICE;
        setT(0);
        if (Q.includes("play")) {
          VOICE.forEach((v) => { const a = new Audio(v.src); setTimeout(() => a.play().catch(() => {}), v.at * 1000); });
          const t0 = performance.now();
          (function f() { setT(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(f); })();
        }
      },
    };
  }

  window.Reel = { setup, $, clamp, ramp, ease, out, back, lerp, pop, popScale };
})();
