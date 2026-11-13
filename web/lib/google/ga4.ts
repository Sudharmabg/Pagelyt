/* Server only. Reads Google Analytics 4: the properties an account can see (Admin API), which one belongs to a site
   (its web data stream's address), and five reports in one batch call (Data API) for the last 28 days and the 28
   before. Matching checks at most MAX_MATCH properties, so a refresh stays well inside a Worker's subrequest budget. */

import { gJson } from "./oauth";
import type { Ga4Channel, Ga4Data, Ga4Page, Ga4PageChannel, Ga4Totals } from "./ga4-insights";

const ADMIN = "https://analyticsadmin.googleapis.com/v1beta";
const DATA = "https://analyticsdata.googleapis.com/v1beta";
const MAX_MATCH = 25;

export type Ga4Property = { property: string; name: string; account: string };

export async function listGa4Properties(access: string): Promise<Ga4Property[]> {
  type Reply = { accountSummaries?: { displayName?: string; propertySummaries?: { property: string; displayName?: string }[] }[]; nextPageToken?: string };
  const out: Ga4Property[] = [];
  let page = "";
  for (let i = 0; i < 3; i++) {
    const d = await gJson<Reply>(access, `${ADMIN}/accountSummaries?pageSize=200${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`);
    for (const a of d.accountSummaries ?? []) for (const p of a.propertySummaries ?? []) out.push({ property: p.property, name: p.displayName || p.property, account: a.displayName || "" });
    if (!d.nextPageToken) break;
    page = d.nextPageToken;
  }
  return out;
}

