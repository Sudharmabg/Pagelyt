"use client";

import { LoaderBlock } from "@/components/avara/LoaderBlock";

/** Full-area wait (signed-in pages, opening the dashboard): the Avara orbit loader with a line of text. */
export function PageLoader({ text }: { text: string }) {
  return (
    <div className="dash-loading" role="status" aria-live="polite">
      <LoaderBlock variant="orbit" size="lg" text={text} />
    </div>
  );
}
