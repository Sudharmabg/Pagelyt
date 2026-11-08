/* Client helper: ask the server for a branded PDF and save it. When server PDFs are unavailable (free plan,
   Browser Rendering not configured, or an error), fall back to the browser's own print dialog. */
export async function downloadPdf(body: { scanId?: string; token?: string }, accessToken?: string): Promise<void> {
  try {
    const r = await fetch("/api/report/pdf", {
      method: "POST",
      headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(body),
    });
    if (r.ok && r.headers.get("content-type")?.includes("application/pdf")) {
      const blob = await r.blob();
      const name = r.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "website-report.pdf";
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return;
    }
  } catch {
    /* fall through to print */
  }
  window.print();
}
