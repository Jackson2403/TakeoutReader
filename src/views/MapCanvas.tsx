import { cluster, type Cluster, type Point } from '../geo/projection';

export const VIEW_W = 940;
export const VIEW_H = 520;
export const BASE_ZOOM = 3;

function radius(n: number): number {
  return 14 + 8 * Math.log2(n + 1);
}

interface Props {
  points: Point[];
  zoom: number;
  center: { x: number; y: number };
  onSelect: (p: Point) => void;
}

/** SVG world map viewport: graticule + clustered markers, pan/zoom-driven. */
export default function MapCanvas({ points, zoom, center, onSelect }: Props) {
  const clusters: Cluster[] = cluster(points, zoom);
  const scale = (2 ** zoom / 2 ** BASE_ZOOM) * 120;
  const toScreen = (tx: number, ty: number) => ({
    x: (tx - center.x) * scale + VIEW_W / 2,
    y: (ty - center.y) * scale + VIEW_H / 2,
  });

  return (
    <svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      {/* Graticule grid */}
      {Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        const s = toScreen(t, 0);
        return (
          <line key={`v${i}`} x1={s.x} y1={0} x2={s.x} y2={VIEW_H} stroke="#1e293b" strokeWidth={0.5} />
        );
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const t = i / 7;
        const s = toScreen(0, t);
        return (
          <line key={`h${i}`} x1={0} y1={s.y} x2={VIEW_W} y2={s.y} stroke="#1e293b" strokeWidth={0.5} />
        );
      })}

      {clusters.map((c) => {
        const s = toScreen(c.x, c.y);
        if (s.x < -60 || s.x > VIEW_W + 60 || s.y < -60 || s.y > VIEW_H + 60) return null;
        if (c.n === 1) {
          const p = c.points[0];
          return (
            <g key={p.recordId} transform={`translate(${s.x},${s.y})`} className="cursor-pointer" onClick={() => onSelect(p)}>
              <circle r={5} fill="#38bdf8" stroke="#0b1120" strokeWidth={2} />
              <title>{p.title}</title>
            </g>
          );
        }
        const r = radius(c.n);
        return (
          <g
            key={`${c.x.toFixed(4)}|${c.y.toFixed(4)}`}
            transform={`translate(${s.x},${s.y})`}
            className="cursor-pointer"
            onClick={() => onSelect(c.points[0])}
          >
            <circle r={r} fill="#0e7490" opacity={0.85} stroke="#38bdf8" strokeWidth={1.5} />
            <text textAnchor="middle" dy={3} fontSize={11} fill="white" fontWeight={600}>
              {c.n}
            </text>
            <title>{`${c.points.length} records nearby`}</title>
          </g>
        );
      })}
    </svg>
  );
}