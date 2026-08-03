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

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'SerpicoPursue/1.0 (https://serpico.onrender.com)',
};

const COORDS_ONLY_RE = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/;

export function isCoordsOnlyAddress(value?: string): boolean {
  if (!value?.trim()) return true;
  return COORDS_ONLY_RE.test(value.trim());
}

export function coordsLabel(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
};

function formatStreetAddress(name?: string, address?: NominatimAddress): string {
  if (!address) return name?.trim() || '';
  const street = [address.house_number, address.road].filter(Boolean).join(' ');
  const locality =
    address.city || address.town || address.village || address.suburb || address.neighbourhood;
  const parts = [name?.trim(), street, locality, address.state].filter(Boolean);
  return parts.join(', ');
}

async function nominatimFetch<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller != null ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: controller?.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    if (timer != null) window.clearTimeout(timer);
  }
}

/** Best-effort reverse geocode via OpenStreetMap Nominatim. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = coordsLabel(lat, lng);
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const data = await nominatimFetch<{
    display_name?: string;
    name?: string;
    address?: NominatimAddress;
  }>(url);
  if (!data) return fallback;

  const formatted = formatStreetAddress(data.name, data.address);
  if (formatted) return formatted;
  if (data.display_name) return data.display_name.split(',').slice(0, 5).join(',');
  return fallback;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

/** Forward geocode an address / place name to coordinates. */
export async function forwardGeocode(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3 || isCoordsOnlyAddress(trimmed)) return null;

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: trimmed,
    limit: '1',
    addressdetails: '1',
    countrycodes: 'us',
  });
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const results = await nominatimFetch<
    Array<{
      lat: string;
      lon: string;
      display_name?: string;
      name?: string;
      address?: NominatimAddress;
    }>
  >(url);

  const hit = results?.[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const label = formatStreetAddress(hit.name, hit.address) || hit.display_name?.split(',').slice(0, 5).join(',') || trimmed;
  return { lat, lng, label };
}

/** Resolve coords-only tags to a street address when possible. */
export async function autoMapTagLocation(tag: MapTag): Promise<MapTag> {
  if (!isCoordsOnlyAddress(tag.address)) return tag;
  const address = await reverseGeocode(tag.lat, tag.lng);
  if (isCoordsOnlyAddress(address)) return tag;
  return { ...tag, address, updatedAt: new Date().toISOString() };
}
