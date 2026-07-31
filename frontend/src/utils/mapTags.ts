/** Pursue map intel tags — placeable markers with notes + AI enrichment. */

export type MapTagKind =
  | 'police_officer'
  | 'police_vehicle'
  | 'police_station'
  | 'perp'
  | 'perp_vehicle'
  | 'murder_case'
  | 'suspect'
  | 'investigation'
  | 'witness'
  | 'evidence'
  | 'other';

export interface MapTagEnrichment {
  summary: string;
  fetchedAt: string;
}

export interface MapTag {
  id: string;
  kind: MapTagKind;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  notes: string;
  enrichment?: MapTagEnrichment;
  createdAt: string;
  updatedAt: string;
}

export const MAP_TAG_KINDS: Array<{
  kind: MapTagKind;
  label: string;
  short: string;
  color: string;
  glyph: string;
}> = [
  { kind: 'police_officer', label: 'Police officer', short: 'Officer', color: '#38bdf8', glyph: 'O' },
  { kind: 'police_vehicle', label: 'Police vehicle', short: 'PD car', color: '#2563eb', glyph: 'V' },
  { kind: 'police_station', label: 'Police station', short: 'Station', color: '#1e3a8a', glyph: 'S' },
  { kind: 'perp', label: 'Perp', short: 'Perp', color: '#ef4444', glyph: 'P' },
  { kind: 'perp_vehicle', label: 'Perp vehicle', short: 'Suspect car', color: '#f97316', glyph: 'C' },
  { kind: 'murder_case', label: 'Murder case', short: 'Homicide', color: '#9f1239', glyph: 'M' },
  { kind: 'suspect', label: 'Suspect', short: 'Suspect', color: '#f43f5e', glyph: 'X' },
  { kind: 'investigation', label: 'Investigation', short: 'Case', color: '#c026d3', glyph: 'I' },
  { kind: 'witness', label: 'Witness', short: 'Witness', color: '#14b8a6', glyph: 'W' },
  { kind: 'evidence', label: 'Evidence', short: 'Evidence', color: '#eab308', glyph: 'E' },
  { kind: 'other', label: 'Other', short: 'Pin', color: '#64748b', glyph: '+' },
];

export function tagMeta(kind: MapTagKind) {
  return MAP_TAG_KINDS.find((k) => k.kind === kind) ?? MAP_TAG_KINDS[MAP_TAG_KINDS.length - 1];
}

const storageKey = (userId: string) => `serpico.pursue.mapTags.v1.${userId || 'guest'}`;

export function loadMapTags(userId: string): MapTag[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MapTag[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMapTags(userId: string, tags: MapTag[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(tags));
  } catch (err) {
    console.warn('saveMapTags failed', err);
  }
}

export function createMapTag(
  kind: MapTagKind,
  lat: number,
  lng: number,
  extras?: Partial<Pick<MapTag, 'name' | 'address' | 'notes'>>
): MapTag {
  const now = new Date().toISOString();
  const meta = tagMeta(kind);
  return {
    id: `tag-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    kind,
    name: extras?.name?.trim() || `${meta.short} pin`,
    lat,
    lng,
    address: extras?.address,
    notes: extras?.notes || '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Best-effort reverse geocode via OpenStreetMap Nominatim (fast timeout). */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller != null
      ? window.setTimeout(() => controller.abort(), 2500)
      : null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      display_name?: string;
      name?: string;
      address?: { road?: string; neighbourhood?: string; city?: string; town?: string };
    };
    if (data.name && data.address?.road) {
      return `${data.name} — ${data.address.road}`;
    }
    if (data.display_name) return data.display_name.split(',').slice(0, 4).join(',');
    return fallback;
  } catch {
    return fallback;
  } finally {
    if (timer != null) window.clearTimeout(timer);
  }
}
