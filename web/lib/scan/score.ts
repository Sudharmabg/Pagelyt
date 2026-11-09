import { MODULE_NAMES, type Finding, type ModuleKey } from "./types";
import { AREA_DONE_AT } from "./labels";

/* Pure scoring helpers, safe to import from client components. */
export const PENALTY = { high: 22, medium: 10, low: 4 } as const;

export function scoreModules(findings: Finding[]) {
  return (Object.keys(MODULE_NAMES) as ModuleKey[]).map((key) => {
    const penalty = findings.filter((f) => f.module === key).reduce((a, f) => a + PENALTY[f.severity], 0);
    return { key, name: MODULE_NAMES[key], score: Math.max(5, 100 - penalty) };
  });
}

/* Areas that can take a site offline or put visitors at risk count for more in the overall score. */
export const WEIGHTS: Record<ModuleKey, number> = { security: 1.5, health: 1.5, performance: 1.2, seo: 1, accessibility: 1, domain: 1, geo: 0.8, privacy: 0.8 };

/** Weighted average of the area scores (areas without a key, e.g. from old callers, weigh 1). */
export function overallScore(modules: { key?: ModuleKey; score: number }[]) {
  if (!modules.length) return 0;
  let sum = 0;
  let w = 0;
  for (const m of modules) {
    const k = m.key ? (WEIGHTS[m.key] ?? 1) : 1;
    sum += m.score * k;
    w += k;
  }
  return Math.round(sum / w);
}

/** Stable per-scan identity for a finding (titles include counts, ids alone can repeat across modules). */
export const findingKey = (f: Finding) => `${f.module}:${f.id}:${f.title}`;

/** Areas whose score is already final after `stagesDone` stages of a running scan, scored from the findings so far. */
export function finishedAreas(findings: Finding[], stagesDone: number) {
  return scoreModules(findings).filter((m) => AREA_DONE_AT[m.key] <= stagesDone);
}
