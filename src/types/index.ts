/** Canonical data source / service identifiers. */
export type Service =
  | 'youtube'
  | 'activity'
  | 'location'
  | 'instagram'
  | 'twitter'
  | 'generic';

/** A normalized, human-readable record extracted from an archive file. */
export interface ArchiveRecord {
  /** Stable unique id (sourceFile + index). */
  id: string;
  service: Service;
  /** Coarse category, e.g. 'watch' | 'search' | 'visit' | 'activity' | 'media'. */
  type: string;
  /** Epoch milliseconds. */
  timestamp: number;
  /** Short human label used for display + search. */
  title: string;
  /** Secondary human label, e.g. channel / place name. */
  subtitle?: string;
  url?: string;
  /** Short text body for search/display. */
  text?: string;
  /** Optional geo coordinates (used by Location History). */
  lat?: number;
  lng?: number;
  /** The original JSON payload, preserved verbatim. */
  payload: unknown;
  /** Archive path this came from. */
  sourceFile: string;
  /** Optional typed facets used by the analytics engine. */
  facets?: {
    /** e.g. YouTube channel name, media author. */
    channel?: string;
    /** e.g. location place name. */
    place?: string;
    /** Duration in ms (e.g. video length, place visit length). */
    durationMs?: number;
    /** A count associated with the record (e.g. star count, play count). */
    count?: number;
    /** Engagement count (likes / retweets) for ranking "top" content. */
    engagement?: number;
  };
}

/** A directory-like node in the generic file browser tree. */
export interface FileNode {
  name: string;
  path: string;
  kind: 'dir' | 'file';
  size: number;
  /** Only populated once the raw text is fetched lazily. */
  children?: FileNode[];
}

/** Metadata about an ingest session (one dropped archive). */
export interface Session {
  id?: number;
  name: string;
  createdAt: number;
  fileCount: number;
  recordCount: number;
  services: Service[];
}

/** Progress report emitted by the ingest pipeline. */
export interface IngestProgress {
  phase: 'listing' | 'extracting' | 'parsing' | 'done';
  done: number;
  pending: number;
  /** Number of decompressed bytes processed since last report. */
  bytesDone: number;
  /** Estimated total decompressed bytes. */
  bytesTotal: number;
  currentFile?: string;
  currentService?: Service;
  /** Human-readable status line. */
  message?: string;
}

/** Returned by a parser for a single source file. */
export interface ParseResult {
  service: Service;
  type: string;
  records: ArchiveRecord[];
  /** Human summary of what the file produced. */
  summary?: string;
}

/** Union of messages a worker can pass back to the main thread. */
export type WorkerRequest =
  | { kind: 'archive-listing'; file: ArrayBuffer; type: ArchiveType }
  | { kind: 'archive-extract'; file: ArrayBuffer; type: ArchiveType; entries: ZipEntryRequest[] }
  | { kind: 'parse'; fileName: string; text: string };

/** Supported container formats. */
export type ArchiveType = 'zip' | 'tar' | 'tgz' | 'unknown';

export interface ZipEntryRequest {
  /** Exact name used by the container reader. */
  name: string;
  max?: number;
  /** Whether this file exceeds the per-file parse cap (extract anyway for listing). */
  tooLarge?: boolean;
}

export interface ZipEntryInfo {
  name: string;
  size: number;
  originalSize: number;
}

export type WorkerResponse =
  | { kind: 'listing-ready'; entries: ZipEntryInfo[]; sessionId: string }
  | { kind: 'listing-error'; message: string; sessionId: string }
  | { kind: 'archive-batch'; results: { name: string; text: string }[]; oversized: string[]; sessionId: string }
  | { kind: 'extract-error'; message: string; sessionId: string }
  | { kind: 'parse-error'; message: string }
  | { kind: 'parsed'; result: ParseResult };

/** Sniff a file's container type from its leading bytes. */
export function sniffArchiveType(buf: Uint8Array): ArchiveType {
  if (buf.length < 2) return 'unknown';
  // ZIP: "PK\x03\x04" or "PK\x05\x06"
  if (buf[0] === 0x50 && buf[1] === 0x4b) return 'zip';
  // gzip: 0x1f 0x8b
  if (buf[0] === 0x1f && buf[1] === 0x8b) return 'tgz';
  // ustar signature at offset 257: "ustar"
  if (buf.length >= 262) {
    const sig = new TextDecoder('latin1').decode(buf.subarray(257, 262));
    if (sig === 'ustar') return 'tar';
  }
  return 'unknown';
}