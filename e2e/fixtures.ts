import { zipSync, strToU8 } from 'fflate';

/** Build a realistic Google-Takeout-shaped zip as a Node Buffer. */
export function makeTakeoutZip(): Buffer {
  const files: Record<string, string> = {
    'Takeout/YouTube/history/watch-history.json': JSON.stringify([
      { header: 'YouTube', title: 'Watched: A lovely cat video', time: '2023/05/01 12:00:00 UTC' },
      { header: 'YouTube', title: 'Watched: Intro to pasta making', time: '2023/05/02 09:00:00 UTC' },
    ]),
    'Takeout/Location History/Location History/Records.json': JSON.stringify([
      { latitudeE7: 37880490, longitudeE7: -122417300, timestampMs: '1683000000000', source: 'GPS' },
    ]),
    'Takeout/My Activity/Chrome/MyActivity.json': `[
      { "title": "Visited wikipedia.org", "time": "2023/05/03 10:00:00 UTC", "products": ["Chrome"] },
    ]`,
    'Takeout/Archive.html': '<html>ignored</html>',
  };
  const encoded = Object.fromEntries(
    Object.entries(files).map(([name, content]) => [name, strToU8(content)])
  );
  return Buffer.from(zipSync(encoded, { level: 6 }));
}

export const TAKE_OUT_ZIP = makeTakeoutZip();