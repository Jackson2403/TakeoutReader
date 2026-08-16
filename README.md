# TakeoutReader

<p align="center">
  <img src="public/favicon.svg" width="120" height="120" alt="TakeoutReader" />
</p>

<p align="center">
  <strong>Turn your archived data back into memories.</strong><br/>
  A visual, fully-offline browser for Google Takeout &amp; social-media export archives.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg" /></a>
  <a href="https://github.com/Jackson2403/TakeoutReader"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" /></a>
  <a href="https://github.com/Jackson2403/TakeoutReader"><img alt="Offline-first PWA" src="https://img.shields.io/badge/PWA-offline--first-64748b" /></a>
  <a href="https://github.com/Jackson2403/TakeoutReader/actions"><img alt="CI" src="https://img.shields.io/badge/CI-green?logo=githubactions&logoColor=white" /></a>
</p>

<p align="center">
  <a href="https://jackson2403.github.io/TakeoutReader/">🚀 Try the live demo (GitHub Pages)</a>
  &nbsp;·&nbsp;
  <a href="#getting-started">Run locally</a>
</p>

---

## Why this exists

Companies hand over your data to comply with data-portability laws — and then it
sits in unreadable JSON. **TakeoutReader changes that.** Drop in the archive and the
app parses it locally, then renders a searchable, timeline-driven dashboard of your
actual digital life: the videos you watched, the places you went, the activity you
forgot you had. Nothing ever leaves your browser.

- **Heavy parsing runs in Web Workers**, so large archives don't freeze the page.
- **Fully offline-first** — data lives in IndexedDB, installable as a PWA.
- **Privacy by design** — no account, no server, no telemetry.

## Features

- **Drop zip / tgz / tar / folder** — multi-file + folder pick; extraction runs in a background Web Worker to keep the UI responsive.
- **Content-hash dedup** — re-dropping the same archive skips files already imported.
- **Live progress** — a real progress bar (bytes / files / phase) while parsing in a background worker.
- **Google Takeout parsers** — YouTube (watch + search history), My Activity, Location History.
- **Social export parsers** — Instagram posts, X/Twitter (tweets.js unwrapping).
- **Generic JSON browser** — any unrecognized JSON/JS file is stored as a searchable document, so nothing is ever unreadable.
- **Insights & analytics** — activity heatmap, monthly chart, top channels/places, streaks, busiest day/hour.
- **Location map** — zero-dependency SVG map with clustering, pan/zoom, click-to-inspect.
- **Full-text search** — MiniSearch with prefix + fuzzy matching, service + date-range filters, facet counts, and query-term highlighting.
- **Timeline** — grouped by day, service + date-range filters, a month heatmap calendar, and scroll-to-load infinite paging.
- **Export** — download your data as a self-contained HTML report, Markdown, or JSON (100% local Blob).
- **Light/dark theme** — persisted toggle respecting your OS preference.
- **Keyboard shortcuts** — `1–6` switch views, `/` searches.

---

## Table of contents

- [Getting Started](#getting-started)
- [Data sources supported](#data-sources-supported)
- [Architecture](#architecture)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)


```bash
npm install
npm run dev
```

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
 ├─ IngestManager            (orchestrates worker, dedup, progress)
 ├─ Web Worker (zip.worker.ts)
 │   ├─ zip / tar / tgz  (fflate + minimal tar reader, run in a worker)
 │   └─ → decoded file text, oversized-warning
 ├─ Parsers                  (youtube, activity, location, instagram, twitter, generic)
 ├─ Store (Dexie/IndexedDB)  (records, sessions, fingerprints) + MiniSearch
 └─ Views                    (Dashboard, Insights, Map, Files, Timeline, Search)
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run check` | Type-check only |
| `npm run test` | Run the unit/integration test suite (`node:test` + tsx) |
| `npm run build` | Type-check + production build (incl. PWA service worker) |
| `npm run preview` | Preview the production build |
| `npm run e2e` | Build + run the Playwright end-to-end suite (requires `npx playwright install`) |

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.
All participants agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

- 🐞 [Open a bug report](https://github.com/Jackson2403/TakeoutReader/issues/new?labels=bug)
- ✨ [Request a feature](https://github.com/Jackson2403/TakeoutReader/issues/new?labels=enhancement)
- 🔐 Report security issues privately — see [SECURITY.md](SECURITY.md)

## License

MIT — see [LICENSE](LICENSE).