import type { ScanResult } from "../scan/types";

/* What the assistant knows besides the model itself: the person's report, the fix guides and
   the blog. Pure (no runtime imports), so ranking and the report brief are covered by tests.
   Everything is sent as text in the instructions; the whole library is too big to send every
   time (~32k tokens), so each question gets the few documents that match it best. */

export type Doc = { kind: "guide" | "blog"; id: string; title: string; url: string; summary: string; text: string };
export type Turn = { role: "user" | "assistant"; content: string };

export const CHAT_LIMITS = { question: 1000, turn: 4000, turns: 10, fullDocs: 3, docChars: 6000 } as const;

const STOP = new Set(
  "the and for are but not you your with this that have has had was were will would can could should what when where which who why how does did doing about into from our out its it's they them their there then than too very just also more most some any all each other such only own same over under again once here why yes get got make made use using used site website page pages".split(" ")
);

export const tokens = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));

/** The documents that best match the question: title words count most, then the summary, then the body.
    `boost` holds guide ids for this report's findings, which win ties when the question is about them. */
export function rankDocs(question: string, docs: Doc[], boost: Set<string> = new Set(), n: number = CHAT_LIMITS.fullDocs): Doc[] {
  const q = new Set(tokens(question));
  if (!q.size) return [];
  const scored = docs.map((d) => {
    const title = new Set(tokens(d.title));
    const summary = new Set(tokens(d.summary));
    const body = new Set(tokens(d.text));
    let s = 0;
    for (const w of q) s += (title.has(w) ? 3 : 0) + (summary.has(w) ? 2 : 0) + (body.has(w) ? 1 : 0);
    if (s > 0 && boost.has(d.id)) s += 1.5;
    return { d, s };
  });
  return scored
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.d);
}

const SEV: Record<string, number> = { high: 0, medium: 1, low: 2 };
const ms = (v: number | null | undefined) => (v == null ? "n/a" : `${(v / 1000).toFixed(1)} s`);
const num = (v: number | null | undefined) => (v == null ? "n/a" : String(Math.round(v * 1000) / 1000));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A compact plain-text summary of one report for the model. */
export function reportBrief(res: ScanResult, fixed: string[] = []): string {
  const done = new Set(fixed);
  const out: string[] = [];
  out.push(`Site: ${res.host} (${res.url}), scanned ${res.scannedAt.slice(0, 10)}. Website Intelligence Score: ${res.overall}/100.`);
  out.push(`Area scores: ${res.modules.map((m) => `${m.name} ${m.score}`).join(", ")}.`);
  const v = res.vitals;
  if (v) {
    const run = (label: string, r: typeof v.mobile) => r && `${label}: performance ${r.score ?? "n/a"}, LCP ${ms(r.lcp)}, FCP ${ms(r.fcp)}, TBT ${r.tbt == null ? "n/a" : `${Math.round(r.tbt)} ms`}, CLS ${num(r.cls)}, Speed Index ${ms(r.speedIndex)}`;
    const parts = [run("Mobile (lab)", v.mobile), run("Desktop (lab)", v.desktop)].filter(Boolean);
    if (v.field) parts.push(`Real users (field): LCP ${ms(v.field.lcp)}, INP ${v.field.inp == null ? "n/a" : `${Math.round(v.field.inp)} ms`}, CLS ${num(v.field.cls)}`);
    if (v.weight?.total) parts.push(`Page weight ${Math.round(v.weight.total / 1024)} KB, images ${v.weight.images == null ? "n/a" : `${Math.round(v.weight.images / 1024)} KB`}, ${v.weight.requests ?? "n/a"} requests`);
    if (v.a11y != null) parts.push(`Lighthouse accessibility ${v.a11y}/100`);
    if (parts.length) out.push(`Core Web Vitals. ${parts.join(". ")}.`);
  }
  if (res.crawl) out.push(`Crawl: ${res.crawl.pages} pages checked, ${res.crawl.sitemapUrls} in the sitemap, ${res.crawl.broken} broken.`);
  if (res.links) out.push(`Links: ${res.links.checked} checked, ${res.links.broken} broken.`);
  if (res.images) out.push(`Images: ${res.images.count} found.`);
  if (res.tech?.length) out.push(`Tech stack: ${res.tech.slice(0, 15).map((t) => t.name).join(", ")}.`);
  const open = res.findings.filter((f) => !done.has(f.id)).sort((a, b) => (SEV[a.severity] ?? 3) - (SEV[b.severity] ?? 3));
  out.push(`Open issues (${open.length}, most important first; [id] matches /fix/<id> when a guide exists):`);
  for (const f of open.slice(0, 30)) {
    const pages = f.pages?.rows.length ? ` Affects ${f.pages.rows.length} page(s), e.g. ${f.pages.rows.slice(0, 3).map((r) => r.url).join(", ")}.` : f.evidence ? ` Evidence: ${clip(f.evidence, 160)}` : "";
    out.push(`- [${f.id}] ${f.severity.toUpperCase()} · ${f.title}. Fix: ${clip(f.fix, 200)}${pages}`);
  }
  if (open.length > 30) out.push(`…and ${open.length - 30} more lower-priority issues.`);
  if (done.size) out.push(`Marked as fixed by the owner: ${[...done].slice(0, 20).join(", ")}.`);
  return out.join("\n");
}

/** Keep the last few turns, each within size, ending with a user question. Returns null when the shape is wrong. */
export function cleanTurns(input: unknown): Turn[] | null {
  if (!Array.isArray(input)) return null;
  const turns = input
    .filter((t): t is Turn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim().length > 0)
    .slice(-CHAT_LIMITS.turns)
    .map((t) => ({ role: t.role, content: t.content.slice(0, CHAT_LIMITS.turn) }));
  const last = turns[turns.length - 1];
  if (!last || last.role !== "user" || last.content.length > CHAT_LIMITS.question) return null;
  return turns;
}

/** Turns OpenAI's streamed Responses events (server-sent events) into plain answer text. Only text deltas
    are passed on; a failure before any text becomes a short apology so the reader never sees a blank reply. */
export function sseText(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const reader = body.getReader();
  let buf = "";
  let sent = false;
  return new ReadableStream<Uint8Array>({
    async pull(ctl) {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          if (!sent) ctl.enqueue(enc.encode("Sorry, I couldn't write an answer this time. Please try again."));
          ctl.close();
          return;
        }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        let pushed = false;
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          let ev: { type?: string; delta?: string };
          try {
            ev = JSON.parse(data);
          } catch {
            continue;
          }
          if (ev.type === "response.output_text.delta" && ev.delta) {
            ctl.enqueue(enc.encode(ev.delta));
            sent = pushed = true;
          } else if (ev.type === "response.incomplete" && !sent) {
            ctl.enqueue(enc.encode("Sorry, that answer ran too long. Try a narrower question."));
            sent = pushed = true;
          } else if (ev.type === "error" || ev.type === "response.failed") {
            if (!sent) ctl.enqueue(enc.encode("Sorry, something went wrong while answering. Please try again."));
            ctl.close();
            void reader.cancel();
            return;
          }
        }
        if (pushed) return;
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}
