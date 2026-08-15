# TakeoutReader

A visual, fully-offline browser for your archived data. Drop a **Google Takeout** or social-media export `.zip` into the app and it turns the unreadable JSON back into a beautiful, searchable, timeline-driven dashboard of your digital memories.

Heavy parsing runs in **Web Workers** so even massive archives don't freeze the browser.

## Features

- **Drop a zip / tgz / folder** — streaming extraction so archives aren't loaded wholesale into RAM.
- **Google Takeout parsers** — YouTube (watch + search history), My Activity, Location History.
- **Social export parsers** — Instagram posts, X/Twitter (tweets.js unwrapping).
- **Generic JSON browser** — any unrecognized file is stored as a searchable document, so nothing is ever unreadable.
- **Offline-first PWA** — parsed data is stored in IndexedDB (Dexie); installable and works with no network.
- **Full-text search** — MiniSearch with prefix + fuzzy matching over titles, subtitles, and text.
- **Views** — Dashboard (drop + stats), Files, Timeline (grouped by day), and Search.

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