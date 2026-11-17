import { userFromRequest } from "@/lib/auth";
import { listThreads } from "@/lib/ai/chat-store";
import { getScanRow } from "@/lib/scan/store";

/* Ask Pagelyt's History list: the signed-in owner's saved chats for this report's website, newest first. */
const no = (error: string, status: number) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  const scanId = new URL(req.url).searchParams.get("scanId") ?? "";
  const row = await getScanRow(scanId);
  if (!row || row.user_id !== user.id) return no("Report not found.", 404);
  try {
    const threads = await listThreads(user.id, row.host);
    return Response.json({ threads: threads.map(({ id, title, updated_at }) => ({ id, title, updatedAt: updated_at })) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    // Before migration 0015 has run there is simply no history.
    console.error("chat threads", e instanceof Error ? e.message : e);
    return Response.json({ threads: [], off: true }, { headers: { "cache-control": "no-store" } });
  }
}
