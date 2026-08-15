import MiniSearch, { type SearchResult } from 'minisearch';
import type { ArchiveRecord, Service } from '../types';

/** Filters applied on top of a full-text query. */
export interface SearchFilters {
  service?: Service;
  from?: number; // epoch ms
  to?: number; // epoch ms
}

export interface SearchHit extends ArchiveRecord {
  score?: number;
  queryTerms?: string[];
}

/**
 * In-memory full-text index over records. Keeps a side array of the ingested
 * records so we can apply service/date filters and facet counts, since MiniSearch
 * itself only stores the fields we ask it to.
 */
export class RecordSearch {
  private index: MiniSearch<ArchiveRecord>;
  private stored: ArchiveRecord[] = [];
  private ready = false;

  constructor() {
    this.index = new MiniSearch<ArchiveRecord>({
      idField: 'id',
      fields: ['title', 'subtitle', 'text', 'sourceFile'],
      storeFields: ['id', 'service', 'type', 'timestamp', 'title', 'subtitle', 'url', 'text', 'sourceFile'],
      searchOptions: {
        boost: { title: 3, subtitle: 1.5, text: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  private commit(records: ArchiveRecord[]) {
    this.stored = records;
    this.index.removeAll();
    this.index.addAll(records);
    this.ready = true;
  }

  /** Add or append a batch of records (keeps existing). */
  addAll(records: ArchiveRecord[]): void {
    const merged = [...this.stored];
    const seen = new Set(merged.map((r) => r.id));
    for (const r of records) {
      if (!seen.has(r.id)) {
        merged.push(r);
        seen.add(r.id);
      }
    }
    this.commit(merged);
  }

  /** Replace the entire index with a fresh set of records. */
  reset(records: ArchiveRecord[]): void {
    this.commit(records);
  }

  isReady(): boolean {
    return this.ready;
  }

  /** All records currently in the index. */
  all(): ArchiveRecord[] {
    return this.stored;
  }

  /** Count records by service for facet badges. */
  countByService(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of this.stored) counts[r.service] = (counts[r.service] ?? 0) + 1;
    return counts;
  }

  /** Execute a search honoring service/date filters on stored fields. */
  search(query: string, opts: { limit?: number; filters?: SearchFilters } = {}): SearchHit[] {
    const { limit = 100, filters } = opts;
    if (!query.trim()) return [];
    const filterFn = filters
      ? (res: SearchResult): boolean => {
          const r = res as unknown as ArchiveRecord;
          if (filters.service && r.service !== filters.service) return false;
          if (filters.from && r.timestamp && r.timestamp < filters.from) return false;
          if (filters.to && r.timestamp && r.timestamp > filters.to) return false;
          return true;
        }
      : undefined;
    const hits = this.index.search(query, filterFn ? { filter: filterFn } : {});
    return hits.slice(0, limit).map((h) => ({ ...(h as unknown as ArchiveRecord), score: h.score, queryTerms: h.queryTerms }));
  }
}

export const searchIndex = new RecordSearch();