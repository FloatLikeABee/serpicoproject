/** Client-side endless auto-chase vehicle pursuit simulation. */

import {
  buildOsmRoadRoute,
  buildRoadNodePath,
  getRoadNetwork,
  routeFollowsRoads,
  snapToNearestRoad,
  snapToRoadSegment,
} from './olatheRoadNetwork';

export interface SimLatLng {
  lat: number;
  lng: number;
}

export type PoliceKind = 'squad' | 'helper';
export type WeaponKind = 'drone' | 'robocop' | 'laser';
export type SimVehicleStatus = 'chasing' | 'idle' | 'fleeing' | 'caught' | 'escaped';

export interface SimVehicle {
  id: string;
  role: 'police' | 'perp';
  policeKind?: PoliceKind;
  helperExpiresAtSimMs?: number;
  color?: string;
  lat: number;
  lng: number;
  heading: number;
  route: SimLatLng[];
  routeIndex: number;
  routeProgress: number;
  maxSpeedMph: number;
  officerName: string;
  officerRank?: string;
  evaluation: string;
  vehicleModel: string;
  status: SimVehicleStatus;
  pursuingPerpId?: string;
  playerAssigned?: boolean;
  beingPursued: boolean;
  destination?: SimLatLng;
  resolvedAtSimMs?: number;
}

export type LandmarkKind = 'bar' | 'club' | 'factory' | 'projects';

export interface MapLandmark {
  id: string;
  kind: LandmarkKind;
  name: string;
  lat: number;
  lng: number;
}

export interface SimNotice {
  id: string;
  kind: 'caught' | 'escaped' | 'helper' | 'weapon' | 'warn' | 'info';
  text: string;
  atSimMs: number;
}

export interface SimSession {
  id: string;
  userId: string;
  vehicles: SimVehicle[];
  landmarks: MapLandmark[];
  score: number;
  caughtTotal: number;
  escapedTotal: number;
  notices: SimNotice[];
  helpersNextAtSimMs: number;
  clusterCenter?: SimLatLng;
  startedAtMs: number;
}

export const INITIAL_SQUAD_COUNT = 3;
export const HELPER_COUNT = 2;
export const PERP_COUNT = 20;
export const BASE_SCORE = 500;
export const CATCH_SCORE = 60;

export const WEAPON_COSTS: Record<WeaponKind, number> = {
  drone: 120,
  robocop: 240,
  laser: 380,
};

export const WEAPON_LABELS: Record<WeaponKind, string> = {
  drone: 'Crime fighter drones',
  robocop: 'Robocops',
  laser: 'Satellite lasers',
};

/** Compact button labels for the toolbar. */
export const WEAPON_SHORT_LABELS: Record<WeaponKind, string> = {
  drone: 'Drones',
  robocop: 'Robocops',
  laser: 'Sat Laser',
};

/** Playable Olathe city box — map pan/zoom is locked to this. */
export const OLATHE_BOUNDS = { latMin: 38.86, latMax: 38.91, lngMin: -94.85, lngMax: -94.78 };
export const OLATHE_CENTER: [number, number] = [38.8814, -94.8191];
export const OLATHE_MIN_ZOOM = 13;
export const OLATHE_MAX_ZOOM = 17;

export { ensureRoadNetwork } from './olatheRoadNetwork';

const OlatheBounds = OLATHE_BOUNDS;
const ROAD_GRID_STEP = 0.0002;
const CATCH_METERS = 55;
const CATCH_CLOSE_METERS = 125;
const DEST_ARRIVAL_M = 45;
const MIN_SEGMENT_M = 4;
const MIN_PURSUIT_ROUTE_M = 230;
const ROUTE_SNAP_M = 120;
const PURSUIT_FORCE_SNAP_M = 180;
const PURSUIT_TARGET_LOOKAHEAD_M = 430;
const PURSUIT_TAIL_JOIN_M = 390;
const PURSUIT_ROUTE_REBUILD_M = 680;
const MIN_ROUTE_REBUILD_MS = 6500;
const NOTICE_TTL_MS = 8500;
const RESOLVED_VISIBLE_MS = 3600;
const FIRST_HELPER_DELAY_MS = 25_000;
const HELPER_ACTIVE_MS = 40_000;
const HELPER_COOLDOWN_MS = 80_000;
const MIN_VEHICLE_SPAWN_SEP_M = 145;
const PERP_DEST_MIN_M = 1000;
const PERP_DEST_MAX_M = 3000;
const HELPER_SPAWN_MIN_M = 120;
const HELPER_SPAWN_MAX_M = 520;
const IDLE_PATROL_RADIUS_M = 650;

const PERP_CRUISE_MPH = 34;
const POLICE_IDLE_MPH = 36;
const POLICE_PURSUIT_BONUS_MPH = 10;
const POLICE_MIN_SPEED_OVER_PERP_MPH = 18;
const POLICE_CLOSE_RANGE_BONUS_MPH = 12;
const PURSUIT_CLOSURE_BOOST = 1.05;

let simClockMs = 0;
const lastRouteRebuildAt = new Map<string, number>();

interface FleetSpec {
  model: string;
  ratedMaxMph: number;
  pursuitMph?: number;
  fleeMph?: number;
}

const policeProfiles = [
  { rank: 'Patrol Officer', eval: 'Steady responder - reliable on routine intercepts' },
  { rank: 'Senior Officer', eval: 'Tactical ace - excels at high-speed coordination' },
  { rank: 'Corporal', eval: 'Veteran tracker - reads suspect patterns quickly' },
  { rank: 'Sergeant', eval: 'Command mindset - optimal unit deployment instincts' },
  { rank: 'Field Training Officer', eval: 'Precision driver - tight gap closure specialist' },
  { rank: 'Traffic Unit', eval: 'Speed specialist - fastest intercept on arterial roads' },
  { rank: 'K-9 Handler', eval: 'Tenacious - maintains pressure through complex routes' },
  { rank: 'Detective', eval: 'Analytical - picks optimal intercept corridors' },
  { rank: 'SWAT Support', eval: 'Heavy unit - strong on highway closure' },
  { rank: 'Motor Unit', eval: 'Agile - cuts through grid traffic fast' },
];

