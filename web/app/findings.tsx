"use client";

import { useState } from "react";
import { MODULE_NAMES, type Finding } from "@/lib/scan/types";

const LABEL = { high: "High", medium: "Medium", low: "Low" } as const;

export function Findings({ findings }: { findings: Finding[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="findings" aria-label="Findings, ranked by importance">
      <h2>What to fix first</h2>
      <ul>
        {findings.map((f) => {
          const k = f.id + f.title;
          const isOpen = open === k;
          return (
            <li key={k} className={`fnd sev-${f.severity}`}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)}>
                <span className="sev">{LABEL[f.severity]}</span>
                <span className="ft">{f.title}</span>
                <span className="fm">{MODULE_NAMES[f.module]}</span>
              </button>
              {isOpen && (
                <div className="fb">
                  <p><strong>Why it matters.</strong> {f.why}</p>
                  <p><strong>How to fix.</strong> {f.fix}</p>
                  {f.evidence && <p className="ev"><strong>Evidence.</strong> <code>{f.evidence}</code></p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
