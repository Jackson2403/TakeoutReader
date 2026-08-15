import { useState } from 'react';
import type { ArchiveRecord } from '../types';
import { downloadExport, toHtml, toMarkdown, toJson, type ExportFormat } from '../store/export';

interface Props {
  records: ArchiveRecord[];
  title?: string;
  baseName?: string;
  label?: string;
}

/** A small dropdown to export the provided records as HTML / Markdown / JSON. */
export default function ExportMenu({ records, title = 'TakeoutReader Report', baseName = 'takeout-report', label = 'Export' }: Props) {
  const [open, setOpen] = useState(false);

  const run = (format: ExportFormat) => {
    const scope = { records, title };
    const text = format === 'html' ? toHtml(scope) : format === 'json' ? toJson(scope) : toMarkdown(scope);
    downloadExport(text, format, baseName);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={records.length === 0}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ⬇ {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-40 w-40 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl">
            <button onClick={() => run('html')} className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">HTML report</button>
            <button onClick={() => run('markdown')} className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Markdown</button>
            <button onClick={() => run('json')} className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">JSON</button>
          </div>
        </>
      )}
    </div>
  );
}