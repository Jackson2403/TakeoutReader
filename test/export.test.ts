import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHtml, toMarkdown, toJson, escapeHtml } from '../src/store/export';

const records: any[] = [
  {
    id: 'a', service: 'youtube', type: 'watch', timestamp: 1600000000000,
    title: 'A cat <video>', subtitle: 'Channel & Co', text: 'hello "world"',
    url: 'https://youtu.be/abc', sourceFile: 'watch-history.json',
    payload: {},
  },
  {
    id: 'b', service: 'location', type: 'visit', timestamp: 1600000000001,
    title: 'Cafe', lat: 1.2, lng: 3.4, sourceFile: 'Records.json', payload: {},
  },
];

test('escapeHtml escapes HTML metacharacters', () => {
  assert.equal(escapeHtml('a<b>&"\'c'), 'a&lt;b&gt;&amp;&quot;&#39;c');
});

test('toHtml embeds all records and escapes unsafe titles', () => {
  const html = toHtml({ records, title: 'My & Report' });
  assert.ok(html.includes('<div class="record">'));
  assert.ok(html.includes('My &amp; Report'));
  assert.ok(html.includes('A cat &lt;video&gt;'));
  assert.ok(html.includes('watch-history.json'));
  assert.ok(html.includes('Cafe'));
  // html is self-contained with a <style> block and DOCTYPE.
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<style>'));
});

test('toMarkdown produces a table with piped columns', () => {
  const md = toMarkdown({ records });
  assert.ok(md.startsWith('# TakeoutReader Report'));
  assert.ok(md.includes('| Service | Type | Timestamp |'));
  assert.ok(md.includes('| youtube | watch |'));
  assert.ok(md.includes('| location | visit |'));
});

test('toJson returns parseable JSON without payload field', () => {
  const withFacets = { ...records[0], facets: { channel: 'Channel & Co' } };
  const json = toJson({ records: [withFacets, records[1]] });
  const parsed = JSON.parse(json);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].service, 'youtube');
  assert.ok(!('payload' in parsed[0]));
  assert.ok('facets' in parsed[0]);
  assert.equal(parsed[0].facets.channel, 'Channel & Co');
});