import { useEffect, useMemo, useState } from 'react';
import { db } from '../store/db';
import { collectPoints } from '../geo/projection';
import type { Point } from '../geo/projection';
import type { ArchiveRecord } from '../types';
import MapCanvas, { VIEW_W, VIEW_H, BASE_ZOOM } from './MapCanvas';

export default function MapView() {
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [selected, setSelected] = useState<Point | null>(null);

  useEffect(() => {
    db.records.toArray().then(setRecords);
  }, []);

  const points = useMemo(() => collectPoints(records), [records]);
  const scale = (2 ** zoom / 2 ** BASE_ZOOM) * 120;

  if (records.length === 0) {
    return (
      <p className="text-slate-500 text-sm">
        No records yet. Import an archive with location history to see a map.
      </p>
    );
  }
  if (points.length === 0) {
    return (
      <p className="text-slate-500 text-sm">
        Imports found {records.length.toLocaleString()} records but none with geographic
        coordinates.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Map</h2>
          <p className="text-sm text-slate-400">
            {points.length.toLocaleString()} points · zoom {zoom}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 1, 10))}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 1, 2))}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white"
          >
            −
          </button>
          <button
            onClick={() => {
              setCenter({ x: 0.5, y: 0.5 });
              setZoom(BASE_ZOOM);
            }}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm text-white"
          >
            Reset
          </button>
        </div>
      </header>

      <div
        className="relative border border-slate-800 rounded-2xl overflow-hidden bg-[#0b1120] select-none touch-none"
        onPointerDown={(e) => {
          // Always start a potential pan drag.
          const start = { x: e.clientX, y: e.clientY };
          const startCenter = { ...center };
          const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - start.x;
            const dy = ev.clientY - start.y;
            setCenter({ x: startCenter.x - dx / scale, y: startCenter.y - dy / scale });
          };
          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        }}
        style={{ width: VIEW_W, height: VIEW_H }}
      >
        <MapCanvas points={points} zoom={zoom} center={center} onSelect={setSelected} />
        <div className="absolute bottom-2 left-2 text-[10px] text-slate-500 pointer-events-none">
          Drag to pan · +/− or scroll to zoom
        </div>
      </div>

      {selected && (
        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-white font-semibold">{selected.title}</h3>
              {selected.subtitle && <p className="text-slate-400 text-sm mt-1">{selected.subtitle}</p>}
              <p className="text-slate-500 text-xs mt-2">
                <span className="font-mono">
                  {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                </span>
                {selected.ts ? ` · ${new Date(selected.ts).toLocaleString()}` : ''}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-500 hover:text-white text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}