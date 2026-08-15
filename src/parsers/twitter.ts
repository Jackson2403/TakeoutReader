import { defineParser, type Parser } from './types';
import { makeRecord, toEpochMs } from './common';
import type { ArchiveRecord } from '../types';

interface Tweet {
  tweet?: {
    id_str?: string;
    created_at?: string;
    full_text?: string;
    entities?: { urls?: { expanded_url?: string }[] };
  };
  id_str?: string;
  created_at?: string;
  full_text?: string;
  entities?: { urls?: { expanded_url?: string }[] };
}

/** Twitter export JS files look like `window.YTD.tweets.part0 = [ ... ];` */
function unwrapJs(text: string): string {
  const eq = text.indexOf('=');
  if (eq > -1) {
    const rest = text.slice(eq + 1).trim().replace(/;\s*$/, '');
    // If it's still an object literal wrapper, fall back to raw later.
    try {
      JSON.parse(rest);
      return rest;
    } catch {
      /* not valid JSON body */
    }
  }
  return text;
}

function parseTweets(fileName: string, text: string): { records: ArchiveRecord[]; summary: string } {
  let data: unknown;
  try {
    const body = /\.js$/i.test(fileName) ? unwrapJs(text) : text;
    data = JSON.parse(body);
  } catch {
    data = null;
  }
  const arr: Tweet[] = Array.isArray(data) ? (data as Tweet[]) : [];
  const records = arr
    .map((t): ArchiveRecord | null => {
      // Tweets may be nested under { tweet: {...} }.
      const inner = t.tweet ?? t;
      const ts = toEpochMs(inner.created_at);
      const textBody = inner.full_text ?? '';
      const url = inner.entities?.urls?.[0]?.expanded_url;
      return makeRecord('twitter', 'tweet', ts ?? undefined, textBody.slice(0, 80) || 'Tweet', {
        subtitle: 'Tweet',
        url,
        text: textBody,
        payload: t,
        sourceFile: fileName,
      });
    })
    .filter((r): r is ArchiveRecord => Boolean(r));
  return { records, summary: `${records.length} tweets` };
}

export const twitterParser: Parser = defineParser({
  id: 'twitter',
  label: 'X / Twitter',
  match: (path) => {
    const base = path.split('/').pop() ?? path;
    return (/twitter\b/i.test(path) || /^tweets[^/]*\.js$/i.test(base)) && /\.(json|js)$/i.test(path);
  },
  parse(fileName, text) {
    const { records, summary } = parseTweets(fileName, text);
    return { service: 'twitter', type: 'tweet', records, summary };
  },
});