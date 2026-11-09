import { clientIp, userFromRequest, verifyTurnstile } from "@/lib/auth";
import { guard } from "@/lib/ratelimit";
import { checkRequest, saveRequest } from "@/lib/requests";

/* Consultation and contact forms. Stores the request in Supabase for the admin panel to follow up. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = await guard([{ key: `request:ip:${ip}`, limit: 5, windowSec: 3600 }], { failClosed: false });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  // Honeypot: a field people never see. Bots that fill it get a quiet "thanks" and nothing is stored.
  if (typeof body.company === "string" && body.company.trim()) return Response.json({ ok: true });

  const user = await userFromRequest(req).catch(() => null);
  if (!user && !(await verifyTurnstile(typeof body.turnstile === "string" ? body.turnstile : undefined, ip))) {
    return Response.json({ error: "Please complete the human check and try again." }, { status: 400 });
  }

  const v = checkRequest(body, user?.id ?? null);
  if ("error" in v) return Response.json({ error: v.error }, { status: 400 });
  try {
    await saveRequest(v.row);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "We couldn't send that just now. Please try again, or email us instead." }, { status: 503 });
  }
}
