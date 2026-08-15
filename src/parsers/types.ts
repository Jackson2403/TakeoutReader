import type { ParseResult } from '../types';

/** A parser recognizes archive paths and converts file text into normalized records. */
export interface Parser {
  /** Unique parser id. */
  id: string;
  /** Human label shown in the UI. */
  label: string;
  /** Configured during file-classification to force a parser regardless of path. */
  service?: string;
  /** Return true if this parser should handle the given archive path. */
  match(path: string): boolean;
  /** Parse file text into normalized records. Called inside a worker. */
  parse(fileName: string, text: string): ParseResult;
}

/**
 * Build a parser that runs `run` inside a worker-style transform.
 * Kept read-only / self-contained so it can be passed to workers.
 */
export function defineParser(def: Parser): Parser {
  return def;
}