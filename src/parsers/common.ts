import type { ArchiveRecord, Service } from '../types';

/** Helpers to build normalized records consistently. */

export function makeRecord(
  service: Service,
  type: string,
  timestamp: number | undefined | null,
  title: string,
  overrides: Partial<ArchiveRecord> = {}
): ArchiveRecord | null {
  if (!title) return null;
  return {
    id: `${service}:${type}:${timestamp ?? 'na'}:${hash(title)}`,
    service,
    type,
    timestamp: timestamp ?? 0,
    title,
    payload: overrides.payload ?? {},
    sourceFile: overrides.sourceFile ?? '',
    ...overrides,
  };
}

/** Small deterministic string hash so ids are stable across parses. */
export function hash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Google's `header` envelope wraps export files:
 * `{ "header": { "creation_timestamp": "..." }, "records": [...] }`.
 */
export function unwrapTakeout<T>(raw: unknown, dataKey = 'records'): T[] {
  if (Array.isArray(raw)) return raw as unknown as T[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const val = obj[dataKey];
    if (Array.isArray(val)) return val as unknown as T[];
    if (obj.records && Array.isArray(obj.records)) return obj.records as unknown as T[];
  }
  return [];
}

/** Normalize a Google-style creation timestamp (seconds or ms epoch). */
export function toEpochMs(value: unknown): number | undefined {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!Number.isNaN(n) && value.trim() !== '') {
      return n < 1e12 ? n * 1000 : n;
    }
    const d = new Date(value).getTime();
    return Number.isNaN(d) ? undefined : d;
  }
  return undefined;
}

/** Split a raw archive path into buckets we display as "pieces". */
export function pathSegments(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0);
}