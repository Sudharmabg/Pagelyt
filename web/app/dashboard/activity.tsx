"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { StoredScan } from "@/lib/scan/store";
import type { Snap } from "./panels";

/* The bell in the dashboard header: what happened to this site, newest first, built from the saved scans
   (score up or down, issues resolved, new important issues) and the homepage change check. Events newer than
   the last time the bell was opened on this device get an unread dot; opening it marks them read. */

type Ev = { id: string; at: string; tone: "up" | "down" | "info" | "alert"; title: string; text: string };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function events(scan: StoredScan, snaps: Snap[]): Ev[] {
  const list = [...snaps].sort((a, b) => (a.at < b.at ? -1 : 1));
  const out: Ev[] = [];
  list.forEach((s, i) => {
    const p = list[i - 1];
    if (!p) {
      out.push({ id: `first-${s.id}`, at: s.at, tone: "info", title: "First scan saved", text: `Starting score ${s.overall}.` });
      return;
    }
    const d = s.overall - p.overall;
    const now = new Set(s.keys ?? []);
    const resolved = (p.keys ?? []).filter((k) => !now.has(k)).length;
    if (d !== 0) out.push({ id: `score-${s.id}`, at: s.at, tone: d > 0 ? "up" : "down", title: d > 0 ? `Score up ${d} point${d === 1 ? "" : "s"}` : `Score down ${-d} point${d === -1 ? "" : "s"}`, text: `${p.overall} → ${s.overall}${resolved ? `, ${resolved} issue${resolved === 1 ? "" : "s"} resolved` : ""}.` });
    else if (resolved) out.push({ id: `res-${s.id}`, at: s.at, tone: "up", title: `${resolved} issue${resolved === 1 ? "" : "s"} resolved`, text: `Score held at ${s.overall}.` });
    const before = new Set(p.highs ?? []);
    const fresh = (s.highs ?? []).filter((k) => !before.has(k)).length;
    if (p.highs && fresh) out.push({ id: `high-${s.id}`, at: s.at, tone: "alert", title: `${fresh} new important issue${fresh === 1 ? "" : "s"}`, text: "Found in this scan. They are at the top of the list." });
  });
  const c = scan.change;
  if (c && ((c.visual ?? 0) >= 20 || (c.text ?? 0) >= 40 || c.title)) {
    out.push({ id: `chg-${scan.id}`, at: scan.scannedAt, tone: (c.visual ?? 0) >= 35 || c.title ? "alert" : "info", title: "Homepage changed", text: c.title ? `New title: “${c.title.to}”.` : `It looks ${c.visual ?? c.text}% different from ${date(c.prevAt)}.` });
  }
  if (!out.some((e) => e.at === scan.scannedAt)) {
    const high = scan.findings.filter((f) => f.severity === "high").length;
    out.push({ id: `scan-${scan.id}`, at: scan.scannedAt, tone: "info", title: "Scan finished", text: `${scan.findings.length} finding${scan.findings.length === 1 ? "" : "s"}${high ? `, ${high} important` : ""}.` });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);
}

const SEEN = "pagelyt-seen";

export function ActivityBell({ scan, snaps }: { scan: StoredScan; snaps: Snap[] }) {
  const key = `${SEEN}-${scan.host}`;
  const [open, setOpen] = useState(false);
  // What counted as read when the panel opened, so the new items keep their dot while it is open.
  const [was, setWas] = useState("");
  // The header's button row scrolls sideways, so the panel is fixed to the screen under the bell.
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const box = useRef<HTMLDivElement>(null);
  const list = useMemo(() => events(scan, snaps), [scan, snaps]);

  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(SEEN, cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener(SEEN, cb);
    };
  }, []);
  const seen = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    },
    () => "~" // on the server nothing counts as unread
  );
  const unread = list.filter((e) => e.at > seen).length;

  const markRead = () => {
    const latest = list[0]?.at;
    if (!latest || latest <= seen) return;
    try {
      window.localStorage.setItem(key, latest);
      window.dispatchEvent(new Event(SEEN));
    } catch {
      /* storage blocked: the dots stay */
    }
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      box.current?.querySelector<HTMLButtonElement>(".bell")?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="bell-wrap" ref={box}>
      <button
        type="button"
        className={`dash-btn bell${unread ? " has" : ""}`}
        aria-expanded={open}
        aria-controls="bell-pop"
        aria-label={unread ? `Activity, ${unread} new` : "Activity"}
        onClick={(e) => {
          if (!open) {
            const r = e.currentTarget.getBoundingClientRect();
            setPos({ top: r.bottom + 10, right: Math.max(16, window.innerWidth - r.right) });
            setWas(seen);
            markRead();
          }
          setOpen((o) => !o);
        }}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <b className="bell-n" key={unread}>{unread}</b>}
      </button>
      {open && (
        <div className="bell-pop" id="bell-pop" role="region" aria-label="Activity" style={{ top: pos.top, right: pos.right }}>
          <div className="bell-head">
            <strong>Activity</strong>
            <span className="bell-sub">{list.filter((e) => e.at > was).length || "No"} new</span>
          </div>
          <ol className="bell-list">
            {list.map((e, i) => (
              <li key={e.id} className={`bev t-${e.tone}${e.at > was ? " new" : ""}`} style={{ ["--k" as string]: i }}>
                <span className="bev-ic" aria-hidden="true">{e.tone === "up" ? "↑" : e.tone === "down" ? "↓" : e.tone === "alert" ? "!" : "•"}</span>
                <div>
                  <p className="bev-t">{e.title}{e.at > was && <span className="sr-only"> (new)</span>}</p>
                  <p className="bev-x">{e.text}</p>
                </div>
                <time dateTime={e.at}>{date(e.at)}</time>
              </li>
            ))}
          </ol>
          <p className="bell-foot">{snaps.length > 1 ? "From your saved scans of this site." : "Rescan this site to build its history."}</p>
        </div>
      )}
    </div>
  );
}
