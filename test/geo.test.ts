import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, collectPoints, cluster } from '../src/geo/projection';

test('project maps geolocation into tile space consistently', () => {
  // The web-mercator origin (lat 0, lng 0) should be the tile-space center.
  const center = project(0, 0, 1);
  assert.ok(Math.abs(center.x - 1) < 1e-6);
  assert.ok(Math.abs(center.y - 1) < 1e-6);
  // Zooming increases resolution.
  const z0 = project(10, 20, 0);
  const z2 = project(10, 20, 2);
  assert.ok(z2.x > z0.x);
});

test('collectPoints keeps only valid geo records', () => {
  const rec = (id: string, lat?: number, lng?: number) => ({
    id,
    service: 'location' as const,
    type: 'visit' as const,
    timestamp: 0,
    title: id,
    payload: {},
    sourceFile: 'x',
    lat,
    lng,
  });
  const pts = collectPoints([
    rec('a', 1, 2),
    rec('b'), // no coords -> skipped
    rec('c', 90, 0), // out of bounds -> skipped
  ]);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].recordId, 'a');
});

test('cluster groups nearby points and holds single points apart', () => {
  const rec = (id: string, lat: number, lng: number) => ({
    id,
    service: 'location' as const,
    type: 'visit' as const,
    timestamp: 1,
    title: id,
    payload: {},
    sourceFile: 'x',
    lat,
    lng,
  });
  // Two very close points + one far away.
  const pts = collectPoints([
    rec('a', 10.0000001, 10.0000001),
    rec('b', 10.0000002, 10.0000002),
    rec('c', -30, -50),
  ]);
  const clusters = cluster(pts, 4);
  assert.equal(clusters.length, 2, 'expect two distinct clusters at this zoom');
  const multi = clusters.filter((c) => c.n > 1);
  assert.equal(multi.length, 1);
  assert.equal(multi[0].n, 2);
});