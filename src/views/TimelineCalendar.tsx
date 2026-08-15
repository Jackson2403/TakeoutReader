import { useMemo } from 'react';
import { DAY_LABELS } from '../analytics';

/** Per-day record counts for a month. */
export interface MonthDay {
  date: string; // yyyy-mm-dd
  count: number;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * A single-month heatmap calendar. Weeks run Sun–Sat. Uses the current local
 * timezone for year/month/day boundaries.
 */
export default function TimelineCalendar({
  counts,
  month,
  onPrev,
  onNext,
  label,
}: {
  counts: Record<string, number>;
  month: string; // yyyy-mm
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { firstWeekday, daysInMonth } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    return { firstWeekday: (first.getDay() + 6) % 7, daysInMonth: new Date(y, m, 0).getDate() };
  }, [month]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const max = useMemo(() => Math.max(1, ...Object.values(counts)), [counts]);
  const color = (n: number): string => {
    if (n === 0) return '#0f172a';
    const t = n / max;
    if (t < 0.25) return '#1e3a5f';
    if (t < 0.5) return '#0e7490';
    if (t < 0.75) return '#059669';
    return '#eab308';
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="text-slate-400 hover:text-white text-sm px-2">‹</button>
        <div className="text-sm font-semibold text-white">{label}</div>
        <button onClick={onNext} className="text-slate-400 hover:text-white text-sm px-2">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d}>{d[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const [y, m] = month.split('-').map(Number);
          const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const n = counts[date] ?? 0;
          return (
            <div
              key={date}
              title={`${date}: ${n} records`}
              className="aspect-square rounded flex items-center justify-center text-[10px]"
              style={{ background: color(n), color: n > max * 0.6 ? '#0b1120' : '#cbd5e1' }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { monthKey };