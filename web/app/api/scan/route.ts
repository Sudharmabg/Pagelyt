import { ScanError, scanUrl } from "@/lib/scan";

/* Simple in-memory limiter + cache. Replaced by Postgres/Redis in the foundations phase. */
const hits = new Map<string, number[]>();
const cache = new Map<string, { at: number; data: unknown }>();
const PER_HOUR = 10;
const CACHE_MS = 10 * 60_000;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR) {
    return Response.json({ error: "Free scan limit reached. Please try again in an hour." }, { status: 429 });
  }

  let url = "";
  try {
    url = String((await req.json()).url || "").slice(0, 2048);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const key = url.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && now - cached.at < CACHE_MS) return Response.json(cached.data);

  hits.set(ip, [...recent, now]);
  try {
    const data = await scanUrl(url);
    cache.set(key, { at: now, data });
    return Response.json(data);
  } catch (e) {
    if (e instanceof ScanError) return Response.json({ error: e.message }, { status: 422 });
    return Response.json({ error: "The scan failed unexpectedly. Please try again." }, { status: 500 });
  }
}
