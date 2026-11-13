import { analyse } from "./analyse";
import { askChatGpt, configuredProviders } from "./providers";
import { insertRuns, type Prompt, type SiteAi } from "@/lib/scan/store-ext";

/* Ask ChatGPT every prompt, analyse the answers and store one row per prompt. Each model call
   is one subrequest, so callers keep prompts per call small. */

export const MAX_PROMPTS_PER_CALL = 8;

export async function runPrompts(site: SiteAi, prompts: Prompt[]) {
  const providers = configuredProviders();
  if (!providers.length) throw new Error("ChatGPT is not connected. Set OPENAI_API_KEY.");
  const jobs = prompts.slice(0, MAX_PROMPTS_PER_CALL).flatMap((p) => providers.map((pr) => ({ p, pr })));

  const rows = await Promise.all(
    jobs.map(async ({ p, pr }) => {
      const base = { site_id: site.id, prompt_id: p.id, provider: pr.id };
      try {
        const raw = await askChatGpt(p.prompt);
        const a = analyse({ answer: raw.answer, citations: raw.citations, host: site.host, terms: site.brand_terms, competitors: site.competitors });
        return { ...base, mentioned: a.mentioned, cited: a.cited, position: a.position, competitor_counts: a.competitorCounts, answer: raw.answer.slice(0, 4000), citations: raw.citations.slice(0, 12), error: null };
      } catch (e) {
        // A failed call is recorded as an error, never as "not mentioned".
        return { ...base, mentioned: false, cited: false, position: null, competitor_counts: {}, answer: null, citations: [], error: (e instanceof Error ? e.message : "Failed").slice(0, 200) };
      }
    })
  );
  await insertRuns(rows);
  return { runs: rows.length, errors: rows.filter((r) => r.error).length, providers: providers.map((p) => p.label) };
}
