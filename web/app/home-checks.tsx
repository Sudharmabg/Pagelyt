"use client";

import Link from "next/link";
import { Activity, Bot, ChartLine, Gauge, Lightbulb, Plug, ShieldCheck, Swords } from "lucide-react";
import type { ElementType } from "react";
import { VerticalTabs } from "@/components/avara/VerticalTabs";
import { FEATURES } from "./features-data";

const ICONS: Record<string, ElementType> = {
  "website-health": Activity,
  performance: Gauge,
  "seo-geo": Bot,
  "security-accessibility": ShieldCheck,
  "competitor-intelligence": Swords,
  "ai-recommendations": Lightbulb,
  "monitoring-reports": ChartLine,
  "google-integrations": Plug,
};

/** Homepage "What Pagelyt checks": one vertical tab per feature, listing what it checks (from features-data). */
export function HomeChecks() {
  const tabs = FEATURES.filter((f) => ICONS[f.slug]).map((f) => ({
    id: f.slug,
    label: f.name,
    icon: ICONS[f.slug],
    content: (
      <div className="hc-pane">
        <p className="hc-lead">{f.lead}</p>
        <ul className="hc-list">
          {f.checks.map((c) => (
            <li key={c}>
              <span aria-hidden="true">✓</span>
              {c}
            </li>
          ))}
        </ul>
        <Link className="hc-more" href={`/features/${f.slug}`}>
          More on {f.name} <span aria-hidden="true">→</span>
        </Link>
      </div>
    ),
  }));
  return (
    <VerticalTabs
      tabs={tabs}
      orientation="vertical"
      variant="default"
      ariaLabel="What Pagelyt checks"
      className="home-checks"
      railClassName="md:w-64 lg:w-72"
      contentClassName="p-6 md:p-9"
    />
  );
}
