"use client";

import { useSyncExternalStore } from "react";
import { BANDS } from "./bands";

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};


/* Three poses per ribbon. The curve morphs between them forever, each ribbon on its own timing. */
const pose = (i: number, k: 0 | 1 | 2) => {
  const a = 420 - i * 78;
  const b = 20 + i * 34;
  const e = 30 + i * 96;
  if (k === 0) return `M -160 460 C 280 ${a}, 940 ${b}, 1600 ${e}`;
  if (k === 1) return `M -160 420 C 380 ${a + 110}, 840 ${b - 100}, 1600 ${e + 80}`;
  return `M -160 505 C 180 ${a - 100}, 1040 ${b + 110}, 1600 ${e - 70}`;
};

/* A fan of ribbons that starts together on the left, opens out to the right, and keeps flowing. */
export function Arcs({ flip = false, soft = false }: { flip?: boolean; soft?: boolean }) {
  // Follows the visitor's reduced-motion setting, live; the server render assumes motion is fine.
  const still = useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCE).matches, () => false);

  return (
    <svg
      className={`arcs${flip ? " flip" : ""}${soft ? " soft" : ""}`}
      viewBox="0 0 1440 460"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
    >
      {BANDS.map((c, i) => (
        <path
          key={c}
          className="arc"
          pathLength={1}
          stroke={c}
          style={{ ["--i" as string]: i }}
          d={pose(i, 0)}
        >
          {!still && (
            <animate
              attributeName="d"
              dur={`${3.4 + i * 0.7}s`}
              begin={`${-i * 0.9}s`}
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.33;0.66;1"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
              values={`${pose(i, 0)};${pose(i, 1)};${pose(i, 2)};${pose(i, 0)}`}
            />
          )}
        </path>
      ))}
    </svg>
  );
}
