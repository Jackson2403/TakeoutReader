import { useEffect, useState } from 'react';
import { db } from '../store/db';
import type { Session } from '../types';

export default function Files() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    db.sessions.orderBy('createdAt').reverse().toArray().then(setSessions);
    db.records.orderBy('sourceFile').uniqueKeys().then((keys) => setFiles(keys as unknown as string[]));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Files</h2>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Import sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-slate-500 text-sm">No imports yet.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3">
                <span className="text-lg">🗂️</span>
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(s.createdAt).toLocaleString()} · {s.fileCount} files · {s.recordCount.toLocaleString()} records
                  </div>
                </div>
                <div className="ml-auto flex gap-1">
                  {s.services.map((svc) => (
                    <span key={svc} className="text-[10px] uppercase bg-slate-800 text-slate-300 rounded px-2 py-0.5">
                      {svc}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Source files imported ({files.length})
        </h3>
        {files.length === 0 ? (
          <p className="text-slate-500 text-sm">None yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {files.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900/30 border border-slate-800/60 rounded px-3 py-1.5">
                <span className="text-slate-500 text-xs">📄</span>
                <span className="truncate font-mono text-xs">{f}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}