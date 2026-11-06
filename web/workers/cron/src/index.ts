/* Cron Worker: runs every minute.
   1. Scheduled rescans: asks the web app which saved sites are due, starts each scan, then calls
      the step endpoint once per stage (every call gets its own subrequest budget in the web app).
   2. Uptime checks (every 5th minute): pings monitored sites, stores the result, and emails the
      owner when a site goes down or recovers (Resend, optional).
   3. AI visibility (a few minutes past each hour): runs the weekly prompt checks for due sites.
   Budget per run is kept well under the free plan's 50 subrequests. */

type Env = {
  APP_URL: string;
  CRON_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY?: string;
  ALERT_FROM?: string;
};

type SiteLite = { id: string; host: string; url: string; user_id: string };
type Check = { site_id: string; ok: boolean };

const MAX_RESCANS = 4; // 4 sites x 6 requests = 24 subrequests
const MAX_PINGS = 15;

async function rescans(env: Env) {
  const auth = { authorization: `Bearer ${env.CRON_SECRET}`, "content-type": "application/json" };
  const due = (await (await fetch(`${env.APP_URL}/api/internal/due`, { headers: auth })).json()) as { sites?: { id: string }[] };
  for (const s of (due.sites ?? []).slice(0, MAX_RESCANS)) {
    const start = (await (await fetch(`${env.APP_URL}/api/internal/start`, { method: "POST", headers: auth, body: JSON.stringify({ siteId: s.id }) })).json()) as { id?: string; total?: number };
    if (!start.id) continue;
    for (let i = 0; i < (start.total ?? 5) + 1; i++) {
      const r = await fetch(`${env.APP_URL}/api/scan/${start.id}/step`, { method: "POST" });
      const p = (await r.json()) as { done?: boolean };
      if (!r.ok || p.done) break;
    }
  }
}

async function aiVisibility(env: Env) {
  const auth = { authorization: `Bearer ${env.CRON_SECRET}`, "content-type": "application/json" };
  const due = (await (await fetch(`${env.APP_URL}/api/internal/ai-due`, { headers: auth })).json()) as { sites?: { id: string }[] };
  for (const s of due.sites ?? []) {
    await fetch(`${env.APP_URL}/api/internal/ai-run`, { method: "POST", headers: auth, body: JSON.stringify({ siteId: s.id }) });
  }
}

const sb = (env: Env, path: string, init: RequestInit = {}) =>
  fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) },
  });

async function email(env: Env, userId: string, subject: string, text: string) {
  if (!env.RESEND_API_KEY) return;
  const u = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
  const to = ((await u.json()) as { email?: string }).email;
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.ALERT_FROM ?? "Pagelyt <alerts@pagelyt.com>", to, subject, text }),
  });
}

async function uptime(env: Env) {
  const sites = (await (await sb(env, `sites?uptime=eq.true&select=id,host,url,user_id&limit=${MAX_PINGS}`)).json()) as SiteLite[];
  if (!sites.length) return;
  const results = await Promise.all(
    sites.map(async (s) => {
      const t0 = Date.now();
      try {
        const r = await fetch(s.url, { method: "GET", redirect: "follow", headers: { "user-agent": "PagelytUptime/0.1" }, signal: AbortSignal.timeout(10_000) });
        return { site: s, ok: r.status < 500, status: r.status, ms: Date.now() - t0 };
      } catch {
        return { site: s, ok: false, status: 0, ms: Date.now() - t0 };
      }
    })
  );
  const ids = sites.map((s) => s.id).join(",");
  const prevRows = (await (await sb(env, `uptime_checks?site_id=in.(${ids})&select=site_id,ok&order=at.desc&limit=${sites.length * 2}`)).json()) as Check[];
  const prev = new Map<string, boolean>();
  for (const c of prevRows) if (!prev.has(c.site_id)) prev.set(c.site_id, c.ok); // newest first
  await sb(env, "uptime_checks", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(results.map((r) => ({ site_id: r.site.id, ok: r.ok, status: r.status, ms: r.ms }))) });
  for (const r of results) {
    const before = prev.get(r.site.id);
    if (before === undefined || before === r.ok) continue; // no change, or first ever check
    await email(
      env,
      r.site.user_id,
      r.ok ? `${r.site.host} is back up` : `${r.site.host} appears to be down`,
      r.ok ? `${r.site.host} is responding again (HTTP ${r.status}).` : `We could not load ${r.site.url} (${r.status ? `HTTP ${r.status}` : "no response"}). We will email you when it recovers.`
    );
  }
}

const worker = {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const jobs = [rescans(env)];
    const minute = new Date().getUTCMinutes();
    if (minute % 5 === 0) jobs.push(uptime(env));
    if (minute === 7 || minute === 37) jobs.push(aiVisibility(env));
    ctx.waitUntil(Promise.allSettled(jobs));
  },
  async fetch() {
    return new Response("Pagelyt cron worker", { status: 200 });
  },
};

export default worker;
