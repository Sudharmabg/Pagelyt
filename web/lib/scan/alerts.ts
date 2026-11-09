import { emailsOn, sendEmail } from "../email";
import { previousSnap, toSnap } from "./history";
import { live, rest, type ScanRow } from "./store";
import type { ScanResult } from "./types";
import { isBigChange } from "./visual";

/* Email the site owner after a scheduled rescan when the score dropped or a new high-severity
   issue appeared. Needs emails switched on (lib/email.ts); otherwise this does nothing. Alerts are sent only for
   saved sites with a schedule and alerts switched on, never for one-off scans. */

const DROP_POINTS = 5;

type SiteRow = { id: string; cadence: string; alerts: boolean; user_id: string };

async function ownerEmail(userId: string): Promise<string | null> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: { apikey: key!, authorization: `Bearer ${key}` } });
  return r.ok ? (((await r.json()) as { email?: string }).email ?? null) : null;
}

export async function alertAfterScan(row: ScanRow, result: ScanResult): Promise<void> {
  // Off until EMAILS_ON=1 and RESEND_API_KEY are set (see lib/email.ts).
  if (!emailsOn() || !live() || !row.site_id) return;
  const sites = await rest<SiteRow[]>(`sites?id=eq.${encodeURIComponent(row.site_id)}&select=id,cadence,alerts,user_id&limit=1`);
  const site = sites[0];
  if (!site || site.cadence === "none" || !site.alerts) return;

  const prev = await previousSnap(row);
  if (!prev) return; // first scan: nothing to compare with
  const now = toSnap(row.id, result);
  const drop = prev.overall - now.overall;
  const known = new Set(prev.keys);
  const newHigh = result.findings.filter((f) => f.severity === "high" && !known.has(`${f.module}:${f.id}:${f.title}`));
  const changed = isBigChange(result.change) ? result.change! : null;
  if (drop < DROP_POINTS && !newHigh.length && !changed) return;

  const to = await ownerEmail(site.user_id);
  if (!to) return;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://pagelyt.com";
  const lines = [
    drop > 0 ? `Your score for ${result.host} went from ${prev.overall} to ${now.overall} (${-drop}).` : `Your score for ${result.host} is ${now.overall}.`,
    ...(newHigh.length ? ["", `New high-priority issue${newHigh.length > 1 ? "s" : ""}:`, ...newHigh.slice(0, 5).map((f) => `• ${f.title}`)] : []),
    ...(changed
      ? [
          "",
          "Your homepage changed since the last scan:",
          ...(changed.visual != null ? [`• About ${changed.visual}% of the page looks different`] : []),
          ...(changed.text != null ? [`• About ${changed.text}% of the text changed`] : []),
          ...(changed.title ? [`• Title changed from “${changed.title.from}” to “${changed.title.to}”`] : []),
          "If you did not make this change, check the site now: it may have been hacked.",
        ]
      : []),
    "",
    `See the full report: ${origin}/dashboard/${row.id}`,
    "",
    "You get these emails because scheduled scans and alerts are on for this site. Change this under Account on Pagelyt.",
  ];
  const subject = newHigh.length ? `${result.host}: new high-priority issue found` : drop >= DROP_POINTS ? `${result.host}: score dropped ${drop} points` : `${result.host}: your homepage changed`;
  await sendEmail({ from: process.env.ALERT_FROM ?? "Pagelyt <alerts@pagelyt.com>", to, subject, text: lines.join("\n") });
}
