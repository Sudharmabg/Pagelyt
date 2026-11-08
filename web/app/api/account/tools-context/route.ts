import { userFromRequest } from "@/lib/auth";
import { reply } from "@/lib/gotrue";
import { getScanRow, latestScanForUser, live, type ScanRow } from "@/lib/scan/store";
import { toolContext } from "@/lib/scan/tools-context";

/* What the free tools pre-fill from: the signed-in owner's report named in ?scan=, or their newest one.
   A report that belongs to someone else (or nobody) is never returned. */
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return reply({ error: "Please sign in first." }, 401);
  if (!live()) return reply({ ctx: null });

  const wanted = new URL(req.url).searchParams.get("scan");
  try {
    let row: ScanRow | null = null;
    if (wanted) {
      const r = await getScanRow(wanted);
      if (r && r.user_id === user.id && r.status === "done") row = r;
    }
    if (!row) row = await latestScanForUser(user.id);
    return reply({ ctx: row?.result ? toolContext(row.id, row.result) : null });
  } catch {
    return reply({ ctx: null });
  }
}
