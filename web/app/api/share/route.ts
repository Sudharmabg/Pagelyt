import { userFromRequest } from "@/lib/auth";
import { getScanRow, live } from "@/lib/scan/store";
import { canWhiteLabel, createShare, getBrand } from "@/lib/scan/store-ext";

/* Create a client-facing link to a branded copy of a report. Revoking is done from the browser
   (RLS lets owners update their own rows), see /account/brand. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!live()) return Response.json({ error: "Sharing needs Supabase to be configured." }, { status: 501 });
  if (!(await canWhiteLabel(user.id))) return Response.json({ error: "White-label reports are on the Business plan." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { scanId?: string; brandId?: string | null; showDetails?: boolean; includeAi?: boolean; expiresInDays?: number };
  const scan = await getScanRow(String(b.scanId || ""));
  if (!scan || scan.status !== "done") return Response.json({ error: "Report not found." }, { status: 404 });
  if (scan.user_id !== user.id) return Response.json({ error: "Save this site to your account before sharing its report." }, { status: 403 });

  let brandId: string | null = null;
  if (b.brandId) {
    const brand = await getBrand(b.brandId, user.id);
    if (!brand) return Response.json({ error: "Brand not found." }, { status: 404 });
    brandId = brand.id;
  }
  const days = b.expiresInDays && b.expiresInDays > 0 ? Math.min(b.expiresInDays, 365) : undefined;
  const share = await createShare({ scanId: scan.id, userId: user.id, brandId, showDetails: b.showDetails !== false, includeAi: !!b.includeAi, expiresInDays: days });
  return Response.json({ token: share.token, path: `/r/${share.token}` });
}
