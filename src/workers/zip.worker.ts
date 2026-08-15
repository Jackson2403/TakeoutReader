import { Unzip, UnzipInflate, gunzipSync } from 'fflate';
import type { WorkerRequest, ZipEntryInfo } from '../types';
import { untar, type TarEntry } from '../parsers/tar';

/**
 * Dedicated worker: lists an archive's entries, then extracts + decodes targeted
 * files. Supports zip (fflate streaming), tar, and tgz. Keeps big archive handling
 * off the main thread.
 */

const sessionId = Math.random().toString(36).slice(2);
const MAX_TEXT_FOR_PARSE = 64 * 1024 * 1024; // 64MB cap for a single JSON file

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

interface EntryInfo extends ZipEntryInfo {
  /** Lazily-decompressable accessor for zip; undefined for tar (data already held). */
  data?: Uint8Array;
}

/** List entries for a tar/tgz archive (data fully in memory). */
function listTar(entries: TarEntry[]): EntryInfo[] {
  return entries
    .filter((e) => !e.isDir)
    .map((e) => ({ name: e.name, size: e.data.length, originalSize: e.data.length, data: e.data }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** List entries for a zip archive without decompressing bodies. */
function listZip(data: Uint8Array): Promise<EntryInfo[]> {
  return new Promise((resolve) => {
    const entries: EntryInfo[] = [];
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (file) => {
      entries.push({ name: file.name, size: file.size ?? 0, originalSize: file.originalSize ?? 0 });
    };
    unzip.push(data, true);
    resolve(entries.sort((a, b) => a.name.localeCompare(b.name)));
  });
}

/** Extract + decode a single zip entry. Returns '' if over the parse cap. */
function extractZipOne(data: Uint8Array, name: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let chunks: Uint8Array[] = [];
    let settled = false;
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (file) => {
      if (file.name !== name) return;
      file.ondata = (err, dat, final) => {
        if (err) {
          if (!settled) {
            settled = true;
            reject(err);
          }
          return;
        }
        if (dat) chunks.push(dat.slice());
        if (final) {
          if (!settled) {
            settled = true;
            const total = chunks.reduce((a, b) => a + b.length, 0);
            resolve(total <= MAX_TEXT_FOR_PARSE ? decode(concat(chunks)) : null);
          }
        }
      };
      try {
        file.start();
      } catch (e) {
        if (!settled) {
          settled = true;
          reject(e as Error);
        }
      }
    };
    unzip.push(data, true);
  });
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.kind === 'archive-listing') {
      let entries: EntryInfo[];
      if (msg.type === 'tgz') {
        const gun = gunzipSync(new Uint8Array(msg.file));
        entries = listTar(untar(gun));
      } else if (msg.type === 'tar') {
        entries = listTar(untar(new Uint8Array(msg.file)));
      } else {
        entries = await listZip(new Uint8Array(msg.file));
      }
      self.postMessage({
        kind: 'listing-ready',
        entries: entries.map(({ name, size, originalSize }) => ({ name, size, originalSize })),
        sessionId,
      });
    } else if (msg.kind === 'archive-extract') {
      const reqs = msg.entries;
      const results: { name: string; text: string }[] = [];
      const oversized: string[] = [];
      if (msg.type === 'tar' || msg.type === 'tgz') {
        const p = msg.type === 'tgz' ? gunzipSync(new Uint8Array(msg.file)) : new Uint8Array(msg.file);
        const byName = new Map(untar(p).map((e) => [e.name, e]));
        for (const req of reqs) {
          const e = byName.get(req.name);
          if (!e) continue;
          if (e.data.length > MAX_TEXT_FOR_PARSE) {
            oversized.push(req.name);
            continue;
          }
          results.push({ name: req.name, text: decode(e.data) });
        }
      } else {
        const data = new Uint8Array(msg.file);
        for (const req of reqs) {
          const text = await extractZipOne(data, req.name);
          if (text === null) {
            oversized.push(req.name);
            continue;
          }
          if (text) results.push({ name: req.name, text });
        }
      }
      self.postMessage({ kind: 'archive-batch', results, oversized, sessionId } as never);
    }
  } catch (err) {
    self.postMessage({
      kind: 'listing-error',
      message: err instanceof Error ? err.message : String(err),
      sessionId,
    });
  }
};