/** Split text on query terms and wrap matches in <mark>. */
export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  if (!terms || terms.length === 0 || !text) return <>{text}</>;
  const escaped = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  const re2 = new RegExp(`(${escaped.join('|')})`, 'gi');
  return (
    <>
      {parts.map((part, i) =>
        re2.test(part) ? (
          <mark key={i} className="bg-amber-400/30 text-amber-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}