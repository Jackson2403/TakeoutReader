import { defineParser, type Parser } from './types';
import { makeRecord, toEpochMs } from './common';
import type { ArchiveRecord } from '../types';

interface InstaPost {
  media?: ({ uri?: string } | string)[];
  title?: string;
  taken_at?: number;
  string_map_data?: Record<string, { timestamp?: string | number }>;
}

/** Instagram exports are arrays of post objects, sometimes wrapped in an object. */
function parsePosts(fileName: string, text: string): { records: ArchiveRecord[]; summary: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = [];
  }
  // Some exports wrap posts in an object (e.g. { photos: [...] }) instead of a
  // bare array. Unwrap whichever array-shaped key is present.
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const key of ['photos', 'media', 'posts', 'records']) {
      if (Array.isArray(obj[key])) {
        data = obj[key];
        break;
      }
    }
  }
  const arr: InstaPost[] = Array.isArray(data) ? (data as InstaPost[]) : [];
  const records = arr
    .map((p, i): ArchiveRecord | null => {
      const ts = toEpochMs(p.taken_at ?? p.string_map_data?.['Creation Timestamp']?.timestamp);
      const title = p.title || `Instagram post ${i + 1}`;
      const firstMedia = p.media?.[0];
      const mediaUri = typeof firstMedia === 'string' ? firstMedia : firstMedia?.uri;
      return makeRecord('instagram', 'media', ts ?? undefined, title, {
        subtitle: mediaUri ? 'Photo/video' : 'Post',
        url: mediaUri,
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