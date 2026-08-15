# Contributing to TakeoutReader

Thanks for your interest! This project is a small, friendly, offline-first tool, and
every contribution helps. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first —
by participating you agree to uphold it.

## Getting started

1. **Fork** the repo and clone it locally.
2. Install the tooling:

   ```bash
   npm install
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

## Project layout

```
src/
  geo/          map projection + clustering logic
  parsers/      one file per data source (youtube, activity, location, ...)
  store/        Dexie (IndexedDB), ingest pipeline, MiniSearch, export
  views/        one component per tab
  workers/      the zip/tar/tgz parse worker
test/           unit + integration tests (node:test + tsx + fake-indexeddb)
e2e/            Playwright end-to-end tests
```

## Checks

Always run these before opening a PR:

```bash
npm run check   # TypeScript, strict
npm test        # unit + integration tests
npm run build   # production build + PWA
```

For browser tests (optional but appreciated):

```bash
npx playwright install chromium
npm run e2e
```

## Submitting changes

- Keep changes focused; one logical change per PR.
- Add or update tests for any non-trivial change.
- Ensure `npm run check` and `npm test` pass.
- Use a clear, imperative commit message (e.g. "Add YouTube watch count facet").
- Reference any related issue.

## Adding a new data-source parser

1. Add a file under `src/parsers/` implementing the `Parser` interface.
2. Register it in `src/parsers/index.ts` (before the generic fallback).
3. Add unit tests in `test/`.

## Questions?

Open an issue and tag `question`, or reach out on the discussion board.

## License

By contributing you agree that your contributions are licensed under the project's
[MIT license](LICENSE).