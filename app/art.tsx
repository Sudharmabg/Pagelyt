import { BANDS } from "./bands";

export { BANDS };
export { Arcs } from "./arcs";

/* A bowl of ribbons for the top of the footer. */
export function BowlArcs() {
  return (
    <svg className="bowl" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
      {BANDS.map((c, i) => (
        <path
          key={c}
          className="arc"
          pathLength={1}
          stroke={c}
          style={{ ["--i" as string]: i }}
          d={`M -100 ${-30 + i * 30} Q 720 ${360 + i * 24} 1540 ${-30 + i * 30}`}
        />
      ))}
    </svg>
  );
}

const DOTS: [number, number, string][] = [
  [330, 70, "#68cea7"],
  [420, 130, "#FFFFFF"],
  [370, 200, "#febc77"],
  [470, 90, "#fe79a2"],
  [450, 250, "#d3b6ff"],
  [520, 330, "#68cea7"],
  [380, 340, "#FFFFFF"],
  [470, 400, "#febc77"],
  [560, 160, "#fe79a2"],
  [330, 410, "#d3b6ff"],
  [540, 60, "#FFFFFF"],
  [610, 270, "#68cea7"],
];

/* Scattered tools flowing through a funnel into one clear answer. */
export function Funnel() {
  return (
    <div className="funnel" role="img" aria-label="Scattered findings flowing through a funnel into clear answers">
      <svg viewBox="0 0 1200 460" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 0 H400 C520 0 540 190 640 190 H770 V270 H640 C540 270 520 460 400 460 H0 Z"
          fill="#0F2B3A"
        />
        {DOTS.map(([x, y, c], i) => (
          <circle
            key={i}
            className="dot"
            cx={x}
            cy={y}
            r={i % 3 === 0 ? 11 : 7}
            fill={c}
            style={{ ["--tx" as string]: `${700 - x}px`, ["--ty" as string]: `${230 - y}px`, ["--i" as string]: i }}
          />
        ))}
      </svg>
      <p className="f-left">Audits give you numbers.</p>
      <p className="f-right">You needed answers.</p>
    </div>
  );
}

/* Soft drifting clouds for the sky section. */
export function Clouds() {
  return (
    <>
      <svg className="cloud c1" viewBox="0 0 220 90" aria-hidden="true">
        <path d="M30 84h160a30 30 0 0 0 4-60 44 44 0 0 0-84-8 36 36 0 0 0-80 28 22 22 0 0 0 0 40z" fill="#fff" />
      </svg>
      <svg className="cloud c2" viewBox="0 0 220 90" aria-hidden="true">
        <path d="M30 84h160a30 30 0 0 0 4-60 44 44 0 0 0-84-8 36 36 0 0 0-80 28 22 22 0 0 0 0 40z" fill="#fff" />
      </svg>
    </>
  );
}
