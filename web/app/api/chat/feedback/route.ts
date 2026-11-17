import { userFromRequest } from "@/lib/auth";
import { setFeedback, validUuid } from "@/lib/ai/chat-store";
import { rateLimit } from "@/lib/scan/store";

/* Thumbs up / down on one of the signed-in user's Ask Pagelyt answers: { messageId, value: 1 | -1 | 0 } (0 clears it). */
const no = (error: string, status: number) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  const body = (await req.json().catch(() => ({}))) as { messageId?: unknown; value?: unknown };
  if (!validUuid(body.messageId) || ![1, -1, 0].includes(body.value as number)) return no("Invalid request.", 400);
  if (!(await rateLimit(`chat-fb:${user.id}`, 60, 60))) return no("Too many changes. Wait a moment.", 429);
  try {
    await setFeedback(user.id, body.messageId, body.value === 0 ? null : (body.value as 1 | -1));
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("chat feedback", e instanceof Error ? e.message : e);
    return no("Couldn't save that.", 502);
  }
}
