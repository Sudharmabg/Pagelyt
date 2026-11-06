import { MODULE_NAMES, type Finding, type ModuleKey } from "./types";

/* Pure scoring helpers, safe to import from client components. */
export const PENALTY = { high: 22, medium: 10, low: 4 } as const;

export function scoreModules(findings: Finding[]) {
  return (Object.keys(MODULE_NAMES) as ModuleKey[]).map((key) => {
    const penalty = findings.filter((f) => f.module === key).reduce((a, f) => a + PENALTY[f.severity], 0);
    return { key, name: MODULE_NAMES[key], score: Math.max(5, 100 - penalty) };
  });
}

export function overallScore(modules: { score: number }[]) {
  return Math.round(modules.reduce((a, m) => a + m.score, 0) / modules.length);
}

/** Stable per-scan identity for a finding (titles include counts, ids alone can repeat across modules). */
export const findingKey = (f: Finding) => `${f.module}:${f.id}:${f.title}`;
