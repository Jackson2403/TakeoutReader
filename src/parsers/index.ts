import type { Parser } from './types';
import { youtubeParser } from './youtube';
import { activityParser } from './activity';
import { locationParser } from './location';
import { instagramParser } from './instagram';
import { twitterParser } from './twitter';
import { genericParser } from './generic';

/** All registered parsers, ordered most-specific-first so match() wins correctly. */
export const parsers: Parser[] = [
  locationParser,
  youtubeParser,
  activityParser,
  instagramParser,
  twitterParser,
  genericParser,
];

/** Pick the best parser for a given archive path; falls back to generic. */
export function pickParser(path: string): Parser {
  return parsers.find((p) => p.match(path)) ?? genericParser;
}

export {
  youtubeParser,
  activityParser,
  locationParser,
  instagramParser,
  twitterParser,
  genericParser,
};
export type { Parser } from './types';