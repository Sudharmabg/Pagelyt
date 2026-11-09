import { adminFromRequest } from "@/lib/auth";
import { REQUEST_STATUSES, listRequests, setRequestStatus, type RequestStatus } from "@/lib/requests";

/* Admin panel: consultation requests and contact messages, newest first. */
export async function GET(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  try {
    return Response.json({ requests: await listRequests() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not load requests." }, { status: 503 });
  }
}

/* Body: { id, status }. Moves a request along: new, contacted, scheduled, closed. */
export async function POST(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; status?: unknown };
  if (typeof body.id !== "string" || !REQUEST_STATUSES.includes(body.status as RequestStatus)) {
    return Response.json({ error: "Invalid update." }, { status: 400 });
  }
  try {
    await setRequestStatus(body.id, body.status as RequestStatus);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not update." }, { status: 503 });
  }
}
