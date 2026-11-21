/* Automatic half of the reel critic (the other half is marketing/critic.md, done by eye).
   node marketing/tools/check-reel.mjs <video.mp4> [more.mp4 …] [--sheet out.png] [--frames 12] [--platform instagram|linkedin]
   Checks size, frame rate, codecs, length, file size and loudness against platform targets, and writes a contact sheet
   (frames evenly spaced, timestamps printed below) to look at. Exit code 1 if any check fails. Needs ffmpeg + ffprobe. */
import { spawnSync } from "node:child_process";
import { statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const files = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!files.length) { console.error("usage: node check-reel.mjs <video.mp4> [--sheet out.png] [--frames 12] [--platform instagram|linkedin]"); process.exit(2); }
const N = +opt("frames", 12);

const run = (cmd, a) => spawnSync(cmd, a, { encoding: "utf8", maxBuffer: 64 << 20 });
let failed = false;

for (const f of files) {
  const platform = opt("platform", /linkedin/i.test(f) ? "linkedin" : "instagram");
  const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", f]).stdout);
  const v = probe.streams.find((s) => s.codec_type === "video"), a = probe.streams.find((s) => s.codec_type === "audio");
  const dur = +probe.format.duration, mb = statSync(f).size / 1e6;
  const [fn, fd] = v.r_frame_rate.split("/").map(Number), fps = fn / fd;
  const rows = [];
  const check = (name, ok, value, want, warnOnly = false) => { rows.push([ok ? "✓" : warnOnly ? "!" : "✗", name, value, want]); if (!ok && !warnOnly) failed = true; };

  const size = `${v.width}×${v.height}`;
  check("frame size", ["1080×1920", "1080×1350", "1080×1080"].includes(size), size, "1080×1920 (or 1080×1350 / 1080×1080)");
  check("frame rate", fps >= 24 && fps <= 60, fps.toFixed(2), "24–60 fps");
  check("video codec", v.codec_name === "h264" && v.pix_fmt === "yuv420p", `${v.codec_name} ${v.pix_fmt}`, "h264 yuv420p");
  const [lo, hi, soft] = platform === "linkedin" ? [3, 600, 60] : [3, 90, 35];
  check("length", dur >= lo && dur <= hi, `${dur.toFixed(1)} s`, `${lo}–${hi} s`);
  check("length (attention)", dur <= soft, `${dur.toFixed(1)} s`, `≤ ${soft} s keeps people watching`, true);
  check("file size", mb <= (platform === "linkedin" ? 200 : 100), `${mb.toFixed(1)} MB`, platform === "linkedin" ? "≤ 200 MB" : "≤ 100 MB");

  if (a) {
    check("audio codec", a.codec_name === "aac", a.codec_name, "aac");
    const r = run("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
    const I = +(r.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop()?.match(/-?[\d.]+/)[0]);
    const TP = +(r.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop()?.match(/-?[\d.]+/)[0]);
    check("loudness", I >= -16.5 && I <= -11.5, `${I} LUFS`, "about −14 LUFS (social standard)", true);
    check("true peak", TP <= -0.9, `${TP} dBTP`, "≤ −1 dBTP (no clipping)", true);
  } else {
    check("audio", true, "none (silent cut)", "add a trending song in the Instagram app");
  }

  // blank-frame check on the first frame (the auto-thumbnail)
  const y = run("ffmpeg", ["-hide_banner", "-i", f, "-vf", "select=eq(n\\,0),signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-frames:v", "1", "-f", "null", "-"]).stderr;
  const yavg = +(y.match(/YAVG=([\d.]+)/)?.[1] ?? 0);
  check("first frame not blank", yavg > 20 && yavg < 245, `luma ${yavg.toFixed(0)}`, "a readable first frame");

  console.log(`\n${basename(f)}  (${platform})`);
  for (const r of rows) console.log(`  ${r[0]} ${r[1].padEnd(20)} ${String(r[2]).padEnd(18)} ${r[3]}`);

  const sheet = opt("sheet") && (files.length === 1 ? opt("sheet") : opt("sheet").replace(/\.png$/, `-${basename(f, ".mp4")}.png`));
  if (sheet) {
    const dir = mkdtempSync(join(tmpdir(), "sheet-")), times = Array.from({ length: N }, (_, i) => (dur * (i + 0.5)) / N);
    times.forEach((t, i) => run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", t.toFixed(2), "-i", f, "-frames:v", "1", "-vf", "scale=270:-2", join(dir, `s${String(i).padStart(2, "0")}.png`)]));
    const cols = Math.min(6, N), rowsN = Math.ceil(N / cols);
    run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-pattern_type", "glob", "-i", join(dir, "s*.png"), "-vf", `tile=${cols}x${rowsN}:padding=8:color=white`, "-frames:v", "1", sheet]);
    rmSync(dir, { recursive: true, force: true });
    console.log(`  contact sheet → ${sheet}`);
    console.log(`  frames at: ${times.map((t) => t.toFixed(1) + "s").join(", ")}`);
  }
}
process.exit(failed ? 1 : 0);
