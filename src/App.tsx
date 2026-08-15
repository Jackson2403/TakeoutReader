import { useEffect, useState } from 'react';
import { countByService, allServices } from './store/db';
import { ingestManager } from './store/ingest';
import type { Service } from './types';
import Dashboard from './views/Dashboard';
import SearchView from './views/Search';
import Timeline from './views/Timeline';
import Files from './views/Files';
import Insights from './views/Insights';

type Tab = 'dashboard' | 'insights' | 'search' | 'timeline' | 'files';

interface AppState {
  counts: Record<string, number>;
  services: Service[];
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [state, setState] = useState<AppState>({ counts: {}, services: [] });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [counts, services] = await Promise.all([countByService(), allServices()]);
    setState({ counts, services });
  };

  useEffect(() => {
    refresh();
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
          <div className="mb-4 text-sm text-sky-300 bg-sky-950/40 border border-sky-900 rounded-lg px-4 py-2">
            ⏳ Importing… parsing in a background worker.
          </div>
        )}
        {tab === 'dashboard' && (
          <Dashboard
            counts={state.counts}
            refresh={refresh}
            onIngest={(f) => handleIngest(f, refresh, setBusy)}
          />
        )}
        {tab === 'files' && <Files />}
        {tab === 'insights' && <Insights />}
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
  file: File,
  refresh: () => Promise<void>,
  setBusy: (b: boolean) => void
) {
  setBusy(true);
  try {
    const buffer = await file.arrayBuffer();
    await ingestManager.ingestArchive(file.name, buffer);
    await refresh();
  } finally {
    setBusy(false);
  }
}