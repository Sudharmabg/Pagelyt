import { userFromRequest } from "@/lib/auth";
import { readJson, reply } from "@/lib/gotrue";
import { guard } from "@/lib/ratelimit";
import { getScanRow, live, setScanFixed } from "@/lib/scan/store";

const MAX_KEYS = 300;
const MAX_KEY_LENGTH = 300;

/* The owner saves which findings they have marked as fixed. Only the signed-in owner of the report may do this;
   everyone else with the link can read the report but not change it. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return reply({ error: "Please sign in first." }, 401);
  if (!user.verified) return reply({ error: "Please confirm your email first." }, 403);
  if (!live()) return reply({ error: "Saving needs accounts to be switched on." }, 501);

  const limited = await guard([{ key: `fixed:${user.id}`, limit: 60, windowSec: 60 }], { failClosed: false });
  if (limited) return limited;

  const body = await readJson(req, 100_000);
  const keys = body?.fixed;
  if (!Array.isArray(keys) || keys.length > MAX_KEYS) return reply({ error: "Invalid request." }, 400);
  const clean: string[] = [];
  for (const k of keys) {
    if (typeof k !== "string" || k.length === 0 || k.length > MAX_KEY_LENGTH || /[\u0000-\u001f\u007f]/.test(k)) return reply({ error: "Invalid request." }, 400);
    if (!clean.includes(k)) clean.push(k);
  }

  const { id } = await ctx.params;
  const row = await getScanRow(id);
  if (!row) return reply({ error: "Report not found." }, 404);
  if (row.user_id !== user.id) return reply({ error: "Only the owner of this report can change it." }, 403);

  try {
    await setScanFixed(id, clean);
    return reply({ ok: true, fixed: clean });
  } catch {
    return reply({ error: "Could not save that. Please try again." }, 500);
  }
}
