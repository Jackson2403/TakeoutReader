import { useEffect, useMemo, useState } from 'react';
import { db } from '../store/db';
import { computeInsights, type Insights } from '../analytics';
import type { ArchiveRecord } from '../types';
import { HeatmapChart, MonthlyChart, TopList } from './charts';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function Insights() {
  const [records, setRecords] = useState<ArchiveRecord[]>([]);

  useEffect(() => {
    db.records.toArray().then(setRecords);
  }, []);

  const insights = useMemo<Insights>(() => computeInsights(records), [records]);

  if (insights.totalRecords === 0) {
    return <p className="text-slate-500 text-sm">Import an archive to see insights.</p>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-lg font-semibold text-white">Insights</h2>
        <p className="text-sm text-slate-400">
          {insights.range.first?.toLocaleDateString() ?? '—'} →{' '}
          {insights.range.last?.toLocaleDateString() ?? '—'} ·{' '}
          {insights.totalRecords.toLocaleString()} records
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total records" value={insights.totalRecords.toLocaleString()} />
        <StatCard
          label="Longest streak"
          value={insights.longestStreak ? `${insights.longestStreak.days} days` : '—'}
          sub={
            insights.longestStreak
              ? `${insights.longestStreak.start.toLocaleDateString()} – ${insights.longestStreak.end.toLocaleDateString()}`
              : undefined
          }
        />
        <StatCard
          label="Busiest day"
          value={
            insights.busiestDay
              ? new Date(insights.busiestDay.date + 'T00:00:00').toLocaleDateString()
              : '—'
          }
          sub={insights.busiestDay ? `${insights.busiestDay.count} records` : undefined}
        />
        <StatCard
          label="Busiest hour"
          value={insights.busiestHour != null ? `${String(insights.busiestHour).padStart(2, '0')}:00` : '—'}
          sub="local time"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">When are you active?</h3>
          <HeatmapChart insights={insights} />
        </section>
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Activity over time</h3>
          <MonthlyChart insights={insights} />
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopList title="Top channels" items={insights.topChannels} icon="🎬" />
        <TopList title="Top places" items={insights.topPlaces} icon="📍" />
      </div>

      <section>
        <h3 className="text-sm font-semibold text-white mb-3">Time of day breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {insights.timeOfDay.map((t) => (
            <div key={t.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">{t.count.toLocaleString()}</div>
              <div className="text-[11px] text-slate-500 mt-1">{t.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}