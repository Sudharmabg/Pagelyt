import { ImageResponse } from "next/og";

/* Shared Open Graph card (1200×630) for feature, tool and blog pages: a coloured band, the page kind, the title and
   one line of summary, with the Pagelyt name. Rendered by next/og at build time; no external fonts or images. */

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({ kind, title, sub, color = "#7a3fd0" }: { kind: string; title: string; sub: string; color?: string }) {
  const t = title.length > 70 ? `${title.slice(0, 67).trimEnd()}…` : title;
  const s = sub.length > 130 ? `${sub.slice(0, 127).trimEnd()}…` : sub;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fbf8ff", fontFamily: "sans-serif" }}>
        <div style={{ height: 18, width: "100%", background: color, display: "flex" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "64px 80px 56px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex" }}>
              <span style={{ fontSize: 26, fontWeight: 700, color, background: "#ffffff", border: `2px solid ${color}`, borderRadius: 999, padding: "8px 22px", textTransform: "uppercase", letterSpacing: 2 }}>
                {kind}
              </span>
            </div>
            <div style={{ marginTop: 36, fontSize: t.length > 44 ? 62 : 74, fontWeight: 800, color: "#1d1020", lineHeight: 1.08, letterSpacing: -1.5 }}>{t}</div>
            <div style={{ marginTop: 26, fontSize: 30, color: "#5c4752", lineHeight: 1.4 }}>{s}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#7a3fd0", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 800 }}>P</div>
              <span style={{ marginLeft: 16, fontSize: 34, fontWeight: 800, color: "#1d1020" }}>Pagelyt</span>
            </div>
            <span style={{ fontSize: 26, color: "#7a3fd0", fontWeight: 700 }}>pagelyt.dev</span>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
