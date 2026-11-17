import { adminFromRequest } from "@/lib/auth";
import { reportProps } from "@/lib/scan/report-props";
import { getScanRow } from "@/lib/scan/store";

/* Admin panel: the whole of any finished report, including a shared scan nobody has signed in to yet.
   Reading it changes nothing: the report is not claimed and not marked as opened. */
export async function GET(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  const row = await getScanRow(new URL(req.url).searchParams.get("id") ?? "").catch(() => null);
  if (!row || row.status !== "done" || !row.result) return Response.json({ error: "Report not found." }, { status: 404 });
  return Response.json(await reportProps({ ...row, result: row.result }));
}
