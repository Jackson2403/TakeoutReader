import type { IngestProgress, ArchiveRecord, Service, WorkerResponse, ZipEntryInfo } from '../types';
import { db, allServices, countByService } from './db';
import { searchIndex } from './search';
import { pickParser } from '../parsers';

type Listener = () => void;

/** Choose which archive files are JSON (or otherwise parser-relevant). */
function isImportable(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return true;
  // Twitter exports ship JS that assigns a variable; treat .js as potential data.
  if (lower.endsWith('.js')) return true;
  return false;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Orchestrates the full ingest: list → extract → parse → persist. */
export class IngestManager {
  private listeners: Listener[] = [];
  private progressStore: IngestProgress = { phase: 'listing', done: 0, pending: 0, bytesDone: 0, bytesTotal: 0 };
  private activeSessionId: string | null = null;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  onUpdate(cb: Listener): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  get progress(): IngestProgress {
    return this.progressStore;
  }

  private setProgress(p: Partial<IngestProgress>) {
    this.progressStore = { ...this.progressStore, ...p };
    this.emit();
  }

  /** Spawn the zip worker and return post() that resolves on a single response. */
  private spawnZipWorker(): { worker: Worker; post: (m: unknown) => Promise<WorkerResponse> } {
    const worker = new Worker(new URL('../workers/zip.worker.ts', import.meta.url), { type: 'module' });
    return {
      worker,
      post: (m) =>
        new Promise<WorkerResponse>((resolve, reject) => {
          const onMsg = (ev: MessageEvent<WorkerResponse>) => {
            worker.removeEventListener('message', onMsg);
            worker.removeEventListener('error', onErr);
            resolve(ev.data);
          };
          const onErr = () => {
            worker.removeEventListener('message', onMsg);
            worker.removeEventListener('error', onErr);
            reject(new Error('zip worker failed'));
          };
          worker.addEventListener('message', onMsg);
          worker.addEventListener('error', onErr);
          worker.postMessage(m);
        }),
    };
  }

  /**
   * Ingest a single archive buffer. Steps: list entries, pick JSON files,
   * extract+parse each in the worker, write records to Dexie and search.
   */
  async ingestArchive(fileName: string, buffer: ArrayBuffer, onProgress?: (p: IngestProgress) => void): Promise<void> {
    const sessionId = this.activeSessionId ?? Math.random().toString(36).slice(2);
    this.activeSessionId = sessionId;
    this.setProgress({ phase: 'listing', done: 0, pending: 0, bytesDone: 0, bytesTotal: 0 });

    // 1) List entries
    const zip = this.spawnZipWorker();
    try {
      const listingMsg = await zip.post({ kind: 'zip-listing', file: buffer });
      if (listingMsg.kind === 'listing-error') throw new Error(listingMsg.message);
      const entries = (listingMsg as { kind: 'listing-ready'; entries: ZipEntryInfo[] }).entries;

      const importable = entries
        .filter((e) => isImportable(e.name)) // JSON / JS data files only
        .filter((e) => !/\.(html?|txt)$/i.test(e.name));
      this.setProgress({
        phase: 'extracting',
        done: 0,
        pending: importable.length,
        bytesTotal: entries.reduce((a, e) => a + e.originalSize, 0),
        bytesDone: 0,
      });

      let totalRecords = 0;
      const seenServices = new Set<Service>();

      // 2) Extract + parse each importable file.
      for (let i = 0; i < importable.length; i++) {
        const entry = importable[i];
        this.setProgress({
          currentFile: entry.name,
          currentService: undefined,
          done: i,
          pending: importable.length - i - 1,
          bytesDone: Math.min(this.progressStore.bytesTotal, this.progressStore.bytesDone + entry.originalSize),
        });

        const resp = await zip.post({
          kind: 'zip-extract',
          file: buffer,
          entries: [{ name: entry.name }],
        });
        if (resp.kind === 'parsed-batch' && resp.results?.length) {
          for (const { name, text } of resp.results) {
            const parser = pickParser(name);
            const result = parser.parse(name, text);
            const records = result.records.filter(Boolean);
            if (records.length) {
              // Hallucinate stable ids unique per attempt.
              const uniq = records.map((r, idx) => ({ ...r, id: `${r.id || 'rec'}:${idx}:${sessionId}` }));
              await db.records.bulkPut(uniq);
              searchIndex.addAll(uniq);
              seenServices.add(records[0].service);
              totalRecords += records.length;
              this.setProgress({ currentService: records[0].service, done: i, pending: importable.length - i - 1 });
            }
          }
        }
        await sleep(0); // flush progress
      }

      // 3) Record a session + finish.
      const services = [...seenServices];
      await db.sessions.put({
        name: fileName,
        createdAt: Date.now(),
        fileCount: importable.length,
        recordCount: totalRecords,
        services,
      });
      this.setProgress({ phase: 'done', done: importable.length, pending: 0, currentFile: undefined, currentService: undefined });
      onProgress?.(this.progressStore);
    } finally {
      zip.worker.terminate();
      this.activeSessionId = null;
    }
  }

  /** Rebuild the MiniSearch index from everything in Dexie. */
  async rebuildSearchIndex(): Promise<void> {
    const all: ArchiveRecord[] = await db.records.toArray();
    searchIndex.reset(all);
  }
}

export { allServices, countByService };

/** App-wide singleton. */
export const ingestManager = new IngestManager();