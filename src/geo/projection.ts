import type { ArchiveRecord } from '../types';

export interface Point {
  recordId: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  ts: number;
}

/** Web-Mercator projection to tile-style pixel coords at a given zoom. */
export function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  return { x, y };
}

/** All geo-tagged records as normalized points. */
export function collectPoints(records: ArchiveRecord[]): Point[] {
  const pts: Point[] = [];
  for (const r of records) {
    if (r.lat == null || r.lng == null || Number.isNaN(r.lat) || Number.isNaN(r.lng)) continue;
    if (r.lat < -85 || r.lat > 85) continue; // web-mercator bounds
    pts.push({
      recordId: r.id,
      lat: r.lat,
      lng: r.lng,
      title: r.title,
      subtitle: r.subtitle,
      ts: r.timestamp,
    });
  }
  return pts;
}

export interface Cluster {
  x: number;
  y: number;
  /** Screen-space pixel coords (computed later). */
  n: number;
  points: Point[];
  lat: number;
  lng: number;
}

/**
 * Grid-cluster points at a given zoom. Returns clusters whose screen position
 * (x,y in tile space) and aggregated count are computed. Points within the same
 * grid cell collapse into one cluster; a cluster with a single point is a marker.
 */
export function cluster(points: Point[], zoom: number, gridTiles = 1 / 4): Cluster[] {
  const cell = gridTiles; // grid cell width in tile units
  const buckets = new Map<string, Cluster>();
  for (const p of points) {
    const { x, y } = project(p.lat, p.lng, zoom);
    // Snap to a grid cell.
    const gx = Math.round(x / cell);
    const gy = Math.round(y / cell);
    const key = `${gx}:${gy}`;
    let c = buckets.get(key);
    if (!c) {
      c = { x: 0, y: 0, n: 0, points: [], lat: p.lat, lng: p.lng };
      buckets.set(key, c);
    }
    c.n += 1;
    c.points.push(p);
    // Running average of tile coords for the cluster center.
    c.x = c.x + (x - c.x) / c.n;
    c.y = c.y + (y - c.y) / c.n;
  }
  return [...buckets.values()];
}