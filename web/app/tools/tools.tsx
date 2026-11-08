"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { ToolContext } from "@/lib/scan/tools-context";

/* Five free, fully client-side generators. Nothing typed here leaves the browser. */

type ToolId = "llms" | "robots" | "schema" | "serp" | "headers";
type Ctx = ToolContext | null;

const TOOLS: { id: ToolId; name: string; blurb: string }[] = [
  { id: "llms", name: "llms.txt", blurb: "A guide that helps AI assistants understand your site." },
  { id: "robots", name: "robots.txt", blurb: "Decide which search and AI crawlers may visit." },
  { id: "schema", name: "Schema markup", blurb: "Structured data for rich results and AI answers." },
  { id: "serp", name: "Search preview", blurb: "See your title and description as Google shows them." },
  { id: "headers", name: "Security headers", blurb: "Copy-paste config for your host." },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="tf">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function Output({ text, filename }: { text: string; filename: string }) {
  const [done, setDone] = useState("");
  const flash = (m: string) => {
    setDone(m);
    window.setTimeout(() => setDone(""), 1800);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Copied");
    } catch {
      flash("Copy blocked");
    }
  };
  const save = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="tout">
      <div className="tout-bar">
        <span>{filename}</span>
        <span className="tout-act">
          <button type="button" onClick={copy}>{done || "Copy"}</button>
          <button type="button" onClick={save}>Download</button>
        </span>
      </div>
      <pre tabIndex={0} aria-label={`Generated ${filename}`}>{text}</pre>
    </div>
  );
}

/* ---------------- llms.txt ---------------- */
function Llms({ ctx }: { ctx: Ctx }) {
  const [name, setName] = useState(ctx?.name ?? "Acme Plumbing");
  const [about, setAbout] = useState(ctx?.description || (ctx ? "" : "Family-run plumbers serving Pune since 2009. Emergency call-outs, boiler repairs and installations."));
  const [pages, setPages] = useState(ctx && ctx.pages.length ? ctx.pages.map((p) => `${p.title} | ${p.url} | `).join("\n") : ctx ? `Home | ${ctx.url || ctx.origin} | ` : "Services | https://example.com/services | What we do and prices\nAbout us | https://example.com/about | Who we are\nContact | https://example.com/contact | Phone, address and opening hours");
  const lines = pages.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0] && p[1]);
  const out = [`# ${name || "Your site"}`, "", `> ${about || "A short description of your site."}`, "", "## Key pages", "", ...lines.map((p) => `- [${p[0]}](${p[1]})${p[2] ? `: ${p[2]}` : ""}`), ""].join("\n");
  return (
    <div className="tgrid">
      <div className="tform">
        <Field label="Site or business name">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="One-paragraph summary" hint="Plain facts: what you do, where, for whom.">{(id) => <textarea id={id} rows={3} value={about} onChange={(e) => setAbout(e.target.value)} />}</Field>
        <Field label="Key pages" hint="One per line: Title | URL | short description">{(id) => <textarea id={id} rows={5} value={pages} onChange={(e) => setPages(e.target.value)} />}</Field>
        <p className="tnote">Upload the file to <code>/llms.txt</code> at the root of your site.</p>
      </div>
      <Output text={out} filename="llms.txt" />
    </div>
  );
}

/* ---------------- robots.txt ---------------- */
const BOTS = [
  ["GPTBot", "OpenAI (ChatGPT training)"],
  ["ChatGPT-User", "ChatGPT browsing on request"],
  ["ClaudeBot", "Anthropic (Claude)"],
  ["PerplexityBot", "Perplexity search"],
  ["Google-Extended", "Google Gemini training"],
  ["CCBot", "Common Crawl dataset"],
] as const;

