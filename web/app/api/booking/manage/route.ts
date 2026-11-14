import { clientIp } from "@/lib/auth";
import { guard } from "@/lib/ratelimit";
import { bookingIcs, getBooking, sameToken, updateBooking } from "@/lib/booking";
import { sendBookingToFounder, sendBookingToVisitor } from "@/lib/email";
import { SITE_URL } from "@/app/site-config";

/* The visitor's own link from the confirmation email. GET ?id&t: the booking. POST { id, t }: cancels it. */

async function find(req: Request, id: unknown, t: unknown) {
  const limited = await guard([{ key: `booking:manage:${clientIp(req)}`, limit: 30, windowSec: 600 }], { failClosed: false });
  if (limited) return { error: limited };
  if (typeof id !== "string" || typeof t !== "string") return { error: Response.json({ error: "This link isn't valid." }, { status: 404 }) };
  const b = await getBooking(id);
  if (!b || !sameToken(b.manage_token, t)) return { error: Response.json({ error: "This link isn't valid." }, { status: 404 }) };
  return { b };
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const r = await find(req, q.get("id"), q.get("t"));
  if ("error" in r) return r.error;
  const { b } = r;
  return Response.json({ starts_at: b.starts_at, ends_at: b.ends_at, session: b.session, status: b.status, name: b.name.split(" ")[0] }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; t?: unknown };
  const r = await find(req, body.id, body.t);
  if ("error" in r) return r.error;
  const { b } = r;
  if (b.status !== "confirmed") return Response.json({ error: "This booking is already cancelled or done." }, { status: 409 });
  if (Date.parse(b.starts_at) < Date.now()) return Response.json({ error: "This session has already started. Reply to your confirmation email instead." }, { status: 409 });
  await updateBooking(b.id, { status: "cancelled" });
  const organizer = process.env.CONTACT_EMAIL ?? "customer_care@pagelyt.dev";
  const ics = bookingIcs(b, { cancel: true, sequence: Math.floor(Date.now() / 1000), organizer, attendee: b.email });
  await Promise.allSettled([sendBookingToVisitor(b, ics, `${SITE_URL}/consultation`, "cancelled"), sendBookingToFounder(b, ics, "cancelled")]);
  return Response.json({ ok: true });
}
