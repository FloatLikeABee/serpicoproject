import { DEFAULT_FLEET_CITY_ID } from './cities';
import type { MapTag, MapTagKind } from './mapTags';
import { createMapTag, isCoordsOnlyAddress, MAP_TAG_KINDS, tagMeta } from './mapTags';

/** Fleet pin categories — stations, vehicles, crime/event zones. */
export type FleetMarkerKind = 'police_station' | 'personnel' | 'police_vehicle' | 'investigation';

export const FLEET_MARKER_KINDS: Array<{
  kind: FleetMarkerKind;
  label: string;
  short: string;
  color: string;
  glyph: string;
}> = [
  { kind: 'police_station', label: 'Station / facility', short: 'Station', color: '#1e3a8a', glyph: 'S' },
  { kind: 'personnel', label: 'Personnel', short: 'Staff', color: '#0ea5e9', glyph: 'N' },
  { kind: 'police_vehicle', label: 'Police vehicle', short: 'Vehicle', color: '#2563eb', glyph: 'V' },
  { kind: 'investigation', label: 'Crime scene / event', short: 'Scene', color: '#5aa8ff', glyph: 'C' },
];

export const FLEET_KIND_SET = new Set<MapTagKind>(FLEET_MARKER_KINDS.map((k) => k.kind));

export function fleetKindMeta(kind: MapTagKind) {
  return FLEET_MARKER_KINDS.find((k) => k.kind === kind) ?? FLEET_MARKER_KINDS[0];
}

export function isFleetKind(kind: string): kind is FleetMarkerKind {
  return FLEET_KIND_SET.has(kind as MapTagKind);
}

export interface FleetMarker extends MapTag {
  cityId: string;
}

const cacheKey = (userId: string) => `serpico.fleet.markers.v1.${userId || 'guest'}`;

export function loadCachedFleetMarkers(userId: string): FleetMarker[] {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FleetMarker[];
    return Array.isArray(parsed) ? parsed.filter((m) => m && isFleetKind(m.kind)) : [];
  } catch {
    return [];
  }
}

export function saveCachedFleetMarkers(userId: string, markers: FleetMarker[]) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(markers));
  } catch (err) {
    console.warn('saveCachedFleetMarkers failed', err);
  }
}

function pinRichness(m: FleetMarker): number {
  return (
    (m.notes?.trim() ? 1 : 0) +
    (m.enrichment?.summary?.trim() ? 1 : 0) +
    (m.address && !isCoordsOnlyAddress(m.address) ? 1 : 0)
  );
}

function fillMissingPinFields(winner: FleetMarker, other: FleetMarker): FleetMarker {
  return {
    ...winner,
    notes: winner.notes?.trim() ? winner.notes : other.notes,
    name: winner.name?.trim() ? winner.name : other.name,
    enrichment: winner.enrichment?.summary?.trim() ? winner.enrichment : other.enrichment,
    address:
      winner.address && !isCoordsOnlyAddress(winner.address)
        ? winner.address
        : other.address || winner.address,
  };
}

/** Prefer the later updatedAt; if tied, keep the richer officer fields. */
export function pickFleetMarkerVersion(local: FleetMarker, remote: FleetMarker): FleetMarker {
  const lt = Date.parse(local.updatedAt) || 0;
  const rt = Date.parse(remote.updatedAt) || 0;
  if (lt === rt) {
    const richer = pinRichness(local) >= pinRichness(remote) ? local : remote;
    const other = richer === local ? remote : local;
    return fillMissingPinFields(richer, other);
  }
  const winner = lt > rt ? local : remote;
  const other = winner === local ? remote : local;
  return fillMissingPinFields(winner, other);
}

/** Merge server list with device cache; keep unsynced local-only pins. */
export function mergeFleetMarkerLists(local: FleetMarker[], remote: FleetMarker[]): FleetMarker[] {
  const byId = new Map<string, FleetMarker>();
  for (const m of local) {
    if (m?.id) byId.set(m.id, m);
  }
  for (const r of remote) {
    if (!r?.id) continue;
    const existing = byId.get(r.id);
    byId.set(r.id, existing ? pickFleetMarkerVersion(existing, r) : r);
  }
  return Array.from(byId.values()).sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
  );
}

export function fleetMarkerFromPayload(m: {
  id: string;
  cityId?: string;
  kind: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  notes?: string;
  enrichment?: MapTag['enrichment'];
  createdAt: string;
  updatedAt: string;
}): FleetMarker | null {
  if (!isFleetKind(m.kind)) return null;
  return {
    id: m.id,
    kind: m.kind,
    name: m.name,
    lat: m.lat,
    lng: m.lng,
    address: m.address || '',
    notes: m.notes || '',
    enrichment: m.enrichment,
    cityId: m.cityId || DEFAULT_FLEET_CITY_ID,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export function createFleetMarker(
  kind: FleetMarkerKind,
  lat: number,
  lng: number,
  cityId: string,
  extras?: Partial<Pick<MapTag, 'name' | 'address' | 'notes'>>
): FleetMarker {
  const tag = createMapTag(kind, lat, lng, extras);
  const meta = fleetKindMeta(kind);
  if (!extras?.name?.trim()) {
    tag.name = `${meta.short} pin`;
  }
  return { ...tag, cityId };
}

export function fleetKindsForModal() {
  return FLEET_MARKER_KINDS.map((fleet) => {
    const base = MAP_TAG_KINDS.find((k) => k.kind === fleet.kind) ?? MAP_TAG_KINDS[MAP_TAG_KINDS.length - 1];
    return { ...base, label: fleet.label, short: fleet.short, color: fleet.color, glyph: fleet.glyph };
  });
}

export { tagMeta };
