/* Pure analysis of an AI answer: was the brand named, was the site cited, and where did it rank
   against competitors? No imports, so it is trivially testable and runs anywhere. */

export type Analysis = {
  mentioned: boolean;
  cited: boolean;
  position: number | null; // 1 = named first among the brand and the competitors found
  competitorCounts: Record<string, number>;
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matcher = (term: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(term.trim())}(?![\\p{L}\\p{N}])`, "iu");

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** Names to look for: the host, the host without its TLD, and any extra terms (deduped, 2+ chars). */
export function brandTermsFor(host: string, terms: string[] = []): string[] {
  const h = bareHost(host);
  const label = h.split(".")[0];
  return [...new Set([h, label, ...terms].map((t) => t.trim()).filter((t) => t.length >= 2))];
}

function citedHost(url: string, host: string): boolean {
  try {
    const u = bareHost(new URL(url).hostname);
    const h = bareHost(host);
    return u === h || u.endsWith(`.${h}`);
  } catch {
    return false;
  }
}

export function analyse(o: { answer: string; citations: string[]; host: string; terms: string[]; competitors: string[] }): Analysis {
  const answer = o.answer || "";
  const brandTerms = brandTermsFor(o.host, o.terms);
  const firstIndex = (terms: string[]) => {
    let best = -1;
    for (const t of terms) {
      const m = matcher(t).exec(answer);
      if (m && (best === -1 || m.index < best)) best = m.index;
    }
    return best;
  };

  const brandAt = firstIndex(brandTerms);
  const cited = o.citations.some((c) => citedHost(c, o.host));
  const competitorCounts: Record<string, number> = {};
  const found: { name: string; at: number }[] = [];
  if (brandAt >= 0) found.push({ name: "__brand__", at: brandAt });

  for (const c of o.competitors.map((x) => x.trim()).filter(Boolean)) {
    const re = new RegExp(matcher(c).source, "giu");
    const n = (answer.match(re) ?? []).length;
    if (n > 0) {
      competitorCounts[c] = n;
      found.push({ name: c, at: firstIndex([c]) });
    }
  }
  found.sort((a, b) => a.at - b.at);
  const position = brandAt >= 0 ? found.findIndex((f) => f.name === "__brand__") + 1 : null;
  return { mentioned: brandAt >= 0, cited, position, competitorCounts };
}

/** Share of runs where the brand was mentioned, 0–100. */
export const visibilityScore = (runs: { mentioned: boolean; error?: string | null }[]) => {
  const ok = runs.filter((r) => !r.error);
  return ok.length ? Math.round((ok.filter((r) => r.mentioned).length / ok.length) * 100) : null;
};
