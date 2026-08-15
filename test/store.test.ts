import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';

beforeEach(async () => {
  // Reset the Dexie DB between tests.
  const { db } = await import('../src/store/db');
  await db.delete().then(() => db.open());
});

test('persists records to Dexie and can query by service and timestamp', async () => {
  const { db } = await import('../src/store/db');
  await db.records.bulkPut([
    { id: 'a', service: 'youtube', type: 'watch', timestamp: 1000, title: 'Cat video', payload: {}, sourceFile: 'x.json' },
    { id: 'b', service: 'location', type: 'visit', timestamp: 2000, title: 'Cafe', payload: {}, sourceFile: 'y.json' },
  ]);
  const youtube = await db.records.where('service').equals('youtube').toArray();
  assert.equal(youtube.length, 1);
  assert.equal(youtube[0].title, 'Cat video');

  const ordered = await db.records.orderBy('timestamp').reverse().toArray();
  assert.equal(ordered[0].id, 'b');
});

test('rebuilds MiniSearch index from stored records and finds hits', async (t) => {
  const { db } = await import('../src/store/db');
  await db.records.bulkPut([
    { id: 'a', service: 'youtube', type: 'watch', timestamp: 1000, title: 'How to make pasta', subtitle: 'Chef', payload: {}, sourceFile: 'w.json' },
    { id: 'b', service: 'youtube', type: 'watch', timestamp: 2000, title: 'Despacito', payload: {}, sourceFile: 'w.json' },
  ]);
  const { ingestManager } = await import('../src/store/ingest');
  await ingestManager.rebuildSearchIndex();
  const { searchIndex } = await import('../src/store/search');
  const hits = searchIndex.search('pasta');
  assert.ok(hits.length >= 1);
  assert.match(hits[0].title, /pasta/i);
  // Prefix search works for partial words.
  const prefixHits = searchIndex.search('past');
  assert.ok(prefixHits.length >= 1);
});

test('clearAll wipes records and sessions', async () => {
  const { db, clearAll } = await import('../src/store/db');
  await db.records.bulkPut([
    { id: 'a', service: 'youtube', type: 'watch', timestamp: 1, title: 'X', payload: {}, sourceFile: 'w.json' },
  ]);
  await db.sessions.put({ name: 'takeout.zip', createdAt: Date.now(), fileCount: 1, recordCount: 1, services: ['youtube'] });
  await clearAll();
  assert.equal(await db.records.count(), 0);
  assert.equal(await db.sessions.count(), 0);
});

test('fingerprints table dedupes identical file content', async () => {
  const { db } = await import('../src/store/db');
  const { fnv1a } = await import('../src/store/hash');
  const text = JSON.stringify([{ title: 'Watched X', time: '2020/01/01 00:00:00 UTC' }]);
  const h = fnv1a(text);

  // Simulate ingest dedup: first write marks the fingerprint, second is skipped.
  assert.equal(await db.fingerprints.get(h), undefined);
  await db.fingerprints.put({ hash: h, path: 'watch-history.json' });
  assert.equal((await db.fingerprints.get(h))?.path, 'watch-history.json');

  // A different file yields a different hash.
  const h2 = fnv1a(text + '!');
  assert.notEqual(h, h2);
  assert.equal(await db.fingerprints.get(h2), undefined);
});