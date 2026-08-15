import type { ArchiveRecord } from '../types';
import { defineParser, type Parser } from './types';
import { makeRecord, toEpochMs } from './common';

interface MyActivityRecord {
  header?: string;
  title: string;
  titleUrl?: string;
  time?: string;
  products?: string[];
  details?: string[];
  locationInfos?: { name?: string }[];
}

function parseActivity(fileName: string, text: string): { records: ArchiveRecord[]; summary: string } {
  // MyActivity files are often TRAILING-COMMA JSON (Google includes a leading
  // "[" then "]" hanging comma) and sometimes wrapped as { records: [...] }.
  // Use a tolerant parse that handles both.
  let data: unknown = null;
  const safe = text.replace(/,\s*\]\s*$/, ']').trim();
  try {
    data = JSON.parse(safe);
  } catch {
    // Strip leniently: split top-level commas between objects.
    const joined = '[' + safe
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      // Split between "}," and "{" boundaries.
      .replace(/\}\s*,\s*\{/g, '}\n{') + ']';
    data = joined
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));
  }

  // If it's a wrapped object with a "records" array, use that.
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const recs = (data as { records?: unknown }).records;
    if (Array.isArray(recs)) data = recs;
  }

  const arr = (Array.isArray(data) ? data : []) as MyActivityRecord[];
  const product = arr.find((r) => r.header && r.header.includes(':'))?.header?.split(':')[0] ?? 'Google';
  const records = arr
    .map((r): ArchiveRecord | null => {
      const title = r.title?.trim();
      const ts = toEpochMs(r.time);
      const loc = r.locationInfos?.[0]?.name;
      const subtitle = [r.products?.join(', '), loc].filter(Boolean).join(' · ') || undefined;
      return makeRecord('activity', 'activity', ts ?? undefined, title || 'Activity entry', {
        subtitle,
        url: r.titleUrl,
        text: r.details?.join(' '),
        payload: r,
        sourceFile: fileName,
      });
    })
    .filter((r): r is ArchiveRecord => Boolean(r));

  return { records, summary: `${records.length} activity entries (${product})` };
}

export const activityParser: Parser = defineParser({
  id: 'activity',
  label: 'My Activity',
  match: (path) => /My Activity/i.test(path),
  parse(fileName, text) {
    const { records, summary } = parseActivity(fileName, text);
    return { service: 'activity', type: 'activity', records, summary };
  },
});