/* Frame-by-frame capture of an HTML animation that exposes window.setT(seconds), then encode to MP4 with Chrome's MediaRecorder.
   node record.mjs <page.html> <out.mp4> [--fps 30] [--scale 1.2] [--width 1600 --height 900] [--times 1.5,6,9 --dir <folder>]
   If the page sets window.VOICE = [{src, at}] (paths relative to the page), those clips are mixed in as the audio track.
   With --times it only saves those frames as PNGs into --dir (for checking).
   Encoding uses ffmpeg when it's on PATH (or FFMPEG=<path>): exact frame timing, H.264 + AAC, faststart. Extra options then:
     --music <file> [--music-volume 0.12]  loop a music bed under the voice, faded out at the end
     --crf 18                               quality (lower = better/bigger)
     --no-loudnorm                          skip loudness normalisation (default: -14 LUFS, true peak -1.5 dB)
   Without ffmpeg, or with --browser-encode, it falls back to Chrome's MediaRecorder (real-time, no music option). */
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const page = resolve(args[0]), outFile = resolve(args[1] || "out.mp4");
const FPS = +opt("fps", 30), SCALE = +opt("scale", 1.2), W = +opt("width", 1600), H = +opt("height", 900);
const times = opt("times") ? opt("times").split(",").map(Number) : null;
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const useFfmpeg = !args.includes("--browser-encode") && spawnSync(FFMPEG, ["-version"], { stdio: "ignore" }).status === 0;

/** Encode the captured JPEG frames (+ voice clips at their start times, + optional music bed) with ffmpeg. */
function encodeWithFfmpeg(dir, voice, dur) {
  const inputs = ["-framerate", String(FPS), "-i", join(dir, "f%05d.jpg")];
  const filters = [], mix = [];
  voice.forEach((v, i) => {
    inputs.push("-i", resolve(dirname(page), v.src));
    const ms = Math.round(v.at * 1000);
    filters.push(`[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`); mix.push(`[v${i}]`);
  });
  const music = opt("music");
  if (music) {
    inputs.push("-stream_loop", "-1", "-i", resolve(music));
    const vol = +opt("music-volume", voice.length ? 0.12 : 0.8), fade = Math.min(1.5, dur / 4);
    filters.push(`[${voice.length + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${vol},afade=t=out:st=${(dur - fade).toFixed(2)}:d=${fade}[mus]`); mix.push("[mus]");
  }
  const audio = mix.length
    ? ["-filter_complex", [...filters, `${mix.join("")}amix=inputs=${mix.length}:duration=longest:normalize=0` + (args.includes("--no-loudnorm") ? "[aout]" : "[mx];[mx]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]")].join(";"), "-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "192k"]
    : ["-map", "0:v"];
  const cmd = ["-y", "-hide_banner", "-loglevel", "error", ...inputs, ...audio,
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-preset", "slow", "-crf", opt("crf", "18"), "-profile:v", "high",
    "-pix_fmt", "yuv420p", "-r", String(FPS), "-t", dur.toFixed(3), "-movflags", "+faststart", outFile];
  console.log(`encoding with ffmpeg${voice.length ? `, ${voice.length} voice clips` : ""}${music ? ", music bed" : ""}`);
  const r = spawnSync(FFMPEG, cmd, { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed");
}

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "rec-"));
const chrome = spawn(CHROME, [...(process.platform === "linux" ? ["--no-sandbox"] : []), "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run",
  "--hide-scrollbars", "--force-color-profile=srgb", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });

let target;
for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map(); const waiters = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else if (m.method) waiters.filter((w) => w.method === m.method).forEach((w) => { waiters.splice(waiters.indexOf(w), 1); w.res(m.params); }); });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const once = (method, ms = 30000) => new Promise((res) => { waiters.push({ method, res }); setTimeout(res, ms); });
const evaluate = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval error"); return r.result?.value; };
const finish = () => { try { ws.close(); } catch {} chrome.kill(); setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} }, 1500); };

