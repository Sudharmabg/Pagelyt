"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { SchemaPage } from "@/lib/tools/bulk-schema";
import { BULK_SCHEMA, SITEMAP } from "@/lib/tools/limits";
import type { RenderReport } from "@/lib/tools/rendered";
import type { CrawledPage } from "@/lib/tools/sitemap";
import { sitemapXml } from "@/lib/tools/sitemap-xml";
import { Chip, ErrorNote, Verdict, Working, callTool, isProblem, type Problem } from "./checkers";
import { Field, Output, type Ctx } from "./tools";

/* Phase 2 tools: bulk schema checker, sitemap generator and raw vs rendered HTML.
   The first two send work to /api/tools in small batches and show progress as each batch comes back. */

type Plan = { paid: boolean; schema: number; sitemap: number };
type Found = { home: string; host: string; sitemaps: string[]; urls: string[] };

const getPlan = () => callTool<Plan>({ tool: "plan" });
// One address per line, as the hint says (spaces and commas can be part of a URL someone pastes).
const lines = (s: string) => [...new Set(s.split(/[\r\n]+/).map((x) => x.trim()).filter(Boolean))];
const path = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search;
  } catch {
    return u;
  }
};

const host = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

/* ---------------- Bulk schema checker ---------------- */

function verdict(p: SchemaPage): [tone: "ok" | "bad" | "warn" | "na", text: string] {
  if (p.error) return ["bad", p.status ? String(p.status) : "Error"];
  if (p.invalid) return ["bad", "Broken JSON"];
  if (p.issues.some((i) => i.level === "required")) return ["bad", "Missing required"];
  if (p.issues.length) return ["warn", "Could be richer"];
  if (!p.blocks) return ["na", p.microdata ? "Microdata only" : "No schema"];
  return ["ok", "Valid"];
}

