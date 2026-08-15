import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../store/db';
import type { ArchiveRecord, Service } from '../types';
import TimelineCalendar, { monthKey } from './TimelineCalendar';

interface GroupedDay {
  day: string;
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

const PAGE = 500;

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
  const [all, setAll] = useState<ArchiveRecord[]>([]);
  const [service, setService] = useState<Service | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [calendarMonth, setCalendarMonth] = useState(monthKey(Date.now()));
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    db.records.toArray().then(setAll);
  }, []);

  const filtered = useMemo(() => {
    let list = service === 'all' ? all : all.filter((r) => r.service === service);
    if (from) {
      const f = new Date(from).getTime();
      list = list.filter((r) => !r.timestamp || r.timestamp >= f);
    }
    if (to) {
      const t = new Date(to + 'T23:59:59.999').getTime();
      list = list.filter((r) => !r.timestamp || r.timestamp <= t);
    }
    return list;
  }, [all, service, from, to]);

  const days = useMemo(() => groupByDay(filtered), [filtered]);

  const visibleDays = useMemo(() => {
    const items: { day: GroupedDay; item: ArchiveRecord }[] = [];
    outer: for (const day of days) {
      for (const item of day.items) {
        items.push({ day, item });
        if (items.length >= shown) break outer;
      }
    }
    const map = new Map<string, GroupedDay>();
    for (const { day, item } of items) {
      if (!map.has(day.day)) map.set(day.day, { day: day.day, label: day.label, items: [] });
      map.get(day.day)!.items.push(item);
    }
    return [...map.values()];
  }, [days, shown]);

  useEffect(() => {
    if (!sentinel.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setShown((s) => s + PAGE);
      },
      { rootMargin: '600px' }
    );
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setShown(PAGE);
  }, [service, from, to]);

  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of filtered) {
      if (!r.timestamp) continue;
      const d = new Date(r.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [filtered]);

  const calLabel = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [calendarMonth]);

  const hasFilters = !!from || !!to || service !== 'all';
  const stepMonth = (dir: number) => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setCalendarMonth(monthKey(d.getTime()));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-white">Timeline</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={service}
            onChange={(e) => setService(e.target.value as Service | 'all')}
            className="bg-slate-800 text-white rounded-lg px-3 py-1.5 border border-slate-700"
          >
            <option value="all">All services</option>
            {Object.keys(SERVICE_ICON).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-slate-800 text-white rounded-lg px-2 py-1.5 border border-slate-700" />
          <span className="text-slate-500">–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-slate-800 text-white rounded-lg px-2 py-1.5 border border-slate-700" />
          {hasFilters && (
            <button onClick={() => { setFrom(''); setTo(''); setService('all'); }} className="text-xs text-slate-400 hover:text-white">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <TimelineCalendar
            counts={dayCounts}
            month={calendarMonth}
            label={calLabel}
            onPrev={() => stepMonth(-1)}
            onNext={() => stepMonth(1)}
          />
        </div>

        <div className="lg:col-span-3">
          {days.length === 0 ? (
            <p className="text-slate-500 text-sm">No records match.</p>
          ) : (
            <div className="space-y-6">
              {visibleDays.map((day) => (
                <div key={day.day}>
                  <div className="text-xs font-semibold text-sky-300 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg inline-block border border-slate-700/50 mb-3">
                    {day.label} · {day.items.length}
                  </div>
                  <div className="border-l-2 border-slate-800 ml-3 space-y-1.5">
                    {day.items.map((item) => (
                      <div key={item.id} className="pl-5 relative group">
                        <span className="absolute left-0 top-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-sky-500" />
                        <div className="flex items-start gap-2 py-1">
                          <span className="text-sm">{SERVICE_ICON[item.service] ?? '•'}</span>
                          <div className="min-w-0">
                            <div className="text-sm text-white group-hover:text-sky-300 transition-colors truncate">{item.title}</div>
                            {item.subtitle && <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>}
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-sky-500 hover:underline break-all">{item.url}</a>
                            )}
                          </div>
                          <div className="ml-auto text-xs text-slate-500 shrink-0">
                            {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={sentinel} className="h-4" />
              {shown < filtered.length && <p className="text-center text-xs text-slate-600">Scroll for more…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

