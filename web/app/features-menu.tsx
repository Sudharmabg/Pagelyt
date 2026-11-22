"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FEATURE_ICON, NEW_FEATURES } from "./feature-icons";

export type MenuFeature = { slug: string; name: string; short: string };

const tone = (slug: string) => {
  const t = FEATURE_ICON[slug];
  return (t ? { "--c1": t.c1, "--c2": t.c2 } : undefined) as CSSProperties | undefined;
};

export function FeatureIcon({ slug }: { slug: string }) {
  const I = FEATURE_ICON[slug]?.icon;
  return <span className="fm-ic" aria-hidden="true" style={tone(slug)}>{I && <I />}</span>;
}

/** Desktop "Features" mega menu: opens on hover, or on click and keyboard (a disclosure button). Closes on Escape,
 *  a click outside and page changes. Google data gets its own highlighted card; the rest sit in a two-column grid. */
export function FeaturesMenu({ features, google, tools }: { features: MenuFeature[]; google?: MenuFeature; tools: number }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const path = usePathname();

  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      btn.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={`menu-dd${open ? " open" : ""}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button ref={btn} type="button" className="menu-dd-btn" aria-expanded={open} aria-controls="dd-mega" onClick={() => setOpen((o) => !o)}>
        Features
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="dd-mega" id="dd-mega">
        <div className="dd-mega-main">
          <p className="dd-mega-h">What every scan checks</p>
          <ul className="dd-mega-grid">
            {features.map((f, i) => (
              <li key={f.slug} style={{ ["--i" as string]: i }}>
                <Link href={`/features/${f.slug}`} className="dd-item" style={tone(f.slug)}>
                  <FeatureIcon slug={f.slug} />
                  <span className="dd-item-tx">
                    <b>
                      {f.name}
                      {NEW_FEATURES.has(f.slug) && <span className="dd-new">New</span>}
                    </b>
                    <small>{f.short}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/features" className="dd-all">
            All features <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="dd-mega-side">
          {google && (
            <Link href={`/features/${google.slug}`} className="dd-google">
              <span className="dd-google-tag"><span aria-hidden="true">★</span> Google data</span>
              <b>Your traffic, explained. And how to grow it.</b>
              <small>Overall traffic from Search Console, Analytics and Ads, what&apos;s changing, and AI steps to improve it.</small>
              <span className="dd-google-bars" aria-hidden="true">
                {[38, 52, 46, 64, 58, 78, 92].map((h, i) => <i key={i} style={{ height: `${h}%`, ["--i" as string]: i } as CSSProperties} />)}
              </span>
              <span className="dd-google-go">See Google data <span aria-hidden="true">→</span></span>
            </Link>
          )}
          <Link href="/tools" className="dd-tools">
            <span className="dd-tools-n">{tools}</span>
            <span>
              <b>Free tools</b>
              <small>Generators and checkers, free with an account</small>
            </span>
            <span aria-hidden="true" className="dd-tools-go">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
