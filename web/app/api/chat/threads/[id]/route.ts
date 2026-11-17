import { userFromRequest } from "@/lib/auth";
import { deleteThread, getThread, listMessages } from "@/lib/ai/chat-store";

/* One saved Ask Pagelyt chat: GET its messages, DELETE it. Only the signed-in user's own threads. */
const no = (error: string, status: number) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  const { id } = await ctx.params;
  try {
    const t = await getThread(user.id, id);
    if (!t) return no("Chat not found.", 404);
    const msgs = await listMessages(user.id, t.id);
    return Response.json(
      {
        thread: { id: t.id, title: t.title, updatedAt: t.updated_at },
        messages: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources ?? [], finding: m.finding ?? undefined, feedback: m.feedback ?? null, time: m.created_at })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    console.error("chat thread", e instanceof Error ? e.message : e);
    return no("Couldn't load that chat.", 502);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  const { id } = await ctx.params;
  try {
    await deleteThread(user.id, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("chat delete", e instanceof Error ? e.message : e);
    return no("Couldn't delete that chat.", 502);
  }
}
