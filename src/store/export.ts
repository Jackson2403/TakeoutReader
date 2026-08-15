import type { ArchiveRecord, Service } from '../types';

export type ExportFormat = 'html' | 'json' | 'markdown';

export interface ExportScope {
  records: ArchiveRecord[];
  title?: string;
}

/** Escape a string for safe embedding in HTML text content. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SERVICE_ICON: Record<Service, string> = {
  youtube: '▶️',
  activity: '🧭',
  location: '📍',
  instagram: '📸',
  twitter: '𝕏',
  generic: '📄',
};

function fmtDate(ts: number): string {
  return ts ? new Date(ts).toLocaleString() : '—';
}

/** Render a single record as an HTML row (fragment). */
function recordHtml(r: ArchiveRecord): string {
  const icon = SERVICE_ICON[r.service] ?? '•';
  const meta = [r.service, r.type, r.sourceFile].filter(Boolean).join(' · ');
  const body: string[] = [];
  body.push(`<div class="icon">${icon}</div>`);
  body.push(
    `<div class="content"><div class="title">${escapeHtml(r.title || r.subtitle || 'Untitled')}</div>`
  );
  if (r.subtitle) body.push(`<div class="sub">${escapeHtml(r.subtitle)}</div>`);
  if (r.text) body.push(`<div class="text">${escapeHtml(r.text)}</div>`);
  if (r.url) body.push(`<div class="url"><a href="${escapeHtml(r.url)}">${escapeHtml(r.url)}</a></div>`);
  body.push(`<div class="meta">${fmtDate(r.timestamp)} · ${escapeHtml(meta)}</div></div>`);
  return `<div class="record">${body.join('')}</div>`;
}
/** Produce a standalone, self-contained HTML report. */
export function toHtml({ records, title = 'TakeoutReader Report' }: ExportScope): string {
  const byService = new Map<Service, ArchiveRecord[]>();
  for (const r of records) {
    const arr = byService.get(r.service) ?? [];
    arr.push(r);
    byService.set(r.service, arr);
  }
  const sorted = [...records].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const total = records.length;
  const from = sorted.length ? sorted[sorted.length - 1].timestamp : 0;
  const to = sorted.length ? sorted[0].timestamp : 0;

  const serviceChips = [...byService.entries()]
    .map(([svc, arr]) => `<span class="chip">${escapeHtml(svc)} (${arr.length})</span>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, sans-serif; background:#0b1120; color:#e2e8f0; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .lede { color:#94a3b8; font-size:14px; }
  .chips { margin: 16px 0; display:flex; flex-wrap:wrap; gap:6px; }
  .chip { background:#1e293b; border-radius:9999px; padding:3px 10px; font-size:12px; }
  .record { display:flex; gap:12px; background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:12px 14px; margin-bottom:8px; }
  .icon { font-size:18px; }
  .content { min-width:0; }
  .title { font-weight:600; }
  .sub { color:#cbd5e1; font-size:13px; }
  .text { color:#94a3b8; font-size:13px; white-space:pre-wrap; word-break:break-word; }
  .url a { color:#38bdf8; font-size:13px; word-break:break-all; }
  .meta { color:#64748b; font-size:11px; margin-top:4px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  <div class="lede">${total.toLocaleString()} records · ${from ? new Date(from).toLocaleDateString() : '—'} → ${to ? new Date(to).toLocaleDateString() : '—'}</div>
  ${serviceChips ? `<div class="chips">${serviceChips}</div>` : ''}
  <div class="records">
    ${sorted.map(recordHtml).join('\n    ')}
  </div>
</div>
</body>
</html>`;
}

/** Produce a Markdown summary + table. */
export function toMarkdown({ records, title = 'TakeoutReader Report' }: ExportScope): string {
  const sorted = [...records].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const lines: string[] = [`# ${title}`, ''];
  lines.push(`*${records.length.toLocaleString()} records*`, '');
  lines.push('| Service | Type | Timestamp | Title | Source |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of sorted) {
    const when = r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 16).replace('T', ' ') : '—';
    const t = (r.title || r.subtitle || 'Untitled').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const src = (r.sourceFile || '').replace(/\|/g, '\\|');
    lines.push(`| ${r.service} | ${r.type} | ${when} | ${t} | ${src} |`);
  }
  return lines.join('\n') + '\n';
}

/** Produce a JSON file (records without the bulky raw payload). */
export function toJson({ records }: ExportScope): string {
  const mapped = records.map((r) => ({
    id: r.id,
    service: r.service,
    type: r.type,
    timestamp: r.timestamp,
    title: r.title,
    subtitle: r.subtitle,
    text: r.text,
    url: r.url,
    lat: r.lat,
    lng: r.lng,
    sourceFile: r.sourceFile,
    facets: r.facets,
  }));
  return JSON.stringify(mapped, null, 2);
}

/** Trigger a local Blob download of the exported text. */
export function downloadExport(text: string, format: ExportFormat, baseName = 'takeout-report'): void {
  const mimeByFormat: Record<ExportFormat, string> = {
    html: 'text/html;charset=utf-8',
    json: 'application/json;charset=utf-8',
    markdown: 'text/markdown;charset=utf-8',
  };
  const extByFormat: Record<ExportFormat, string> = { html: 'html', json: 'json', markdown: 'md' };
  const blob = new Blob([text], { type: mimeByFormat[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.${extByFormat[format]}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { SERVICE_ICON };