function Robots({ ctx }: { ctx: Ctx }) {
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [sitemap, setSitemap] = useState(ctx?.sitemap ?? "https://example.com/sitemap.xml");
  const [disallow, setDisallow] = useState("/admin\n/cart");
  const toggle = (b: string) =>
    setBlocked((s) => {
      const n = new Set(s);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });
  const paths = disallow.split("\n").map((p) => p.trim()).filter(Boolean);
  const out = [
    "User-agent: *",
    ...(paths.length ? paths.map((p) => `Disallow: ${p}`) : ["Allow: /"]),
    ...[...blocked].flatMap((b) => ["", `User-agent: ${b}`, "Disallow: /"]),
    ...(sitemap.trim() ? ["", `Sitemap: ${sitemap.trim()}`] : []),
    "",
  ].join("\n");
  return (
    <div className="tgrid">
      <div className="tform">
        <fieldset className="tchecks">
          <legend>Block these AI crawlers</legend>
          {BOTS.map(([b, d]) => (
            <label key={b}>
              <input type="checkbox" checked={blocked.has(b)} onChange={() => toggle(b)} />
              <span><b>{b}</b> <small>{d}</small></span>
            </label>
          ))}
        </fieldset>
        <p className="tnote">Leave all unticked to stay visible to AI assistants. Blocking them means they can’t cite you.{ctx && ctx.blocked.length > 0 && <> Your current robots.txt blocks: <b>{ctx.blocked.join(", ")}</b>. This file leaves them unblocked.</>}</p>
        <Field label="Paths to keep private" hint="One per line">{(id) => <textarea id={id} rows={3} value={disallow} onChange={(e) => setDisallow(e.target.value)} />}</Field>
        <Field label="Sitemap URL">{(id) => <input id={id} value={sitemap} onChange={(e) => setSitemap(e.target.value)} />}</Field>
      </div>
      <Output text={out} filename="robots.txt" />
    </div>
  );
}

