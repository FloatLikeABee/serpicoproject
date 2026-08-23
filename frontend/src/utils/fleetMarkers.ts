import type { MapTag, MapTagKind } from './mapTags';
import { createMapTag, MAP_TAG_KINDS, tagMeta } from './mapTags';

/** Fleet pin categories — stations, vehicles, crime/event zones. */
export type FleetMarkerKind = 'police_station' | 'police_vehicle' | 'investigation';

export const FLEET_MARKER_KINDS: Array<{
  kind: FleetMarkerKind;
  label: string;
  short: string;
  color: string;
  glyph: string;
}> = [
  { kind: 'police_station', label: 'Station / facility', short: 'Station', color: '#1e3a8a', glyph: 'S' },
  { kind: 'police_vehicle', label: 'Police vehicle', short: 'Vehicle', color: '#2563eb', glyph: 'V' },
  { kind: 'investigation', label: 'Crime scene / event', short: 'Scene', color: '#c026d3', glyph: 'C' },
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
  return MAP_TAG_KINDS.filter((k) => FLEET_KIND_SET.has(k.kind)).map((k) => {
    const fleet = fleetKindMeta(k.kind);
    return { ...k, label: fleet.label, short: fleet.short, color: fleet.color, glyph: fleet.glyph };
  });
}

export { tagMeta };