try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
  let loaded = once("Page.loadEventFired"); await send("Page.navigate", { url: "file:///" + page.replace(/\\/g, "/") + opt("query", "") }); await loaded;
  await evaluate("document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode().catch(() => 0)))).then(() => true)");
  await sleep(800);
  const dur = await evaluate("window.DURATION");
  const voice = (await evaluate("window.VOICE || []")) ?? [];
  const list = times ?? Array.from({ length: Math.round(dur * FPS) }, (_, i) => i / FPS);
  const dir = times ? resolve(opt("dir", ".")) : mkdtempSync(join(tmpdir(), "frames-"));
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < list.length; i++) {
    await evaluate(`setT(${list[i]}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
    const shot = await send("Page.captureScreenshot", times ? { format: "png" } : { format: "jpeg", quality: 92 });
    writeFileSync(join(dir, times ? `t${i}.png` : `f${String(i).padStart(5, "0")}.jpg`), Buffer.from(shot.data, "base64"));
    if (!times && i % 150 === 0) console.log(`frame ${i}/${list.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  if (times) { console.log("saved", list.length, "frames to", dir); }
  else {
    if (useFfmpeg) {
      encodeWithFfmpeg(dir, voice, dur);
      console.log("saved", outFile, (statSync(outFile).size / 1e6).toFixed(1), "MB");
      rmSync(dir, { recursive: true, force: true });
    } else {
    if (opt("music")) console.log("! --music needs ffmpeg; rendering without music");
    // encode: an encoder page draws each JPEG onto a canvas and MediaRecorder records it in real time
    voice.forEach((v, i) => copyFileSync(resolve(dirname(page), v.src), join(dir, `a${i}.mp3`)));
    const frames = readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
    const enc = join(dir, "encode.html");
    writeFileSync(enc, `<!doctype html><canvas id=c width=${W * SCALE} height=${H * SCALE}></canvas><script>
      const N=${frames.length}, FPS=${FPS}, c=document.getElementById('c'), g=c.getContext('2d');
      const load = (i) => fetch('f' + String(i).padStart(5, '0') + '.jpg').then((r) => r.blob()).then((b) => createImageBitmap(b));
      const AHEAD = 12, q = new Map(); const get = (i) => { for (let k = i; k < Math.min(N, i + AHEAD); k++) if (!q.has(k)) q.set(k, load(k)); const p = q.get(i); q.delete(i - 1); return p; };
      const VOICE = ${JSON.stringify(voice.map((v) => v.at))};
      window.run = async (mime) => {
        const stream = c.captureStream(0), track = stream.getVideoTracks()[0];
        let ac, bufs = [];
        if (VOICE.length) {
          ac = new AudioContext({ sampleRate: 48000 }); await ac.resume();
          bufs = await Promise.all(VOICE.map((_, i) => fetch('a' + i + '.mp3').then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b))));
          const dest = ac.createMediaStreamDestination(); window.dest = dest; stream.addTrack(dest.stream.getAudioTracks()[0]);
        }
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6, audioBitsPerSecond: 160e3 });
        const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        g.drawImage(await get(0), 0, 0); track.requestFrame(); await Promise.all([...q.values()]);
        rec.start(); const start = performance.now();
        if (ac) { const t0 = ac.currentTime + .02; VOICE.forEach((at, i) => { const src = ac.createBufferSource(); src.buffer = bufs[i]; src.connect(window.dest); src.start(t0 + at); }); }
        for (let i = 0; i < N; i++) {
          const im = await get(i);
          const due = start + i * 1000 / FPS; const wait = due - performance.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          g.drawImage(im, 0, 0); track.requestFrame(); im.close();
        }
        window.late = performance.now() - start - N * 1000 / FPS;
        await new Promise((r) => setTimeout(r, 1000 / FPS + 50));
        const done = new Promise((r) => rec.onstop = r); rec.stop(); await done;
        const buf = new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer());
        window.out = buf; return buf.length;
      };
      window.part = (a, b) => { let s = ''; for (let i = a; i < Math.min(b, window.out.length); i++) s += String.fromCharCode(window.out[i]); return btoa(s); };
    </script>`);
    await send("Emulation.clearDeviceMetricsOverride");
    loaded = once("Page.loadEventFired"); await send("Page.navigate", { url: "file:///" + enc.replace(/\\/g, "/") }); await loaded;
    const mime = await evaluate(`${JSON.stringify(voice.length ? ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus'] : ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9'])}.find(m => MediaRecorder.isTypeSupported(m))`);
    console.log("encoding", frames.length, "frames as", mime);
    const size = await evaluate(`run(${JSON.stringify(mime)})`);
    const parts = []; for (let a = 0; a < size; a += 2_000_000) parts.push(Buffer.from(await evaluate(`part(${a}, ${a + 2_000_000})`), "base64"));
    const file = mime.startsWith("video/webm") ? outFile.replace(/\.mp4$/, ".webm") : outFile;
    writeFileSync(file, Buffer.concat(parts));
    console.log("encoder ran", (await evaluate("window.late") / 1000).toFixed(2), "s over");
    console.log("saved", file, (size / 1e6).toFixed(1), "MB");
    rmSync(dir, { recursive: true, force: true });
    }
  }
} catch (e) { console.error(e); process.exitCode = 1; }
finally { finish(); }
