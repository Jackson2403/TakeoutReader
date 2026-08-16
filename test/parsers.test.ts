import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeParser } from '../src/parsers/youtube';
import { activityParser } from '../src/parsers/activity';
import { locationParser } from '../src/parsers/location';
import { genericParser } from '../src/parsers/generic';
import { instagramParser } from '../src/parsers/instagram';
import { twitterParser } from '../src/parsers/twitter';
import { pickParser } from '../src/parsers';

test('youtubeParser parses modern watch-history.json', () => {
  const json = JSON.stringify([
    { header: 'YouTube', title: 'Watched a cat video', titleUrl: 'https://youtu.be/abc', time: '2021/04/01 12:34:56 UTC' },
    { header: 'YouTube', title: 'Searched for recipes', time: '2021/04/02 08:00:00 UTC' },
  ]);
  const r = youtubeParser.parse('Takeout/YouTube/history/watch-history.json', json);
  assert.equal(r.service, 'youtube');
  assert.equal(r.records.length, 2);
  assert.equal(r.records[0].title, 'a cat video'); // "Watched " stripped
  assert.equal(r.records[0].url, 'https://youtu.be/abc');
  assert.ok(r.records[0].timestamp > 0);
});

test('youtubeParser handles newline-delimited entries', () => {
  const nl = [
    '{"header":"YouTube","title":"Watched one","time":"2020/05/05 10:00:00 UTC"}',
    '{"header":"YouTube","title":"Watched two","time":"2020/05/06 10:00:00 UTC"}',
  ].join('\n');
  const r = youtubeParser.parse('watch-history.json', nl);
  assert.equal(r.records.length, 2);
});

test('activityParser parses tolerantly (trailing commas) MyActivity.json', () => {
  // Google files often have trailing commas; our parser strips them.
  const text = `[
    { "title": "Visited example.com", "time": "2021/03/01 10:00:00 UTC", "products": ["Chrome"], "titleUrl": "https://example.com" },
    { "title": "Used Google Maps", "time": "2021/03/02 10:00:00 UTC", "products": ["Maps"], "locationInfos": [{ "name": "San Francisco" }] },
  ]`;
  const r = activityParser.parse('Takeout/My Activity/Chrome/MyActivity.json', text);
  assert.equal(r.records.length, 2);
  assert.equal(r.records[0].subtitle ?? r.records[0].title, 'Chrome');
});

test('activityParser handles wrapped header + records object', () => {
  const text = JSON.stringify({
    header: { creation_timestamp: '1620000000000' },
    records: [{ title: 'Searched the web', time: '1620000000000', products: ['Search'] }],
  });
  const r = activityParser.parse('MyActivity.json', text);
  assert.equal(r.records.length >= 1, true);
});

test('locationParser parses semantic format (visit + move)', () => {
  const text = JSON.stringify({
    semanticSegments: [
      {
        startTimestampMs: '1620000000000',
        endTimestampMs: '1620003600000',
        placeVisit: { location: { latitudeE7: 37880490, longitudeE7: -122417300, name: 'Coffee Shop' } },
      },
      {
        startTimestampMs: '1620004000000',
        endTimestampMs: '1620007600000',
        activitySegment: {
          topCandidate: { type: 'WALKING' },
          startLocation: { address: 'Home' },
          endLocation: { address: 'Office' },
        },
      },
    ],
  });
  const r = locationParser.parse('Takeout/Location History/Semantic Location History/2021/Records.json', text);
  assert.equal(r.records.length, 2);
  assert.equal(r.records[0].type, 'visit');
  assert.equal(r.records[0].title, 'Coffee Shop');
  assert.equal(r.records[0].lat, 3.788049);
  assert.equal(r.records[1].type, 'move');
  assert.ok((r.records[1].title as string).includes('WALKING'));
});

test('locationParser parses legacy flat Records.json points', () => {
  const text = JSON.stringify([
    { latitudeE7: 1e7, longitudeE7: -2e7, timestampMs: '1610000000000', source: 'GPS' },
    { latitudeE7: 2e7, longitudeE7: -3e7, timestampMs: '1610003600000', source: 'GPS' },
  ]);
  const r = locationParser.parse('Takeout/Location History/Location History/Records.json', text);
  assert.equal(r.records.length, 2);
  assert.equal(r.records[0].type, 'point');
});

test('genericParser pretty-prints any JSON as a single searchable document', () => {
  const r = genericParser.parse('settings.json', '{"a":1,"b":[2,3]}');
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].service, 'generic');
  assert.ok((r.records[0].text as string).includes('"a"'));
});

test('pickParser routes by path, falls back to generic', () => {
  assert.equal(pickParser('Takeout/YouTube/history/watch-history.json').id, 'youtube');
  assert.equal(pickParser('Takeout/Location History/x/Records.json').id, 'location');
  assert.equal(pickParser('Takeout/My Activity/Chrome/MyActivity.json').id, 'activity');
  assert.equal(pickParser('Takeout/instagram/posts_1.json').id, 'instagram');
  assert.equal(pickParser('data/tweets.js').id, 'twitter');
  assert.equal(pickParser('random/data.json').id, 'generic');
});

test('instagramParser parses posts array', () => {
  const r = instagramParser.parse('Takeout/instagram/posts_1.json', JSON.stringify([
    { title: 'Sunset photo', taken_at: 1620000000, media: [{ uri: 'https://insta/p1.jpg' }] },
  ]));
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].service, 'instagram');
  assert.equal(r.records[0].url, 'https://insta/p1.jpg');
});

test('twitterParser unwraps tweets.js and reads tweets', () => {
  const js = 'window.YTD.tweets.part0 = [' +
    JSON.stringify({ tweet: { created_at: 'Tue Apr 01 12:00:00 +0000 2021', full_text: 'Hello world this is my first tweet text' } }) +
    '];';
  const r = twitterParser.parse('data/tweets.js', js);
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].service, 'twitter');
  assert.ok((r.records[0].text as string).includes('first tweet'));
  assert.ok(r.records[0].timestamp > 0);
});

test('instagramParser unwraps wrapped { photos: [...] } exports', () => {
  const r = instagramParser.parse('instagram/media.json', JSON.stringify({
    photos: [{ title: 'Wrapped post', taken_at: 1620000000, media: ['https://insta/w.jpg'] }],
  }));
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].url, 'https://insta/w.jpg');
});

test('youtubeParser strips "Searched for" prefix', () => {
  const r = youtubeParser.parse('watch-history.json', JSON.stringify([
    { header: 'YouTube', title: 'Searched for sourdough', time: '2021/04/02 08:00:00 UTC' },
  ]));
  assert.equal(r.records[0].title, 'sourdough');
});