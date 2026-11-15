"use client";

import { toast } from "../toast";
import { CopyButton } from "@/components/avara/CopyButtonBlock";

/** The developer snippet on a fix guide, with a one-click copy button. */
export function CopyCode({ code }: { code: string }) {
  return (
    <div className="guide-codebox">
      <pre className="guide-code" tabIndex={0}>{code}</pre>
      <CopyButton value={code} size="sm" variant="ghost" className="guide-copy av-dark" onCopy={(_, ok) => ok && toast("Code copied")} />
    </div>
  );
}
