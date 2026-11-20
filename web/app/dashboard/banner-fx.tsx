/* Decoration behind every animated banner: drifting light, a faint grid and twinkling sparks. Shared by the
   dashboard's banners and the Google data AI button and window. */
const SPARKS = [[8, 22], [18, 78], [34, 12], [52, 70], [66, 18], [78, 84], [90, 30], [96, 66]];

export function BannerFx({ sparks = SPARKS.length }: { sparks?: number }) {
  return (
    <span className="bn-fx" aria-hidden="true">
      <i className="bn-orb o1" />
      <i className="bn-orb o2" />
      <i className="bn-orb o3" />
      <i className="bn-grid" />
      <i className="bn-sweep" />
      {SPARKS.slice(0, sparks).map(([x, y], k) => <i key={k} className="bn-sp" style={{ left: `${x}%`, top: `${y}%`, ["--k" as string]: k }} />)}
    </span>
  );
}
