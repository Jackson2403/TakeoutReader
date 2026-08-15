import { defineParser, type Parser } from './types';
import { makeRecord, toEpochMs } from './common';
import type { ArchiveRecord } from '../types';

interface InstaPost {
  media?: { uri?: string }[];
  title?: string;
  taken_at?: number;
  string_map_data?: Record<string, { timestamp?: string | number }>;
}

/** Instagram export files are plain (unwrapped) arrays of post objects. */
function parsePosts(fileName: string, text: string): { records: ArchiveRecord[]; summary: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = [];
  }
  const arr: InstaPost[] = Array.isArray(data) ? (data as InstaPost[]) : [];
  const records = arr
    .map((p, i): ArchiveRecord | null => {
      const ts = toEpochMs(p.taken_at ?? p.string_map_data?.['Creation Timestamp']?.timestamp);
      const title = p.title || `Instagram post ${i + 1}`;
      return makeRecord('instagram', 'media', ts ?? undefined, title, {
        subtitle: p.media?.[0]?.uri ? 'Photo/video' : 'Post',
        url: p.media?.[0]?.uri,
        text: p.title,
        payload: p,
        sourceFile: fileName,
      });
    })
    .filter((r): r is ArchiveRecord => Boolean(r));
  return { records, summary: `${records.length} Instagram posts` };
}

export const instagramParser: Parser = defineParser({
  id: 'instagram',
  label: 'Instagram',
  match: (path) => /instagram\b/i.test(path) && /\.json$/i.test(path),
  parse(fileName, text) {
    const { records, summary } = parsePosts(fileName, text);
    return { service: 'instagram', type: 'media', records, summary };
  },
});