const policeFleet: FleetSpec[] = [
  { model: 'Dodge Charger Pursuit', ratedMaxMph: 149, pursuitMph: 78 },
  { model: 'Ford Police Interceptor Utility', ratedMaxMph: 137, pursuitMph: 72 },
  { model: 'Chevy Tahoe PPV', ratedMaxMph: 120, pursuitMph: 68 },
  { model: 'Ford F-150 Police Responder', ratedMaxMph: 100, pursuitMph: 66 },
  { model: 'Harley-Davidson Police Motorcycle', ratedMaxMph: 105, pursuitMph: 76 },
  { model: 'Ram 1500 Special Service', ratedMaxMph: 115, pursuitMph: 67 },
  { model: 'Chevy Caprice PPV', ratedMaxMph: 130, pursuitMph: 72 },
  { model: 'Dodge Durango Pursuit', ratedMaxMph: 125, pursuitMph: 71 },
  { model: 'Ford Explorer Hybrid PIU', ratedMaxMph: 136, pursuitMph: 73 },
  { model: 'BMW R1250RT-P Motorcycle', ratedMaxMph: 120, pursuitMph: 80 },
];

const perpFleet: FleetSpec[] = [
  { model: 'Stolen Honda Civic', ratedMaxMph: 137, fleeMph: 37 },
  { model: 'Black Ford F-150', ratedMaxMph: 107, fleeMph: 35 },
  { model: 'Sport Motorcycle', ratedMaxMph: 130, fleeMph: 40 },
  { model: 'Gray Panel Van', ratedMaxMph: 90, fleeMph: 31 },
  { model: 'Red Toyota Corolla', ratedMaxMph: 118, fleeMph: 36 },
  { model: 'Nissan Altima', ratedMaxMph: 125, fleeMph: 37 },
  { model: 'White Chevy Suburban', ratedMaxMph: 112, fleeMph: 34 },
  { model: 'Silver Mazda CX-5', ratedMaxMph: 120, fleeMph: 36 },
  { model: 'Black BMW 3 Series', ratedMaxMph: 145, fleeMph: 39 },
  { model: 'Green Jeep Wrangler', ratedMaxMph: 105, fleeMph: 33 },
  { model: 'Tan Kia Soul', ratedMaxMph: 112, fleeMph: 34 },
  { model: 'Maroon Chevy Impala', ratedMaxMph: 130, fleeMph: 36 },
  { model: 'Yellow Mustang', ratedMaxMph: 155, fleeMph: 40 },
  { model: 'White Cargo Van', ratedMaxMph: 95, fleeMph: 32 },
  { model: 'Matte Charger', ratedMaxMph: 149, fleeMph: 39 },
  { model: 'Brown Pickup', ratedMaxMph: 108, fleeMph: 34 },
];

const perpColors = [
  '#ec4899',
  '#f97316',
  '#ef4444',
  '#84cc16',
  '#8b5cf6',
  '#fb7185',
  '#f59e0b',
  '#a855f7',
  '#10b981',
  '#e11d48',
  '#d946ef',
  '#fb923c',
  '#22c55e',
  '#be123c',
  '#facc15',
  '#c084fc',
  '#dc2626',
  '#65a30d',
  '#f43f5e',
  '#ea580c',
];

const perpNames = [
  'Subject Alpha',
  'Subject Bravo',
  'Subject Charlie',
  'Subject Delta',
  'Subject Echo',
  'Subject Foxtrot',
  'Subject Ghost',
  'Subject Havoc',
  'Subject Ion',
  'Subject Joker',
  'Subject Kilo',
  'Subject Lynx',
  'Subject Mako',
  'Subject Nova',
  'Subject Orion',
  'Subject Pike',
  'Subject Quartz',
  'Subject Raptor',
  'Subject Siren',
  'Subject Talon',
  'Subject Umbra',
  'Subject Viper',
  'Subject Wraith',
  'Subject Xenon',
  'Subject Yarrow',
  'Subject Zephyr',
  'Subject Atlas',
  'Subject Bandit',
  'Subject Comet',
  'Subject Drifter',
];

