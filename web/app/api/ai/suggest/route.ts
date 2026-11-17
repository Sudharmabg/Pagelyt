import { userFromRequest } from "@/lib/auth";
import { askJson } from "@/lib/google/ga4-ai";
import { configuredProviders } from "@/lib/ai/providers";
import { live, rateLimit } from "@/lib/scan/store";
import { canTrackAi, getSiteAi, listPrompts } from "@/lib/scan/store-ext";

/* Suggest questions for AI visibility: ChatGPT writes the questions a customer would type, from what the
   site offers and where. Nothing is saved here; the owner picks which ones to add. */

const RULES = `You write questions that real customers type into ChatGPT when looking for a business like the one described.
Write 8 short, natural questions (at most 120 characters each), in the language of the description.
Mix: discovery ("best X in Y"), comparison and recommendation ("which X would you recommend"), buying advice ("what to look for in X"), and 2 questions that name the brand directly (reputation, alternatives).
Use the place when one is given. No numbering, no quotes, no duplicates of the existing questions.`;

const SCHEMA = { type: "object", additionalProperties: false, required: ["questions"], properties: { questions: { type: "array", items: { type: "string" } } } };

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!live()) return Response.json({ error: "AI visibility needs Supabase to be configured." }, { status: 501 });
  if (!configuredProviders().length) return Response.json({ error: "ChatGPT isn’t connected." }, { status: 501 });
  if (!(await canTrackAi(user.id))) return Response.json({ error: "AI visibility tracking is on the Professional and Business plans." }, { status: 403 });
  if (!(await rateLimit(`ai-suggest:${user.id}`, 20, 3600))) return Response.json({ error: "Hourly limit for suggestions reached. Try again later." }, { status: 429 });

  const { siteId, offer } = (await req.json().catch(() => ({}))) as { siteId?: string; offer?: string };
  const what = (offer ?? "").trim().slice(0, 200);
  if (what.length < 3) return Response.json({ error: "Tell us what you offer first." }, { status: 400 });
  const site = siteId ? await getSiteAi(siteId, user.id) : null;
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });

  const have = await listPrompts(site.id);
  const brand = site.brand_terms[0] || site.host;
  const input = `VISIBILITY QUESTIONS\nBrand: ${brand}\nWebsite: ${site.host}\nWhat they offer, and where: ${what}\nExisting questions:\n${have.map((p) => `- ${p.prompt}`).join("\n") || "(none)"}`;
  try {
    const { json } = await askJson(RULES, input, "visibility_questions", SCHEMA);
    const seen = new Set(have.map((p) => p.prompt.trim().toLowerCase()));
    const list = ((json as { questions?: unknown }).questions ?? []) as unknown[];
    const questions = list
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim().replace(/^["'\d.\-\s]+/, "").replace(/["']$/, "").slice(0, 300))
      .filter((q) => q.length >= 5 && !seen.has(q.toLowerCase()) && seen.add(q.toLowerCase()))
      .slice(0, 10);
    return Response.json({ questions });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not suggest questions." }, { status: 502 });
  }
}
