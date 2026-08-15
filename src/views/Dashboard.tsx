import { useState, useCallback } from 'react';
import { clearAll } from '../store/db';

const SERVICE_META: Record<string, { label: string; icon: string; color: string }> = {
  youtube: { label: 'YouTube', icon: '▶️', color: 'from-red-600/60 to-red-800/40' },
  activity: { label: 'My Activity', icon: '🧭', color: 'from-sky-600/60 to-blue-800/40' },
  location: { label: 'Location', icon: '📍', color: 'from-emerald-600/60 to-teal-800/40' },
  instagram: { label: 'Instagram', icon: '📸', color: 'from-pink-600/60 to-fuchsia-800/40' },
  twitter: { label: 'X / Twitter', icon: '𝕏', color: 'from-slate-500/60 to-slate-800/40' },
  generic: { label: 'Other files', icon: '📄', color: 'from-amber-600/60 to-orange-800/40' },
};

interface Props {
  counts: Record<string, number>;
  refresh: () => Promise<void>;
  onIngest: (file: File) => void;
}

export default function Dashboard({ counts, refresh, onIngest }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setMessage(null);
      setBusy(true);
      // The parent's handleIngest is async; run it and then refresh.
      Promise.resolve(onIngest(file)).catch((e: unknown) =>
        setMessage(e instanceof Error ? e.message : 'Import failed')
      ).finally(() => setBusy(false));
    },
    [onIngest]
  );

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? 'border-sky-400 bg-sky-950/40' : 'border-slate-700 bg-slate-900/40'
        }`}
      >
        <div className="text-5xl mb-4">📦</div>
        <h2 className="text-xl font-semibold text-white">Drop your export archive here</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          Google Takeout <code className="text-sky-400">.zip</code>, X/Twitter export, or any
          social-media archive with JSON. Parsing runs in a background worker so the page stays
          responsive.
        </p>
        <label className="mt-6 cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors">
          Choose a file
          <input
            type="file"
            accept=".zip,.tgz,.tar,.gz"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
        {busy && <div className="mt-4 text-sm text-sky-300">Parsing…</div>}
        {message && <div className="mt-4 text-sm text-red-400">{message}</div>}
      </div>

      {/* Stats */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Your archive ({total.toLocaleString()} records)
        </h3>
        {total === 0 ? (
          <p className="text-slate-500 text-sm">Nothing imported yet. Drop an archive above.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(SERVICE_META).map(([key, meta]) => {
              const n = counts[key] ?? 0;
              if (n === 0) return null;
              return (
                <div
                  key={key}
                  className={`rounded-xl p-4 bg-gradient-to-br ${meta.color} border border-white/5`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  <div className="mt-2 text-3xl font-bold text-white">{n.toLocaleString()}</div>
                  <div className="text-xs text-white/60">records</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* "Clear all" action */}
      {total > 0 && (
        <div className="flex items-center justify-end">
          <button
            onClick={async () => {
              await clearAll();
              await refresh();
            }} className="text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Clear all local data
          </button>
        </div>
      )}
    </div>
  );
}