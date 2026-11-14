/* Outgoing email through Resend, behind one switch shared by score alerts and client report emails.
   Mail goes out only when EMAILS_ON=1 and RESEND_API_KEY are both set (turn it on once the Resend domain
   is verified). RESEND_API_URL points the calls elsewhere; the local mock mode uses it so nothing is sent. */

export function emailsOn(): boolean {
  return process.env.EMAILS_ON === "1" && !!process.env.RESEND_API_KEY;
}

export type Mail = { from: string; to: string; subject: string; text: string; html?: string; replyTo?: string; attachments?: { filename: string; content: string; contentType?: string }[] };

/** Sends one email. True when Resend accepted it; false when emails are off or the send failed. */
export async function sendEmail(m: Mail): Promise<boolean> {
  if (!emailsOn()) return false;
  const base = process.env.RESEND_API_URL || "https://api.resend.com";
  try {
    const r = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: m.from, to: m.to, subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}), ...(m.replyTo ? { reply_to: m.replyTo } : {}), ...(m.attachments?.length ? { attachments: m.attachments.map((x) => ({ filename: x.filename, content: x.content, ...(x.contentType ? { content_type: x.contentType } : {}) })) } : {}) }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** A display name that is safe inside a From header: no quotes, angle brackets or line breaks. */
export function headerName(raw: string): string {
  return raw.replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Tells the account holder their password was changed, so an unexpected change gets noticed. Best effort. */
export async function notifyPasswordChanged(to: string, how: "reset" | "changed"): Promise<void> {
  const when = new Date().toUTCString();
  const text = [
    "Hello,",
    "",
    how === "reset" ? `The password for your Pagelyt account was reset with an email code on ${when}.` : `The password for your Pagelyt account was changed from your account page on ${when}.`,
    "Other browsers and devices were signed out.",
    "",
    "If this was you, there is nothing more to do.",
    "If it wasn't, reset your password straight away at https://pagelyt.dev/login?forgot=1 and reply to this email.",
    "",
    "Pagelyt",
  ].join("\n");
  await sendEmail({ from: process.env.ALERT_FROM ?? "Pagelyt <alerts@pagelyt.dev>", to, subject: "Your Pagelyt password was changed", text, replyTo: process.env.CONTACT_EMAIL ?? "customer_care@pagelyt.dev" });
}

/* ---------- Consultation bookings ---------- */

type BookingMail = { id: string; starts_at: string; ends_at: string; session: string; name: string; email: string; website: string | null; message: string | null; timezone: string | null; meet_url: string | null };

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
};
const contact = () => process.env.CONTACT_EMAIL ?? "customer_care@pagelyt.dev";
const bookingFrom = () => process.env.ALERT_FROM ?? "Pagelyt <alerts@pagelyt.dev>";

/** "Friday 20 November 2026, 10:30 to 11:00 (India Standard Time)" in a zone, falling back to IST. */
export function whenText(startIso: string, endIso: string, tz: string | null): string {
  const zone = (() => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz ?? "" });
      return tz || "Asia/Kolkata";
    } catch {
      return "Asia/Kolkata";
    }
  })();
  const day = new Date(startIso).toLocaleDateString("en-GB", { timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const t = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "long" }).formatToParts(new Date(startIso)).find((p) => p.type === "timeZoneName")?.value ?? zone;
  return `${day}, ${t(startIso)} to ${t(endIso)} (${name})`;
}

/** Confirmation (or a changed time / added call link) to the visitor, with the calendar file attached. */
export async function sendBookingToVisitor(b: BookingMail, ics: string, manageUrl: string, kind: "confirmed" | "moved" | "link" | "cancelled"): Promise<boolean> {
  const when = whenText(b.starts_at, b.ends_at, b.timezone);
  const title = b.session.split(" · ")[0];
  const subject = kind === "confirmed" ? `Booked: ${title}, ${when.split(",")[0]}` : kind === "moved" ? `New time for your Pagelyt consultation` : kind === "link" ? `Your call link for the Pagelyt consultation` : `Cancelled: your Pagelyt consultation`;
  const text = [
    `Hello ${b.name.split(" ")[0]},`,
    "",
    kind === "cancelled" ? `Your ${title} on ${when} has been cancelled.` : kind === "moved" ? `Your ${title} has moved to ${when}.` : kind === "link" ? `Here is the video call link for your ${title} on ${when}:` : `Your ${title} is booked for ${when}.`,
    ...(kind === "link" && b.meet_url ? ["", b.meet_url] : []),
    ...(kind === "cancelled"
      ? ["", "If you'd like another time, book again at https://pagelyt.dev/consultation."]
      : [
          "",
          b.meet_url && kind !== "link" ? `Join the call: ${b.meet_url}` : kind !== "link" ? "Sudharma will email you the video call link before the session." : "",
          "",
          "The attached calendar file adds it to your calendar.",
          "Payment: nothing to pay now. We email an invoice after booking (subscribers' free annual session is applied there).",
          "",
          `Need to cancel? ${manageUrl}`,
          "To change the time, just reply to this email.",
        ]),
    "",
    "Pagelyt",
  ].join("\n");
  return sendEmail({ from: bookingFrom(), to: b.email, subject, text, replyTo: contact(), attachments: [{ filename: kind === "cancelled" ? "cancelled.ics" : "consultation.ics", content: b64(ics), contentType: "text/calendar" }] });
}

/** A heads-up to Pagelyt for each new booking or visitor cancellation. */
export async function sendBookingToFounder(b: BookingMail, ics: string, kind: "new" | "cancelled"): Promise<boolean> {
  const when = whenText(b.starts_at, b.ends_at, "Asia/Kolkata");
  const text = [
    kind === "new" ? "New consultation booking." : "A visitor cancelled their consultation.",
    "",
    `When: ${when}`,
    `Session: ${b.session}`,
    `Name: ${b.name}`,
    `Email: ${b.email}`,
    `Website: ${b.website ?? "-"}`,
    `Their timezone: ${b.timezone ?? "-"}`,
    "",
    b.message ? `Message:\n${b.message}` : "No message.",
    "",
    kind === "new" ? "Add the video call link in /admin (Bookings) and the visitor gets it by email." : "",
  ].join("\n");
  return sendEmail({ from: bookingFrom(), to: contact(), subject: `${kind === "new" ? "Booking" : "Cancelled"}: ${b.session.split(" · ")[0]}, ${when.split(" (")[0]}`, text, replyTo: b.email, attachments: [{ filename: "booking.ics", content: b64(ics), contentType: "text/calendar" }] });
}
