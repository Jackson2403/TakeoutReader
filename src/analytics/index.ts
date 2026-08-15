import type { ArchiveRecord, Service } from '../types';
import {
  topByFacet,
  hourlyHeatmap,
  monthlySeries,
  byDay,
  type RankedItem,
  type HourCell,
  type MonthBucket,
} from './aggregate';

export type { RankedItem, HourCell, MonthBucket };
export { DAY_LABELS, dayKey, topByFacet, hourlyHeatmap, monthlySeries, byDay } from './aggregate';

export interface Insights {
  totalRecords: number;
  byService: Partial<Record<Service, number>>;
  timeOfDay: { label: string; count: number }[];
  heatmap: HourCell[];
  monthly: MonthBucket[];
  topChannels: RankedItem[];
  topPlaces: RankedItem[];
  longestStreak: { days: number; start: Date; end: Date } | null;
  busiestDay: { date: string; count: number } | null;
  busiestHour: number | null;
  range: { first: Date | null; last: Date | null };
}

const TIME_PARTS = [
  { label: 'Early (12a–5a)', from: 0, to: 5 },
  { label: 'Morning (5a–9a)', from: 5, to: 9 },
  { label: 'Midday (9a–12p)', from: 9, to: 12 },
  { label: 'Afternoon (12p–5p)', from: 12, to: 17 },
  { label: 'Evening (5p–9p)', from: 17, to: 21 },
  { label: 'Night (9p–12a)', from: 21, to: 24 },
];

function timeOfDay(records: ArchiveRecord[]): { label: string; count: number }[] {
  const counts = TIME_PARTS.map((p) => ({ label: p.label, count: 0 }));
  for (const r of records) {
    if (!r.timestamp) continue;
    const h = new Date(r.timestamp).getHours();
    const idx = TIME_PARTS.findIndex((p) => h >= p.from && h < p.to);
    if (idx > -1) counts[idx].count += 1;
  }
  return counts;
}

export function longestStreak(records: ArchiveRecord[]): Insights['longestStreak'] {
  const dates = byDay(records).map((d) => new Date(d.key + 'T00:00:00').getTime());
  if (dates.length === 0) return null;
  const MS = 86400000;
  let best = 1;
  let bestStart = dates[0];
  let bestEnd = dates[0];
  let cur = 1;
  let curStart = dates[0];
  let curEnd = dates[0];
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] - dates[i - 1] === MS) {
      cur += 1;
      curEnd = dates[i];
    } else {
      cur = 1;
      curStart = dates[i];
      curEnd = dates[i];
    }
    if (cur > best) {
      best = cur;
      bestStart = curStart;
      bestEnd = curEnd;
    }
  }
  return { days: best, start: new Date(bestStart), end: new Date(bestEnd) };
}

function busiestDay(records: ArchiveRecord[]): Insights['busiestDay'] {
  const days = byDay(records);
  if (days.length === 0) return null;
  const top = days.reduce((a, b) => (b.count > a.count ? b : a));
  return { date: top.key, count: top.count };
}

function busiestHour(records: ArchiveRecord[]): number | null {
  const hours = new Map<number, number>();
  for (const r of records) {
    if (!r.timestamp) continue;
    const h = new Date(r.timestamp).getHours();
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = -1;
  for (const [hour, count] of hours) {
    if (count > bestCount) {
      best = hour;
      bestCount = count;
    }
  }
  return best;
}

/** Compute the full insights snapshot for a set of records. */
export function computeInsights(records: ArchiveRecord[]): Insights {
  const byService: Partial<Record<Service, number>> = {};
  let first: number | null = null;
  let last: number | null = null;
  for (const r of records) {
    byService[r.service] = (byService[r.service] ?? 0) + 1;
    if (r.timestamp) {
      if (first === null || r.timestamp < first) first = r.timestamp;
      if (last === null || r.timestamp > last) last = r.timestamp;
    }
  }

  return {
    totalRecords: records.length,
    byService,
    timeOfDay: timeOfDay(records),
    heatmap: hourlyHeatmap(records),
    monthly: monthlySeries(records),
    topChannels: topByFacet(records, 'channel'),
    topPlaces: topByFacet(records, 'place'),
    longestStreak: longestStreak(records),
    busiestDay: busiestDay(records),
    busiestHour: busiestHour(records),
    range: {
      first: first !== null ? new Date(first) : null,
      last: last !== null ? new Date(last) : null,
    },
  };
}