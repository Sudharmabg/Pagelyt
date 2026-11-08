"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSignedIn } from "@/lib/use-signed-in";

type Item = { name: string; href: string };

export function NavMobile({ features, links }: { features: Item[]; links: Item[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const signedIn = useSignedIn();

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
          <Link className="btn outline nm-signin" href={signedIn ? "/account" : "/login"}>
            {signedIn ? "Account" : "Sign in"}
          </Link>
          <p className="nm-h">Features</p>
          {features.map((f) => (
            <Link key={f.href} href={f.href} className="nm-sub">
              {f.name}
            </Link>
          ))}
          <hr />
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.name}
            </Link>
          ))}
          <Link className="btn sm" href="/">
            Analyse a website
          </Link>
        </nav>
      )}
    </div>
  );
}
