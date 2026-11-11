import { userFromRequest } from "@/lib/auth";
import { isDisposable } from "@/lib/disposable";
import { emailsOn, escapeHtml, headerName, sendEmail } from "@/lib/email";
import { digest, guard } from "@/lib/ratelimit";
import { overallScore } from "@/lib/scan/score";
import { getScanRow, live } from "@/lib/scan/store";
import { canWhiteLabel, createShare, getBrand, type Brand } from "@/lib/scan/store-ext";
import { checkEmail } from "@/lib/validate";

const NOTE_MAX = 500;

/* Create a client-facing link to a branded copy of a report, and optionally email it to one client address.
   Revoking is done from the browser (RLS lets owners update their own rows), see /account/brand. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!live()) return Response.json({ error: "Sharing needs Supabase to be configured." }, { status: 501 });
  if (!(await canWhiteLabel(user.id))) return Response.json({ error: "White-label reports are on the Business plan." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { scanId?: string; brandId?: string | null; showDetails?: boolean; includeAi?: boolean; expiresInDays?: number; email?: string; note?: string };
  const scan = await getScanRow(String(b.scanId || ""));
  if (!scan || scan.status !== "done" || !scan.result) return Response.json({ error: "Report not found." }, { status: 404 });
  if (scan.user_id !== user.id) return Response.json({ error: "Save this site to your account before sharing its report." }, { status: 403 });

  let brand: Brand | null = null;
  if (b.brandId) {
    brand = await getBrand(b.brandId, user.id);
    if (!brand) return Response.json({ error: "Brand not found." }, { status: 404 });
  }

  // The optional client email: checked (and counted) before the link is made, so a refusal changes nothing.
  let to: string | null = null;
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (typeof b.email === "string" && b.email.trim()) {
    if (!emailsOn()) return Response.json({ error: "Emailing reports isn't switched on yet. Copy the link instead." }, { status: 501 });
    const em = checkEmail(b.email);
    if (!em.ok) return Response.json({ error: em.error }, { status: 400 });
    if (isDisposable(em.value)) return Response.json({ error: "Please use the client's real email address." }, { status: 400 });
    if (note.length > NOTE_MAX) return Response.json({ error: `Keep the note under ${NOTE_MAX} characters.` }, { status: 400 });
    const limited = await guard([
      { key: `share-mail:u:${user.id}`, limit: 20, windowSec: 86_400 },
      { key: `share-mail:to:${user.id}:${await digest(em.value)}`, limit: 3, windowSec: 86_400 },
    ]);
    if (limited) return Response.json({ error: "You've reached today's email limit for reports (20 a day, 3 to the same address). Copy the link instead." }, { status: 429 });
    to = em.value;
  }

  const days = b.expiresInDays && b.expiresInDays > 0 ? Math.min(b.expiresInDays, 365) : undefined;
  const share = await createShare({ scanId: scan.id, userId: user.id, brandId: brand?.id ?? null, showDetails: b.showDetails !== false, includeAi: !!b.includeAi, expiresInDays: days });
  const path = `/r/${share.token}`;
  if (!to) return Response.json({ token: share.token, path });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const emailed = await sendEmail(reportEmail({ to, link: `${origin}${path}`, note, brand, host: scan.host, score: overallScore(scan.result.modules), sender: user.name, replyTo: brand?.contact_email || user.email || undefined }));
  return Response.json({ token: share.token, path, emailed, sentTo: emailed ? to : undefined });
}

function reportEmail(o: { to: string; link: string; note: string; brand: Brand | null; host: string; score: number; sender: string | null; replyTo?: string }) {
  const name = headerName(o.brand?.name || o.sender || "") || "Pagelyt";
  const from = `${name}${name === "Pagelyt" ? "" : " via Pagelyt"} <${process.env.REPORTS_FROM || "reports@pagelyt.dev"}>`;
  const color = o.brand && /^#[0-9a-fA-F]{6}$/.test(o.brand.color) ? o.brand.color : "#14202b";
  const subject = `Website report for ${o.host}`;
  const text = [
    `${name} has shared a website report for ${o.host} with you.`,
    `Overall score: ${o.score} / 100.`,
    ...(o.note ? ["", o.note] : []),
    "",
    `Open the report: ${o.link}`,
  ].join("\n");
  const logo = o.brand?.logo_url?.startsWith("https://")
    ? `<img src="${escapeHtml(o.brand.logo_url)}" alt="${escapeHtml(name)}" height="32" style="max-height:32px;width:auto;display:block">`
    : `<b style="color:${color};font-size:18px">${escapeHtml(name)}</b>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#14202b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="padding:16px 20px;border-bottom:4px solid ${color}">${logo}</td></tr>
<tr><td style="padding:22px 20px">
<p style="margin:0 0 4px;color:${color};font-size:11px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase">Website report</p>
<p style="margin:0 0 14px;font-size:22px;font-weight:bold">${escapeHtml(o.host)}</p>
<p style="margin:0 0 16px;font-size:15px">Overall score: <b>${o.score}</b> / 100</p>
${o.note ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.5;white-space:pre-line">${escapeHtml(o.note)}</p>` : ""}
<a href="${escapeHtml(o.link)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:999px">Open the report</a>
</td></tr></table>
<p style="margin:14px 0 0;font-size:12px;color:#55616d">Sent by ${escapeHtml(name)}${o.replyTo ? `. Reply to this email to reach them.` : "."}</p>
</td></tr></table></body></html>`;
  return { from, to: o.to, subject, text, html, replyTo: o.replyTo };
}
