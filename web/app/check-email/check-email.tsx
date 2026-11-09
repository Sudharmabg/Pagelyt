"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { claimAndFindReport, forgetVerifyEmail, useVerifyEmail } from "@/lib/pending";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { CodeForm } from "../code-form";

/* For a new account that hasn't entered its email code yet (reached from older links; the scan flow now asks for
   the code on the locked dashboard). Moves on by itself once this browser is signed in. */
export function CheckEmail() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const email = useVerifyEmail();

  const go = async () => {
    if (!sb) return;
    const id = await claimAndFindReport(sb);
    forgetVerifyEmail();
    router.replace(id ? `/dashboard/${id}` : "/account");
  };

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => data.session && void go());
  }, [sb]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="panel auth-card auth-code">
      <h2>Enter your 6-digit code</h2>
      <p className="panel-note">
        We emailed a code to {email ? <strong>{email}</strong> : "the address you signed up with"}. Enter it to confirm your email and open your report. You only need to do this once.
      </p>
      <CodeForm email={email} onVerified={go} />
    </div>
  );
}
