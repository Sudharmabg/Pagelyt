import { userFromRequest } from "@/lib/auth";
import { createComparison, isPaid } from "@/lib/scan/agency";
import { getScanRow } from "@/lib/scan/store";

/* Saves a comparison of one of the user's reports against up to three competitor reports the user has
   just scanned (the competitor scans go through the normal scan endpoint and its rate limit).
   Paid plans only. Browser sends: Authorization: Bearer <access token>. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!(await isPaid(user.id).catch(() => false))) return Response.json({ error: "Competitor comparison comes with any paid plan.", upgrade: true }, { status: 403 });

  let body: { scanId?: unknown; rivalIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const rivalIds = Array.isArray(body.rivalIds) ? [...new Set(body.rivalIds.map(String))].slice(0, 3) : [];
  if (!rivalIds.length) return Response.json({ error: "Add at least one competitor." }, { status: 400 });

  const rows = await Promise.all([String(body.scanId || ""), ...rivalIds].map((id) => getScanRow(id)));
  if (rows.some((r) => !r || r.status !== "done")) return Response.json({ error: "One of the reports is missing or unfinished." }, { status: 404 });
  // Every report must be the user's own (competitor scans were run while signed in, so they are owned too).
  if (rows.some((r) => r!.user_id && r!.user_id !== user.id)) return Response.json({ error: "One of the reports belongs to another account." }, { status: 403 });

  try {
    const id = await createComparison(user.id, rows[0]!.id, rivalIds);
    return Response.json({ id });
  } catch {
    return Response.json({ error: "Could not save the comparison. Please try again." }, { status: 503 });
  }
}
