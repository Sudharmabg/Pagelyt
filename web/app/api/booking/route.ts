import { clientIp, userFromRequest, verifyTurnstile } from "@/lib/auth";
import { guard } from "@/lib/ratelimit";
import { availability, bookingIcs, insertBooking, newToken, sessionOf } from "@/lib/booking";
import { sendBookingToFounder, sendBookingToVisitor } from "@/lib/email";
import { SITE_URL } from "@/app/site-config";

/* Consultation booking. GET ?minutes=30|60|90: the free start times (UTC) and the founder's timezone.
   POST { session, start, name, email, website?, message?, timezone?, turnstile?, company? }: books the slot (no sign-in
   needed; Turnstile instead), emails a calendar file to the visitor and a heads-up to Pagelyt. Pay later by invoice. */

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = await guard([{ key: `booking:slots:${ip}`, limit: 60, windowSec: 600 }], { failClosed: false });
  if (limited) return limited;
  const minutes = Number(new URL(req.url).searchParams.get("minutes"));
  if (![30, 60, 90].includes(minutes)) return Response.json({ error: "Pick a session length." }, { status: 400 });
  try {
    const { settings, slots } = await availability(minutes);
    return Response.json({ slots, timezone: settings.timezone, minutes }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Times couldn't be loaded just now. Please try again." }, { status: 503 });
  }
}

const clip = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = await guard([{ key: `booking:book:${ip}`, limit: 5, windowSec: 3600 }], { failClosed: false });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.company === "string" && body.company.trim()) return Response.json({ ok: true }); // honeypot

  const user = await userFromRequest(req).catch(() => null);
  if (!user && !(await verifyTurnstile(typeof body.turnstile === "string" ? body.turnstile : undefined, ip)))
    return Response.json({ error: "Please complete the human check and try again." }, { status: 400 });

  const s = sessionOf(body.session);
  if (!s) return Response.json({ error: "Please choose a session." }, { status: 400 });
  const name = clip(body.name, 100);
  const email = clip(body.email, 254)?.toLowerCase() ?? null;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Please enter your name and a valid email address.", field: "email" }, { status: 400 });
  const start = typeof body.start === "string" ? body.start : "";
  const at = Date.parse(start);
  if (!Number.isFinite(at)) return Response.json({ error: "Please pick a time.", field: "start" }, { status: 400 });
  let tz = clip(body.timezone, 64);
  try {
    if (tz) new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    tz = null;
  }

  try {
    const { slots } = await availability(s.minutes);
    const iso = new Date(at).toISOString();
    if (!slots.includes(iso)) return Response.json({ error: "That time was just taken or is no longer available. Please pick another.", field: "start", taken: true }, { status: 409 });
    const b = await insertBooking({
      starts_at: iso,
      ends_at: new Date(at + s.minutes * 60000).toISOString(),
      minutes: s.minutes,
      session: s.label,
      name,
      email,
      website: clip(body.website, 300),
      message: clip(body.message, 3000),
      timezone: tz,
      user_id: user?.id ?? null,
      manage_token: newToken(),
    });
    if (!b) return Response.json({ error: "That time was just taken. Please pick another.", field: "start", taken: true }, { status: 409 });
    const organizer = process.env.CONTACT_EMAIL ?? "customer_care@pagelyt.dev";
    const manage = `${SITE_URL}/consultation/manage?id=${b.id}&t=${b.manage_token}`;
    await Promise.allSettled([
      sendBookingToVisitor(b, bookingIcs(b, { organizer, attendee: b.email }), manage, "confirmed"),
      sendBookingToFounder(b, bookingIcs(b, { organizer, attendee: b.email }), "new"),
    ]);
    return Response.json({ ok: true, id: b.id, starts_at: b.starts_at, ends_at: b.ends_at, session: b.session });
  } catch {
    return Response.json({ error: "We couldn't book that just now. Please try again, or email us instead." }, { status: 503 });
  }
}
