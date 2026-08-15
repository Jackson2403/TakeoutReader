import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fnv1a, hashBytes } from '../src/store/hash';
import { untar } from '../src/parsers/tar';
import { sniffArchiveType } from '../src/types';

test('fnv1a is deterministic and differs for different inputs', () => {
  assert.equal(fnv1a('hello'), fnv1a('hello'));
test('sniffArchiveType detects zip, tgz, tar, and unknown', () => {
  assert.equal(sniffArchiveType(new TextEncoder().encode('PK\x03\x04rest')), 'zip');
  assert.equal(sniffArchiveType(new TextEncoder().encode('PK\x05\x06end')), 'zip');
  // gzip magic
  assert.equal(sniffArchiveType(new Uint8Array([0x1f, 0x8b, 0x08, 0x00])), 'tgz');
  // tar: build a 512-byte header with ustar magic at 257
  const hdr = new Uint8Array(512);
  const t = new TextEncoder();
  t.encodeInto('ustar', hdr.subarray(257));
  assert.equal(sniffArchiveType(hdr), 'tar');
  // Unknown content
  assert.equal(sniffArchiveType(new TextEncoder().encode('hello world')), 'unknown');
});
  assert.notEqual(fnv1a('hello'), fnv1a('world'));
  assert.equal(fnv1a('').length, 8);
});

test('hashBytes matches fnv1a over decoded content', () => {
  const bytes = new TextEncoder().encode('abc123');
  assert.equal(hashBytes(bytes), fnv1a('abc123'));
});

test('untar lists files and directories with correct content', () => {
  // Build a tiny tar by hand.
  const textEncoder = new TextEncoder();
  const mkHeader = (
    name: string,
    size: number,
    typeflag: string,
    prefix = ''
  ): Uint8Array => {
    const h = new Uint8Array(512);
    const set = (off: number, max: number, s: string) => {
      const b = textEncoder.encode(s);
      h.set(b.subarray(0, max), off);
    };
    set(0, 100, name);
    set(124, 12, size.toString(8).padStart(12, '0'));
    h[156] = typeflag.charCodeAt(0);
    set(345, 155, prefix);
    return h;
  };

  const files = [
    { name: 'dir/', size: 0, typeflag: '5', data: '' },
    { name: 'a.json', size: 0, typeflag: '0', data: '{"x":1}' },
    { name: 'b.txt', size: 0, typeflag: '0', data: 'hello' },
  ];
  const parts: Uint8Array[] = [];
  for (const f of files) {
    const dataBytes = textEncoder.encode(f.data);
    f.size = dataBytes.length;
    parts.push(mkHeader(f.name, f.size, f.typeflag));
    if (f.typeflag !== '5') parts.push(dataBytes);
    // pad data to 512
    const pad = (512 - (dataBytes.length % 512)) % 512;
    if (pad) parts.push(new Uint8Array(pad));
  }
  parts.push(new Uint8Array(1024)); // end-of-archive zeros
  const tar = concat(parts);

  const entries = untar(tar);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].name, 'dir/');
  assert.equal(entries[0].isDir, true);
  const a = entries.find((e) => e.name === 'a.json');
  assert.ok(a);
  assert.equal(new TextDecoder().decode(a.data), '{"x":1}');
  const b = entries.find((e) => e.name === 'b.txt');
  assert.ok(b);
  assert.equal(new TextDecoder().decode(b.data), 'hello');
});

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}