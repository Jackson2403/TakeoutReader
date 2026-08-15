import { defineParser, type Parser } from './types';

/** Fallback parser: pretty-prints any JSON and emits a single searchable record. */
export const genericParser: Parser = defineParser({
  id: 'generic',
  label: 'Generic JSON',
  match: () => true, // always a fallback
  parse(fileName, text) {
    let pretty = text;
    try {
      pretty = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      /* keep raw text */
    }
    const records = [
      {
        id: `generic:${fileName}`,
        service: 'generic' as const,
        type: 'document',
        timestamp: 0,
        title: fileName.split('/').pop() ?? fileName,
        text: pretty,
        payload: { fileName },
        sourceFile: fileName,
      },
    ];
    return { service: 'generic', type: 'document', records, summary: 'Stored as a searchable document' };
  },
});