/* ---------------- JSON-LD ---------------- */
function Schema({ ctx }: { ctx: Ctx }) {
  const [type, setType] = useState<"Organization" | "LocalBusiness" | "FAQPage">("Organization");
  const [name, setName] = useState(ctx?.name ?? "Acme Plumbing");
  const [url, setUrl] = useState(ctx?.url || ctx?.origin || "https://example.com");
  const [logo, setLogo] = useState(ctx ? `${ctx.origin}/logo.png` : "https://example.com/logo.png");
  const [phone, setPhone] = useState(ctx ? "" : "+91 98765 43210");
  const [address, setAddress] = useState(ctx ? "" : "12 MG Road, Pune, Maharashtra 411001");
  const [faq, setFaq] = useState("Do you offer emergency call-outs? | Yes, 24 hours a day across Pune.\nHow much does a boiler service cost? | From ₹1,500, with a fixed quote before we start.");
  let data: Record<string, unknown>;
  if (type === "FAQPage") {
    data = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0] && p[1]).map((p) => ({ "@type": "Question", name: p[0], acceptedAnswer: { "@type": "Answer", text: p[1] } })),
    };
  } else {
    data = { "@context": "https://schema.org", "@type": type, name, url, ...(logo && { logo }), ...(phone && { telephone: phone }), ...(type === "LocalBusiness" && address && { address: { "@type": "PostalAddress", streetAddress: address } }) };
  }
  // "<" is escaped so text like "</script>" in a field can't end the script block early.
  const out = `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n</script>`;
  return (
    <div className="tgrid">
      <div className="tform">
        <Field label="Type">
          {(id) => (
            <select id={id} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="Organization">Organization</option>
              <option value="LocalBusiness">Local business</option>
              <option value="FAQPage">FAQ page</option>
            </select>
          )}
        </Field>
        {type === "FAQPage" ? (
          <Field label="Questions" hint="One per line: Question | Answer">{(id) => <textarea id={id} rows={6} value={faq} onChange={(e) => setFaq(e.target.value)} />}</Field>
        ) : (
          <>
            <Field label="Name">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label="Website">{(id) => <input id={id} value={url} onChange={(e) => setUrl(e.target.value)} />}</Field>
            <Field label="Logo URL">{(id) => <input id={id} value={logo} onChange={(e) => setLogo(e.target.value)} />}</Field>
            <Field label="Phone">{(id) => <input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
            {type === "LocalBusiness" && <Field label="Street address">{(id) => <input id={id} value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>}
          </>
        )}
        <p className="tnote">Paste inside the <code>&lt;head&gt;</code> of the page it describes.</p>
      </div>
      <Output text={out} filename="schema.html" />
    </div>
  );
}

/* ---------------- SERP preview ---------------- */
function Serp({ ctx }: { ctx: Ctx }) {
  const [title, setTitle] = useState(ctx ? ctx.title : "Emergency Plumber in Pune | Acme Plumbing");
  const [desc, setDesc] = useState(ctx ? ctx.description : "24-hour plumbers in Pune. Boiler repairs, leaks and installations with fixed quotes and a 12-month guarantee. Call now for a fast response.");
  const [url, setUrl] = useState(ctx ? ctx.url || ctx.origin : "https://example.com/emergency-plumber");
  const [mobile, setMobile] = useState(false);
  const tMax = 60, dMax = 160;
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  const meter = (n: number, lo: number, hi: number) => (n === 0 ? "na" : n < lo ? "short" : n > hi ? "long" : "good");
  let host = url;
  try { host = new URL(url).hostname; } catch { /* keep raw */ }
  return (
    <div className="tgrid">
      <div className="tform">
        <Field label="Page title">{(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <p className={`tmeter m-${meter(title.length, 30, tMax)}`}>{title.length} / {tMax} characters</p>
        <Field label="Meta description">{(id) => <textarea id={id} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
        <p className={`tmeter m-${meter(desc.length, 70, dMax)}`}>{desc.length} / {dMax} characters</p>
        <Field label="Page URL">{(id) => <input id={id} value={url} onChange={(e) => setUrl(e.target.value)} />}</Field>
      </div>
      <div className="tout">
        <div className="tout-bar">
          <span>Preview</span>
          <span className="tout-act">
            <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</button>
            <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>Mobile</button>
          </span>
        </div>
        <div className={`serp${mobile ? " mobile" : ""}`}>
          <div className="serp-site"><span className="serp-fav" aria-hidden="true">{(host[0] || "?").toUpperCase()}</span><span>{host}<small> › {url.replace(/^https?:\/\/[^/]+\/?/, "") || "home"}</small></span></div>
          <div className="serp-title">{clip(title || "Your page title", mobile ? 56 : tMax)}</div>
          <div className="serp-desc">{clip(desc || "Your meta description will appear here.", mobile ? 120 : dMax)}</div>
        </div>
        <p className="tnote pad">Google decides what to show, so treat this as a guide. Text beyond the limit is usually cut off.</p>
      </div>
    </div>
  );
}

/* ---------------- Security headers ---------------- */
const HDRS: [string, string, string][] = [
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains", "Forces HTTPS (only enable once your whole site works on HTTPS)"],
  ["X-Content-Type-Options", "nosniff", "Stops browsers guessing file types"],
  ["X-Frame-Options", "SAMEORIGIN", "Blocks other sites from embedding yours"],
  ["Referrer-Policy", "strict-origin-when-cross-origin", "Limits what URL info leaks to other sites"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()", "Turns off powerful browser features you don’t use"],
  ["Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; frame-ancestors 'self'", "Limits where scripts and content can load from (test before enforcing)"],
];
type Host = "netlify" | "nginx" | "apache" | "vercel";

function Headers({ ctx }: { ctx: Ctx }) {
  const [host, setHost] = useState<Host>(ctx?.hostKind ?? "netlify");
  const [on, setOn] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));
  const sel = HDRS.filter((_, i) => on.has(i));
  const toggle = (i: number) =>
    setOn((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const out =
    host === "netlify" ? `/*\n${sel.map(([k, v]) => `  ${k}: ${v}`).join("\n")}\n`
    : host === "nginx" ? `${sel.map(([k, v]) => `add_header ${k} "${v}" always;`).join("\n")}\n`
    : host === "apache" ? `<IfModule mod_headers.c>\n${sel.map(([k, v]) => `  Header always set ${k} "${v}"`).join("\n")}\n</IfModule>\n`
    : JSON.stringify({ headers: [{ source: "/(.*)", headers: sel.map(([key, value]) => ({ key, value })) }] }, null, 2) + "\n";
  const file = { netlify: "_headers", nginx: "nginx-headers.conf", apache: ".htaccess", vercel: "vercel.json" }[host];
  return (
    <div className="tgrid">
      <div className="tform">
        <Field label="Your host">
          {(id) => (
            <select id={id} value={host} onChange={(e) => setHost(e.target.value as Host)}>
              <option value="netlify">Netlify (_headers file)</option>
              <option value="vercel">Vercel (vercel.json)</option>
              <option value="nginx">Nginx</option>
              <option value="apache">Apache (.htaccess)</option>
            </select>
          )}
        </Field>
        <fieldset className="tchecks">
          <legend>Headers to add</legend>
          {HDRS.map(([k, , d], i) => (
            <label key={k}>
              <input type="checkbox" checked={on.has(i)} onChange={() => toggle(i)} />
              <span><b>{k}</b> <small>{d}</small></span>
            </label>
          ))}
        </fieldset>
      </div>
      <Output text={out} filename={file} />
    </div>
  );
}

export function Tools({ ctx = null }: { ctx?: Ctx }) {
  // Open on the tool that fixes the most findings from the scan.
  const first = ctx ? (TOOLS.map((t) => t.id).sort((a, b) => ctx.fixes[b].length - ctx.fixes[a].length)[0] ?? "llms") : "llms";
  const [tool, setTool] = useState<ToolId>(ctx && ctx.fixes[first].length ? first : "llms");
  const cur = TOOLS.find((t) => t.id === tool)!;
  return (
    <div className="tools">
      {ctx && (
        <p className="tctx" role="status">
          Pre-filled from your scan of <b>{ctx.host}</b>. Check everything before you publish it.{" "}
          <Link href={`/dashboard/${ctx.scanId}`}>Back to your report</Link>
        </p>
      )}
      <div className="ttabs" role="tablist" aria-label="Free tools">
        {TOOLS.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={tool === t.id} aria-controls="tool-panel" tabIndex={tool === t.id ? 0 : -1} onClick={() => setTool(t.id)}
            onKeyDown={(e) => {
              const i = TOOLS.findIndex((x) => x.id === tool);
              const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
              if (next === null) return;
              const n = TOOLS[(next + TOOLS.length) % TOOLS.length].id;
              setTool(n);
              document.getElementById(`tab-${n}`)?.focus();
            }}>
            {t.name}
            {ctx && ctx.fixes[t.id].length > 0 && <span className="tbadge" title={ctx.fixes[t.id].join("; ")}>{ctx.fixes[t.id].length}</span>}
          </button>
        ))}
      </div>
      <div id="tool-panel" role="tabpanel" aria-labelledby={`tab-${tool}`} className="tpanel">
        <p className="tblurb">{cur.blurb}</p>
        {ctx && ctx.fixes[tool].length > 0 && <p className="tfixes">Fixes from your scan: {ctx.fixes[tool].join(" · ")}</p>}
        {tool === "llms" && <Llms ctx={ctx} />}
        {tool === "robots" && <Robots ctx={ctx} />}
        {tool === "schema" && <Schema ctx={ctx} />}
        {tool === "serp" && <Serp ctx={ctx} />}
        {tool === "headers" && <Headers ctx={ctx} />}
      </div>
    </div>
  );
}
