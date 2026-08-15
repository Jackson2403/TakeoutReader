import { Unzip, UnzipInflate } from 'fflate';
import type { WorkerRequest } from '../types';

/**
 * Dedicated worker: lists a zip's entries, then extracts + parses targeted files.
 * Uses fflate's streaming `Unzip` (push whole buffer once; onfile fires for each
 * entry; call file.start() on the ones we want to decompress only).
 */

interface ZipEntry {
  name: string;
  size: number;
  originalSize: number;
}

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

/** List entry names + sizes without decompressing bodies. */
function listEntries(data: Uint8Array): Promise<ZipEntry[]> {
  return new Promise((resolve) => {
    const entries: ZipEntry[] = [];
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (file) => {
      entries.push({ name: file.name, size: file.size ?? 0, originalSize: file.originalSize ?? 0 });
    };
    unzip.push(data, true);
    resolve(entries.sort((a, b) => a.name.localeCompare(b.name)));
  });
}

/** Extract + decode a single entry's bytes. Called per requested file. */
function extractOne(data: Uint8Array, name: string): Promise<string> {
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
            resolve(total <= MAX_TEXT_FOR_PARSE ? decode(concat(chunks)) : '');
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
    if (msg.kind === 'zip-listing') {
      const entries = await listEntries(new Uint8Array(msg.file));
      self.postMessage({ kind: 'listing-ready', entries, sessionId });
    } else if (msg.kind === 'zip-extract') {
      const reqs = msg.entries;
      const data = new Uint8Array(msg.file);
      const results: { name: string; text: string }[] = [];
      for (const req of reqs) {
        const text = await extractOne(data, req.name);
        if (text) results.push({ name: req.name, text });
      }
      self.postMessage({ kind: 'parsed-batch', results, sessionId } as never);
    }
  } catch (err) {
    self.postMessage({
      kind: 'listing-error',
      message: err instanceof Error ? err.message : String(err),
      sessionId,
    });
  }
};