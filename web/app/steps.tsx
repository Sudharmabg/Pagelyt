import { FLOW } from "./features-data";
import { Ring, Spark } from "./ui";

const NUM_COLOURS = ["#6a30bd", "#1a6b4c", "#a35a0c", "#b8244f"];

const Mini = [
  () => (
    <div className="mini">
      <span className="mini-url">https://yourwebsite.com</span>
      <span className="pill info">42 pages found</span>
    </div>
  ),
  () => (
    <div className="mini six">
      {[92, 74, 82, 68, 61, 87].map((v, i) => (
        <Ring key={i} v={v} size={34} stroke={4} />
      ))}
    </div>
  ),
  () => (
    <div className="mini col">
      <span className="pill bad">High priority</span>
      <span className="mini-line">Add security headers</span>
      <span className="pill lime">+6 points</span>
    </div>
  ),
  () => (
    <div className="mini col">
      <Spark data={[62, 64, 63, 68, 71, 70, 76, 82]} height={46} />
      <span className="pill good">+11 since last scan</span>
    </div>
  ),
];

/* Compact four-step flow for the homepage: cards on a gentle wave joined by a flowing line. */
export function HowFlow() {
  return (
    <div className="flow">
      <svg className="flow-line" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 40 C 150 40, 160 120, 300 120 S 450 40, 600 40 S 750 120, 900 120 S 1050 40, 1200 40" />
      </svg>
      <ol>
        {FLOW.map((s, i) => {
          const M = Mini[i];
          return (
            <li className={`fstep f${i}`} key={s.k}>
              <span className="fnum" style={{ color: NUM_COLOURS[i] }} aria-hidden="true">
                0{i + 1}
              </span>
              <h3>{s.k}</h3>
              <p>{s.d}</p>
              <M />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
