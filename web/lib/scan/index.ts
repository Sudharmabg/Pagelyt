import { runChecks } from "./checks";
import { normaliseUrl, safeFetch } from "./fetcher";
import { MODULE_NAMES, type Finding, type ModuleKey, type ScanResult } from "./types";

const PENALTY = { high: 22, medium: 10, low: 4 } as const;

export class ScanError extends Error {}

async function tryText(u: URL): Promise<{ ok: boolean; body: string }> {
  try {
    const r = await safeFetch(u);
    const html = /^\s*<(!doctype|html)/i.test(r.body);
    return { ok: r.status === 200 && !html, body: r.body };
  } catch {
    return { ok: false, body: "" };
  }
}

export function scoreModules(findings: Finding[]) {
  return (Object.keys(MODULE_NAMES) as ModuleKey[]).map((key) => {
    const penalty = findings.filter((f) => f.module === key).reduce((a, f) => a + PENALTY[f.severity], 0);
    return { key, name: MODULE_NAMES[key], score: Math.max(5, 100 - penalty) };
  });
}

export async function scanUrl(raw: string): Promise<ScanResult> {
  const start = normaliseUrl(raw);
  if (!start) throw new ScanError("Enter a full public address such as https://example.com");

  let page;
  try {
    page = await safeFetch(start);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/Blocked/.test(msg)) throw new ScanError("That address is not publicly reachable.");
    throw new ScanError(`Could not reach ${start.hostname}${msg ? ` (${msg})` : ""}. Is the address correct?`);
  }
  const finalUrl = new URL(page.url);
  const origin = finalUrl.origin;

  const [robots, sitemap, llms, http] = await Promise.all([
    tryText(new URL("/robots.txt", origin)),
    tryText(new URL("/sitemap.xml", origin)),
    tryText(new URL("/llms.txt", origin)),
    finalUrl.protocol === "https:"
      ? safeFetch(new URL(`http://${finalUrl.host}/`)).then(
          (r) => r.chain.some((c) => c.url.startsWith("https://")),
          () => null
        )
      : Promise.resolve(null),
  ]);

  const findings = runChecks({
    page,
    finalUrl,
    robots: robots.ok ? robots.body : null,
    sitemapOk: sitemap.ok || (robots.ok && /^sitemap:/im.test(robots.body)),
    llmsTxt: llms.ok,
    httpRedirectsToHttps: http,
  });

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  const modules = scoreModules(findings);
  return {
    url: page.url,
    host: finalUrl.hostname.replace(/^www\./, ""),
    scannedAt: new Date().toISOString(),
    overall: Math.round(modules.reduce((a, m) => a + m.score, 0) / modules.length),
    modules,
    findings,
  };
}
