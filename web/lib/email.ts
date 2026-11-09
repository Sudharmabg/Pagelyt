/* Outgoing email through Resend, behind one switch shared by score alerts and client report emails.
   Mail goes out only when EMAILS_ON=1 and RESEND_API_KEY are both set (turn it on once the Resend domain
   is verified). RESEND_API_URL points the calls elsewhere; the local mock mode uses it so nothing is sent. */

export function emailsOn(): boolean {
  return process.env.EMAILS_ON === "1" && !!process.env.RESEND_API_KEY;
}

export type Mail = { from: string; to: string; subject: string; text: string; html?: string; replyTo?: string };

/** Sends one email. True when Resend accepted it; false when emails are off or the send failed. */
export async function sendEmail(m: Mail): Promise<boolean> {
  if (!emailsOn()) return false;
  const base = process.env.RESEND_API_URL || "https://api.resend.com";
  try {
    const r = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: m.from, to: m.to, subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}), ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
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
