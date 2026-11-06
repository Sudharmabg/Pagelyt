import { ScanError, advanceScan } from "@/lib/scan";

/* Runs the next stage of a scan. Each call spends a fresh request budget, which is what lets a
   full scan fit inside the Workers limits. Calling it after the scan finishes is harmless. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return Response.json(await advanceScan(id));
  } catch (e) {
    if (e instanceof ScanError) return Response.json({ error: e.message }, { status: e.message === "Report not found." ? 404 : 422 });
    return Response.json({ error: "The scan failed unexpectedly. Please try again." }, { status: 500 });
  }
}
