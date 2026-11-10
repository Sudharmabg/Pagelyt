/* robots.txt parsing and matching, following RFC 9309 (the standard Google, Bing and the AI crawlers use).
   Pure functions, safe on the server and in the browser. */

export type RobotsRule = { allow: boolean; path: string; line: number };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };
export type RobotsParse = { groups: RobotsGroup[]; sitemaps: string[]; problems: { line: number; text: string }[] };
export type RobotsVerdict = {
  allowed: boolean;
  /** The rule that decided it; null when no rule matched (allowed by default). */
  rule: RobotsRule | null;
  /** Which group answered: the bot's own name, or "*" when it has none. null when no group applies. */
  group: string | null;
};

const KNOWN = new Set(["user-agent", "allow", "disallow", "sitemap", "crawl-delay", "host", "clean-param", "request-rate", "visit-time", "noindex"]);
/** Google reads the first 500 KiB; anything after is ignored. */
const MAX_CHARS = 500 * 1024;

export function parseRobots(text: string): RobotsParse {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const problems: RobotsParse["problems"] = [];
  let cur: RobotsGroup | null = null;
  let lastWasAgent = false;
  text.slice(0, MAX_CHARS).split(/\r\n|\r|\n/).forEach((raw, i) => {
    const line = i + 1;
    const clean = raw.replace(/#.*/, "").trim();
    if (!clean) return;
    const m = clean.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) {
      problems.push({ line, text: `Not a valid rule: "${clean.slice(0, 60)}"` });
      return;
    }
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      return;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      return;
    }
    if (key === "allow" || key === "disallow") {
      if (!cur) {
        problems.push({ line, text: `"${m[1]}" comes before any User-agent line, so crawlers ignore it` });
        return;
      }
      // An empty Disallow means "nothing is disallowed": it adds no rule.
      if (value) cur.rules.push({ allow: key === "allow", path: value, line });
      return;
    }
    if (!KNOWN.has(key)) problems.push({ line, text: `Unknown directive "${m[1]}" is ignored by crawlers` });
  });
  return { groups, sitemaps, problems };
}

/** Wildcard match without regular expressions (no catastrophic backtracking on hostile patterns).
    `*` matches any run of characters; a trailing `$` anchors the end; otherwise it is a prefix match. */
export function pathMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const p = anchored ? pattern.slice(0, -1) : pattern;
  let i = 0;
  let j = 0;
  let star = -1;
  let mark = 0;
  while (j < path.length) {
    if (!anchored && i === p.length) return true;
    if (i < p.length && p[i] === "*") {
      star = i++;
      mark = j;
    } else if (i < p.length && p[i] === path[j]) {
      i++;
      j++;
    } else if (star >= 0) {
      i = star + 1;
      j = ++mark;
    } else return false;
  }
  while (i < p.length && p[i] === "*") i++;
  return i === p.length;
}

/** The path and query crawlers compare against rules. Accepts a full URL or a bare path. */
export function robotsPath(input: string): string {
  const s = input.trim();
  try {
    const u = /^https?:\/\//i.test(s) ? new URL(s) : new URL(s.startsWith("/") ? s : `/${s}`, "https://x.invalid");
    return u.pathname + u.search;
  } catch {
    return s.startsWith("/") ? s : `/${s}`;
  }
}

/** Is `path` allowed for the crawler whose product token is `agent` (e.g. "Googlebot", "GPTBot")?
    Groups naming the bot win over `*`; several groups for the same bot are merged. Among matching rules the
    longest pattern wins, and Allow wins a tie. /robots.txt itself is always allowed. */
export function robotsVerdict(parsed: RobotsParse, agent: string, path: string): RobotsVerdict {
  const a = agent.trim().toLowerCase();
  let picked = parsed.groups.filter((g) => g.agents.includes(a));
  let group: string | null = picked.length ? agent : null;
  if (!picked.length) {
    picked = parsed.groups.filter((g) => g.agents.includes("*"));
    group = picked.length ? "*" : null;
  }
  if (path === "/robots.txt") return { allowed: true, rule: null, group };
  let best: RobotsRule | null = null;
  for (const g of picked) {
    for (const r of g.rules) {
      if (!pathMatches(r.path, path)) continue;
      const len = r.path.length;
      if (!best || len > best.path.length || (len === best.path.length && r.allow && !best.allow)) best = r;
    }
  }
  return { allowed: best ? best.allow : true, rule: best, group };
}
