import { userFromRequest } from "@/lib/auth";
import { buildInstructions, chatOn, streamAnswer } from "@/lib/ai/chat";
import { cleanTurns } from "@/lib/ai/chat-knowledge";
import { isPaid } from "@/lib/scan/agency";
import { getScanRow, rateLimit } from "@/lib/scan/store";
import { findingKey } from "@/lib/scan/score";
import type { ScanResult } from "@/lib/scan/types";
import { gscBrief, type GscData } from "@/lib/google/gsc-insights";
import { ga4Brief, type Ga4Ai, type Ga4Data } from "@/lib/google/ga4-insights";
import { adsBrief, type AdsAi, type AdsData } from "@/lib/google/ads-insights";
import { canUseGoogle, getCache, getLink, siteForHost } from "@/lib/google/store";
import { addMessage, createThread, deleteMessage, getThread, titleFrom, touchThread, validUuid } from "@/lib/ai/chat-store";

/* Pagelyt Assistant. Signed in, about one of your own reports. Streams plain text; the sources
   used are in the x-chat-sources header (URI-encoded JSON).
   Each question and answer is saved to a thread for this site (migration 0015): send threadId to carry on one, or
   none to start a new one. x-chat-thread names the thread and x-chat-answer the answer's id (for thumbs up/down).
   finding: the title of the report finding the question is about. replace: the id of the last answer to regenerate
   (it is deleted and the question is not saved again). Saving never fails the chat. */

const CHAT_DAILY = { free: 10, paid: 100 } as const;

const no = (error: string, status: number, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in to use the assistant.", 401);
  if (!chatOn()) return no("The assistant isn't switched on yet (OPENAI_API_KEY is not set).", 503);

  const body = (await req.json().catch(() => ({}))) as { scanId?: unknown; messages?: unknown; threadId?: unknown; finding?: unknown; replace?: unknown };
  const turns = cleanTurns(body.messages);
  if (!turns) return no("Ask a question of up to 1,000 characters.", 400);
  const finding = typeof body.finding === "string" && body.finding.trim() ? body.finding.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300) : null;
  const question = turns[turns.length - 1].content;
  // The finding goes to the model with the question, so "How do I fix this?" knows what "this" is.
  if (finding) turns[turns.length - 1] = { role: "user", content: `About this finding in my report: "${finding}"\n\n${question}` };
  if (typeof body.scanId !== "string") return no("Open a report first.", 400);
  const row = await getScanRow(body.scanId);
  if (!row || row.user_id !== user.id || !row.result) return no("Report not found.", 404);

  const paid = await isPaid(user.id);
  if (!(await rateLimit(`chat-burst:${user.id}`, 6, 60))) return no("You're asking quickly. Wait a moment and try again.", 429);
  if (!(await rateLimit(`chat-day:${user.id}`, paid ? CHAT_DAILY.paid : CHAT_DAILY.free, 86_400)))
    return no(paid ? `You've used today's ${CHAT_DAILY.paid} questions. The limit resets within 24 hours.` : `You've used today's ${CHAT_DAILY.free} free questions. Upgrade for up to ${CHAT_DAILY.paid} a day.`, 429, { upgrade: !paid });

  const { instructions, sources } = buildInstructions(row.result, turns, row.fixed ?? [], await googleBrief(user.id, row.result, row.fixed ?? []));
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await streamAnswer(instructions, turns, req.signal);
  } catch (e) {
    console.error("chat", e instanceof Error ? e.message : e);
    return no("The assistant couldn't answer just now. Please try again.", 502);
  }

  // Save the question now and the answer once it has streamed (or what there was of it, if stopped).
  const thread = await saveQuestion(user.id, row.host, row.id, question, finding, body.threadId, body.replace);
  const answerId = crypto.randomUUID();
  let answer = "";
  let saved = false;
  const dec = new TextDecoder();
  const keep = async () => {
    if (saved || !thread || !answer.trim()) return;
    saved = true;
    await addMessage({ id: answerId, thread_id: thread, user_id: user.id, role: "assistant", content: answer, sources, finding: null }).catch((e) => console.error("chat save", e instanceof Error ? e.message : e));
  };
  const reader = stream.getReader();
  const out = new ReadableStream<Uint8Array>({
    async pull(ctl) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          await keep();
          ctl.close();
          return;
        }
        answer += dec.decode(value, { stream: true });
        ctl.enqueue(value);
      } catch (e) {
        await keep();
        ctl.error(e);
      }
    },
    async cancel() {
      await keep();
      await reader.cancel().catch(() => {});
    },
  });
  return new Response(out, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-chat-sources": encodeURIComponent(JSON.stringify(sources)),
      ...(thread ? { "x-chat-thread": thread, "x-chat-answer": answerId } : {}),
    },
  });
}

/* Saves the question to the given thread (when it is this user's thread for this site) or to a new one, and returns the
   thread id. With `replace`, the answer being regenerated is deleted instead and the question is not saved twice.
   Returns null when saving isn't possible (e.g. migration 0015 hasn't run); the chat still answers. */
async function saveQuestion(userId: string, host: string, scanId: string, question: string, finding: string | null, threadId: unknown, replace: unknown): Promise<string | null> {
  try {
    let t = validUuid(threadId) ? await getThread(userId, threadId) : null;
    if (t && t.host !== host) t = null;
    if (!t) t = await createThread(userId, host, scanId, titleFrom(finding ? `${finding}: ${question}` : question));
    else await touchThread(t.id, scanId);
    if (validUuid(replace)) await deleteMessage(userId, t.id, replace);
    else await addMessage({ thread_id: t.id, user_id: userId, role: "user", content: question, sources: [], finding });
    return t.id;
  } catch (e) {
    console.error("chat save", e instanceof Error ? e.message : e);
    return null;
  }
}

/* The cached Search Console, Analytics and Google Ads numbers for this report's site, when the owner has connected Google. Never
   calls Google here (the dashboard keeps the cache fresh), and never fails the chat. */
async function googleBrief(userId: string, res: ScanResult, fixed: string[]): Promise<string | undefined> {
  try {
    if (!(await canUseGoogle(userId))) return undefined;
    const site = await siteForHost(res.host, userId);
    if (!site) return undefined;
    const link = await getLink(site.id);
    const [c, ga, ai, ads, adsAi] = await Promise.all([
      link?.gsc_property ? getCache<GscData>(site.id, "gsc") : null,
      link?.ga4_property ? getCache<Ga4Data>(site.id, "ga4") : null,
      link?.ga4_property ? getCache<Ga4Ai>(site.id, "ga4_ai") : null,
      link?.ads_customer ? getCache<AdsData>(site.id, "ads") : null,
      link?.ads_customer ? getCache<AdsAi>(site.id, "ads_ai") : null,
    ]);
    const done = new Set(fixed);
    const open = res.findings.filter((f) => !done.has(findingKey(f)));
    const parts = [c?.data && gscBrief(c.data, open, res.url, findingKey), ga?.data && ga4Brief(ga.data, open, findingKey, ai?.data), ads?.data && adsBrief(ads.data, open, res.url, findingKey, c?.data, adsAi?.data)].filter(Boolean);
    return parts.length ? parts.join("\n") : undefined;
  } catch {
    return undefined;
  }
}
