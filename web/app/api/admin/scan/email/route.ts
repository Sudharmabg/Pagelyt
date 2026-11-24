import { adminFromRequest } from "@/lib/auth";
import { isDisposable } from "@/lib/disposable";
import { emailsOn, scanReportMail, sendEmail } from "@/lib/email";
import { digest, guard } from "@/lib/ratelimit";
import { overallScore } from "@/lib/scan/score";
import { getScanRow, live, rest } from "@/lib/scan/store";
import { checkEmail } from "@/lib/validate";

const NOTE_MAX = 500;

/* Admin Scan tab: email a shared scan's report link to one address. The link is the same /dashboard/:id one the tab
   copies; whoever signs in through it first owns the report. Records who it went to (migration 0020, optional). */
export async function POST(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  if (!live()) return Response.json({ error: "Emailing needs Supabase to be configured." }, { status: 501 });
  if (!emailsOn()) return Response.json({ error: "Emails aren't switched on yet (EMAILS_ON and RESEND_API_KEY). Copy the link instead." }, { status: 501 });

  const b = (await req.json().catch(() => ({}))) as { id?: string; email?: string; note?: string };
  const row = await getScanRow(String(b.id || "")).catch(() => null);
  if (!row || !row.invite) return Response.json({ error: "Shared scan not found." }, { status: 404 });
  if (row.status !== "done" || !row.result) return Response.json({ error: "That scan hasn't finished." }, { status: 409 });

  const em = checkEmail(String(b.email || ""));
  if (!em.ok) return Response.json({ error: em.error }, { status: 400 });
  if (isDisposable(em.value)) return Response.json({ error: "Please use the person's real email address." }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > NOTE_MAX) return Response.json({ error: `Keep the note under ${NOTE_MAX} characters.` }, { status: 400 });

  const limited = await guard([
    { key: `scan-mail:u:${a.user.id}`, limit: 100, windowSec: 86_400 },
    { key: `scan-mail:to:${await digest(em.value)}`, limit: 5, windowSec: 86_400 },
  ]);
  if (limited) return Response.json({ error: "Email limit reached (100 a day, 5 to the same address). Copy the link instead." }, { status: 429 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const sent = await sendEmail(scanReportMail({ to: em.value, link: `${origin}/dashboard/${row.id}`, host: row.host, score: overallScore(row.result.modules), note }));
  if (!sent) return Response.json({ error: "The email could not be sent. Check the Resend domain, or copy the link instead." }, { status: 502 });

  // Best effort: before migration 0020 these columns don't exist and the email has still gone out.
  const at = new Date().toISOString();
  await rest(`scans?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify({ emailed_to: em.value, emailed_at: at }), prefer: "return=minimal" }).catch(() => {});
  return Response.json({ sentTo: em.value, at });
}
