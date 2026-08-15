import type { WorkerRequest, ParseResult, Service } from '../types';
import { pickParser } from '../parsers';

/**
 * Parse worker: runs the appropriate parser (via the same code the main thread
 * uses) on JSON/file text. Keeping parsing here keeps the UI thread responsive.
 */

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.kind === 'parse') {
      const parser = pickParser(msg.fileName);
      const result = parser.parse(msg.fileName, msg.text);
      self.postMessage({ kind: 'parsed', result } satisfies { kind: 'parsed'; result: ParseResult });
    }
  } catch (err) {
    self.postMessage({ kind: 'parse-error', message: err instanceof Error ? err.message : String(err) });
  }
};

// Re-export to keep the worker bundle type-sane when tree-shaken.
export type { Service, ParseResult };