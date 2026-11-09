import type { ModuleKey } from "@/lib/scan/types";

/* One simple outline icon per area. Decorative: the label next to each is the accessible name. */
const P: Record<ModuleKey, React.ReactNode> = {
  health: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  performance: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4-5" />
    </>
  ),
  seo: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  geo: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="m12 8 1.4 2.6L16 12l-2.6 1.4L12 16l-1.4-2.6L8 12l2.6-1.4z" />
    </>
  ),
  security: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />,
  accessibility: (
    <>
      <circle cx="12" cy="5" r="1.8" />
      <path d="M5 9h14M12 9v5m0 0-3 6m3-6 3 6" />
    </>
  ),
  domain: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  privacy: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};

/* Icons for the dashboard's other sections (overview, insights and the "Grow" tools). */
const X = {
  overview: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  pages: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  images: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
    </>
  ),
  tech: (
    <>
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
      <path d="M8 7h.01M8 17h.01" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" />
      <path d="M4 4v4.6h4.6M12 8v4l3 2" />
    </>
  ),
  monitor: <path d="M6 4h12v17l-6-4-6 4z" />,
  ai: (
    <>
      <path d="M12 4 13.8 9.2 19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" />
      <path d="M19 3v3M17.5 4.5h3" />
    </>
  ),
  compare: <path d="M7 4v16M17 4v16M3 9h8M13 15h8" />,
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  tools: <path d="M14.5 5.5a4 4 0 0 0-5 5L4 16v4h4l5.5-5.5a4 4 0 0 0 5-5L16 12l-4-4z" />,
} satisfies Record<string, React.ReactNode>;

export type IconKey = ModuleKey | keyof typeof X;

export function AreaIcon({ k, size = 18 }: { k: IconKey; size?: number }) {
  return (
    <svg className="aico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {k in X ? X[k as keyof typeof X] : P[k as ModuleKey]}
    </svg>
  );
}
