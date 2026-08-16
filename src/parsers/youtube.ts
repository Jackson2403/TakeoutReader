import type { ParseResult } from '../types';
import { defineParser, type Parser } from './types';
import { makeRecord, toEpochMs } from './common';

interface ActivityEntry {
  header?: string;
  title: string;
  titleUrl?: string;
  time?: string;
  details?: string[];
  products?: string[];
  subtitles?: { name?: string; url?: string }[];
  locationInfos?: { name?: string }[];
}

function parseEntries(fileName: string, text: string): { records: ParseResult['records']; summary: string } {
  // Some YouTube history files are newline-delimited JSON objects (allows lazy loads).
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('{') && l.endsWith('}'));
    data = lines.map((l) => JSON.parse(l));
  }

  const entries: ActivityEntry[] = Array.isArray(data) ? (data as ActivityEntry[]) : [];
  const hasHeaders = entries.every((e) => typeof e.header === 'string');
  const type = hasHeaders ? 'activity' : 'watch';

  const records = entries
    .map((e) => {
      const title = (e.title ?? '').replace(/^(Watched|Searched for|Searched|Visited) /i, '');
      const ts = toEpochMs(e.time);
      const url = e.titleUrl;
      const subtitle = e.subtitles?.[0]?.name ?? e.details?.[0];
      return makeRecord('youtube', type, ts ?? undefined, title || subtitle || 'Untitled entry', {
        subtitle,
        url,
        text: e.details?.join(' '),
        payload: e,
        sourceFile: fileName,
        // The first subtitle is typically the channel / channel name in YouTube history.
        facets: { channel: e.subtitles?.[0]?.name || undefined },
      });
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return { records, summary: `${records.length} ${type} entries` };
}

export const youtubeParser: Parser = defineParser({
  id: 'youtube',
  label: 'YouTube',
  match: (path) =>
    /youtube\b/i.test(path) ||
    /\bhistory\/(watch|search)-history\.json$/i.test(path),
  parse(fileName, text) {
    const { records, summary } = parseEntries(fileName, text);
    return { service: 'youtube', type: 'activity', records, summary };
  },
});