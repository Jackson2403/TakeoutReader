import { useMemo } from 'react';
import { DAY_LABELS, type Insights } from '../analytics';

const HEAT_COLORS = ['#0f172a', '#1e3a5f', '#0e7490', '#059669', '#eab308', '#f97316', '#dc2626'];

function heatColor(count: number, max: number): string {
  if (count === 0) return HEAT_COLORS[0];
  const t = count / Math.max(1, max);
  const idx = Math.min(HEAT_COLORS.length - 1, 1 + Math.floor(t * (HEAT_COLORS.length - 2)));
  return HEAT_COLORS[idx];
}

export function HeatmapChart({ insights }: { insights: Insights }) {
  const cellFor = new Map<string, number>();
  for (const c of insights.heatmap) cellFor.set(`${c.day}:${c.hour}`, c.count);
  const max = useMemo(
    () => Math.max(1, ...insights.heatmap.map((c) => c.count)),
    [insights.heatmap]
  );
  const W = 16 + 24 * 12;
  const H = 7 * 12 + 6;
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} shapeRendering="crispEdges">
        {DAY_LABELS.map((label, day) => (
          <text key={label} x={0} y={day * 12 + 10} fontSize="8" fill="#64748b">
            {label[0]}
          </text>
        ))}
        {insights.heatmap.map((c) => (
          <rect
            key={`${c.day}:${c.hour}`}
            x={16 + c.hour * 12}
            y={c.day * 12}
            width="11"
            height="11"
            rx="2"
            fill={heatColor(c.count, max)}
          >
            <title>{`${DAY_LABELS[c.day]} ${String(c.hour).padStart(2, '0')}:00 — ${c.count} activities`}</title>
          </rect>
        ))}
      </svg>
      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
        <span>0</span>
        {HEAT_COLORS.map((c) => (
          <span key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />
        ))}
        <span>high</span>
      </div>
    </div>
  );
}

export function MonthlyChart({ insights }: { insights: Insights }) {
  const data = insights.monthly;
  if (data.length === 0) return <p className="text-slate-500 text-sm">No dated activity.</p>;
  const W = Math.max(320, data.length * 28);
  const H = 140;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H}>
        {data.map((d, i) => {
          const h = Math.max(2, (d.count / max) * (H - 28));
          const x = i * 28 + 4;
          const y = H - 22 - h;
          return (
            <g key={d.key}>
              <rect x={x} y={y} width={20} height={h} rx="2" fill="#38bdf8" opacity={0.85}>
                <title>{`${d.label}: ${d.count}`}</title>
              </rect>
              {i % 2 === 0 && (
                <text x={x} y={H - 6} fontSize="8" fill="#64748b">
                  {d.key.slice(5)}/{d.key.slice(2, 4)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TopList({
  title,
  items,
  icon,
}: {
  title: string;
  items: { key: string; count: number }[];
  icon: string;
}) {
  if (items.length === 0) return null;
  const max = items[0].count || 1;
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-white mb-3">
        {icon} {title}
      </h4>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={item.key} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-5 text-right">{i + 1}</span>
            <span className="text-sm text-slate-200 flex-1 truncate" title={item.key}>
              {item.key}
            </span>
            <span className="text-xs text-slate-500">{item.count}</span>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}