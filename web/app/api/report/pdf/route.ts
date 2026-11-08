import { userFromRequest } from "@/lib/auth";
import { NoBrowser, renderPdf } from "@/lib/pdf";
import { isPaid } from "@/lib/scan/agency";
import { getShare } from "@/lib/scan/store-ext";
import { getScanRow, live, rateLimit } from "@/lib/scan/store";

/* Server-rendered branded PDF of a report (paid plans).
   - { scanId }: the signed-in owner downloads their own report.
   - { token }: anyone holding a live shared-report link, when the account that shared it is on a paid plan.
   Answers 501 { fallback: true } when Browser Rendering is not available, so the page can print instead. */
export async function POST(req: Request) {
  let body: { scanId?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  let path: string;
  let ownerId: string | null;
  let host: string;
  if (typeof body.token === "string") {
    const share = live() ? await getShare(body.token).catch(() => null) : null;
    if (!share) return Response.json({ error: "This link has expired or was withdrawn." }, { status: 404 });
    const scan = await getScanRow(share.scan_id);
    if (!scan?.result) return Response.json({ error: "Report not found." }, { status: 404 });
    path = `/r/${encodeURIComponent(body.token)}`;
    ownerId = share.user_id;
    host = scan.host;
  } else {
    const user = await userFromRequest(req);
    if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
    const scan = await getScanRow(String(body.scanId || ""));
    if (!scan || scan.status !== "done") return Response.json({ error: "Report not found." }, { status: 404 });
    if (scan.user_id !== user.id) return Response.json({ error: "Only the report's owner can download it." }, { status: 403 });
    path = `/print/${encodeURIComponent(scan.id)}`;
    ownerId = user.id;
    host = scan.host;
  }

  if (!ownerId || !(await isPaid(ownerId).catch(() => false))) return Response.json({ error: "Branded PDF reports come with any paid plan.", upgrade: true, fallback: true }, { status: 403 });
  // Each PDF spends browser time on the paid Workers plan, so keep it to a sensible rate per account.
  if (!(await rateLimit(`pdf:${ownerId}`, 30, 3600))) return Response.json({ error: "Too many PDFs in the last hour. Please try again later." }, { status: 429 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  try {
    const pdf = await renderPdf(new URL(path, origin).href);
    return new Response(pdf as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${host.replace(/[^a-z0-9.-]/gi, "")}-website-report.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof NoBrowser) return Response.json({ error: "Server PDFs are not switched on.", fallback: true }, { status: 501 });
    return Response.json({ error: "Could not create the PDF. Please try again.", fallback: true }, { status: 502 });
  }
}
