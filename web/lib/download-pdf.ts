/* Client helper: ask the server for a branded PDF and save it. When server PDFs are unavailable (free plan,
   Browser Rendering not configured, or an error), fall back to the browser's own print dialog (of `printUrl`
   when given). */

type Ready = { blob: Blob; name: string } | null;
const pending = new Map<string, Promise<Ready>>();

function fetchPdf(body: { scanId?: string; token?: string }, accessToken?: string): Promise<Ready> {
  const k = JSON.stringify(body);
  const have = pending.get(k);
  if (have) return have;
  const p = (async (): Promise<Ready> => {
    try {
      const r = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!r.ok || !r.headers.get("content-type")?.includes("application/pdf")) return null;
      return { blob: await r.blob(), name: r.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "website-report.pdf" };
    } catch {
      return null;
    }
  })();
  pending.set(k, p);
  // Kept for a few minutes so a click soon after uses it; a failure is forgotten at once so the click retries.
  void p.then((r) => window.setTimeout(() => pending.delete(k), r ? 5 * 60_000 : 0));
  return p;
}

/** Starts making the PDF in the background (when the Export menu opens), so the download is ready or nearly
    ready by the time it is clicked. */
export function preparePdf(body: { scanId?: string; token?: string }, accessToken?: string): void {
  void fetchPdf(body, accessToken);
}

export async function downloadPdf(body: { scanId?: string; token?: string }, accessToken?: string, printUrl?: string): Promise<void> {
  const ready = await fetchPdf(body, accessToken);
  if (ready) {
    const url = URL.createObjectURL(ready.blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: ready.name });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  // From the dashboard, print the full report page rather than whatever section is on screen.
  if (printUrl) {
    if (!window.open(printUrl, "_blank")) window.location.assign(printUrl);
    return;
  }
  window.print();
}

/** The full report, laid out for print, that opens the print window by itself. */
/** `g`: the owner's signed pass that adds their Google Analytics section (from /api/google/status). */
export const fullReportPrintUrl = (scanId: string, g?: string) => `/print/${encodeURIComponent(scanId)}?auto=1${g ? `&g=${encodeURIComponent(g)}` : ""}`;