const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** The property whose web data stream is this host (www or not). Falls back to a property named after the host. */
export async function matchGa4Property(access: string, host: string, props: Ga4Property[]): Promise<string | null> {
  const h = bare(host);
  const byName = props.find((p) => bare(p.name).includes(h));
  // Likely ones first, so the cap rarely cuts off the right property.
  const order = [...props].sort((a, b) => Number(bare(b.name).includes(h.split(".")[0])) - Number(bare(a.name).includes(h.split(".")[0]))).slice(0, MAX_MATCH);
  type Streams = { dataStreams?: { type?: string; webStreamData?: { defaultUri?: string } }[] };
  const hits = await Promise.all(
    order.map(async (p) => {
      try {
        const d = await gJson<Streams>(access, `${ADMIN}/${p.property}/dataStreams?pageSize=50`);
        return (d.dataStreams ?? []).some((s) => {
          try {
            return !!s.webStreamData?.defaultUri && bare(new URL(s.webStreamData.defaultUri).hostname) === h;
          } catch {
            return false;
          }
        });
      } catch {
        return false;
      }
    })
  );
  return order.find((_, i) => hits[i])?.property ?? byName?.property ?? null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const back = (d: Date, n: number) => new Date(d.getTime() - n * 86_400_000);

/** GA4 data is close to real time: the window ends yesterday. */
export function ga4Ranges(now = new Date()) {
  const end = back(now, 1);
  const start = back(end, 27);
  const pEnd = back(start, 1);
  return { range: { start: day(start), end: day(end) }, prevRange: { start: day(back(pEnd, 27)), end: day(pEnd) } };
}

type Report = { dimensionHeaders?: { name: string }[]; metricHeaders?: { name: string }[]; rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[] };
type Row = { dims: Record<string, string>; m: Record<string, number> };

function rowsOf(r: Report): Row[] {
  const dn = (r.dimensionHeaders ?? []).map((h) => h.name);
  const mn = (r.metricHeaders ?? []).map((h) => h.name);
  return (r.rows ?? []).map((row) => ({
    dims: Object.fromEntries(dn.map((n, i) => [n, row.dimensionValues?.[i]?.value ?? ""])),
    m: Object.fromEntries(mn.map((n, i) => [n, Number(row.metricValues?.[i]?.value ?? 0) || 0])),
  }));
}

const TOTAL_METRICS = ["sessions", "engagedSessions", "activeUsers", "newUsers", "screenPageViews", "averageSessionDuration", "keyEvents"];
const totalsOf = (r?: Row): Ga4Totals => ({
  sessions: r?.m.sessions ?? 0,
  engaged: r?.m.engagedSessions ?? 0,
  users: r?.m.activeUsers ?? 0,
  newUsers: r?.m.newUsers ?? 0,
  views: r?.m.screenPageViews ?? 0,
  avgDuration: r?.m.averageSessionDuration ?? 0,
  keyEvents: r?.m.keyEvents ?? 0,
});

/** Splits rows of a two-range report into this period and the one before, keyed by `key`. */
function split(rows: Row[], key: (r: Row) => string) {
  const now = new Map<string, Row>(), prev = new Map<string, Row>();
  for (const r of rows) (r.dims.dateRange === "prev" ? prev : now).set(key(r), r);
  return { now, prev };
}

export async function fetchGa4(access: string, property: string, name: string | null): Promise<Ga4Data> {
  const { range, prevRange } = ga4Ranges();
  const both = [{ startDate: range.start, endDate: range.end, name: "now" }, { startDate: prevRange.start, endDate: prevRange.end, name: "prev" }];
  const m = (...names: string[]) => names.map((n) => ({ name: n }));
  const d = (...names: string[]) => names.map((n) => ({ name: n }));
  const desc = { orderBys: [{ metric: { metricName: "sessions" }, desc: true }] };
  const reply = await gJson<{ reports?: Report[] }>(access, `${DATA}/${property}:batchRunReports`, {
    requests: [
      { dateRanges: both, metrics: m(...TOTAL_METRICS) },
      { dateRanges: [both[0]], dimensions: d("date"), metrics: m("sessions", "activeUsers"), limit: 100 },
      { dateRanges: both, dimensions: d("pagePath"), metrics: m("sessions", "engagedSessions", "screenPageViews"), limit: 1000, ...desc },
      { dateRanges: both, dimensions: d("sessionDefaultChannelGroup"), metrics: m("sessions", "engagedSessions"), limit: 50 },
      { dateRanges: both, dimensions: d("pagePath", "sessionDefaultChannelGroup"), metrics: m("sessions"), limit: 2000, ...desc },
    ],
  });
  const [tot, daily, pages, chans, pageChans] = (reply.reports ?? []).map(rowsOf);

  // With two date ranges and no other dimension, each row carries only the range name.
  const t = split(tot ?? [], () => "all");

  const pg = split(pages ?? [], (r) => r.dims.pagePath);
  const pageRows: Ga4Page[] = [...new Set([...pg.now.keys(), ...pg.prev.keys()])].map((path) => {
    const a = pg.now.get(path), b = pg.prev.get(path);
    return { path, sessions: a?.m.sessions ?? 0, engaged: a?.m.engagedSessions ?? 0, views: a?.m.screenPageViews ?? 0, prevSessions: b?.m.sessions ?? 0, prevEngaged: b?.m.engagedSessions ?? 0 };
  });

  const c = split(chans ?? [], (r) => r.dims.sessionDefaultChannelGroup);
  const channels: Ga4Channel[] = [...new Set([...c.now.keys(), ...c.prev.keys()])].map((channel) => ({ channel, sessions: c.now.get(channel)?.m.sessions ?? 0, engaged: c.now.get(channel)?.m.engagedSessions ?? 0, prevSessions: c.prev.get(channel)?.m.sessions ?? 0 }));

  const pc = split(pageChans ?? [], (r) => `${r.dims.pagePath}\n${r.dims.sessionDefaultChannelGroup}`);
  const pageChannels: Ga4PageChannel[] = [...new Set([...pc.now.keys(), ...pc.prev.keys()])].map((k) => {
    const [path, channel] = k.split("\n");
    return { path, channel, sessions: pc.now.get(k)?.m.sessions ?? 0, prevSessions: pc.prev.get(k)?.m.sessions ?? 0 };
  });

  return {
    property,
    name,
    range,
    prevRange,
    totals: totalsOf(t.now.get("all")),
    prev: totalsOf(t.prev.get("all")),
    daily: (daily ?? []).map((r) => ({ date: `${r.dims.date.slice(0, 4)}-${r.dims.date.slice(4, 6)}-${r.dims.date.slice(6, 8)}`, sessions: r.m.sessions, users: r.m.activeUsers })).sort((a, b) => a.date.localeCompare(b.date)),
    pages: pageRows.sort((a, b) => b.sessions + b.prevSessions - (a.sessions + a.prevSessions)).slice(0, 500),
    channels,
    // Only what the drop detective needs: pages that had real traffic before.
    pageChannels: pageChannels.filter((r) => r.prevSessions >= 5 || r.sessions >= 5).slice(0, 1500),
  };
}
