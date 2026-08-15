import MiniSearch from 'minisearch';
import type { ArchiveRecord } from '../types';

/**
 * In-memory full-text index over records. Rebuilt lazily from Dexie.
 * Indexing titles/subtitles/text; stores a few fields for display.
 */
export class RecordSearch {
  private index: MiniSearch<ArchiveRecord>;
  private ready = false;

  constructor() {
    this.index = new MiniSearch<ArchiveRecord>({
      idField: 'id',
      fields: ['title', 'subtitle', 'text', 'sourceFile'],
      storeFields: ['id', 'service', 'type', 'timestamp', 'title', 'subtitle', 'url', 'text'],
      searchOptions: {
        boost: { title: 3, subtitle: 1.5, text: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  /** Add or replace a batch of records. */
  addAll(records: ArchiveRecord[]): void {
    this.index.addAll(records);
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  /** Execute a search, returning stored record fields + score. */
  search(query: string, limit = 100): Array<ArchiveRecord & { score?: number }> {
    if (!query.trim()) return [];
    const hits = this.index.search(query);
    return hits
      .slice(0, limit)
      .map((h) => ({ ...(h as unknown as ArchiveRecord), score: h.score }));
  }
/** Replace the entire index with a fresh set of records. */
  reset(records: ArchiveRecord[]): void {
    this.index.removeAll();
    this.index.addAll(records);
    this.ready = true;
  }
}

export const searchIndex = new RecordSearch();