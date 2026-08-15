import type { ArchiveRecord } from '../types';

export interface RankedItem {
  key: string;
  count: number;
  value?: number;
}

export interface HourCell {
  hour: number;
  day: number;
  count: number;
}

export interface MonthBucket {
  key: string; // YYYY-MM
  label: string;
  count: number;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Rank a list of records by a facet key, returning top N with counts. */
export function topByFacet(
  records: ArchiveRecord[],
  facet: 'channel' | 'place',
  n = 10
): RankedItem[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = r.facets?.[facet];
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, n);
}

/** Distribution of records across the 24-hour day (local time). */
export function hourlyHeatmap(records: ArchiveRecord[]): HourCell[] {
  const cells = new Map<string, HourCell>();
  for (const r of records) {
    if (!r.timestamp) continue;
    const d = new Date(r.timestamp);
    const key = `${d.getDay()}:${d.getHours()}`;
    const cur = cells.get(key) ?? { hour: d.getHours(), day: d.getDay(), count: 0 };
    cur.count += 1;
    cells.set(key, cur);
  }
  return [...cells.values()];
}

/** Monthly activity series ordered chronologically. */
export function monthlySeries(records: ArchiveRecord[]): MonthBucket[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (!r.timestamp) continue;
    const d = new Date(r.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => {
      const [, m] = key.split('-').map(Number);
      return { key, label: `${MONTH_LABELS[m - 1]} ${key.slice(0, 4)}`, count };
    });
}

/** Records grouped into a sorted array of { yyyy-mm-dd, count }. */
export function byDay(records: ArchiveRecord[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (!r.timestamp) continue;
    const key = dayKey(r.timestamp);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}