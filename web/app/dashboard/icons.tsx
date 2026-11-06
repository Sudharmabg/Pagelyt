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

export function AreaIcon({ k, size = 18 }: { k: ModuleKey; size?: number }) {
  return (
    <svg className="aico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[k]}
    </svg>
  );
}
