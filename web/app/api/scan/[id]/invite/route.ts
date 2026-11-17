import { isAdmin, userFromRequest } from "@/lib/auth";
import { rootDomain } from "@/lib/domain";
import { claimDomain } from "@/lib/owners";
import { getScanRow, live, rest, saveSite } from "@/lib/scan/store";

/* An admin's shared scan (admin Scan tab, migration 0014). The report page calls this when it opens and again once
   the visitor has signed in. The first signed-in person who is not an admin becomes the report's owner; the website
   becomes theirs too unless another account already holds it. Admins only look: nothing is recorded for them.

   Answers `state`: "signin" (nobody signed in), "admin", "yours", "taken" (somebody else has it; the link then
   works like any other report link), "wait" (still scanning) or "unverified". */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = live() ? await getScanRow(id).catch(() => null) : null;
  if (!row || !row.invite) return Response.json({ error: "Report not found." }, { status: 404 });
  const q = `scans?id=eq.${encodeURIComponent(row.id)}`;
  const now = new Date().toISOString();

  const user = await userFromRequest(req);
  if (!user) {
    if (!row.user_id && !row.opened_at) await rest(`${q}&opened_at=is.null`, { method: "PATCH", body: JSON.stringify({ opened_at: now }), prefer: "return=minimal" }).catch(() => {});
    return Response.json({ state: "signin" });
  }
  if (await isAdmin(user)) return Response.json({ state: "admin" });
  if (row.user_id) return Response.json({ state: row.user_id === user.id ? "yours" : "taken" });
  if (!user.verified) return Response.json({ state: "unverified" });
  if (row.status !== "done") return Response.json({ state: "wait" });

  try {
    // Only an unclaimed row matches, so two people signing in at once cannot both get it.
    await rest(`${q}&user_id=is.null`, { method: "PATCH", body: JSON.stringify({ user_id: user.id, claimed_at: now, opened_at: row.opened_at ?? now }), prefer: "return=minimal" });
    const after = await getScanRow(row.id);
    if (after?.user_id !== user.id) return Response.json({ state: "taken" });
  } catch {
    return Response.json({ error: "Could not open the report. Please try again." }, { status: 503 });
  }
  // The website comes with the report when it is free. Someone else's website stays theirs: this person keeps the report only.
  const site = await claimDomain(rootDomain(row.host), user.id, true).catch(() => false);
  if (site) await saveSite(user.id, { id: row.id, host: row.host, url: row.url }, {}).catch(() => null);
  return Response.json({ state: "yours", site });
}
