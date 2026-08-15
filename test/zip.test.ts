import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8, Unzip, UnzipInflate } from 'fflate';

/**
 * Builds a realistic Google-Takeout-shaped zip in memory and verifies that the
 * listing + extraction logic the worker uses routes to the right result.
 */
function makeTakeoutZip(): Uint8Array {
  const files: Record<string, string> = {
    'Takeout/YouTube/history/watch-history.json': JSON.stringify([
      { header: 'YouTube', title: 'Watched a tutorial', time: '2023/01/01 12:00:00 UTC' },
    ]),
    'Takeout/Location History/Location History/Records.json': JSON.stringify([
      { latitudeE7: 123456780, longitudeE7: -987654320, timestampMs: '1672550000000', source: 'GPS' },
    ]),
    'Takeout/My Activity/Chrome/MyActivity.json': `[
      { "title": "Visited wikipedia", "time": "2023/01/02 09:00:00 UTC", "products": ["Chrome"] },
    ]`,
    'Takeout/Archive.html': '<html>metadata ignored</html>',
    'settings.xml': '<xml/>',
  };
  const encoded = Object.fromEntries(
    Object.entries(files).map(([name, content]) => [name, strToU8(content)])
  );
  return zipSync(encoded, { level: 6 });
}

test('zip listing + extraction yields expected importable files', async () => {
  const bytes = makeTakeoutZip();

  // Simulate the zip worker's listEntries step.
  const entries: { name: string; originalSize: number }[] = [];
  await new Promise<void>((resolve) => {
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (f) => entries.push({ name: f.name, originalSize: f.originalSize ?? 0 });
    unzip.push(bytes, true);
    resolve();
  });

  const names = entries.map((e) => e.name);
  assert.ok(names.includes('Takeout/YouTube/history/watch-history.json'));
  assert.ok(names.includes('Takeout/Archive.html'));

  // Filter to importable (JSON) like ingest does.
  const importable = entries.filter((e) => /\.json$/i.test(e.name)).map((e) => e.name);
  assert.equal(importable.length, 3);

  // Extract one entry (like the worker's extractOne).
  const want = 'Takeout/YouTube/history/watch-history.json';
  const text = await new Promise<string>((resolve, reject) => {
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    let chunks: Uint8Array[] = [];
    unzip.onfile = (f) => {
      if (f.name !== want) return;
      f.ondata = (err, dat, final) => {
        if (err) return reject(err);
        if (dat) chunks.push(dat.slice());
        if (final) {
          const buf = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
          let o = 0;
          for (const c of chunks) buf.set(c, o), (o += c.length);
          resolve(new TextDecoder().decode(buf));
        }
      };
      f.start();
    };
    unzip.push(bytes, true);
  });
  const parsed = JSON.parse(text);
  assert.equal(parsed[0].title, 'Watched a tutorial');
});