export function BulkSchemaChecker({ ctx }: { ctx: Ctx }) {
  const [text, setText] = useState(ctx ? (ctx.pages.length ? ctx.pages.map((p) => p.url) : [ctx.url || ctx.origin]).slice(0, BULK_SCHEMA.free).join("\n") : "");
  const [site, setSite] = useState(ctx?.origin ?? "");
  const [busy, setBusy] = useState<"" | "load" | "run">("");
  const [err, setErr] = useState<Problem | null>(null);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<SchemaPage[] | null>(null);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setBusy("load");
    setErr(null);
    setNote("");
    const r = await callTool<Found>({ tool: "sitemap-urls", for: "schema", url: site || lines(text)[0] || "" });
    if (isProblem(r)) setErr(r);
    else if (!r.urls.length) setNote(r.sitemaps.length ? "Your sitemap has no page addresses on this site." : "We couldn't find a sitemap for this site. Paste the addresses instead.");
    else {
      setText(r.urls.join("\n"));
      setNote(`Loaded ${r.urls.length} address${r.urls.length > 1 ? "es" : ""} from ${r.sitemaps.length > 1 ? `${r.sitemaps.length} sitemaps` : "your sitemap"}.`);
    }
    setBusy("");
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("run");
    setErr(null);
    setNote("");
    const plan = await getPlan();
    if (isProblem(plan)) {
      setErr(plan);
      return setBusy("");
    }
    const all = lines(text);
    const urls = all.slice(0, plan.schema);
    if (all.length > urls.length) setNote(`Checked the first ${urls.length} of ${all.length} addresses. ${plan.paid ? "" : `Paid plans check up to ${BULK_SCHEMA.paid} at a time.`}`);
    setRows([]);
    setTotal(urls.length);
    const done: SchemaPage[] = [];
    for (let i = 0; i < urls.length; i += BULK_SCHEMA.batch) {
      const r = await callTool<{ pages: SchemaPage[] }>({ tool: "schema-bulk", urls: urls.slice(i, i + BULK_SCHEMA.batch) });
      if (isProblem(r)) {
        setErr(r);
        break;
      }
      done.push(...r.pages);
      setRows([...done]);
    }
    setBusy("");
  };

  const counts = rows && {
    withSchema: rows.filter((r) => r.blocks > 0).length,
    required: rows.filter((r) => r.issues.some((i) => i.level === "required") || r.invalid > 0).length,
    errors: rows.filter((r) => r.error).length,
  };
  return (
    <div className="tcheck">
      <form className="tform" onSubmit={run}>
        <Field label="Pages to check" hint={`One address per line. Free accounts check up to ${BULK_SCHEMA.free} at a time; paid plans ${BULK_SCHEMA.paid}.`}>
          {(id) => <textarea id={id} rows={6} placeholder={"https://example.com/\nhttps://example.com/products/blue-mug"} value={text} onChange={(e) => setText(e.target.value)} required spellCheck={false} />}
        </Field>
        <div className="tload">
          <Field label="Or load them from a sitemap">{(id) => <input id={id} type="text" inputMode="url" placeholder="https://example.com" value={site} onChange={(e) => setSite(e.target.value)} />}</Field>
          <button className="btn outline" type="button" data-gate onClick={load} disabled={!!busy} aria-busy={busy === "load"}>{busy === "load" ? "Reading sitemap…" : "Load from sitemap"}</button>
        </div>
        <button className="btn" type="submit" disabled={!!busy} aria-busy={busy === "run"}>
          {busy === "run" ? `Checking ${rows?.length ?? 0} of ${total}…` : "Check structured data"}
        </button>
      </form>
      {note && <p className="tnote" role="status">{note}</p>}
      <ErrorNote p={err} />
      {rows && rows.length > 0 && counts && (
        <section className="tres" aria-label="Structured data results" aria-live="polite">
          <Verdict tone={counts.required ? "bad" : counts.withSchema < rows.length ? "warn" : "ok"} big={<>{counts.withSchema}<small>/{rows.length}</small></>} title={`page${rows.length > 1 ? "s" : ""} with JSON-LD · ${counts.required ? `${counts.required} need fixing` : "no required fields missing"}`}>
            {counts.errors > 0 ? `${counts.errors} couldn’t be read.` : "Pages missing required fields can’t earn rich results."}
          </Verdict>
          <div className="crawl-wrap">
            <table className="crawl tschema">
              <thead>
                <tr><th>Page</th><th>Types</th><th>Result</th><th>What to fix</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const [tone, label] = verdict(p);
                  return (
                    <tr key={p.url}>
                      <td title={p.url}>{path(p.url) || "/"}{host(p.url) && <small>{host(p.url)}</small>}</td>
                      <td>{p.types.length ? p.types.join(", ") : "–"}</td>
                      <td><Chip tone={tone}>{label}</Chip></td>
                      <td>
                        {p.error ? <small>{p.error}</small> : null}
                        {p.invalid > 0 && <small className="bad">{p.invalid} JSON-LD block{p.invalid > 1 ? "s are" : " is"} not valid JSON, so search engines skip {p.invalid > 1 ? "them" : "it"}.</small>}
                        {p.issues.map((i) => (
                          <small key={i.label + i.level} className={i.level === "required" ? "bad" : undefined}>
                            {i.label}: {i.level === "required" ? "needs" : "add"} {i.missing.join(", ")}
                          </small>
                        ))}
                        {!p.error && !p.invalid && !p.issues.length && <small>{p.blocks ? "Nothing to fix." : "No JSON-LD on this page."}</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="tnote">
            Types we don&rsquo;t have rules for are listed but not checked field by field. Need markup for a page? Use the <Link href="/tools/schema-markup-generator">schema markup generator</Link>.
          </p>
        </section>
      )}
    </div>
  );
}

/* ---------------- Sitemap generator ---------------- */

const REASON: Record<NonNullable<CrawledPage["reason"]>, string> = {
  redirect: "Redirects",
  error: "Error",
  noindex: "Set to noindex",
  canonical: "Canonical points elsewhere",
  "not-html": "Not a web page",
};
const key = (u: string) => u.replace(/#.*$/, "").replace(/\/$/, "");

export function SitemapGenerator({ ctx }: { ctx: Ctx }) {
  const [url, setUrl] = useState(ctx?.origin ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Problem | null>(null);
  const [pages, setPages] = useState<CrawledPage[] | null>(null);
  const [state, setState] = useState<{ queued: number; max: number; paid: boolean; found: Found | null }>({ queued: 0, max: 0, paid: false, found: null });
  const stop = useRef(false);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    stop.current = false;
    setBusy(true);
    setErr(null);
    setPages(null);
    const plan = await getPlan();
    if (isProblem(plan)) {
      setErr(plan);
      return setBusy(false);
    }
    const found = await callTool<Found>({ tool: "sitemap-urls", url });
    if (isProblem(found)) {
      setErr(found);
      return setBusy(false);
    }
    const queue: string[] = [];
    const seen = new Set<string>();
    const enqueue = (u: string) => {
      if (seen.has(key(u))) return;
      seen.add(key(u));
      queue.push(u);
    };
    [found.home, ...found.urls].forEach(enqueue);
    const done: CrawledPage[] = [];
    setPages([]);
    setState({ queued: queue.length, max: plan.sitemap, paid: plan.paid, found });
    while (queue.length && done.length < plan.sitemap && !stop.current) {
      const batch = queue.splice(0, Math.min(SITEMAP.batch, plan.sitemap - done.length));
      const r = await callTool<{ pages: CrawledPage[]; links: string[] }>({ tool: "sitemap-crawl", host: found.host, urls: batch });
      if (isProblem(r)) {
        setErr(r);
        break;
      }
      done.push(...r.pages);
      r.links.forEach(enqueue);
      setPages([...done]);
      setState((s) => ({ ...s, queued: queue.length }));
    }
    setBusy(false);
  };

  const included = (pages ?? []).filter((p) => p.include).sort((a, b) => a.url.localeCompare(b.url));
  const excluded = (pages ?? []).filter((p) => !p.include);
  const byReason = Object.entries(REASON).map(([k, label]) => [label, excluded.filter((p) => p.reason === k).length] as const).filter(([, n]) => n > 0);
  const capped = !busy && pages && pages.length >= state.max && state.queued > 0;
  return (
    <div className="tcheck">
      <form className="tform trow" onSubmit={run}>
        <Field label="Website to crawl">{(id) => <input id={id} type="text" inputMode="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} required />}</Field>
        {busy ? (
          <button className="btn outline" type="button" onClick={() => (stop.current = true)}>Stop</button>
        ) : (
          <button className="btn" type="submit">Generate sitemap</button>
        )}
      </form>
      <p className="tnote">Free accounts crawl up to {SITEMAP.free} pages; paid plans {SITEMAP.paid.toLocaleString("en-GB")}.</p>
      <ErrorNote p={err} />
      {pages && (
        <section className="tres" aria-label="Sitemap results" aria-live="polite">
          {busy && (
            <div className="tprog" role="status">
              <span>Crawled <b>{pages.length}</b> of up to {state.max.toLocaleString("en-GB")} pages · {state.queued} waiting</span>
              <progress max={state.max} value={pages.length} />
            </div>
          )}
          {!busy && (
            <Verdict tone={included.length ? (excluded.length ? "warn" : "ok") : "bad"} big={included.length} title={`page${included.length === 1 ? "" : "s"} in your sitemap, from ${pages.length} crawled`}>
              {excluded.length > 0 ? `${excluded.length} left out: redirects, errors, noindex or canonicalised pages.` : "Every crawled page belongs in the sitemap."}
            </Verdict>
          )}
          <ul className="tfacts">
            <li>
              <Chip tone={state.found?.sitemaps.length ? "ok" : "na"}>{state.found?.sitemaps.length ? "Found" : "None"}</Chip> Current sitemap
              {state.found?.sitemaps.length ? <small> {state.found.urls.length} addresses, added to the crawl</small> : <small> We started from your homepage links</small>}
            </li>
            {byReason.map(([label, n]) => (
              <li key={label}><Chip tone="warn">{n}</Chip> {label}</li>
            ))}
          </ul>
          {capped && <p className="tnote">Stopped at your limit of {state.max.toLocaleString("en-GB")} pages with {state.queued} more links waiting.{!state.paid && ` Paid plans crawl up to ${SITEMAP.paid.toLocaleString("en-GB")}.`}</p>}
          {!busy && included.length > 0 && <Output text={sitemapXml(included)} filename="sitemap.xml" />}
          {!busy && included.length === 0 && <p className="terr" role="alert">No indexable pages found. Check the reasons below.</p>}
          {excluded.length > 0 && (
            <details className="tmore">
              <summary>Pages left out ({excluded.length})</summary>
              <div className="crawl-wrap">
                <table className="crawl">
                  <thead>
                    <tr><th>Page</th><th>Why</th></tr>
                  </thead>
                  <tbody>
                    {excluded.map((p) => (
                      <tr key={p.url}>
                        <td title={p.url}>{path(p.url) || "/"}</td>
                        <td>
                          {p.reason ? REASON[p.reason] : ""}
                          {p.status > 0 && ` (${p.status})`}
                          {p.target && <small>→ {path(p.target) || "/"}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {!busy && included.length > 0 && (
            <p className="tnote">
              Upload it as /sitemap.xml, add <code>Sitemap: {new URL("/sitemap.xml", included[0].url).href}</code> to robots.txt, and submit it in Google Search Console.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------------- Raw vs rendered HTML ---------------- */

const VERDICT: Record<RenderReport["verdict"], [tone: "ok" | "warn" | "bad", head: string, text: string]> = {
  same: ["ok", "The raw HTML has what matters", "Crawlers that don't run JavaScript see essentially the same page as a browser."],
  some: ["warn", "Some of this page needs JavaScript", "Search engines that render will see it; most AI crawlers and some others won't. Check the rows marked Changed."],
  heavy: ["bad", "This page depends on JavaScript", "Crawlers that don't run JavaScript see a mostly empty page. Render the main content on the server."],
};

export function RenderedChecker({ ctx }: { ctx: Ctx }) {
  const [url, setUrl] = useState(ctx?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Problem | null>(null);
  const [rep, setRep] = useState<RenderReport | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await callTool<{ report: RenderReport }>({ tool: "rendered", url });
    if (isProblem(r)) setErr(r);
    else setRep(r.report);
    setBusy(false);
  };
  const v = rep && VERDICT[rep.verdict];
  return (
    <div className="tcheck">
      <form className="tform trow" onSubmit={run}>
        <Field label="Page to compare">{(id) => <input id={id} type="text" inputMode="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} required />}</Field>
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Rendering in Chrome…" : "Compare"}</button>
      </form>
      <ErrorNote p={err} />
      {busy && !rep && <Working label="Fetching the raw HTML and rendering the page in Chrome…" />}
      {rep && v && (
        <section className="tres" aria-label="Raw vs rendered results" aria-live="polite">
          <div className={`tverdict ${v[0]}`}>
            <b>{v[1]}</b>
            <span>{v[2]}</span>
            <small>Raw HTML: {rep.rawWords.toLocaleString("en-GB")} words · Rendered: {rep.renderedWords.toLocaleString("en-GB")} words</small>
          </div>
          <div className="crawl-wrap">
            <table className="crawl trender">
              <thead>
                <tr><th>What</th><th>Raw HTML</th><th>After JavaScript</th><th></th></tr>
              </thead>
              <tbody>
                {rep.facts.map((f) => (
                  <tr key={f.key} className={f.changed ? "chg" : undefined}>
                    <td><b>{f.label}</b></td>
                    <td title={f.raw}>{f.raw || <small>None</small>}</td>
                    <td title={f.rendered}>{f.rendered || <small>None</small>}</td>
                    <td>{f.changed ? <Chip tone="warn">Changed</Chip> : <Chip tone="ok">Same</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rep.onlyRenderedTotal > 0 ? (
            <details className="tmore">
              <summary>Text that only appears after JavaScript ({rep.onlyRenderedTotal})</summary>
              <ul className="tonly">
                {rep.onlyRendered.map((l) => <li key={l}>{l}</li>)}
              </ul>
              {rep.onlyRenderedTotal > rep.onlyRendered.length && <p className="tnote">Showing the first {rep.onlyRendered.length}.</p>}
            </details>
          ) : (
            <p className="tnote">All of the rendered page&rsquo;s text is already in the raw HTML.</p>
          )}
          {rep.finalUrl !== rep.url && <p className="tnote">The browser ended up at {rep.finalUrl}.</p>}
        </section>
      )}
    </div>
  );
}
