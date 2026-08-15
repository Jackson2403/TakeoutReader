import { defineParser, type Parser } from './types';
import { makeRecord } from './common';
import type { ArchiveRecord } from '../types';

interface PlaceVisit {
  location?: { latitudeE7?: number; longitudeE7?: number; address?: string; name?: string };
  duration?: { startTimestampMs?: string | number; endTimestampMs?: string | number };
}

interface ActivitySeg {
  topCandidate?: { type?: string };
  activities?: { type?: string }[];
  startLocation?: { address?: string };
  endLocation?: { address?: string };
  duration?: { startTimestampMs?: string | number; endTimestampMs?: string | number };
}

interface SemanticSegment {
  startTimestampMs?: string | number;
  endTimestampMs?: string | number;
  placeVisit?: PlaceVisit;
  activitySegment?: ActivitySeg;
}

interface SemanticDay {
  semanticSegments?: SemanticSegment[];
}

interface RawPoint {
  latitudeE7?: number;
  longitudeE7?: number;
  timestampMs?: string | number;
  source?: string;
  accuracy?: number;
}

function toNum(v: string | number | undefined | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function toIso(ms: number | undefined): string {
  return ms ? new Date(ms).toISOString() : '';
}

function visitGeocode(pv: PlaceVisit): { lat: number; lng: number } | null {
  const { latitudeE7, longitudeE7 } = pv.location ?? {};
  if (latitudeE7 != null && longitudeE7 != null) {
    return { lat: latitudeE7 / 1e7, lng: longitudeE7 / 1e7 };
  }
  return null;
}

function buildRecords(fileName: string, data: unknown): { records: ArchiveRecord[]; summary: string } {
  const records: ArchiveRecord[] = [];
  let places = 0;
  let activities = 0;

  // Detect format. Semantic (2018+) is an object `{ semanticSegments }` or an array
  // of day-objects each holding `semanticSegments`. Legacy is a flat array of points.
  const days: SemanticDay[] = [];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const wrapped = (data as { semanticSegments?: unknown }).semanticSegments;
    if (Array.isArray(wrapped)) days.push({ semanticSegments: wrapped as SemanticSegment[] });
  } else if (Array.isArray(data)) {
    const arr = data as unknown[];
    const looksSemantic = arr.some(
      (d) => d && typeof d === 'object' && 'semanticSegments' in (d as object)
    );
    if (looksSemantic) days.push(...(arr as SemanticDay[]));
  }

  if (days.length > 0) {
    for (const day of days) {
      for (const seg of day.semanticSegments ?? []) {
        const start = toNum(
          seg.startTimestampMs ?? seg.placeVisit?.duration?.startTimestampMs ?? seg.activitySegment?.duration?.startTimestampMs
        );
        const end = toNum(
          seg.endTimestampMs ?? seg.placeVisit?.duration?.endTimestampMs ?? seg.activitySegment?.duration?.endTimestampMs
        );

        if (seg.placeVisit) {
          places++;
          const geo = visitGeocode(seg.placeVisit);
          const name = seg.placeVisit.location?.name;
          const address = seg.placeVisit.location?.address;
          const rec = makeRecord('location', 'visit', start, name || 'Place visit', {
            subtitle: address,
            text: `Visited at ${toIso(start)}${end ? ` · left ${toIso(end)}` : ''}`.trim(),
            payload: seg,
            sourceFile: fileName,
            lat: geo?.lat,
            lng: geo?.lng,
          });
          if (rec) records.push(rec);
        } else if (seg.activitySegment) {
          activities++;
          const top =
            seg.activitySegment.topCandidate?.type ??
            seg.activitySegment.activities?.[0]?.type ??
            'Travel';
          const from = seg.activitySegment.startLocation?.address ?? 'unknown';
          const to = seg.activitySegment.endLocation?.address ?? 'unknown';
          const label = top.replace(/_/g, ' ');
          const rec = makeRecord('location', 'move', start, `${label} · ${from} → ${to}`, {
            subtitle: label,
            text: `${from} → ${to}`,
            payload: seg,
            sourceFile: fileName,
          });
          if (rec) records.push(rec);
        }
      }
    }
  } else {
    // Old (pre-2018) "Records.json": flat list of raw coordinate points.
    const points = (Array.isArray(data) ? data : []) as RawPoint[];
    for (const p of points) {
      const lat = p.latitudeE7 != null ? p.latitudeE7 / 1e7 : undefined;
      const lng = p.longitudeE7 != null ? p.longitudeE7 / 1e7 : undefined;
      const ts = toNum(p.timestampMs);
      if (lat == null || lng == null || ts == null) continue;
      places++;
      const rec = makeRecord('location', 'point', ts, 'Location point', {
        subtitle: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        text: `Source: ${p.source ?? 'unknown'}${p.accuracy != null ? ` · ±${Math.round(p.accuracy)}m` : ''}`,
        payload: p,
        sourceFile: fileName,
      });
      if (rec) records.push(rec);
    }
  }

  return {
    records,
    summary: `${records.length} timestamps (${places} visits, ${activities} moves)`,
  };
}

export const locationParser: Parser = defineParser({
  id: 'location',
  label: 'Location History',
  match: (path) => /Location History\b/i.test(path),
  parse(fileName, text) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
    const { records, summary } = buildRecords(fileName, data);
    return { service: 'location', type: 'visit', records, summary };
  },
});