import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInsights,
  topByFacet,
  hourlyHeatmap,
  monthlySeries,
  byDay,
  longestStreak,
} from '../src/analytics';

function rec(id: string, ts: number, over: Record<string, unknown> = {}): any {
  return {
    id,
    service: 'activity',
    type: 'activity',
    timestamp: ts,
    title: `Title ${id}`,
    payload: {},
    sourceFile: 'x.json',
    ...over,
  };
}

// Fixed local "now" anchors. Use date-only values built from local time to avoid TZ flakiness.
function at(y: number, m: number, d: number, h = 12): number {
  return new Date(y, m - 1, d, h, 0, 0).getTime();
}

test('topByFacet ranks channels by count', () => {
  const records = [
    rec('1', at(2021, 1, 1), { facets: { channel: 'ChA' } }),
    rec('2', at(2021, 1, 2), { facets: { channel: 'ChA' } }),
    rec('3', at(2021, 1, 3), { facets: { channel: 'ChB' } }),
  ];
  const top = topByFacet(records, 'channel', 10);
  assert.equal(top[0].key, 'ChA');
  assert.equal(top[0].count, 2);
  assert.equal(top[1].key, 'ChB');
  assert.equal(top[1].count, 1);
});

test('hourlyHeatmap buckets by day + hour', () => {
  // Two records at the same hour but on different days of the week (Sun=0 vs Mon=1).
  const records = [rec('1', at(2021, 1, 3, 9)), rec('2', at(2021, 1, 4, 9))];
  const cells = hourlyHeatmap(records);
  const match = cells.find((c) => c.hour === 9 && c.count === 2);
  assert.ok(!match, 'expected separate day cells for Sun and Mon');
  const sun = cells.find((c) => c.day === 0 && c.hour === 9);
  const mon = cells.find((c) => c.day === 1 && c.hour === 9);
  assert.ok(sun && sun.count === 1, 'expected Sun hour-9 count 1');
  assert.ok(mon && mon.count === 1, 'expected Mon hour-9 count 1');
  assert.equal(cells.length, 2);
});

test('monthlySeries aggregates chronologically with labels', () => {
  const records = [
    rec('1', at(2021, 1, 5)),
    rec('2', at(2021, 1, 20)),
    rec('3', at(2021, 3, 4)),
  ];
  const m = monthlySeries(records);
  assert.equal(m.length, 2);
  assert.equal(m[0].key, '2021-01');
  assert.equal(m[0].count, 2);
  assert.equal(m[1].key, '2021-03');
  assert.ok(m[0].label.startsWith('Jan'));
});

test('byDay groups and sorts by date key', () => {
  const records = [rec('1', at(2021, 2, 2)), rec('2', at(2021, 1, 1)), rec('3', at(2021, 1, 1))];
  const days = byDay(records);
  assert.equal(days.length, 2);
  assert.equal(days[0].key, '2021-01-01');
  assert.equal(days[0].count, 2);
  assert.equal(days[1].key, '2021-02-02');
});

test('longestStreak finds consecutive-day run', () => {
  const records = [
    rec('1', at(2021, 1, 1)),
    rec('2', at(2021, 1, 2)),
    rec('3', at(2021, 1, 3)),
    rec('4', at(2021, 1, 10)),
    rec('5', at(2021, 1, 11)),
  ];
  const s = longestStreak(records);
  assert.ok(s);
  assert.equal(s.days, 3);
});

test('computeInsights assembles the full snapshot', () => {
  const records = [
    rec('1', at(2021, 1, 1, 8), { service: 'youtube', facets: { channel: 'ChA' } }),
    rec('2', at(2021, 1, 1, 8), { service: 'youtube', facets: { channel: 'ChA' } }),
    rec('3', at(2021, 1, 2, 8), { service: 'location', facets: { place: 'Cafe' } }),
  ];
  const ins = computeInsights(records);
  assert.equal(ins.totalRecords, 3);
  assert.equal(ins.byService.youtube, 2);
  assert.equal(ins.byService.location, 1);
  assert.equal(ins.topChannels[0].key, 'ChA');
  assert.equal(ins.topChannels[0].count, 2);
  assert.equal(ins.topPlaces[0].key, 'Cafe');
  assert.equal(ins.busiestHour, 8);
  assert.ok(ins.busiestDay);
  assert.equal(ins.busiestDay.count, 2);
  assert.ok(ins.longestStreak);
  assert.equal(ins.longestStreak.days, 2);
  assert.ok(ins.range.first && ins.range.last);
});

test('computeInsights empty input is safe', () => {
  const ins = computeInsights([]);
  assert.equal(ins.totalRecords, 0);
  assert.equal(ins.busiestDay, null);
  assert.equal(ins.busiestHour, null);
  assert.equal(ins.longestStreak, null);
  assert.equal(ins.topChannels.length, 0);
});