const officerNames = [
  'Martinez',
  'Chen',
  'Johnson',
  'Williams',
  'Patel',
  'Garcia',
  'Thompson',
  'Davis',
  'Wilson',
  'Anderson',
  'Lee',
  'Brown',
  'Nguyen',
  'Rivera',
  'Kim',
  'Foster',
  'Miller',
  'Sanchez',
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mphToMps(mph: number): number {
  return mph * 0.44704;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampToOlathe(point: SimLatLng): SimLatLng {
  return {
    lat: clamp(point.lat, OlatheBounds.latMin, OlatheBounds.latMax),
    lng: clamp(point.lng, OlatheBounds.lngMin, OlatheBounds.lngMax),
  };
}

function snapToRoadGrid(p: SimLatLng): SimLatLng {
  return {
    lat: Math.round(p.lat / ROAD_GRID_STEP) * ROAD_GRID_STEP,
    lng: Math.round(p.lng / ROAD_GRID_STEP) * ROAD_GRID_STEP,
  };
}

function snapToRoad(p: SimLatLng): SimLatLng {
  const point = clampToOlathe(p);
  const network = getRoadNetwork();
  if (!network) return snapToRoadGrid(point);
  const snappedSegment = snapToRoadSegment(network, point);
  if (snappedSegment) return clampToOlathe(snappedSegment.point);
  return clampToOlathe(snapToNearestRoad(network, point));
}

function bearingHeading(from: SimLatLng, to: SimLatLng): number {
  const rad = Math.PI / 180;
  const dLng = (to.lng - from.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(to.lat * rad);
  const x =
    Math.cos(from.lat * rad) * Math.sin(to.lat * rad) -
    Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function interpolateAlongSegment(cur: SimLatLng, next: SimLatLng, progress: number): SimLatLng {
  return {
    lat: cur.lat + (next.lat - cur.lat) * progress,
    lng: cur.lng + (next.lng - cur.lng) * progress,
  };
}

function offsetMeters(center: SimLatLng, northM: number, eastM: number): SimLatLng {
  const lat = center.lat + northM / 111320;
  const lng = center.lng + eastM / (111320 * Math.cos(center.lat * (Math.PI / 180)));
  return clampToOlathe({ lat, lng });
}

function dedupeRoute(route: SimLatLng[], minSepM = MIN_SEGMENT_M): SimLatLng[] {
  if (route.length < 2) return route.map((p) => ({ ...p }));
  const out: SimLatLng[] = [{ ...route[0] }];
  for (let i = 1; i < route.length; i++) {
    const prev = out[out.length - 1];
    const cur = route[i];
    if (haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng) >= minSepM) {
      out.push({ ...cur });
    }
  }
  if (out.length === 1) out.push({ ...route[route.length - 1] });
  return out;
}

function routePathLength(route: SimLatLng[]): number {
  let len = 0;
  for (let i = 1; i < route.length; i++) {
    len += haversineMeters(route[i - 1].lat, route[i - 1].lng, route[i].lat, route[i].lng);
  }
  return len;
}

function isUsablePursuitRoute(route: SimLatLng[], gapToPerp: number): boolean {
  if (route.length < 2) return false;
  if (!routeFollowsRoads(route) && route.length < 3) return false;
  const len = routePathLength(route);
  if (gapToPerp <= CATCH_CLOSE_METERS) return len >= MIN_SEGMENT_M * 2;
  return len >= MIN_PURSUIT_ROUTE_M || route.length >= 5;
}

function projectOntoRoute(
  route: SimLatLng[],
  point: SimLatLng,
  preferFromIndex = 0
): { index: number; progress: number; point: SimLatLng } {
  if (route.length < 2) {
    return { index: 0, progress: 0, point: route[0] ?? point };
  }

  let bestIdx = Math.max(0, Math.min(preferFromIndex, route.length - 2));
  let bestProgress = 0;
  let bestPoint = route[bestIdx];
  let bestDist = Infinity;

  const start = Math.max(0, preferFromIndex - 1);
  for (let i = start; i < route.length - 1; i++) {
    const cur = route[i];
    const next = route[i + 1];
    const dLat = next.lat - cur.lat;
    const dLng = next.lng - cur.lng;
    const segLenSq = dLat * dLat + dLng * dLng;
    if (segLenSq < 1e-12) continue;

    const t = clamp(
      ((point.lat - cur.lat) * dLat + (point.lng - cur.lng) * dLng) / segLenSq,
      0,
      1
    );
    const proj = interpolateAlongSegment(cur, next, t);
    const d = haversineMeters(point.lat, point.lng, proj.lat, proj.lng);
    const bias = i < preferFromIndex ? 4 : 0;
    if (d + bias < bestDist) {
      bestDist = d;
      bestIdx = i;
      bestProgress = t;
      bestPoint = proj;
    }
  }

  return { index: bestIdx, progress: bestProgress, point: bestPoint };
}

function canRebuildRoute(v: SimVehicle, force = false): boolean {
  if (force) return true;
  const last = lastRouteRebuildAt.get(v.id) ?? -Infinity;
  return simClockMs - last >= MIN_ROUTE_REBUILD_MS;
}

function hasForwardPath(v: SimVehicle): boolean {
  if (v.route.length < 2 || v.routeIndex >= v.route.length - 1) return false;
  const cur = v.route[v.routeIndex];
  const next = v.route[v.routeIndex + 1];
  const left = haversineMeters(cur.lat, cur.lng, next.lat, next.lng) * (1 - v.routeProgress);
  if (left > MIN_SEGMENT_M) return true;
  for (let i = v.routeIndex + 1; i < v.route.length - 1; i++) {
    if (
      haversineMeters(v.route[i].lat, v.route[i].lng, v.route[i + 1].lat, v.route[i + 1].lng) >
      MIN_SEGMENT_M
    ) {
      return true;
    }
  }
  return false;
}

function buildGridRouteFallback(start: SimLatLng, dest: SimLatLng): SimLatLng[] {
  const route: SimLatLng[] = [snapToRoad(start)];
  let cur = { ...route[0] };
  const end = snapToRoad(dest);
  let safety = 0;
  let preferLat = Math.random() > 0.5;

  while (haversineMeters(cur.lat, cur.lng, end.lat, end.lng) > 60 && safety < 320) {
    safety++;
    const dLat = end.lat - cur.lat;
    const dLng = end.lng - cur.lng;
    const next = { ...cur };
    const moveLat = Math.abs(dLat) >= ROAD_GRID_STEP * 0.4;
    const moveLng = Math.abs(dLng) >= ROAD_GRID_STEP * 0.4;

    if (moveLat && moveLng) {
      if (preferLat) {
        next.lat += Math.sign(dLat) * ROAD_GRID_STEP;
        preferLat = false;
      } else {
        next.lng += Math.sign(dLng) * ROAD_GRID_STEP;
        preferLat = true;
      }
    } else if (moveLng) {
      next.lng += Math.sign(dLng) * ROAD_GRID_STEP;
    } else if (moveLat) {
      next.lat += Math.sign(dLat) * ROAD_GRID_STEP;
    } else {
      break;
    }

    route.push(clampToOlathe(next));
    cur = route[route.length - 1];
  }
  route.push(end);
  return dedupeRoute(route);
}

function buildRoadRouteToDestination(start: SimLatLng, dest: SimLatLng): SimLatLng[] {
  const network = getRoadNetwork();
  if (network) {
    const snappedStart = snapToRoad(start);
    const snappedDest = snapToRoad(dest);
    const osmRoute = buildOsmRoadRoute(network, snappedStart, snappedDest);
    if (routeFollowsRoads(osmRoute)) return dedupeRoute(osmRoute);
    const nodePath = buildRoadNodePath(network, snappedStart, snappedDest);
    if (nodePath.length >= 2) return dedupeRoute(nodePath);
  }
  return buildGridRouteFallback(start, dest);
}

function applyRouteWithProgress(v: SimVehicle, route: SimLatLng[], forceSnap = false): void {
  const clean = dedupeRoute(route);
  if (clean.length < 2) {
    v.route = clean;
    v.routeIndex = 0;
    v.routeProgress = 0;
    lastRouteRebuildAt.set(v.id, simClockMs);
    return;
  }

  const projected = projectOntoRoute(clean, { lat: v.lat, lng: v.lng }, v.routeIndex);
  const snapDist = haversineMeters(v.lat, v.lng, projected.point.lat, projected.point.lng);
  const chasing = v.role === 'police' && v.status === 'chasing';

  v.route = clean;
  if (!forceSnap && snapDist < ROUTE_SNAP_M && projected.index < v.routeIndex - 1) {
    v.routeIndex = Math.min(Math.max(v.routeIndex, 0), clean.length - 2);
    v.routeProgress = clamp(v.routeProgress, 0, 0.99);
  } else {
    v.routeIndex = Math.min(projected.index, clean.length - 2);
    v.routeProgress = projected.progress;
  }

  const snapThreshold = chasing ? PURSUIT_FORCE_SNAP_M : ROUTE_SNAP_M;
  if ((!chasing && forceSnap) || snapDist > snapThreshold) {
    v.lat = projected.point.lat;
    v.lng = projected.point.lng;
  }
  if (v.routeIndex < v.route.length - 1) {
    v.heading = bearingHeading(v.route[v.routeIndex], v.route[v.routeIndex + 1]);
  }

  lastRouteRebuildAt.set(v.id, simClockMs);
}

function routeHasMovement(route: SimLatLng[]): boolean {
  for (let i = 1; i < route.length; i++) {
    if (haversineMeters(route[i - 1].lat, route[i - 1].lng, route[i].lat, route[i].lng) > 40) {
      return true;
    }
  }
  return false;
}

function getPerpRoadTarget(perp: SimVehicle, lookaheadM = PURSUIT_TARGET_LOOKAHEAD_M): SimLatLng {
  if (perp.route.length < 2 || perp.routeIndex >= perp.route.length - 1) {
    return snapToRoad({ lat: perp.lat, lng: perp.lng });
  }

  let remaining = lookaheadM;
  let idx = perp.routeIndex;
  let progress = perp.routeProgress;

  while (idx < perp.route.length - 1 && remaining > 0) {
    const cur = perp.route[idx];
    const next = perp.route[idx + 1];
    const segLen = haversineMeters(cur.lat, cur.lng, next.lat, next.lng);
    if (segLen < 1) {
      idx++;
      progress = 0;
      continue;
    }
    const distLeft = segLen * (1 - progress);
    if (remaining <= distLeft) {
      return interpolateAlongSegment(cur, next, progress + remaining / segLen);
    }
    remaining -= distLeft;
    idx++;
    progress = 0;
  }

  return { ...perp.route[perp.route.length - 1] };
}

function buildPursuitTailRoute(police: SimVehicle, perp: SimVehicle): SimLatLng[] | null {
  if (perp.route.length < 2 || perp.routeIndex >= perp.route.length - 1) return null;

  const gap = haversineMeters(police.lat, police.lng, perp.lat, perp.lng);
  if (gap > PURSUIT_TAIL_JOIN_M) return null;

  const tail: SimLatLng[] = [{ lat: police.lat, lng: police.lng }];
  const onPerp = projectOntoRoute(perp.route, { lat: perp.lat, lng: perp.lng }, perp.routeIndex);
  const join = interpolateAlongSegment(
    perp.route[onPerp.index],
    perp.route[Math.min(onPerp.index + 1, perp.route.length - 1)],
    onPerp.progress
  );
  if (haversineMeters(tail[0].lat, tail[0].lng, join.lat, join.lng) >= MIN_SEGMENT_M) {
    tail.push(join);
  }

  for (let i = onPerp.index + 1; i < perp.route.length; i++) {
    tail.push({ ...perp.route[i] });
  }

  const ahead = getPerpRoadTarget(perp, Math.max(PURSUIT_TARGET_LOOKAHEAD_M, gap + 90));
  const last = tail[tail.length - 1];
  if (haversineMeters(last.lat, last.lng, ahead.lat, ahead.lng) > 25) tail.push(ahead);

  const clean = dedupeRoute(tail);
  return isUsablePursuitRoute(clean, gap) ? clean : null;
}

function buildPursuitRoadRoute(police: SimVehicle, perp: SimVehicle): SimLatLng[] {
  const gap = haversineMeters(police.lat, police.lng, perp.lat, perp.lng);
  const tail = buildPursuitTailRoute(police, perp);
  if (tail && isUsablePursuitRoute(tail, gap)) return tail;

  const lookahead = Math.max(PURSUIT_TARGET_LOOKAHEAD_M, Math.min(720, gap + 300));
  const target = getPerpRoadTarget(perp, lookahead);
  const routed = buildRoadRouteToDestination({ lat: police.lat, lng: police.lng }, target);
  if (isUsablePursuitRoute(routed, gap)) return routed;

  if (perp.destination) {
    const viaDest = buildRoadRouteToDestination({ lat: police.lat, lng: police.lng }, perp.destination);
    if (isUsablePursuitRoute(viaDest, gap)) return viaDest;
  }

  const snappedPerp = snapToRoad({ lat: perp.lat, lng: perp.lng });
  const fallback = buildRoadRouteToDestination({ lat: police.lat, lng: police.lng }, snappedPerp);
  if (isUsablePursuitRoute(fallback, gap) || routeFollowsRoads(fallback)) return fallback;

  if (isUsablePursuitRoute(police.route, gap)) return police.route;
  return buildGridRouteFallback({ lat: police.lat, lng: police.lng }, snappedPerp);
}

function extendPursuitRoute(v: SimVehicle, perp: SimVehicle): SimLatLng[] | null {
  if (v.route.length < 2 || v.routeIndex >= v.route.length - 1) return null;
  const remaining = v.route.slice(v.routeIndex).map((p) => ({ ...p }));
  remaining[0] = { lat: v.lat, lng: v.lng };
  const ahead = getPerpRoadTarget(perp, Math.max(PURSUIT_TARGET_LOOKAHEAD_M, 520));
  const last = remaining[remaining.length - 1];
  if (haversineMeters(last.lat, last.lng, ahead.lat, ahead.lng) > 40) {
    const bridge = buildRoadRouteToDestination(last, ahead);
    for (let i = 1; i < bridge.length; i++) remaining.push(bridge[i]);
  }
  return dedupeRoute(remaining);
}

function ensurePursuitRoute(v: SimVehicle, perp: SimVehicle): void {
  const target = getPerpRoadTarget(perp);
  const end = v.route[v.route.length - 1];
  const atRouteEnd = !hasForwardPath(v);
  const gap = haversineMeters(v.lat, v.lng, perp.lat, perp.lng);
  const endDrift = end ? haversineMeters(end.lat, end.lng, target.lat, target.lng) : Infinity;

  const currentOk =
    hasForwardPath(v) && routeFollowsRoads(v.route) && isUsablePursuitRoute(v.route, gap);

  if (currentOk && !atRouteEnd && endDrift <= PURSUIT_ROUTE_REBUILD_M) return;
  if (currentOk && !atRouteEnd && endDrift > PURSUIT_ROUTE_REBUILD_M) {
    if (!canRebuildRoute(v)) return;
    const extended = extendPursuitRoute(v, perp);
    if (extended && isUsablePursuitRoute(extended, gap)) applyRouteWithProgress(v, extended, false);
    return;
  }

  if (!atRouteEnd && !canRebuildRoute(v)) return;
  if (atRouteEnd && !canRebuildRoute(v, gap <= CATCH_CLOSE_METERS)) return;

  const newRoute = buildPursuitRoadRoute(v, perp);
  if (!isUsablePursuitRoute(newRoute, gap)) return;
  if (
    currentOk &&
    routePathLength(newRoute) + 40 < routePathLength(v.route) * 0.55 &&
    gap > CATCH_CLOSE_METERS
  ) {
    return;
  }

  applyRouteWithProgress(v, newRoute, false);
}

function randomPointInBounds(): SimLatLng {
  return {
    lat: rand(OlatheBounds.latMin + 0.002, OlatheBounds.latMax - 0.002),
    lng: rand(OlatheBounds.lngMin + 0.003, OlatheBounds.lngMax - 0.003),
  };
}

function pickCityRoadPoint(avoid: SimLatLng[] = [], minSepM = MIN_VEHICLE_SPAWN_SEP_M): SimLatLng {
  for (let attempt = 0; attempt < 70; attempt++) {
    const candidate = snapToRoad(randomPointInBounds());
    const ok = avoid.every((p) => haversineMeters(candidate.lat, candidate.lng, p.lat, p.lng) >= minSepM);
    if (ok) return candidate;
  }
  return snapToRoad(randomPointInBounds());
}

function pickNearPoint(
  center: SimLatLng,
  minR: number,
  maxR: number,
  avoid: SimLatLng[] = [],
  minSepM = MIN_VEHICLE_SPAWN_SEP_M
): SimLatLng {
  for (let attempt = 0; attempt < 55; attempt++) {
    const angle = rand(0, Math.PI * 2);
    const r = rand(minR, maxR);
    const candidate = snapToRoad(offsetMeters(center, Math.cos(angle) * r, Math.sin(angle) * r));
    const ok = avoid.every((p) => haversineMeters(candidate.lat, candidate.lng, p.lat, p.lng) >= minSepM);
    if (ok) return candidate;
  }
  return pickCityRoadPoint(avoid, minSepM);
}

function pickPerpDestination(from: SimLatLng, used: SimLatLng[] = []): SimLatLng {
  for (let attempt = 0; attempt < 45; attempt++) {
    const dest = pickCityRoadPoint(used, 220);
    const dist = haversineMeters(from.lat, from.lng, dest.lat, dest.lng);
    if (dist >= PERP_DEST_MIN_M && dist <= PERP_DEST_MAX_M * 1.25) return dest;
  }
  return pickNearPoint(from, PERP_DEST_MIN_M, PERP_DEST_MAX_M, used, 220);
}

function randomIdleRoute(start: SimLatLng): SimLatLng[] {
  const dest = pickNearPoint(start, 180, IDLE_PATROL_RADIUS_M, [], 80);
  return buildRoadRouteToDestination(start, dest);
}

function fleetSpecForVehicle(v: SimVehicle): FleetSpec | undefined {
  const fleet = v.role === 'police' ? policeFleet : perpFleet;
  return fleet.find((f) => f.model === v.vehicleModel);
}

export function getOperationalSpeedMph(v: SimVehicle, pursuedPerp?: SimVehicle): number {
  if (v.status === 'caught' || v.status === 'escaped') return 0;
  const spec = fleetSpecForVehicle(v);
  if (v.role === 'police') {
    if (v.status === 'chasing') {
      let mph = (spec?.pursuitMph ?? Math.min(v.maxSpeedMph * 0.55, 76)) + POLICE_PURSUIT_BONUS_MPH;
      mph *= PURSUIT_CLOSURE_BOOST;
      if (pursuedPerp) {
        const perpFlee = fleetSpecForVehicle(pursuedPerp)?.fleeMph ?? PERP_CRUISE_MPH;
        mph = Math.max(mph, perpFlee + POLICE_MIN_SPEED_OVER_PERP_MPH);
        const gap = haversineMeters(v.lat, v.lng, pursuedPerp.lat, pursuedPerp.lng);
        if (gap <= CATCH_CLOSE_METERS) mph += POLICE_CLOSE_RANGE_BONUS_MPH;
      }
      return mph;
    }
    return POLICE_IDLE_MPH;
  }
  if (v.status !== 'fleeing') return 0;
  const flee = spec?.fleeMph ?? PERP_CRUISE_MPH;
  return v.beingPursued ? Math.min(42, flee + 3) : flee;
}

function advanceVehicle(v: SimVehicle, elapsedSec: number, pursuedPerp?: SimVehicle): void {
  if (v.route.length < 2 || elapsedSec <= 0 || v.status === 'caught' || v.status === 'escaped') return;

  const speed = mphToMps(getOperationalSpeedMph(v, pursuedPerp));
  if (speed <= 0) return;

  let remaining = speed * elapsedSec;
  let guard = 0;

  while (remaining > 0 && v.route.length >= 2 && guard++ < 80) {
    if (v.routeIndex >= v.route.length - 1) {
      if (v.role === 'police' && v.status === 'chasing' && pursuedPerp) {
        ensurePursuitRoute(v, pursuedPerp);
      } else if (v.role === 'police' && v.status === 'idle' && canRebuildRoute(v, true)) {
        applyRouteWithProgress(v, randomIdleRoute({ lat: v.lat, lng: v.lng }), true);
      } else if (v.role === 'perp' && v.status === 'fleeing' && v.destination && canRebuildRoute(v, true)) {
        applyRouteWithProgress(v, buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, v.destination), true);
      } else {
        remaining = 0;
      }
      if (!hasForwardPath(v)) remaining = 0;
      continue;
    }

    const cur = v.route[v.routeIndex];
    const next = v.route[v.routeIndex + 1];
    const segLen = haversineMeters(cur.lat, cur.lng, next.lat, next.lng);
    if (segLen < MIN_SEGMENT_M) {
      v.routeIndex += 1;
      v.routeProgress = 0;
      v.lat = next.lat;
      v.lng = next.lng;
      continue;
    }

    const distLeft = segLen * (1 - v.routeProgress);
    if (remaining >= distLeft) {
      remaining -= distLeft;
      v.routeIndex += 1;
      v.routeProgress = 0;
      v.lat = next.lat;
      v.lng = next.lng;
      v.heading = bearingHeading(cur, next);
    } else {
      v.routeProgress += remaining / segLen;
      const pos = interpolateAlongSegment(cur, next, v.routeProgress);
      v.lat = pos.lat;
      v.lng = pos.lng;
      v.heading = bearingHeading(cur, next);
      remaining = 0;
    }
  }
}

function ensurePerpReady(v: SimVehicle): void {
  if (v.role !== 'perp' || v.status !== 'fleeing') return;
  const pos = { lat: v.lat, lng: v.lng };
  if (!v.destination) {
    v.destination = pickPerpDestination(pos);
    applyRouteWithProgress(v, buildRoadRouteToDestination(pos, v.destination), true);
    return;
  }
  if (v.route.length < 2 || !routeHasMovement(v.route) || !routeFollowsRoads(v.route)) {
    if (!canRebuildRoute(v)) return;
    applyRouteWithProgress(v, buildRoadRouteToDestination(pos, v.destination), false);
  }
}

function perpReachedDestination(v: SimVehicle): boolean {
  if (v.role !== 'perp' || v.status !== 'fleeing' || !v.destination) return false;
  return haversineMeters(v.lat, v.lng, v.destination.lat, v.destination.lng) <= DEST_ARRIVAL_M;
}

function cloneVehicle(v: SimVehicle): SimVehicle {
  return {
    ...v,
    route: v.route.map((p) => ({ ...p })),
    destination: v.destination ? { ...v.destination } : undefined,
  };
}

function cloneSession(session: SimSession): SimSession {
  return {
    ...session,
    vehicles: session.vehicles.map(cloneVehicle),
    landmarks: session.landmarks.map((l) => ({ ...l })),
    notices: session.notices.map((n) => ({ ...n })),
    clusterCenter: session.clusterCenter ? { ...session.clusterCenter } : undefined,
  };
}

function addNotice(session: SimSession, kind: SimNotice['kind'], text: string): void {
  session.notices = [
    ...session.notices.filter((n) => simClockMs - n.atSimMs <= NOTICE_TTL_MS),
    { id: uid('notice'), kind, text, atSimMs: simClockMs },
  ].slice(-8);
}

function activeFleeingPerps(vehicles: SimVehicle[]): SimVehicle[] {
  return vehicles.filter((v) => v.role === 'perp' && v.status === 'fleeing');
}

function isOperationalPolice(v: SimVehicle): boolean {
  if (v.role !== 'police') return false;
  if (v.policeKind === 'helper' && v.helperExpiresAtSimMs !== undefined) {
    return simClockMs < v.helperExpiresAtSimMs;
  }
  return v.status === 'chasing' || v.status === 'idle';
}

function targetIsFleeing(vehicles: SimVehicle[], perpId?: string): boolean {
  if (!perpId) return false;
  return vehicles.some((v) => v.id === perpId && v.role === 'perp' && v.status === 'fleeing');
}

function clearPoliceTarget(police: SimVehicle): void {
  police.status = 'idle';
  police.pursuingPerpId = undefined;
  police.playerAssigned = false;
  if (!hasForwardPath(police)) {
    applyRouteWithProgress(police, randomIdleRoute({ lat: police.lat, lng: police.lng }), true);
  }
}

function releasePoliceTargeting(vehicles: SimVehicle[], perpId: string): void {
  for (const unit of vehicles) {
    if (unit.role === 'police' && unit.pursuingPerpId === perpId) {
      clearPoliceTarget(unit);
    }
  }
}

function assignPoliceToPerp(police: SimVehicle, perp: SimVehicle, playerAssigned = false): void {
  police.status = 'chasing';
  police.pursuingPerpId = perp.id;
  police.playerAssigned = playerAssigned;
  const route = buildPursuitRoadRoute(police, perp);
  if (isUsablePursuitRoute(route, haversineMeters(police.lat, police.lng, perp.lat, perp.lng))) {
    applyRouteWithProgress(police, route, false);
  }
}

function refreshBeingPursued(vehicles: SimVehicle[]): void {
  const pursued = new Set<string>();
  for (const unit of vehicles) {
    if (unit.role === 'police' && unit.status === 'chasing' && unit.pursuingPerpId) {
      pursued.add(unit.pursuingPerpId);
    }
  }
  for (const perp of vehicles) {
    if (perp.role === 'perp') {
      perp.beingPursued = perp.status === 'fleeing' && pursued.has(perp.id);
    }
  }
}

function chooseAutoTarget(
  police: SimVehicle,
  perps: SimVehicle[],
  targetCounts: Map<string, number>
): SimVehicle | undefined {
  return perps
    .map((perp) => ({
      perp,
      count: targetCounts.get(perp.id) ?? 0,
      dist: haversineMeters(police.lat, police.lng, perp.lat, perp.lng),
    }))
    .sort((a, b) => a.count - b.count || a.dist - b.dist)[0]?.perp;
}

function autoAssignPoliceTargets(session: SimSession): void {
  const perps = activeFleeingPerps(session.vehicles);
  if (!perps.length) {
    for (const unit of session.vehicles) {
      if (unit.role === 'police') clearPoliceTarget(unit);
    }
    refreshBeingPursued(session.vehicles);
    return;
  }

  for (const unit of session.vehicles) {
    if (unit.role !== 'police') continue;
    if (!isOperationalPolice(unit)) continue;
    if (unit.pursuingPerpId && !targetIsFleeing(session.vehicles, unit.pursuingPerpId)) {
      clearPoliceTarget(unit);
    }
  }

  const counts = new Map<string, number>();
  for (const unit of session.vehicles) {
    if (unit.role === 'police' && unit.status === 'chasing' && targetIsFleeing(session.vehicles, unit.pursuingPerpId)) {
      counts.set(unit.pursuingPerpId!, (counts.get(unit.pursuingPerpId!) ?? 0) + 1);
    }
  }

  const police = session.vehicles.filter(isOperationalPolice);
  for (const unit of police) {
    if (unit.playerAssigned && targetIsFleeing(session.vehicles, unit.pursuingPerpId)) {
      continue;
    }

    const current = perps.find((p) => p.id === unit.pursuingPerpId);
    if (current) counts.set(current.id, Math.max(0, (counts.get(current.id) ?? 1) - 1));
    const best = chooseAutoTarget(unit, perps, counts);
    if (!best) {
      if (!current) clearPoliceTarget(unit);
      continue;
    }

    if (current) {
      const currentCount = counts.get(current.id) ?? 0;
      const bestCount = counts.get(best.id) ?? 0;
      const currentDist = haversineMeters(unit.lat, unit.lng, current.lat, current.lng);
      const bestDist = haversineMeters(unit.lat, unit.lng, best.lat, best.lng);
      if (currentCount <= bestCount && currentDist <= bestDist * 1.25 + 150) {
        counts.set(current.id, (counts.get(current.id) ?? 0) + 1);
        continue;
      }
    }

    assignPoliceToPerp(unit, best, false);
    counts.set(best.id, (counts.get(best.id) ?? 0) + 1);
  }

  refreshBeingPursued(session.vehicles);
}

function markPerpCaught(session: SimSession, perp: SimVehicle, noticeText?: string): void {
  if (perp.role !== 'perp' || perp.status !== 'fleeing') return;
  perp.status = 'caught';
  perp.beingPursued = false;
  perp.resolvedAtSimMs = simClockMs;
  perp.evaluation = 'Apprehended - suspect removed from pursuit';
  session.score += CATCH_SCORE;
  session.caughtTotal += 1;
  releasePoliceTargeting(session.vehicles, perp.id);
  addNotice(session, 'caught', noticeText ?? `${perp.officerName} caught (+${CATCH_SCORE})`);
}

function markPerpEscaped(session: SimSession, perp: SimVehicle): void {
  if (perp.role !== 'perp' || perp.status !== 'fleeing') return;
  perp.status = 'escaped';
  perp.beingPursued = false;
  perp.resolvedAtSimMs = simClockMs;
  perp.evaluation = 'Escaped - reached destination';
  session.escapedTotal += 1;
  releasePoliceTargeting(session.vehicles, perp.id);
  addNotice(session, 'escaped', `${perp.officerName} escaped`);
}

function buildPoliceVehicleAt(index: number, start: SimLatLng, policeKind: PoliceKind): SimVehicle {
  const fleet = policeFleet[index % policeFleet.length];
  const profile = policeProfiles[index % policeProfiles.length];
  const route = randomIdleRoute(start);
  return {
    id: uid(policeKind === 'helper' ? 'helper' : 'police'),
    role: 'police',
    policeKind,
    lat: start.lat,
    lng: start.lng,
    heading: route.length > 1 ? bearingHeading(route[0], route[1]) : rand(0, 360),
    route,
    routeIndex: 0,
    routeProgress: 0,
    maxSpeedMph: fleet.ratedMaxMph + randInt(-2, 2),
    officerName: `${policeKind === 'helper' ? 'Helper' : 'Officer'} ${officerNames[index % officerNames.length]}`,
    officerRank: profile.rank,
    evaluation: profile.eval,
    vehicleModel: fleet.model,
    status: 'idle',
    beingPursued: false,
  };
}

function buildPerpVehicleAt(index: number, start: SimLatLng, usedDestinations: SimLatLng[] = []): SimVehicle {
  const dest = pickPerpDestination(start, usedDestinations);
  usedDestinations.push(dest);
  const fleet = perpFleet[index % perpFleet.length];
  const route = buildRoadRouteToDestination(start, dest);
  return {
    id: uid('perp'),
    role: 'perp',
    color: perpColors[index % perpColors.length],
    lat: start.lat,
    lng: start.lng,
    heading: route.length > 1 ? bearingHeading(route[0], route[1]) : rand(0, 360),
    route,
    routeIndex: 0,
    routeProgress: 0,
    maxSpeedMph: fleet.ratedMaxMph + randInt(-3, 3),
    officerName: perpNames[index % perpNames.length],
    evaluation: 'Suspect vehicle - fleeing toward an exit route',
    vehicleModel: fleet.model,
    status: 'fleeing',
    beingPursued: false,
    destination: dest,
  };
}

function activeAreaCenter(session: SimSession): SimLatLng {
  const tracked = session.vehicles.filter(
    (v) => (v.role === 'perp' && v.status === 'fleeing' && v.beingPursued) || (v.role === 'police' && v.status === 'chasing')
  );
  const source = tracked.length ? tracked : session.vehicles.filter((v) => v.role === 'perp' && v.status === 'fleeing');
  if (!source.length) return session.clusterCenter ?? { lat: OLATHE_CENTER[0], lng: OLATHE_CENTER[1] };
  return snapToRoad({
    lat: source.reduce((sum, v) => sum + v.lat, 0) / source.length,
    lng: source.reduce((sum, v) => sum + v.lng, 0) / source.length,
  });
}

function spawnHelpersIfDue(session: SimSession): void {
  if (helpersActive(session) || simClockMs < session.helpersNextAtSimMs) return;

  const center = activeAreaCenter(session);
  const avoid = session.vehicles.map((v) => ({ lat: v.lat, lng: v.lng }));
  const policeIndexBase = session.vehicles.filter((v) => v.role === 'police').length;
  for (let i = 0; i < HELPER_COUNT; i++) {
    const start = pickNearPoint(center, HELPER_SPAWN_MIN_M, HELPER_SPAWN_MAX_M, avoid);
    avoid.push(start);
    const helper = buildPoliceVehicleAt(policeIndexBase + i, start, 'helper');
    helper.helperExpiresAtSimMs = simClockMs + HELPER_ACTIVE_MS;
    session.vehicles.push(helper);
  }
  addNotice(session, 'helper', 'Helper units on scene');
  autoAssignPoliceTargets(session);
}

function expireHelpers(session: SimSession): void {
  const expiring = session.vehicles.filter(
    (v) => v.role === 'police' && v.policeKind === 'helper' && (v.helperExpiresAtSimMs ?? Infinity) <= simClockMs
  );
  if (!expiring.length) return;
  const expiringIds = new Set(expiring.map((v) => v.id));
  session.vehicles = session.vehicles.filter((v) => !expiringIds.has(v.id));
  session.helpersNextAtSimMs = simClockMs + HELPER_COOLDOWN_MS;
  addNotice(session, 'helper', 'Helpers recalled');
  refreshBeingPursued(session.vehicles);
}

function respawnResolvedPerps(session: SimSession): void {
  const resolved = session.vehicles.filter(
    (v) =>
      v.role === 'perp' &&
      (v.status === 'caught' || v.status === 'escaped') &&
      v.resolvedAtSimMs !== undefined &&
      simClockMs - v.resolvedAtSimMs >= RESOLVED_VISIBLE_MS
  );
  if (!resolved.length) return;

  const resolvedIds = new Set(resolved.map((v) => v.id));
  session.vehicles = session.vehicles.filter((v) => !resolvedIds.has(v.id));
  const avoid = session.vehicles.map((v) => ({ lat: v.lat, lng: v.lng }));
  const usedDestinations = session.vehicles
    .filter((v) => v.role === 'perp' && v.destination)
    .map((v) => v.destination!) as SimLatLng[];
  for (let i = 0; i < resolved.length; i++) {
    const nextIndex = session.caughtTotal + session.escapedTotal + session.vehicles.filter((v) => v.role === 'perp').length + i;
    const start = pickCityRoadPoint(avoid, Math.max(MIN_VEHICLE_SPAWN_SEP_M, 220));
    avoid.push(start);
    session.vehicles.push(buildPerpVehicleAt(nextIndex, start, usedDestinations));
  }
}

const LANDMARK_CATALOG: Array<{ kind: LandmarkKind; names: string[] }> = [
  {
    kind: 'bar',
    names: ['The Broken Tap', 'Rail Yard Tavern', 'Santa Fe Street Pub', 'Cedar Side Bar', 'Off-Duty Lounge'],
  },
  {
    kind: 'club',
    names: ['Neon Alley', 'After Hours Olathe', 'The Velvet Grid', 'Pulse & Siren', 'Blackout Room', 'Kilowatt Club'],
  },
  {
    kind: 'factory',
    names: ['Kansas Ave Mill Works', 'Cedar Creek Assembly Yard', 'Prairie Tool Foundry', 'Old Silo Packing Plant'],
  },
  {
    kind: 'projects',
    names: ['Ridgeview Courts', 'West Park Flats', 'Southgate Walkups', 'Elm Hollow Residences'],
  },
];

const LANDMARK_COUNTS: Record<LandmarkKind, number> = {
  bar: 3,
  club: 4,
  factory: 2,
  projects: 2,
};

const MIN_LANDMARK_SEP_M = 280;

function shuffleCopy<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickLandmarkPoint(avoid: SimLatLng[]): SimLatLng {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = {
      lat: rand(OlatheBounds.latMin + 0.003, OlatheBounds.latMax - 0.003),
      lng: rand(OlatheBounds.lngMin + 0.004, OlatheBounds.lngMax - 0.004),
    };
    const ok = avoid.every((p) => haversineMeters(candidate.lat, candidate.lng, p.lat, p.lng) >= MIN_LANDMARK_SEP_M);
    if (ok) return candidate;
  }
  return {
    lat: rand(OlatheBounds.latMin + 0.003, OlatheBounds.latMax - 0.003),
    lng: rand(OlatheBounds.lngMin + 0.004, OlatheBounds.lngMax - 0.004),
  };
}

/** Place named bars, clubs, factories, and projects randomly across Olathe. */
export function createCityLandmarks(): MapLandmark[] {
  const landmarks: MapLandmark[] = [];
  const placed: SimLatLng[] = [];

  for (const catalog of LANDMARK_CATALOG) {
    const count = LANDMARK_COUNTS[catalog.kind];
    const names = shuffleCopy(catalog.names).slice(0, count);
    for (const name of names) {
      const point = pickLandmarkPoint(placed);
      placed.push(point);
      landmarks.push({
        id: uid(`lm-${catalog.kind}`),
        kind: catalog.kind,
        name,
        lat: point.lat,
        lng: point.lng,
      });
    }
  }

  return shuffleCopy(landmarks);
}

export function createSimSession(userId: string): SimSession {
  simClockMs = 0;
  lastRouteRebuildAt.clear();

  const clusterCenter = snapToRoad({ lat: OLATHE_CENTER[0], lng: OLATHE_CENTER[1] });
  const vehicles: SimVehicle[] = [];
  const usedDestinations: SimLatLng[] = [];
  const avoid: SimLatLng[] = [];

  for (let i = 0; i < PERP_COUNT; i++) {
    const start = pickCityRoadPoint(avoid, 210);
    avoid.push(start);
    vehicles.push(buildPerpVehicleAt(i, start, usedDestinations));
  }

  for (let i = 0; i < INITIAL_SQUAD_COUNT; i++) {
    const start = pickNearPoint(clusterCenter, 80, 650, avoid, MIN_VEHICLE_SPAWN_SEP_M);
    avoid.push(start);
    vehicles.push(buildPoliceVehicleAt(i, start, 'squad'));
  }

  const session: SimSession = {
    id: uid('session'),
    userId,
    vehicles,
    landmarks: createCityLandmarks(),
    score: BASE_SCORE,
    caughtTotal: 0,
    escapedTotal: 0,
    notices: [],
    helpersNextAtSimMs: FIRST_HELPER_DELAY_MS,
    clusterCenter,
    startedAtMs: Date.now(),
  };

  autoAssignPoliceTargets(session);
  return session;
}

export function redirectPoliceTo(session: SimSession, policeId: string, perpId: string): SimSession {
  const next = cloneSession(session);
  const police = next.vehicles.find((v) => v.id === policeId && v.role === 'police');
  const perp = next.vehicles.find((v) => v.id === perpId && v.role === 'perp');
  if (!police || !perp || !isOperationalPolice(police) || perp.status !== 'fleeing') {
    return next;
  }
  assignPoliceToPerp(police, perp, true);
  autoAssignPoliceTargets(next);
  return next;
}

export function deployWeapon(
  session: SimSession,
  kind: WeaponKind,
  perpId: string
): { session: SimSession; ok: boolean; reason?: string } {
  const next = cloneSession(session);
  const cost = WEAPON_COSTS[kind];
  const label = WEAPON_LABELS[kind];

  if (next.score < cost) {
    const reason = `Insufficient score for ${label}`;
    addNotice(next, 'warn', reason);
    return { session: next, ok: false, reason };
  }

  const perp = next.vehicles.find((v) => v.id === perpId && v.role === 'perp');
  if (!perp || perp.status !== 'fleeing') {
    const reason = 'Target is no longer fleeing';
    addNotice(next, 'warn', reason);
    return { session: next, ok: false, reason };
  }

  next.score -= cost;
  addNotice(next, 'weapon', `${label} deployed (-${cost})`);
  markPerpCaught(next, perp, `${label} neutralized ${perp.officerName} (+${CATCH_SCORE})`);
  autoAssignPoliceTargets(next);
  return { session: next, ok: true };
}

export function tickSimSession(session: SimSession, elapsedSec: number): SimSession {
  const elapsedMs = Math.max(0, Math.min(elapsedSec, 0.5)) * 1000;
  simClockMs += elapsedMs;

  const next = cloneSession(session);
  expireHelpers(next);
  spawnHelpersIfDue(next);

  for (const perp of next.vehicles) {
    if (perp.role !== 'perp' || perp.status !== 'fleeing') continue;
    ensurePerpReady(perp);
    advanceVehicle(perp, elapsedMs / 1000);
    if (perpReachedDestination(perp)) markPerpEscaped(next, perp);
  }

  autoAssignPoliceTargets(next);

  for (const police of next.vehicles) {
    if (police.role !== 'police' || !isOperationalPolice(police)) continue;
    const perp = police.pursuingPerpId
      ? next.vehicles.find((v) => v.id === police.pursuingPerpId && v.role === 'perp')
      : undefined;
    if (police.status === 'chasing' && perp?.status === 'fleeing') {
      ensurePursuitRoute(police, perp);
      advanceVehicle(police, elapsedMs / 1000, perp);
      if (haversineMeters(police.lat, police.lng, perp.lat, perp.lng) <= CATCH_METERS) {
        markPerpCaught(next, perp);
      }
    } else {
      clearPoliceTarget(police);
      advanceVehicle(police, (elapsedMs / 1000) * 0.35);
    }
  }

  respawnResolvedPerps(next);
  autoAssignPoliceTargets(next);
  next.notices = next.notices.filter((notice) => simClockMs - notice.atSimMs <= NOTICE_TTL_MS);
  return next;
}

export function helpersActive(session: SimSession): boolean {
  return session.vehicles.some(
    (v) => v.role === 'police' && v.policeKind === 'helper' && (v.helperExpiresAtSimMs ?? 0) > simClockMs
  );
}

export function helpersCountdownSec(session: SimSession): number {
  const helpers = session.vehicles.filter((v) => v.role === 'police' && v.policeKind === 'helper');
  if (helpers.length) {
    const remaining = Math.max(...helpers.map((v) => (v.helperExpiresAtSimMs ?? simClockMs) - simClockMs));
    return Math.max(0, Math.ceil(remaining / 1000));
  }
  return Math.max(0, Math.ceil((session.helpersNextAtSimMs - simClockMs) / 1000));
}

export function canAffordWeapon(session: SimSession, kind: WeaponKind): boolean {
  return session.score >= WEAPON_COSTS[kind];
}
