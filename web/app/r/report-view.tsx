import { Ring, tone } from "../ui";
import { PrintButton } from "./[token]/print-button";
import { MODULE_NAMES, type Finding, type ScanResult, type Severity } from "@/lib/scan/types";

/* Presentational white-label report. Used by the real shared link and by the public /r/demo sample. */

export type ReportBrand = { name: string; logo_url: string | null; color: string; website: string | null; contact_email: string | null; footer: string | null; show_powered_by: boolean };
export type ReportAi = { score: number | null; byProvider: { label: string; score: number | null }[]; prompts: number };

const HEX = /^#[0-9a-fA-F]{6}$/;
const httpUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null);
const GROUPS: { sev: Severity; title: string }[] = [
  { sev: "high", title: "Fix these first" },
  { sev: "medium", title: "Worth improving" },
  { sev: "low", title: "Minor polish" },
];


export function ReportView({ brand, res, ai, showDetails, pdfToken }: { brand: ReportBrand | null; res: ScanResult; ai: ReportAi | null; showDetails: boolean; pdfToken?: string }) {
  const color = brand && HEX.test(brand.color) ? brand.color : "#14202b";
  const name = brand?.name ?? "Website report";
  const when = new Date(res.scannedAt).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
  const high = res.findings.filter((f) => f.severity === "high").length;
  const item = (f: Finding) => (
    <li key={f.module + f.id + f.title} className={`br-f sev-${f.severity}`}>
      <div className="br-f-top">
        <span className="br-sev">{f.severity === "high" ? "Important" : f.severity === "medium" ? "Worth fixing" : "Minor"}</span>
        <span className="br-area">{MODULE_NAMES[f.module]}</span>
      </div>
      <h3>{f.title}</h3>
      <p>{f.why}</p>
      {showDetails && (
        <p className="br-fix"><strong>How to fix:</strong> {f.fix}</p>
      )}
    </li>
  );

  return (
    <div className="br" style={{ ["--brand" as string]: color }}>
      <header className="br-head">
        {brand?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt={name} className="br-logo" height={40} />
        ) : (
          <span className="br-name">{name}</span>
        )}
        <PrintButton token={pdfToken} />
      </header>

      <main className="br-main">
        <section className="br-hero" aria-labelledby="br-h1">
          <p className="br-kicker">Website report · {when}</p>
          <h1 id="br-h1">{res.host}</h1>
          <div className="br-score">
            <Ring v={res.overall} size={150} stroke={14} />
            <div>
              <p className={`br-verdict t-${tone(res.overall)}`}>{res.overall >= 80 ? "In great shape" : res.overall >= 65 ? "In good shape" : "Room to grow"}</p>
              <p>{res.findings.length === 0 ? "No issues found." : `${res.findings.length} findings${high ? `, ${high} important` : ""}. Ordered by importance below.`}</p>
            </div>
          </div>
        </section>

        <section aria-label="Scores by area">
          <ul className="br-areas">
            {res.modules.map((m) => (
              <li key={m.key}>
                <Ring v={m.score} size={64} stroke={7} />
                <span>{m.name}</span>
              </li>
            ))}
          </ul>
        </section>

        {ai && (
          <section className="br-ai" aria-labelledby="br-ai-h">
            <h2 id="br-ai-h">AI search visibility</h2>
            <p className="br-note">How often AI assistants named {res.host} in their answers to {ai.prompts} test question{ai.prompts === 1 ? "" : "s"}. A sample, not a ranking: results vary by assistant, wording and location.</p>
            <div className="br-ai-row">
              <div className="br-ai-big"><b>{ai.score ?? "–"}%</b><span>mentioned overall</span></div>
              {ai.byProvider.map((p) => (
                <div key={p.label} className="br-ai-p"><b>{p.score ?? "–"}%</b><span>{p.label}</span></div>
              ))}
            </div>
          </section>
        )}

        {GROUPS.map((g) => {
          const list = res.findings.filter((f) => f.severity === g.sev);
          return list.length ? (
            <section key={g.sev} aria-label={g.title}>
              <h2 className="br-h2">{g.title}</h2>
              <ul className="br-list">{list.map(item)}</ul>
            </section>
          ) : null;
        })}

        <p className="br-limits">Automated checks find a share of issues and are not a compliance certificate. Speed figures from lab tests are estimates.</p>
      </main>

      <footer className="br-foot">
        <div>
          <strong>{name}</strong>
          {brand?.footer && <p>{brand.footer}</p>}
          <p>
            {httpUrl(brand?.website) && <a href={httpUrl(brand?.website)!}>{httpUrl(brand?.website)!.replace(/^https?:\/\//, "")}</a>}
            {httpUrl(brand?.website) && brand?.contact_email && " · "}
            {brand?.contact_email && <a href={`mailto:${brand.contact_email}`}>{brand.contact_email}</a>}
          </p>
        </div>
        {brand?.show_powered_by && <span className="br-powered">Powered by Pagelyt</span>}
      </footer>
    </div>
  );
}
