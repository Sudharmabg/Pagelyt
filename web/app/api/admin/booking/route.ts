import { adminFromRequest } from "@/lib/auth";
import { availability, bookingIcs, checkSettings, getBooking, getSettings, listBlocks, listBookings, saveSettings, setBlock, updateBooking } from "@/lib/booking";
import { sendBookingToVisitor } from "@/lib/email";
import { SITE_URL } from "@/app/site-config";

/* Admin panel: consultation hours, blocked days and bookings.
   GET: { settings, blocks, bookings } (bookings from 30 days ago on).
   POST { action }: "settings" { settings } · "block" { day, note? } · "unblock" { day } · "cancel" { id } ·
   "done" { id } · "meet" { id, meetUrl } (emails the link) · "move" { id, start } (emails the new time) ·
   "slots" { id } (free start times for moving that booking). */

export async function GET(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  try {
    const settings = await getSettings();
    const today = new Date().toISOString().slice(0, 10);
    const [blocks, bookings] = await Promise.all([listBlocks(today), listBookings(new Date(Date.now() - 30 * 86400000).toISOString())]);
    return Response.json({ settings, blocks, bookings: bookings.map(({ manage_token: _t, ...b }) => b) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not load bookings." }, { status: 503 });
  }
}

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const organizer = process.env.CONTACT_EMAIL ?? "customer_care@pagelyt.dev";
  try {
    switch (body.action) {
      case "settings": {
        const s = checkSettings((body.settings ?? {}) as Record<string, unknown>);
        if ("error" in s) return bad(s.error);
        await saveSettings(s);
        return Response.json({ ok: true, settings: s });
      }
      case "block":
      case "unblock": {
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;
        await setBlock(String(body.day ?? ""), note, body.action === "block");
        return Response.json({ ok: true });
      }
    }
    const b = await getBooking(String(body.id ?? ""));
    if (!b) return bad("Unknown booking.", 404);
    const manage = `${SITE_URL}/consultation/manage?id=${b.id}&t=${b.manage_token}`;
    const seq = Math.floor(Date.now() / 1000);
    switch (body.action) {
      case "cancel": {
        await updateBooking(b.id, { status: "cancelled" });
        const sent = await sendBookingToVisitor(b, bookingIcs(b, { cancel: true, sequence: seq, organizer, attendee: b.email }), `${SITE_URL}/consultation`, "cancelled");
        return Response.json({ ok: true, emailed: sent });
      }
      case "done":
        await updateBooking(b.id, { status: "done" });
        return Response.json({ ok: true });
      case "meet": {
        const url = typeof body.meetUrl === "string" ? body.meetUrl.trim() : "";
        if (url && (!/^https:\/\/\S+$/.test(url) || url.length > 300)) return bad("Paste the full https:// link.");
        await updateBooking(b.id, { meet_url: url || null });
        const sent = url && b.status === "confirmed" ? await sendBookingToVisitor({ ...b, meet_url: url }, bookingIcs({ ...b, meet_url: url }, { sequence: seq, organizer, attendee: b.email }), manage, "link") : false;
        return Response.json({ ok: true, emailed: sent });
      }
      case "slots": {
        const { slots } = await availability(b.minutes, b.id);
        return Response.json({ slots });
      }
      case "move": {
        const at = Date.parse(String(body.start ?? ""));
        if (!Number.isFinite(at)) return bad("Pick a new time.");
        const { slots } = await availability(b.minutes, b.id);
        const iso = new Date(at).toISOString();
        if (!slots.includes(iso)) return bad("That time isn't free.", 409);
        const moved = { ...b, starts_at: iso, ends_at: new Date(at + b.minutes * 60000).toISOString(), status: "confirmed" as const };
        await updateBooking(b.id, { starts_at: moved.starts_at, ends_at: moved.ends_at, status: "confirmed" });
        const sent = await sendBookingToVisitor(moved, bookingIcs(moved, { sequence: seq, organizer, attendee: b.email }), manage, "moved");
        return Response.json({ ok: true, emailed: sent });
      }
    }
    return bad("Unknown action.");
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not update.", 503);
  }
}
