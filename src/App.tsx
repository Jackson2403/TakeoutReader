import { useEffect, useState } from 'react';
import { countByService, allServices } from './store/db';
import { ingestManager, type IngestOutcome } from './store/ingest';
import type { Service, IngestProgress } from './types';
import Dashboard from './views/Dashboard';
import SearchView from './views/Search';
import Timeline from './views/Timeline';
import Files from './views/Files';
import Insights from './views/Insights';
import MapView from './views/MapView';

type Tab = 'dashboard' | 'insights' | 'map' | 'search' | 'timeline' | 'files';

interface AppState {
  counts: Record<string, number>;
  services: Service[];
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [state, setState] = useState<AppState>({ counts: {}, services: [] });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [outcomeMsg, setOutcomeMsg] = useState<string | null>(null);

  const refresh = async () => {
    const [counts, services] = await Promise.all([countByService(), allServices()]);
    setState({ counts, services });
  };

  useEffect(() => {
    refresh();
    const unsub = ingestManager.onUpdate(() => setProgress(ingestManager.progress));
    return unsub;
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗂️</span>
          <h1 className="text-xl font-bold tracking-tight text-white">TakeoutReader</h1>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Turn your export archives into memories — fully offline.
          </span>
        </div>
        <nav className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
          {(
            [
              ['dashboard', 'Dashboard'],
              ['insights', 'Insights'],
              ['map', 'Map'],
              ['files', 'Files'],
              ['timeline', 'Timeline'],
              ['search', 'Search'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === id ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-6 py-6 max-w-7xl w-full mx-auto">
        {busy && (
          <div className="mb-4 rounded-lg border border-sky-900 bg-sky-950/40 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-sky-300">
              <span>⏳ {progress?.message ?? 'Importing…'}</span>
              {progress?.pending != null && progress.pending > 0 && (
                <span className="text-sky-400">{progress.pending} remaining</span>
              )}
            </div>
            {progress && (
              <div className="mt-2 h-1.5 w-full bg-sky-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all"
                  style={{
                    width: `${
                      progress.bytesTotal > 0
                        ? Math.min(100, (progress.bytesDone / progress.bytesTotal) * 100)
                        : progress.pending > 0
                          ? ((progress.done / (progress.done + progress.pending)) || 0) * 100
                          : 0
                    }%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
        {outcomeMsg && (
          <div className="mb-4 text-sm text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2">
            {outcomeMsg}
          </div>
        )}
        {tab === 'dashboard' && (
          <Dashboard
            counts={state.counts}
            refresh={refresh}
            onIngest={(files) => handleIngest(files, refresh, setBusy, setOutcomeMsg)}
          />
        )}
        {tab === 'files' && <Files />}
        {tab === 'insights' && <Insights />}
        {tab === 'map' && <MapView />}
        {tab === 'timeline' && <Timeline />}
        {tab === 'search' && <SearchView />}
      </main>

      <footer className="text-center text-xs text-slate-500 py-4">
        Everything stays on your device. No data ever leaves the browser.
      </footer>
    </div>
  );
}

async function handleIngest(
  files: File[],
  refresh: () => Promise<void>,
  setBusy: (b: boolean) => void,
  setOutcomeMsg: (m: string | null) => void
) {
  if (files.length === 0) return;
  setBusy(true);
  setOutcomeMsg(null);
  try {
    const buffers = await Promise.all(
      files.map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() }))
    );
    const outcome: IngestOutcome = await ingestManager.ingestArchives(buffers);
    const chunks: string[] = [];
    if (outcome.imported > 0) chunks.push(`${outcome.imported.toLocaleString()} records imported`);
    if (outcome.skipped > 0) chunks.push(`${outcome.skipped} file(s) already imported (skipped)`);
    if (outcome.oversized.length > 0) {
      chunks.push(`${outcome.oversized.length} file(s) over 64MB skipped`);
    }
    if (outcome.imported === 0 && outcome.skipped === 0) chunks.push('Nothing new to import');
    setOutcomeMsg(chunks.join(' · '));
    await refresh();
  } catch (e) {
    setOutcomeMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    setBusy(false);
  }
}