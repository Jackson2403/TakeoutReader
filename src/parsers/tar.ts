/** Minimal POSIX tar / ustar reader for incrementally extracting entries. */

export interface TarEntry {
  name: string;
  size: number;
  /** Full content bytes for this entry (already range-extracted). */
  data: Uint8Array;
  isDir: boolean;
}

/** Parse an octal string from a fixed-width tar header field (may be NUL/space padded). */
function parseOctal(ascii: string): number {
  const trimmed = ascii.replace(/\0| /g, '');
  if (!trimmed) return 0;
  const n = parseInt(trimmed, 8);
  return Number.isNaN(n) ? 0 : n;
}

/** Decode a header field's ASCII bytes (path, name, etc.). */
function field(bytes: Uint8Array, start: number, len: number): string {
  let end = start + len;
  while (end > start && bytes[end - 1] === 0) end -= 1;
  return new TextDecoder('latin1').decode(bytes.subarray(start, end)).trim();
}

/**
 * Extract all entries from a tar (or .tar.gz is NOT handled here — the gzip is
 * that caller's job). Returns the entries in file order. Skips pax/global headers.
 */
export function untar(data: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  const BLOCK = 512;

  while (offset + BLOCK <= data.length) {
    // Two zero blocks terminate the archive.
    let allZero = true;
    for (let i = 0; i < BLOCK; i++) {
      if (data[offset + i] !== 0) {
        allZero = false;
        break;
      }
    }
    if (allZero) break;

    const header = data.subarray(offset, offset + BLOCK);
    const name = field(header, 0, 100).replace(/\0.*$/, '');
    if (!name) break;
    const size = parseOctal(field(header, 124, 12));
    const typeflag = String.fromCharCode(header[156] ?? 0);
    const prefix = field(header, 345, 155);
    const isDir = typeflag === '5' || name.endsWith('/');

    const fullName = prefix ? `${prefix}/${name}` : name;
    offset += BLOCK;

    if (typeflag === 'L') {
      // Long name: size bytes hold the real path; consume then continue.
      offset += align(size);
      continue;
    }
    if (isDir) {
      entries.push({ name: fullName, size: 0, data: new Uint8Array(0), isDir: true });
      continue;
    }

    const dataBytes = data.subarray(offset, offset + size);
    entries.push({ name: fullName, size, data: dataBytes.slice(), isDir: false });
    offset += align(size);
  }

  return entries;
}

function align(size: number): number {
  return (size + 511) & ~511;
}