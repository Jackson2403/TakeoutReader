/**
 * FNV-1a 32-bit hash over a UTF-8 string. Fast, dependency-free, deterministic.
 * Not cryptographic — sufficient for content-dedup of decompressed file text.
 */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Hash a Uint8Array by chunking into the string hasher (cheap). */
export function hashBytes(bytes: Uint8Array): string {
  // Read in blocks to avoid building one giant string for big payloads.
  let h = 0x811c9dc5;
  const block = 32 * 1024;
  for (let off = 0; off < bytes.length; off += block) {
    const slice = bytes.subarray(off, Math.min(bytes.length, off + block));
    let s = '';
    for (const b of slice) s += String.fromCharCode(b);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}