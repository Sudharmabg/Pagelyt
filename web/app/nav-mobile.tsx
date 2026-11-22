"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSignedInUser } from "@/lib/use-signed-in";
import { SignInLink } from "@/app/sign-in-modal";
import { FeatureIcon, type MenuFeature } from "./features-menu";
import { NEW_FEATURES } from "./feature-icons";

type Item = { name: string; href: string };

export function NavMobile({ features, tools, links }: { features: MenuFeature[]; tools: number; links: Item[] }) {
  const [open, setOpen] = useState(false);
  const [feat, setFeat] = useState(false);
  const path = usePathname();
  const user = useSignedInUser();

  // Close the menu when the page changes (adjusting state while rendering, as React recommends).
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    setSeenPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="nav-mob">
      <button
        type="button"
        className="nav-burger"
        aria-expanded={open}
        aria-controls="nav-mob-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {open && (
        <nav id="nav-mob-panel" className="nav-mob-panel" aria-label="Mobile">
          {user ? (
            <Link className="nm-who" href="/account">
              <span className="acct-av" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
              <span>
                <b>{user.name}</b>
                <small>Signed in as {user.email}</small>
              </span>
            </Link>
          ) : null}
          {user ? (
            // Signed in: the dashboard comes first, since the header hides its button on the narrowest phones.
            <Link className="btn sm nm-dash" href="/dashboard">
              Go to dashboard
            </Link>
          ) : (
            <SignInLink className="btn outline nm-signin" onClick={() => setOpen(false)}>
              Sign in
            </SignInLink>
          )}
          <button type="button" className="nm-acc" aria-expanded={feat} aria-controls="nm-feat" onClick={() => setFeat((v) => !v)}>
            Features
            <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {feat && (
            <div className="nm-feat" id="nm-feat">
              {features.map((f) => (
                <Link key={f.slug} href={`/features/${f.slug}`} className="nm-fi">
                  <FeatureIcon slug={f.slug} />
                  <span>
                    <b>
                      {f.name}
                      {NEW_FEATURES.has(f.slug) && <span className="dd-new">New</span>}
                    </b>
                    <small>{f.short}</small>
                  </span>
                </Link>
              ))}
              <div className="nm-feat-foot">
                <Link href="/features">All features →</Link>
                <Link href="/tools">{tools} free tools →</Link>
              </div>
            </div>
          )}
          <hr />
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.name}
            </Link>
          ))}
          {!user && (
            <Link className="btn sm" href="/">
              Analyse a website
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
