import type { CheerioAPI } from "cheerio";
import { decode } from "jpeg-js";
import type { ChangeInfo, Finding, ModuleKey, Severity, Snapshot } from "./types";

/* Visual change and defacement monitoring.

   Every scan keeps a small fingerprint of the homepage: a 16 × 32 grid of brightness values taken
   from Lighthouse's last filmstrip thumbnail (tiny, so decoding stays well inside the Workers CPU
   budget), plus a MinHash of the visible text. Comparing fingerprints with the previous scan of the
   same site gives a "how much changed" figure without storing or diffing full screenshots.
   The full Lighthouse screenshot is stored separately (scan_shots) for the before/after view. */

const COLS = 16;
const ROWS = 32;
const CELL_DELTA = 24; // brightness difference (0–255) that counts a cell as changed

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Brightness grid of a JPEG data URI, or null if it cannot be decoded. */
export function visualSignature(dataUri: string | null | undefined): number[] | null {
  if (!dataUri) return null;
  try {
    const img = decode(base64Bytes(dataUri.slice(dataUri.indexOf(",") + 1)), { useTArray: true, maxResolutionInMP: 2, maxMemoryUsageInMB: 64 });
    const { width: w, height: h, data } = img;
    if (!w || !h) return null;
    const sums = new Array<number>(COLS * ROWS).fill(0);
    const counts = new Array<number>(COLS * ROWS).fill(0);
    // Sample every other pixel in each direction: plenty for a 16 × 32 grid.
    for (let y = 0; y < h; y += 2) {
      const r = Math.min(ROWS - 1, Math.floor((y / h) * ROWS));
      for (let x = 0; x < w; x += 2) {
        const c = Math.min(COLS - 1, Math.floor((x / w) * COLS));
        const i = (y * w + x) * 4;
        sums[r * COLS + c] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        counts[r * COLS + c]++;
      }
    }
    return sums.map((s, i) => Math.round(s / Math.max(1, counts[i])));
  } catch {
    return null;
  }
}

/** Share of grid cells that changed noticeably, 0–100. */
export function visualDiff(a: number[] | null | undefined, b: number[] | null | undefined): number | null {
  if (!a || !b || a.length !== b.length || !a.length) return null;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > CELL_DELTA) n++;
  return Math.round((n / a.length) * 100);
}

/* ---------- Text ---------- */

const HASHES = 32;

function fnv(s: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** MinHash over 4-word shingles of the visible text. */
export function textSignature(text: string): number[] {
  const w = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 3000);
  const shingles = new Set<string>();
  for (let i = 0; i + 3 < w.length || (i === 0 && w.length); i++) shingles.add(w.slice(i, i + 4).join(" "));
  const sig = new Array<number>(HASHES).fill(0xffffffff);
  for (const s of shingles) for (let k = 0; k < HASHES; k++) sig[k] = Math.min(sig[k], fnv(s, k * 0x9e3779b1));
  return sig;
}

/** Estimated share of the text that changed, 0–100. */
export function textDiff(a: number[] | null | undefined, b: number[] | null | undefined): number | null {
  if (!a || !b || a.length !== b.length) return null;
  const same = a.filter((v, i) => v === b[i]).length;
  return Math.round((1 - same / a.length) * 100);
}

export function compareSnapshots(prev: { id: string; at: string; snap: Snapshot }, now: Snapshot): ChangeInfo {
  return {
    prevId: prev.id,
    prevAt: prev.at,
    visual: visualDiff(prev.snap.sig, now.sig),
    text: textDiff(prev.snap.text, now.text),
    title: prev.snap.title !== now.title ? { from: prev.snap.title, to: now.title } : null,
  };
}

/** Big enough to tell the owner about. */
export const isBigChange = (c: ChangeInfo | null | undefined) => !!c && ((c.visual ?? 0) >= 35 || (c.text ?? 0) >= 60 || !!c.title);

/* ---------- Defacement and spam injection (static, every scan) ---------- */

type Add = (module: ModuleKey, severity: Severity, id: string, title: string, why: string, fix: string, evidence?: string) => void;

const DEFACED = /\b(hacked|defaced|owned|pwned)\s+by\b|\bh[a4]ck[e3]d\s+by\b|\bwas\s+here\b.*\b(team|crew|cyber)\b|\bcyber\s*(army|team)\b/i;
const SPAM = /\b(viagra|cialis|levitra|kamagra|slot\s*gacor|judi\s*(online|slot|bola)|togel|sbobet|situs\s*slot|casino\s*online|payday\s*loans?|replica\s*watches|escort\s*service|buy\s*followers)\b/gi;

export function defacementChecks($: CheerioAPI, add: Add) {
  const head = `${$("title").first().text()} ${$("h1").first().text()}`.replace(/\s+/g, " ").trim();
  if (DEFACED.test(head)) add("security", "high", "defaced", "Homepage looks defaced", "The page title or main heading contains wording typical of a hacked site. Visitors and search engines see the attacker's message instead of yours.", "Take the site offline or restore it from a clean backup, change every password (hosting, CMS, FTP, database), update all software and plugins, then rescan.", head.slice(0, 160));

  // Spam links planted by attackers are usually hidden or tucked into the footer, so look at links only.
  // A site that is genuinely about one of these topics will name it in its own title, so skip those.
  const linkText = $("a").map((_, el) => `${$(el).text()} ${$(el).attr("href") || ""}`).get().join(" ");
  const hits = [...new Set((linkText.match(SPAM) ?? []).map((x) => x.toLowerCase().replace(/\s+/g, " ")))];
  const own = (head.match(SPAM) ?? []).length > 0;
  if (!own && hits.length >= 2) add("security", "high", "spam-injection", "Possible spam links injected into the page", "Links for gambling, pills or similar topics usually mean an attacker has added hidden content. Search engines penalise or deindex sites that carry it.", "Search your theme, plugins and database for the links listed, remove them, update everything and change passwords. Then ask Google to review the site in Search Console.", hits.slice(0, 6).join(", "));
}

export type { Finding };
