"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AiBotReport } from "@/lib/tools/ai-bots";
import type { DomainAge } from "@/lib/tools/domain-age";
import type { HreflangReport } from "@/lib/tools/hreflang";
import { parseRobots, robotsPath, robotsVerdict } from "@/lib/tools/robots";
import { Field, Output, type Ctx } from "./tools";

/* The free checkers. The ones that fetch another site call /api/tools with the visitor's session. */

type Problem = { error: string; signedOut?: boolean };

async function callTool<T>(payload: Record<string, unknown>): Promise<T | Problem> {
  try {
    const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
    const r = await fetch("/api/tools", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
    const j = (await r.json().catch(() => ({}))) as T & { error?: string; code?: string };
    if (!r.ok) return { error: j.error || "Something went wrong. Please try again.", signedOut: j.code === "signed_out" };
    return j;
  } catch {
    return { error: "Couldn't reach Pagelyt. Check your connection and try again." };
  }
}
const isProblem = (x: unknown): x is Problem => !!x && typeof x === "object" && "error" in x && typeof (x as Problem).error === "string";

function ErrorNote({ p }: { p: Problem | null }) {
  if (!p) return null;
  return (
    <p className="terr" role="alert">
      {p.error}
      {p.signedOut && <> <Link href={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in again</Link></>}
    </p>
  );
}

function Chip({ tone, children }: { tone: "ok" | "bad" | "warn" | "na"; children: React.ReactNode }) {
  return <span className={`tchip ${tone}`}>{children}</span>;
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–");

/* ---------------- AI bot access ---------------- */
const KIND = { training: "Training", search: "AI search", user: "User request" } as const;

export function AiBotChecker({ ctx }: { ctx: Ctx }) {
  const [url, setUrl] = useState(ctx?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Problem | null>(null);
  const [rep, setRep] = useState<AiBotReport | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await callTool<{ report: AiBotReport }>({ tool: "ai-bots", url });
    if (isProblem(r)) setErr(r);
    else setRep(r.report);
    setBusy(false);
  };
  const canRead = rep ? rep.bots.filter((b) => b.robots === "allowed" && b.server !== "blocked").length : 0;
  return (
    <div className="tcheck">
      <form className="tform trow" onSubmit={run}>
        <Field label="Page to check">{(id) => <input id={id} type="text" inputMode="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} required />}</Field>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Checking 14 bots…" : "Check AI access"}</button>
      </form>
      <ErrorNote p={err} />
      {rep && (
        <section className="tres" aria-label="AI bot access results" aria-live="polite">
          <p className="tres-sum">
            <b>{canRead} of {rep.bots.length}</b> AI bots can read <span className="tres-url">{rep.url}</span>
          </p>
          <ul className="tfacts">
            <li><Chip tone={rep.robots === "found" ? "ok" : "na"}>{rep.robots === "found" ? "Found" : rep.robots === "missing" ? "None" : "Unreachable"}</Chip> robots.txt</li>
            <li><Chip tone={rep.llms ? "ok" : "na"}>{rep.llms ? "Found" : "None"}</Chip> llms.txt {!rep.llms && <Link href="/tools/llms-txt-generator">Create one</Link>}</li>
            {rep.baselineBlocked && <li><Chip tone="warn">{rep.status}</Chip> The site refused our normal browser test too, so we can&rsquo;t tell how its firewall treats AI bots. The robots.txt column still applies.</li>}
            {rep.noai && <li><Chip tone="warn">noai</Chip> The page asks AI tools not to use it (meta robots or X-Robots-Tag)</li>}
          </ul>
          <div className="crawl-wrap">
            <table className="crawl tbots">
              <thead>
                <tr><th>Bot</th><th>Used for</th><th>robots.txt</th><th>Server</th></tr>
              </thead>
              <tbody>
                {rep.bots.map((b) => (
                  <tr key={b.token}>
                    <td><b>{b.token}</b><small>{b.owner} · {b.purpose}</small></td>
                    <td>{KIND[b.kind]}</td>
                    <td>
                      <Chip tone={b.robots === "allowed" ? "ok" : "bad"}>{b.robots === "allowed" ? "Allowed" : "Blocked"}</Chip>
                      {b.rule && <small>{b.rule}</small>}
                    </td>
                    <td>
                      {b.server === "skipped" ? <Chip tone="na">n/a</Chip> : b.server === "unknown" ? <Chip tone="na">Can&rsquo;t tell</Chip> : b.server === "ok" ? <Chip tone="ok">Let in{b.status ? ` (${b.status})` : ""}</Chip> : b.server === "blocked" ? <Chip tone="bad">Turned away ({b.status})</Chip> : <Chip tone="warn">No answer</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tnote">
            &ldquo;Turned away&rdquo; means your server or CDN refused a request carrying that bot&rsquo;s name while it served a normal browser. Our test doesn&rsquo;t come from the bot&rsquo;s own network, so a firewall that checks real bot addresses may treat the genuine crawler differently. To change robots.txt rules, use the <Link href="/tools/robots-txt-generator">robots.txt generator</Link>.
          </p>
        </section>
      )}
    </div>
  );
}

/* ---------------- robots.txt tester ---------------- */
const AGENTS = ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "*"];
const SAMPLE = "User-agent: *\nDisallow: /admin\nDisallow: /cart\nAllow: /admin/help\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: https://example.com/sitemap.xml\n";

export function RobotsTester({ ctx }: { ctx: Ctx }) {
  const [site, setSite] = useState(ctx?.origin ?? "");
  const [text, setText] = useState(ctx ? "" : SAMPLE);
  const [agent, setAgent] = useState("Googlebot");
  const [custom, setCustom] = useState("");
  const [paths, setPaths] = useState("/\n/admin/settings\n/admin/help\n/blog/my-first-post");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Problem | null>(null);
  const [note, setNote] = useState("");

  const load = async () => {
    setBusy(true);
    setErr(null);
    setNote("");
    const r = await callTool<{ origin: string; status: number; text: string; html: boolean }>({ tool: "robots", url: site });
    if (isProblem(r)) setErr(r);
    else {
      setText(r.text);
      setNote(r.text ? `Loaded ${r.origin}/robots.txt. Edit it below to try changes; your live file isn't touched.` : r.html ? `${r.origin}/robots.txt returns a web page, not a robots file, so crawlers treat everything as allowed.` : `${r.origin}/robots.txt returned ${r.status}, so crawlers treat everything as allowed.`);
    }
    setBusy(false);
  };

  const ua = agent === "custom" ? custom.trim() || "*" : agent;
  const parsed = useMemo(() => parseRobots(text), [text]);
  const rows = paths.split("\n").map((p) => p.trim()).filter(Boolean).slice(0, 50).map((p) => ({ input: p, path: robotsPath(p), v: robotsVerdict(parsed, ua, robotsPath(p)) }));

  return (
    <div className="tgrid">
      <div className="tform">
        <Field label="Website" hint="We fetch its live robots.txt into the editor.">
          {(id) => (
            <div className="tinline">
              <input id={id} type="text" inputMode="url" placeholder="https://example.com" value={site} onChange={(e) => setSite(e.target.value)} />
              <button className="btn" type="button" onClick={load} disabled={busy || !site.trim()}>{busy ? "Loading…" : "Load"}</button>
            </div>
          )}
        </Field>
        <ErrorNote p={err} />
        {note && <p className="tnote" role="status">{note}</p>}
        <Field label="robots.txt" hint="Or paste one here. Results update as you type.">{(id) => <textarea id={id} rows={10} className="mono" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />}</Field>
        <Field label="Crawler">
          {(id) => (
            <select id={id} value={agent} onChange={(e) => setAgent(e.target.value)}>
              {AGENTS.map((a) => <option key={a} value={a}>{a === "*" ? "Any other crawler (*)" : a}</option>)}
              <option value="custom">Other…</option>
            </select>
          )}
        </Field>
        {agent === "custom" && <Field label="User-agent name">{(id) => <input id={id} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. AhrefsBot" />}</Field>}
        <Field label="URLs or paths to test" hint="One per line, up to 50.">{(id) => <textarea id={id} rows={5} value={paths} onChange={(e) => setPaths(e.target.value)} />}</Field>
      </div>
      <div className="tres">
        <div className="crawl-wrap">
          <table className="crawl">
            <thead>
              <tr><th>Path</th><th>{ua === "*" ? "Any crawler" : ua}</th><th>Decided by</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.input}>
                  <td title={r.input}>{r.path}</td>
                  <td><Chip tone={r.v.allowed ? "ok" : "bad"}>{r.v.allowed ? "Allowed" : "Blocked"}</Chip></td>
                  <td><small>{r.v.rule ? `Line ${r.v.rule.line}: ${r.v.rule.allow ? "Allow" : "Disallow"}: ${r.v.rule.path}` : r.v.group ? "No matching rule" : "No group applies"}{r.v.group && ` · group ${r.v.group === "*" ? "*" : `"${r.v.group}"`}`}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {parsed.sitemaps.length > 0 && <p className="tnote">Sitemaps listed: {parsed.sitemaps.join(" · ")}</p>}
        {parsed.problems.length > 0 && (
          <ul className="tissues">
            {parsed.problems.slice(0, 8).map((p) => <li key={p.line}>Line {p.line}: {p.text}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Domain age ---------------- */
function age(from: string | null, now: number): string {
  if (!from) return "–";
  const a = new Date(from);
  const n = new Date(now);
  let months = (n.getUTCFullYear() - a.getUTCFullYear()) * 12 + (n.getUTCMonth() - a.getUTCMonth());
  if (n.getUTCDate() < a.getUTCDate()) months--;
  if (months < 1) return `${Math.max(0, Math.floor((n.getTime() - a.getTime()) / 86_400_000))} days`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} year${y > 1 ? "s" : ""}` : "", m ? `${m} month${m > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ");
}

export function DomainAgeChecker({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState(ctx?.host ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Problem | null>(null);
  const [res, setRes] = useState<{ results: DomainAge[]; skipped: number; at: number } | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await callTool<{ results: DomainAge[]; skipped: number }>({ tool: "domain-age", domains: list });
    if (isProblem(r)) setErr(r);
    else setRes({ ...r, at: Date.now() });
    setBusy(false);
  };
  return (
    <div className="tcheck">
      <form className="tform" onSubmit={run}>
        <Field label="Domains" hint="One per line or separated by commas, up to 10.">{(id) => <textarea id={id} rows={4} placeholder={"example.com\nexample.org"} value={list} onChange={(e) => setList(e.target.value)} required />}</Field>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Looking up…" : "Check domains"}</button>
      </form>
      <ErrorNote p={err} />
      {res && (
        <section className="tres" aria-label="Domain age results" aria-live="polite">
          <div className="crawl-wrap">
            <table className="crawl">
              <thead>
                <tr><th>Domain</th><th>Age</th><th>Registered</th><th>Expires</th><th>Registrar</th></tr>
              </thead>
              <tbody>
                {res.results.map((d) => {
                  const left = d.expires ? Math.floor((new Date(d.expires).getTime() - res.at) / 86_400_000) : null;
                  return d.ok ? (
                    <tr key={d.domain}>
                      <td><b>{d.domain}</b></td>
                      <td>{age(d.created, res.at)}</td>
                      <td>{day(d.created)}</td>
                      <td>{day(d.expires)}{left != null && <small className={left < 60 ? "bad" : undefined}>{left < 0 ? "Expired" : `in ${left} days`}</small>}</td>
                      <td>{d.registrar ?? "–"}</td>
                    </tr>
                  ) : (
                    <tr key={d.domain} className="bad">
                      <td><b>{d.domain}</b></td>
                      <td colSpan={4}>{d.error}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {res.skipped > 0 && <p className="tnote">{res.skipped} entr{res.skipped > 1 ? "ies weren't" : "y wasn't"} checked: not a domain name, a duplicate, or over the limit of 10.</p>}
        </section>
      )}
    </div>
  );
}

/* ---------------- hreflang ---------------- */
export function HreflangChecker({ ctx }: { ctx: Ctx }) {
  const [url, setUrl] = useState(ctx?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Problem | null>(null);
  const [rep, setRep] = useState<HreflangReport | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await callTool<{ report: HreflangReport }>({ tool: "hreflang", url });
    if (isProblem(r)) setErr(r);
    else setRep(r.report);
    setBusy(false);
  };
  return (
    <div className="tcheck">
      <form className="tform trow" onSubmit={run}>
        <Field label="Page with language versions">{(id) => <input id={id} type="text" inputMode="url" placeholder="https://example.com/en/" value={url} onChange={(e) => setUrl(e.target.value)} required />}</Field>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Checking alternates…" : "Check hreflang"}</button>
      </form>
      <ErrorNote p={err} />
      {rep && (
        <section className="tres" aria-label="hreflang results" aria-live="polite">
          {rep.alts.length === 0 ? (
            <p className="tres-sum">No hreflang tags found on <span className="tres-url">{rep.url}</span>. That&rsquo;s fine for a site in one language.</p>
          ) : (
            <>
              <p className="tres-sum">
                <b>{rep.alts.length}</b> language version{rep.alts.length > 1 ? "s" : ""} on <span className="tres-url">{rep.url}</span>
                {" · "}
                {rep.issues.length ? <b className="bad">{rep.issues.length} problem{rep.issues.length > 1 ? "s" : ""}</b> : <b className="ok">no problems found</b>}
              </p>
              {rep.issues.length > 0 && (
                <ul className="tissues">
                  {rep.issues.map((i) => (
                    <li key={i.title}><b>{i.title}.</b> {i.fix}{i.evidence && <small>{i.evidence}</small>}</li>
                  ))}
                </ul>
              )}
              <div className="crawl-wrap">
                <table className="crawl">
                  <thead>
                    <tr><th>hreflang</th><th>URL</th><th>Status</th><th>Links back</th></tr>
                  </thead>
                  <tbody>
                    {rep.alts.map((a) => (
                      <tr key={`${a.lang}|${a.href}`}>
                        <td><b>{a.lang}</b></td>
                        <td title={a.href}>{a.href}{a.canonicalElsewhere && <small className="bad">Canonical: {a.canonicalElsewhere}</small>}</td>
                        <td>{!a.checked ? <small>Not opened</small> : a.status == null ? <Chip tone="warn">No answer</Chip> : <Chip tone={a.status === 200 ? "ok" : "bad"}>{a.status}</Chip>}</td>
                        <td>{a.self ? <small>This page</small> : a.returns == null ? "–" : <Chip tone={a.returns ? "ok" : "bad"}>{a.returns ? "Yes" : "No"}</Chip>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rep.truncated && <p className="tnote">Only the first 12 alternates were opened and checked for return links. The codes of all {rep.alts.length} were checked.</p>}
            </>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------------- Google review link ---------------- */
export function ReviewLink() {
  const [id, setId] = useState("");
  const clean = id.trim().replace(/^.*placeid=/i, "").replace(/[&#].*$/, "");
  const valid = /^[A-Za-z0-9_-]{16,}$/.test(clean);
  const link = valid ? `https://search.google.com/local/writereview?placeid=${clean}` : "";
  return (
    <div className="tgrid">
      <div className="tform">
        <Field label="Google Place ID" hint="Usually starts with ChIJ.">{(fid) => <input id={fid} value={id} onChange={(e) => setId(e.target.value)} placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4" spellCheck={false} />}</Field>
        <p className="tnote">
          Don&rsquo;t know it? Search for your business on{" "}
          <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer">Google&rsquo;s Place ID Finder</a>{" "}
          and copy the ID it shows.
        </p>
        {id.trim() && !valid && <p className="terr" role="alert">That doesn&rsquo;t look like a Place ID. It&rsquo;s a long code of letters, numbers, dashes and underscores.</p>}
      </div>
      <div>
        <Output text={link || "Your review link will appear here."} filename="review-link.txt" />
        {link && (
          <p className="tnote pad-top">
            <a href={link} target="_blank" rel="noopener noreferrer">Open the link</a> to check it shows your business before you share it.
          </p>
        )}
      </div>
    </div>
  );
}
