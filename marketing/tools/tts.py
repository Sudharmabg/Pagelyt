#!/usr/bin/env python3
"""Make a reel's voiceover clips with word timings.

    python3 marketing/tools/tts.py <post-folder> [--voice en-IN-NeerjaExpressiveNeural] [--rate +4%] [--only 2,5] [--script voice-li.txt --out voice-li]

Reads <post-folder>/voice.txt (one line per scene; blank lines and lines starting with # are skipped) and writes:
  voice/v1.mp3 … vN.mp3   trimmed to the speech (ffmpeg)
  voice/words.js          window.VOICE_DATA = [{ len, text, words: [{ w, s, e }] }]  (seconds, relative to each clip)

Spell names for the voice in voice.txt (e.g. "Page-light") and map them back for on-screen captions in DISPLAY below,
or with --show "spoken=shown" (repeatable). In a cloud session the HTTPS proxy is used automatically.
"""
import argparse, asyncio, json, os, re, subprocess, sys, tempfile

import edge_tts

# spoken words (lower case, no punctuation) → caption text
DISPLAY = {"page-light": "Pagelyt", "page light dot dev": "pagelyt.dev", "page-light dot dev": "pagelyt.dev", "sixty-one percent": "61%",
           "robots dot text": "robots.txt", "llms dot text": "llms.txt", "no-index": "noindex"}
TICK = 1e7  # edge-tts offsets are in 100 ns units


def norm(w):
    return re.sub(r"[^\w\s-]", "", w.lower()).strip()


def apply_display(words, rules):
    """Merge runs of spoken words that match a rule into one caption word, keeping trailing punctuation."""
    out, i = [], 0
    keys = sorted(((k.split(" "), v) for k, v in rules.items()), key=lambda kv: -len(kv[0]))
    while i < len(words):
        for toks, shown in keys:
            run = words[i:i + len(toks)]
            if len(run) == len(toks) and [norm(r["w"]) for r in run] == toks:
                tail = re.search(r"[^\w%]+$", run[-1]["w"])
                out.append({"w": shown + (tail.group(0) if tail else ""), "s": run[0]["s"], "e": run[-1]["e"]})
                i += len(toks)
                break
        else:
            out.append(words[i]); i += 1
    return out


async def synth(text, voice, rate, proxy):
    audio, words = bytearray(), []
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary", proxy=proxy)
    async for c in comm.stream():
        if c["type"] == "audio":
            audio.extend(c["data"])
        elif c["type"] == "WordBoundary":
            words.append({"w": c["text"], "s": c["offset"] / TICK, "e": (c["offset"] + c["duration"]) / TICK})
    return bytes(audio), words


def attach_punctuation(text, words):
    """edge-tts word texts drop punctuation; copy it back from the script so captions read naturally."""
    pos = 0
    for w in words:
        j = text.find(w["w"], pos)
        if j < 0:
            continue
        k = j + len(w["w"])
        m = re.match(r"[,.;:!?…'’\"]+", text[k:])
        if m and not w["w"].endswith(m.group(0)):
            w["w"] += m.group(0)
            k += len(m.group(0))
        pos = k
    return words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("post")
    ap.add_argument("--voice", default="en-IN-NeerjaExpressiveNeural")
    ap.add_argument("--rate", default="+4%")
    ap.add_argument("--only", default="", help="comma-separated clip numbers to regenerate")
    ap.add_argument("--show", action="append", default=[], help='extra caption mapping "spoken=shown"')
    ap.add_argument("--script", default="voice.txt", help="script file inside the post folder")
    ap.add_argument("--out", default="voice", help="output folder inside the post folder")
    a = ap.parse_args()

    rules = dict(DISPLAY)
    for s in a.show:
        k, _, v = s.partition("=")
        rules[norm(k)] = v
    src = os.path.join(a.post, a.script)
    lines = [l.strip() for l in open(src, encoding="utf-8") if l.strip() and not l.lstrip().startswith("#")]
    vdir = os.path.join(a.post, a.out)
    os.makedirs(vdir, exist_ok=True)
    data_path = os.path.join(vdir, "words.js")
    old = []
    if os.path.exists(data_path):
        try:
            old = json.loads(open(data_path, encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))
        except Exception:
            old = []
    only = {int(x) for x in a.only.split(",") if x.strip()}
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    data = []
    for n, text in enumerate(lines, 1):
        if only and n not in only and n - 1 < len(old):
            data.append(old[n - 1]); continue
        audio, words = asyncio.run(synth(text, a.voice, a.rate, proxy))
        if not audio or not words:
            sys.exit(f"clip {n}: no audio or word timings returned")
        start = max(0.0, words[0]["s"] - 0.06)
        end = words[-1]["e"] + 0.12
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(audio); raw = f.name
        out = os.path.join(vdir, f"v{n}.mp3")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", raw,
                        "-c:a", "libmp3lame", "-q:a", "2", out], check=True)
        os.unlink(raw)
        words = attach_punctuation(text, words)
        for w in words:
            w["s"] = round(w["s"] - start, 3); w["e"] = round(w["e"] - start, 3)
        words = apply_display(words, rules)
        data.append({"len": round(end - start, 3), "text": " ".join(w["w"] for w in words), "words": words})
        print(f"v{n}.mp3  {end - start:5.2f}s  {data[-1]['text']}")
    with open(data_path, "w", encoding="utf-8") as f:
        f.write("window.VOICE_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n")
    print("wrote", data_path)


if __name__ == "__main__":
    main()
