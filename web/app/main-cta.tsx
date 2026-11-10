"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSignedIn } from "@/lib/use-signed-in";
import { Arrow } from "./arrow";

/* The site's main call to action. Visitors are asked to analyse their website; signed-in people already have,
   so the same button takes them to their dashboard instead. */
export function MainCta({
  className = "btn",
  label = "Analyse My Website",
  signedLabel = "Go to dashboard",
  signedClassName,
  arrow = false,
}: {
  className?: string;
  label?: ReactNode;
  signedLabel?: ReactNode;
  /** Extra class on the signed-in version (the header keeps its Dashboard button on phones). */
  signedClassName?: string;
  arrow?: boolean;
}) {
  const signedIn = useSignedIn();
  return signedIn ? (
    <Link className={signedClassName ? `${className} ${signedClassName}` : className} href="/dashboard">
      {signedLabel}
      {arrow && <Arrow />}
    </Link>
  ) : (
    <Link className={className} href="/">
      {label}
      {arrow && <Arrow />}
    </Link>
  );
}
