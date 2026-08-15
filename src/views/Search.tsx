import { useEffect, useState } from 'react';
import { searchIndex, type SearchFilters, type SearchHit } from '../store/search';
import { db } from '../store/db';
import type { Service } from '../types';
import { Highlight } from './highlight';

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
  const [results, setResults] = useState<SearchHit[]>([]);
  const [service, setService] = useState<Service | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [facets, setFacets] = useState<Record<string, number>>({});
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    if (!searchIndex.isReady()) {
      db.records.toArray().then((all) => {
        searchIndex.reset(all);
        setFacets(searchIndex.countByService());
        setWarm(true);
      });
    } else {
      setFacets(searchIndex.countByService());
      setWarm(true);
    }
  }, []);

  const buildFilters = (): SearchFilters => ({
    service: service === 'all' ? undefined : service,
    from: from ? new Date(from).getTime() : undefined,
    to: to ? new Date(to + 'T23:59:59.999').getTime() : undefined,
  });

  const run = (text: string) => {
    setQ(text);
    const hits = text.trim() ? searchIndex.search(text, { limit: 300, filters: buildFilters() }) : [];
    setResults(hits);
  };

  useEffect(() => {
    run(q);
    // Filters re-run the current query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, from, to]);

  const total = Object.values(facets).reduce((a, b) => a + b, 0);
  const hasFilters = from || to || service !== 'all';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Search</h2>
          {warm && <span className="text-xs text-slate-500">{total.toLocaleString()} records indexed</span>}
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => run(e.target.value)}
          placeholder="Search titles, channels, places, activity…"
          className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={service}
            onChange={(e) => setService(e.target.value as Service | 'all')}
            className="bg-slate-800 text-white rounded-lg px-3 py-1.5 border border-slate-700"
          >
            <option value="all">All services</option>
            {Object.entries(SERVICE_ICON)
              .filter(([s]) => (facets[s] ?? 0) > 0)
              .map(([s, icon]) => (
                <option key={s} value={s}>
                  {icon} {s} ({facets[s]})
                </option>
              ))}
          </select>
          <label className="flex items-center gap-1 text-slate-400">
            from
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-slate-800 text-white rounded-lg px-2 py-1.5 border border-slate-700" />
          </label>
          <label className="flex items-center gap-1 text-slate-400">
            to
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-slate-800 text-white rounded-lg px-2 py-1.5 border border-slate-700" />
          </label>
          {hasFilters && (
            <button
              onClick={() => {
                setFrom('');
                setTo('');
                setService('all');
              }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {q && results.length === 0 && <p className="text-slate-400 text-sm">No matches for “{q}”.</p>}
      {!q && <p className="text-slate-500 text-sm">Start typing to search across everything you’ve imported.</p>}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span>{SERVICE_ICON[r.service] ?? '•'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white">
                    <Highlight text={r.title || r.subtitle || 'Untitled'} terms={r.queryTerms} />
                  </div>
                  {r.subtitle && (
                    <div className="text-xs text-slate-400">
                      <Highlight text={r.subtitle} terms={r.queryTerms} />
                    </div>
                  )}
                  {r.text && (
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2 break-words">
                      <Highlight text={r.text} terms={r.queryTerms} />
                    </div>
                  )}
                  <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-2">
                    <span>{r.service}</span>
                    {r.timestamp ? <span>{new Date(r.timestamp).toLocaleString()}</span> : null}
                    {r.sourceFile && <span className="truncate">{r.sourceFile}</span>}
                  </div>
                </div>
                {r.score != null && <span className="text-[10px] text-slate-600 shrink-0">{r.score.toFixed(2)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}