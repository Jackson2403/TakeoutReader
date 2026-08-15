import { useEffect, useMemo, useState } from 'react';
import { db } from '../store/db';
import type { ArchiveRecord, Service } from '../types';

interface GroupedDay {
  day: string; // yyyy-mm-dd
  label: string;
  items: ArchiveRecord[];
}

const SERVICE_ICON: Record<Service, string> = {
  youtube: '▶️',
  activity: '🧭',
  location: '📍',
  instagram: '📸',
  twitter: '𝕏',
  generic: '📄',
};

function groupByDay(records: ArchiveRecord[]): GroupedDay[] {
  const map = new Map<string, GroupedDay>();
  const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
  for (const r of sorted) {
    if (!r.timestamp) continue;
    const d = new Date(r.timestamp);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    if (!map.has(day)) map.set(day, { day, label, items: [] });
    map.get(day)!.items.push(r);
  }
  return [...map.values()];
}

export default function Timeline() {
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [service, setService] = useState<Service | 'all'>('all');
  const [limit, setLimit] = useState(2000);

  useEffect(() => {
    db.records
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray()
      .then(setRecords);
  }, [limit, service]);

  const filtered = useMemo(
    () => (service === 'all' ? records : records.filter((r) => r.service === service)),
    [records, service]
  );
  const days = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-white">Timeline</h2>
        <div className="flex items-center gap-2">
          <select
            value={service}
            onChange={(e) => setService(e.target.value as Service | 'all')}
            className="bg-slate-800 text-sm text-white rounded-lg px-3 py-1.5 border border-slate-700"
          >
            <option value="all">All services</option>
            {Object.entries(SERVICE_ICON).map(([s]) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-slate-800 text-sm text-white rounded-lg px-3 py-1.5 border border-slate-700"
          >
            <option value={500}>500</option>
            <option value={2000}>2,000</option>
            <option value={10000}>10,000</option>
          </select>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="text-slate-500 text-sm">No records yet.</p>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day.day}>
              <div className="sticky top-16 z-10 text-xs font-semibold text-sky-300 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg inline-block border border-slate-700/50 mb-3">
                {day.label} · {day.items.length}
              </div>
              <div className="border-l-2 border-slate-800 ml-3 space-y-1.5">
                {day.items.slice(0, 200).map((item) => (
                  <div key={item.id} className="pl-5 relative group">
                    <span className="absolute left-0 top-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-sky-500" />
                    <div className="flex items-start gap-2 py-1">
                      <span className="text-sm">{SERVICE_ICON[item.service] ?? '•'}</span>
                      <div className="min-w-0">
                        <div className="text-sm text-white group-hover:text-sky-300 transition-colors truncate">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-sky-500 hover:underline break-all"
                          >
                            {item.url}
                          </a>
                        )}
                      </div>
                      <div className="ml-auto text-xs text-slate-500 shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}