"use client";

import Link from "next/link";
import { useSignedIn } from "@/lib/use-signed-in";

/* The header's account button: an outlined "Sign in" for visitors, "Account" once signed in. */
export function AuthLink() {
  const signedIn = useSignedIn();
  return (
    <Link className="btn sm outline" href={signedIn ? "/account" : "/login"}>
      {signedIn ? "Account" : "Sign in"}
    </Link>
  );
}
