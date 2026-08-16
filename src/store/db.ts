import Dexie, { type Table } from 'dexie';
import type { ArchiveRecord, Session, Service } from '../types';

/** A record of an imported file's content, used to skip identical re-imports. */
export interface Fingerprint {
  /** Stable hash over the archive's decoded file text. */
  hash: string;
  /** Normalized archive path. */
  path: string;
}

/** IndexedDB schema for TakeoutReader. Everything stays on-device. */
export class TakeoutDB extends Dexie {
  records!: Table<ArchiveRecord, string>;
  sessions!: Table<Session, number>;
  fingerprints!: Table<{ hash: string; path: string }, string>;

  constructor() {
    super('takeout-reader');
    // v3 drops the unused `fileText` table (the raw-file browser was never wired up).
    this.version(3).stores({
      records: 'id, service, type, timestamp, title',
      sessions: '++id, createdAt',
      fingerprints: 'hash, path',
    });
  }
}

export const db = new TakeoutDB();

/** Recompute the set of services present across all stored records (cached). */
export async function allServices(): Promise<Service[]> {
  const svc = await db.records.orderBy('service').uniqueKeys();
  return svc as unknown as Service[];
}

/** Count records, grouped by service. */
export async function countByService(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db.records.each((r) => (counts[r.service] = (counts[r.service] ?? 0) + 1));
  return counts;
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    db.records.clear(),
    db.sessions.clear(),
    db.fingerprints.clear(),
  ]);
}