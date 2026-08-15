import type {
  IngestProgress,
  ArchiveRecord,
  Service,
  WorkerResponse,
  ZipEntryInfo,
  ArchiveType,
} from '../types';
import { sniffArchiveType } from '../types';
import { db, allServices, countByService } from './db';
import { searchIndex } from './search';
import { pickParser } from '../parsers';
import { fnv1a } from './hash';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Choose which archive files are JSON (or otherwise parser-relevant). */
function isImportable(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return true;
  if (lower.endsWith('.js')) return true;
  return false;
}

export interface IngestOutcome {
  imported: number;
  skipped: number;
  oversized: string[];
  services: Service[];
}

type Listener = () => void;

/** Orchestrates the full ingest: sniff → list → extract/parse → dedup → persist. */
export class IngestManager {
  private listeners: Listener[] = [];
  private progressStore: IngestProgress = {
    phase: 'listing',
    done: 0,
    pending: 0,
    bytesDone: 0,
    bytesTotal: 0,
    message: 'Starting…',
  };

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

  /** Spawn the archive worker; post() resolves on a single response. */
  private spawnWorker(): { worker: Worker; post: (m: unknown) => Promise<WorkerResponse> } {
    const worker = new Worker(new URL('../workers/zip.worker.ts', import.meta.url), {
      type: 'module',
    });
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
            reject(new Error('archive worker failed'));
          };
          worker.addEventListener('message', onMsg);
          worker.addEventListener('error', onErr);
          worker.postMessage(m);
        }),
    };
  }

  /** Ingest one or more archives, aggregating counts across all of them. */
  async ingestArchives(files: { name: string; buffer: ArrayBuffer }[]): Promise<IngestOutcome> {
    const outcome: IngestOutcome = { imported: 0, skipped: 0, oversized: [], services: [] };
    for (const file of files) {
      const r = await this.ingestOne(file.name, file.buffer);
      outcome.imported += r.imported;
      outcome.skipped += r.skipped;
      outcome.oversized.push(...r.oversized);
      for (const s of r.services) if (!outcome.services.includes(s)) outcome.services.push(s);
    }
    this.setProgress({ phase: 'done', done: 0, pending: 0, message: 'Done' });
    return outcome;
  }
  /** Ingest a single archive: sniff type, list, extract+parse, dedup, persist. */
  private async ingestOne(fileName: string, buffer: ArrayBuffer): Promise<IngestOutcome> {
    const outcome: IngestOutcome = { imported: 0, skipped: 0, oversized: [], services: [] };
    const bytes = new Uint8Array(buffer);
    const type: ArchiveType = sniffArchiveType(bytes);
    this.setProgress({
      phase: 'listing',
      done: 0,
      pending: 0,
      bytesTotal: bytes.length,
      bytesDone: 0,
      message: `Reading ${fileName}…`,
    });

    const worker = this.spawnWorker();
    try {
      const listingMsg = await worker.post({ kind: 'archive-listing', file: buffer, type });
      if (listingMsg.kind === 'listing-error') throw new Error(listingMsg.message);
      const entries = (listingMsg as { kind: 'listing-ready'; entries: ZipEntryInfo[] }).entries;

      const importable = entries
        .filter((e) => isImportable(e.name))
        .filter((e) => !/\.(html?|txt)$/i.test(e.name));

      this.setProgress({ phase: 'extracting', done: 0, pending: importable.length, message: 'Extracting…' });
      const totalBytes = entries.reduce((a, e) => a + e.originalSize, 0);

      for (let i = 0; i < importable.length; i++) {
        const entry = importable[i];
        this.setProgress({
          currentFile: entry.name,
          done: i,
          pending: importable.length - i - 1,
          bytesDone: Math.min(totalBytes, this.progressStore.bytesDone + entry.originalSize),
          message: `Parsing ${entry.name}…`,
        });

        const resp = await worker.post({
          kind: 'archive-extract',
          file: buffer,
          type,
          entries: [{ name: entry.name }],
        });
        if (resp.kind === 'extract-error') throw new Error(resp.message);

        if (resp.kind === 'archive-batch') {
          for (const oversized of resp.oversized) outcome.oversized.push(oversized);
          for (const { name, text } of resp.results) {
            // Dedup: skip a file whose decoded content we've already imported.
            const h = fnv1a(text);
            const existing = await db.fingerprints.get(h);
            if (existing) {
              outcome.skipped += 1;
              continue;
            }
            const result = pickParser(name).parse(name, text);
            const records = result.records.filter(Boolean);
            if (records.length) {
              const uniq = records.map((r, idx) => ({
                ...r,
                id: `${h}:${idx}:${r.service}:${r.type}`,
              }));
              await db.records.bulkPut(uniq);
              await db.fingerprints.put({ hash: h, path: name });
              searchIndex.addAll(uniq);
              const svc = records[0].service;
              if (!outcome.services.includes(svc)) outcome.services.push(svc);
              outcome.imported += records.length;
              this.setProgress({ currentService: svc });
            }
          }
        }
        await sleep(0);
      }

      await db.sessions.put({
        name: fileName,
        createdAt: Date.now(),
        fileCount: importable.length,
        recordCount: outcome.imported,
        services: outcome.services,
      });
      this.setProgress({
        phase: 'done',
        done: importable.length,
        pending: 0,
        currentFile: undefined,
        message: `${fileName} complete`,
      });
    } finally {
      worker.worker.terminate();
    }
    return outcome;
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
