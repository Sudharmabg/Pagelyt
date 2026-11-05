import { Arrow } from "./arrow";
import Link from "next/link";
import type { ReactNode } from "react";
import { Arcs } from "./art";

export function PageHero({
  h1,
  lead,
  children,
}: {
  h1: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero" aria-labelledby="page-h1">
      <Arcs />
      <div className="container">
        <h1 id="page-h1">{h1}</h1>
        {lead && <p className="sub">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

export function CtaBand({
  title = "See what your website is telling you.",
  text = "Start with a free website analysis. No complicated setup. No technical expertise required.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="sec ice" aria-labelledby="cta-band-h">
      <div className="container head-center">
        <h2 className="title" id="cta-band-h">
          {title}
        </h2>
        <p className="lead">{text}</p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <Link className="btn" href="/">
            Analyse My Website <Arrow />
          </Link>
          <Link className="btn ghost" href="/consultation">
            Book a consultation
          </Link>
        </div>
      </div>
    </section>
  );
}
