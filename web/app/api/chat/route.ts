import { userFromRequest } from "@/lib/auth";
import { buildInstructions, chatOn, streamAnswer } from "@/lib/ai/chat";
import { cleanTurns } from "@/lib/ai/chat-knowledge";
import { isPaid } from "@/lib/scan/agency";
import { getScanRow, rateLimit } from "@/lib/scan/store";

/* Pagelyt Assistant. Signed in, about one of your own reports. Streams plain text; the sources
   used are in the x-chat-sources header (URI-encoded JSON). */

const CHAT_DAILY = { free: 10, paid: 100 } as const;

const no = (error: string, status: number, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in to use the assistant.", 401);
  if (!chatOn()) return no("The assistant isn't switched on yet (OPENAI_API_KEY is not set).", 503);

  const body = (await req.json().catch(() => ({}))) as { scanId?: unknown; messages?: unknown };
  const turns = cleanTurns(body.messages);
  if (!turns) return no("Ask a question of up to 1,000 characters.", 400);
  if (typeof body.scanId !== "string") return no("Open a report first.", 400);
  const row = await getScanRow(body.scanId);
  if (!row || row.user_id !== user.id || !row.result) return no("Report not found.", 404);

  const paid = await isPaid(user.id);
  if (!(await rateLimit(`chat-burst:${user.id}`, 6, 60))) return no("You're asking quickly. Wait a moment and try again.", 429);
  if (!(await rateLimit(`chat-day:${user.id}`, paid ? CHAT_DAILY.paid : CHAT_DAILY.free, 86_400)))
    return no(paid ? `You've used today's ${CHAT_DAILY.paid} questions. The limit resets within 24 hours.` : `You've used today's ${CHAT_DAILY.free} free questions. Upgrade for up to ${CHAT_DAILY.paid} a day.`, 429, { upgrade: !paid });

  const { instructions, sources } = buildInstructions(row.result, turns, row.fixed ?? []);
  try {
    const stream = await streamAnswer(instructions, turns, req.signal);
    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-chat-sources": encodeURIComponent(JSON.stringify(sources)) },
    });
  } catch (e) {
    console.error("chat", e instanceof Error ? e.message : e);
    return no("The assistant couldn't answer just now. Please try again.", 502);
  }
}
