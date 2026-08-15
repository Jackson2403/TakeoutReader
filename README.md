# TakeoutReader

A visual, fully-offline browser for your archived data. Drop a **Google Takeout** or social-media export `.zip` into the app and it turns the unreadable JSON back into a beautiful, searchable, timeline-driven dashboard of your digital memories.

Heavy parsing runs in **Web Workers** so even massive archives don't freeze the browser.

## Features

- **Drop zip / tgz / tar / folder** — multi-file + folder pick; streaming extraction so archives aren't loaded wholesale into RAM.
- **Content-hash dedup** — re-dropping the same archive skips files already imported.
- **Live progress** — a real progress bar (bytes / files / phase) while parsing in a background worker.
- **Google Takeout parsers** — YouTube (watch + search history), My Activity, Location History.
- **Social export parsers** — Instagram posts, X/Twitter (tweets.js unwrapping).
- **Generic JSON browser** — any unrecognized file is stored as a searchable document, so nothing is ever unreadable.
- **Insights & analytics** — activity heatmap, monthly chart, top channels/places, streaks, busiest day/hour.
- **Location map** — zero-dependency SVG map with clustering, pan/zoom, click-to-inspect.
- **Offline-first PWA** — parsed data is stored in IndexedDB (Dexie); installable and works with no network.
- **Full-text search** — MiniSearch with prefix + fuzzy matching, service + date-range filters, facet counts, and query-term highlighting.
- **Timeline** — grouped by day, service + date-range filters, a month heatmap calendar, and scroll-to-load infinite paging.
- **Export** — download your data as a self-contained HTML report, Markdown, or JSON (100% local Blob).

## Getting Started

```bash
npm install
npm run dev
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run check` | Type-check only |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build |

## Data sources supported

| Service | Format | Files |
| --- | --- | --- |
| YouTube | watch + search history | `Takeout/YouTube[and Music]/history/watch-history.json`, `search-history.json` |
| Google Activity | My Activity | `Takeout/My Activity/*/MyActivity.json` |
| Google Location | Location History | `Takeout/Location History/*/Records.json`, `LocationHistory.json` |
| Instagram | posts | `instagram/*.json` |
| X / Twitter | tweets | `tweets.js` (and `data/*.js`) |
| ANY | Generic | any `*.json` (searchable document) |

## Architecture

```
App (React)
 ├─ DropZone / FilePicker
 ├─ IngestManager            (orchestrates workers, reports progress)
 ├─ Web Workers
 │   ├─ zip.worker.ts        (fflate Unzip → stream file entries)
 │   └─ parse.worker.ts      (detect format → parse JSON → normalized records)
 ├─ Parsers                  (youtube, activity, location, instagram, twitter, generic)
 ├─ Store (Dexie/IndexedDB)  (records, files, sessions)
 └─ Views                    (Dashboard, Files, Timeline, Search)
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run check` | Type-check only |
| `npm run test` | Run the unit/integration test suite (`node:test` + tsx) |
| `npm run build` | Type-check + production build (incl. PWA service worker) |
| `npm run preview` | Preview the production build |

## License

MIT