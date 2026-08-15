import { useEffect, useState } from 'react';
import { searchIndex } from '../store/search';
import { db } from '../store/db';
import type { ArchiveRecord, Service } from '../types';

const SERVICE_ICON: Record<Service, string> = {
  youtube: '▶️',
  activity: '🧭',
  location: '📍',
  instagram: '📸',
  twitter: '𝕏',
  generic: '📄',
};

export default function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<ArchiveRecord & { score?: number }>>([]);
  const [searched, setSearched] = useState(false);

  // Ensure the index is warm on first visit.
  useEffect(() => {
    if (!searchIndex.isReady()) {
      db.records.toArray().then((all) => searchIndex.addAll(all));
    }
  }, []);

  const run = (text: string) => {
    setQ(text);
    setSearched(true);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const hits = searchIndex.search(text, 200);
    // Hydrate full records from the index storeFields.
    setResults(hits as Array<ArchiveRecord & { score?: number }>);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Search</h2>
        <input
          autoFocus
          value={q}
          onChange={(e) => run(e.target.value)}
          placeholder="Search titles, channels, places, activity…"
          className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {searched && q && results.length === 0 && (
        <p className="text-slate-400 text-sm">No matches for “{q}”.</p>
      )}
      {!q && <p className="text-slate-500 text-sm">Start typing to search across everything you’ve imported.</p>}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span>{SERVICE_ICON[r.service] ?? '•'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white">{r.title || r.subtitle || 'Untitled'}</div>
                  {r.subtitle && (
                    <div className="text-xs text-slate-400">{r.subtitle}</div>
                  )}
                  {r.text && (
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2 break-words">{r.text}</div>
                  )}
                  <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-2">
                    <span>{r.service}</span>
                    {r.timestamp ? (
                      <span>{new Date(r.timestamp).toLocaleString()}</span>
                    ) : null}
                    {r.sourceFile && <span className="truncate">{r.sourceFile}</span>}
                  </div>
                </div>
                {r.score != null && (
                  <span className="text-[10px] text-slate-600 shrink-0">{r.score.toFixed(2)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}