/** Client-side pursuit exam simulation — drives smooth map movement. */

import {
  buildOsmRoadRoute,
  getRoadNetwork,
  routeFollowsRoads,
  snapToNearestRoad,
} from './olatheRoadNetwork';

export interface SimLatLng {
  lat: number;
  lng: number;
}

export interface SimVehicle {
  id: string;
  role: 'police' | 'perp';
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
  pursuingPerpId?: string;
  status: 'patrol' | 'pursuing' | 'caught' | 'idle' | 'escaped' | 'down';
  beingPursued: boolean;
  destination?: SimLatLng;
  downAt?: number;
  downReason?: string;
}

export interface PursuitDecision {
  policeId: string;
  policeName: string;
  policeSpeed: number;
  policeRank?: string;
  vehicleModel: string;
  perpId: string;
  perpName: string;
  perpSpeed: number;
  perpModel: string;
  timestampMs: number;
  outcome?: 'caught' | 'escaped' | 'interrupted';
}

export interface PoliceStatusRecord {
  name: string;
  status: string;
  model: string;
  speed: number;
  rank?: string;
}

export interface RoundStats {
  round: number;
  roundDurationSec: number;
  totalPolice: number;
  totalPerps: number;
  policeDown: number;
  policeUsed: number;
  pursuitsLaunched: number;
  caught: number;
  escaped: number;
  outcome: string;
  operationalScore: number;
  decisions: PursuitDecision[];
  policeStatus: PoliceStatusRecord[];
}

export interface PursuitAIEvaluation {
  grade: 'A' | 'B' | 'C' | string;
  score: number;
  summary: string;
  strategyAnalysis: string;
  resourceAnalysis: string;
  strengths: string[];
  improvements: string[];
}

export interface SimRoundResult {
  outcome: 'total_failure' | 'partial_win' | 'total_win';
  caught: number;
  escaped: number;
  totalPerps: number;
  score: number;
  message: string;
  grade: string;
  stats?: RoundStats;
}

export interface SimSession {
  id: string;
  userId: string;
  phase: 'active' | 'completed' | 'cooldown';
  round: number;
  roundEndsAt: number;
  cooldownEndsAt?: number;
  vehicles: SimVehicle[];
  result?: SimRoundResult;
  armedPoliceId?: string;
  stats?: RoundStats;
  roundStartMs?: number;
}

/** Total vehicles on the map each round (police + suspects), both factions present. */
export const FLEET_TOTAL_MIN = 4;
export const FLEET_TOTAL_MAX = 6;

function randomFleetCounts(): { policeCount: number; perpCount: number } {
  const total = randInt(FLEET_TOTAL_MIN, FLEET_TOTAL_MAX);
  // Keep both sides present without overcrowding the map.
  const policeCount = randInt(2, Math.max(2, total - 2));
  return { policeCount, perpCount: total - policeCount };
}
/** Real mph on the map — no arcade speed multiplier. */
export const SIM_MOVEMENT_SCALE = 1.0;

export const ROUND_MS = 12 * 60 * 60 * 1000;
export const ROUND_RESET_AVAILABLE_MS = 3 * 60 * 1000;
/** Gap after a round ends before auto-start; user can also start manually sooner. */
export const ROUND_COOLDOWN_MS = 5 * 60 * 1000;
const CATCH_METERS = 55;
const CATCH_CLOSE_METERS = 120;
const DEST_ARRIVAL_M = 40;
const OlatheBounds = { latMin: 38.86, latMax: 38.91, lngMin: -94.85, lngMax: -94.78 };
/** Fallback grid step when OSM roads are still loading (~22 m). */
const ROAD_GRID_STEP = 0.0002;
const PURSUIT_ROUTE_REBUILD_M = 420;
const PURSUIT_TARGET_LOOKAHEAD_M = 320;
const PURSUIT_TAIL_JOIN_M = 450;
const MIN_ROUTE_REBUILD_MS = 4500;
const MIN_SEGMENT_M = 4;
/** Only hard-snap position when this far off the rebuilt polyline (reduces chase jumps). */
const ROUTE_SNAP_M = 55;
/** Reject tiny chase stubs that cause loop/appear-disappear thrash. */
const MIN_PURSUIT_ROUTE_M = 180;

/** Throttle route rebuilds per vehicle to prevent shake/teleport loops. */
const lastRouteRebuildAt = new Map<string, number>();
const MIN_VEHICLE_SPAWN_SEP_M = 1100;

const PATROL_CRUISE_MPH = 28;
const PERP_CRUISE_MPH = 30;
/** Police stay clearly faster than fleeing suspects, still in real-world range. */
const POLICE_PURSUIT_BONUS_MPH = 8;
const POLICE_MIN_SPEED_OVER_PERP_MPH = 12;
const POLICE_CLOSE_RANGE_BONUS_MPH = 10;
const POLICE_PURSUIT_MULTIPLIER = 1.0;
const PERP_FLEE_MULTIPLIER = 1.0;
const PURSUIT_CLOSURE_BOOST = 1.05;

interface FleetSpec {
  model: string;
  ratedMaxMph: number;
  pursuitMph?: number;
  fleeMph?: number;
}

const policeProfiles = [
  { rank: 'Patrol Officer', eval: 'Steady responder — reliable on routine intercepts' },
  { rank: 'Senior Officer', eval: 'Tactical ace — excels at high-speed coordination' },
  { rank: 'Corporal', eval: 'Veteran tracker — reads suspect patterns quickly' },
  { rank: 'Sergeant', eval: 'Command mindset — optimal unit deployment instincts' },
  { rank: 'Field Training Officer', eval: 'Precision driver — tight gap closure specialist' },
  { rank: 'Traffic Unit', eval: 'Speed specialist — fastest intercept on arterial roads' },
  { rank: 'K-9 Handler', eval: 'Tenacious — maintains pressure through complex routes' },
  { rank: 'Detective', eval: 'Analytical — picks optimal intercept corridors' },
  { rank: 'SWAT Support', eval: 'Heavy unit — strong on highway closure' },
  { rank: 'Motor Unit', eval: 'Agile — cuts through grid traffic fast' },
];

const policeFleet: FleetSpec[] = [
  { model: 'Dodge Charger Pursuit', ratedMaxMph: 149, pursuitMph: 95 },
  { model: 'Ford Police Interceptor Utility', ratedMaxMph: 137, pursuitMph: 88 },
  { model: 'Chevy Tahoe PPV', ratedMaxMph: 120, pursuitMph: 82 },
  { model: 'Ford F-150 Police Responder', ratedMaxMph: 100, pursuitMph: 78 },
  { model: 'Harley-Davidson Police Motorcycle', ratedMaxMph: 105, pursuitMph: 85 },
  { model: 'Ram 1500 Special Service', ratedMaxMph: 115, pursuitMph: 80 },
  { model: 'Chevy Caprice PPV', ratedMaxMph: 130, pursuitMph: 86 },
  { model: 'Dodge Durango Pursuit', ratedMaxMph: 125, pursuitMph: 84 },
  { model: 'Ford Explorer Hybrid PIU', ratedMaxMph: 136, pursuitMph: 87 },
  { model: 'BMW R1250RT-P Motorcycle', ratedMaxMph: 120, pursuitMph: 90 },
];

const perpFleet: FleetSpec[] = [
  { model: 'Stolen Honda Civic', ratedMaxMph: 137, fleeMph: 72 },
  { model: 'Black Ford F-150', ratedMaxMph: 107, fleeMph: 68 },
  { model: 'Sport Motorcycle', ratedMaxMph: 130, fleeMph: 78 },
  { model: 'Gray Panel Van', ratedMaxMph: 90, fleeMph: 58 },
  { model: 'Red Toyota Corolla', ratedMaxMph: 118, fleeMph: 70 },
  { model: 'Blue Nissan Altima', ratedMaxMph: 125, fleeMph: 71 },
  { model: 'White Chevy Suburban', ratedMaxMph: 112, fleeMph: 65 },
  { model: 'Silver Mazda CX-5', ratedMaxMph: 120, fleeMph: 69 },
  { model: 'Black BMW 3 Series', ratedMaxMph: 145, fleeMph: 76 },
  { model: 'Green Jeep Wrangler', ratedMaxMph: 105, fleeMph: 62 },
];

const perpNames = [
  'Subject Alpha', 'Subject Bravo', 'Subject Charlie', 'Subject Delta',
  'Subject Echo', 'Subject Foxtrot', 'Subject Ghost', 'Subject Havoc', 'Subject Ion',
  'Subject Joker', 'Subject Kilo', 'Subject Lynx',
];

const officerNames = [
  'Martinez', 'Chen', 'Johnson', 'Williams', 'Patel', 'Garcia',
  'Thompson', 'Davis', 'Wilson', 'Anderson', 'Lee', 'Brown',
  'Nguyen', 'Rivera', 'Kim', 'Foster',
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mphToMps(mph: number) {
  return mph * 0.44704;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function snapToRoadGrid(p: SimLatLng): SimLatLng {
  return {
    lat: Math.round(p.lat / ROAD_GRID_STEP) * ROAD_GRID_STEP,
    lng: Math.round(p.lng / ROAD_GRID_STEP) * ROAD_GRID_STEP,
  };
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
  if (out.length === 1 && route.length > 1) {
    out.push({ ...route[route.length - 1] });
  }
  return out;
}

function routePathLength(route: SimLatLng[]): number {
  let len = 0;
  for (let i = 1; i < route.length; i++) {
    len += haversineMeters(route[i - 1].lat, route[i - 1].lng, route[i].lat, route[i].lng);
  }
  return len;
}

/** Pursuit routes must be road-like and long enough to avoid short-loop thrash. */
function isUsablePursuitRoute(route: SimLatLng[], gapToPerp: number): boolean {
  if (route.length < 2) return false;
  if (!routeFollowsRoads(route) && route.length < 3) return false;
  const len = routePathLength(route);
  // Closing distance may use a short final segment.
  if (gapToPerp <= CATCH_CLOSE_METERS) return len >= MIN_SEGMENT_M * 2;
  return len >= MIN_PURSUIT_ROUTE_M || route.length >= 5;
}

function projectOntoRoute(
  route: SimLatLng[],
  point: SimLatLng,
  preferFromIndex = 0
): {
  index: number;
  progress: number;
  point: SimLatLng;
} {
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
    // Prefer forward segments when distances are close — avoids oscillation at vertices.
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
  const last = lastRouteRebuildAt.get(v.id) ?? 0;
  return performance.now() - last >= MIN_ROUTE_REBUILD_MS;
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

function randomPointInZone(latMin: number, latMax: number, lngMin: number, lngMax: number): SimLatLng {
  return snapToRoad({ lat: rand(latMin, latMax), lng: rand(lngMin, lngMax) });
}

function snapToRoad(p: SimLatLng): SimLatLng {
  const network = getRoadNetwork();
  if (network) return snapToNearestRoad(network, p);
  return snapToRoadGrid(p);
}

function buildGridRouteFallback(start: SimLatLng, dest: SimLatLng): SimLatLng[] {
  const route: SimLatLng[] = [snapToRoad(start)];
  let cur = { ...route[0] };
  const end = snapToRoad(dest);
  let safety = 0;
  let preferLat = Math.random() > 0.5;

  while (haversineMeters(cur.lat, cur.lng, end.lat, end.lng) > 60 && safety < 280) {
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

    next.lat = clamp(next.lat, OlatheBounds.latMin, OlatheBounds.latMax);
    next.lng = clamp(next.lng, OlatheBounds.lngMin, OlatheBounds.lngMax);
    route.push(next);
    cur = next;
  }
  route.push(end);
  return route;
}

function buildRoadRouteToDestination(start: SimLatLng, dest: SimLatLng): SimLatLng[] {
  const network = getRoadNetwork();
  if (network) {
    const osmRoute = buildOsmRoadRoute(network, start, dest);
    if (routeFollowsRoads(osmRoute)) return dedupeRoute(osmRoute);
  }
  return dedupeRoute(buildGridRouteFallback(start, dest));
}

function applyRouteWithProgress(v: SimVehicle, route: SimLatLng[], forceSnap = false) {
  const clean = dedupeRoute(route);
  if (clean.length < 2) {
    v.route = clean;
    v.routeIndex = 0;
    v.routeProgress = 0;
    lastRouteRebuildAt.set(v.id, performance.now());
    return;
  }

  const projected = projectOntoRoute(clean, { lat: v.lat, lng: v.lng }, v.routeIndex);
  const snapDist = haversineMeters(v.lat, v.lng, projected.point.lat, projected.point.lng);

  v.route = clean;
  // Keep forward progress when the new polyline is nearby — avoids jump-backs along the line.
  if (!forceSnap && snapDist < ROUTE_SNAP_M * 1.5 && projected.index < v.routeIndex - 1) {
    v.routeIndex = Math.min(Math.max(v.routeIndex, 0), clean.length - 2);
    v.routeProgress = clamp(v.routeProgress, 0, 0.99);
  } else {
    v.routeIndex = Math.min(projected.index, clean.length - 2);
    v.routeProgress = projected.progress;
  }

  // Soft snap only when meaningfully off the polyline — stops rebuild shake/teleports.
  if (forceSnap || snapDist > ROUTE_SNAP_M) {
    v.lat = projected.point.lat;
    v.lng = projected.point.lng;
  }

  lastRouteRebuildAt.set(v.id, performance.now());
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

/** Remaining road path the suspect is already driving — keeps police on the same roads. */
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

  // Extend a bit past the current perp position so police keep closing.
  const ahead = getPerpRoadTarget(perp, Math.max(PURSUIT_TARGET_LOOKAHEAD_M, gap + 80));
  const last = tail[tail.length - 1];
  if (haversineMeters(last.lat, last.lng, ahead.lat, ahead.lng) > 25) {
    tail.push(ahead);
  }

  const clean = dedupeRoute(tail);
  return routeFollowsRoads(clean) || clean.length >= 3 ? clean : null;
}

function buildPursuitRoadRoute(police: SimVehicle, perp: SimVehicle): SimLatLng[] {
  const gap = haversineMeters(police.lat, police.lng, perp.lat, perp.lng);
  const tail = buildPursuitTailRoute(police, perp);
  if (tail && isUsablePursuitRoute(tail, gap)) return tail;

  // Prefer a farther lookahead so rebuilds don't collapse into short stubs.
  const lookahead = Math.max(PURSUIT_TARGET_LOOKAHEAD_M, Math.min(700, gap + 280));
  const target = getPerpRoadTarget(perp, lookahead);
  const routed = buildRoadRouteToDestination({ lat: police.lat, lng: police.lng }, target);
  if (isUsablePursuitRoute(routed, gap)) return routed;

  // Route toward the perp's own destination when available for a longer road path.
  if (perp.destination) {
    const viaDest = buildRoadRouteToDestination(
      { lat: police.lat, lng: police.lng },
      perp.destination
    );
    if (isUsablePursuitRoute(viaDest, gap)) return viaDest;
  }

  // Last resort: route to the suspect's current road-snapped position, never a long chord.
  const snappedPerp = snapToRoad({ lat: perp.lat, lng: perp.lng });
  const fallback = buildRoadRouteToDestination({ lat: police.lat, lng: police.lng }, snappedPerp);
  if (isUsablePursuitRoute(fallback, gap) || routeFollowsRoads(fallback)) return fallback;

  // Stay on the current road-following route rather than drawing a straight line.
  if (isUsablePursuitRoute(police.route, gap)) return police.route;
  return buildGridRouteFallback({ lat: police.lat, lng: police.lng }, snappedPerp);
}

function ensurePursuitRoute(v: SimVehicle, perp: SimVehicle) {
  const target = getPerpRoadTarget(perp);
  const end = v.route[v.route.length - 1];
  const atRouteEnd = !hasForwardPath(v);
  const gap = haversineMeters(v.lat, v.lng, perp.lat, perp.lng);
  const endDrift = end
    ? haversineMeters(end.lat, end.lng, target.lat, target.lng)
    : Infinity;

  const currentOk =
    hasForwardPath(v) &&
    routeFollowsRoads(v.route) &&
    isUsablePursuitRoute(v.route, gap);

  // Keep riding a good route — retarget only when exhausted or badly stale.
  if (currentOk && endDrift <= PURSUIT_ROUTE_REBUILD_M) return;

  const needsRebuild =
    atRouteEnd ||
    v.route.length < 2 ||
    !end ||
    !routeFollowsRoads(v.route) ||
    !isUsablePursuitRoute(v.route, gap) ||
    endDrift > PURSUIT_ROUTE_REBUILD_M;

  // Close-range tail join: only when path is exhausted (prevents shake).
  const shouldJoinTail = gap < PURSUIT_TAIL_JOIN_M && atRouteEnd;

  if (!needsRebuild && !shouldJoinTail) return;
  if (!canRebuildRoute(v, atRouteEnd && gap <= CATCH_CLOSE_METERS)) return;

  const newRoute = buildPursuitRoadRoute(v, perp);
  if (!isUsablePursuitRoute(newRoute, gap)) return;

  // Don't swap a long usable route for a much shorter stub.
  if (
    currentOk &&
    routePathLength(newRoute) + 40 < routePathLength(v.route) * 0.55 &&
    gap > CATCH_CLOSE_METERS
  ) {
    return;
  }

  applyRouteWithProgress(v, newRoute, false);
}

function releasePoliceForReassignment(v: SimVehicle) {
  v.status = 'patrol';
  v.pursuingPerpId = undefined;
  applyRouteWithProgress(v, randomPatrolRoute({ lat: v.lat, lng: v.lng }));
}

function fleetSpecForVehicle(v: SimVehicle): FleetSpec | undefined {
  const fleet = v.role === 'police' ? policeFleet : perpFleet;
  return fleet.find((f) => f.model === v.vehicleModel);
}

export function getOperationalSpeedMph(v: SimVehicle, pursuedPerp?: SimVehicle): number {
  if (v.status === 'caught' || v.status === 'escaped' || v.status === 'down') return 0;
  const spec = fleetSpecForVehicle(v);
  let mph = 0;
  if (v.role === 'police') {
    if (v.status === 'pursuing') {
      mph =
        ((spec?.pursuitMph ?? v.maxSpeedMph * POLICE_PURSUIT_MULTIPLIER) + POLICE_PURSUIT_BONUS_MPH) *
        PURSUIT_CLOSURE_BOOST;
      if (pursuedPerp) {
        const perpFlee =
          fleetSpecForVehicle(pursuedPerp)?.fleeMph ??
          pursuedPerp.maxSpeedMph * PERP_FLEE_MULTIPLIER;
        mph = Math.max(mph, perpFlee + POLICE_MIN_SPEED_OVER_PERP_MPH);
        const gap = haversineMeters(v.lat, v.lng, pursuedPerp.lat, pursuedPerp.lng);
        if (gap <= CATCH_CLOSE_METERS) {
          mph += POLICE_CLOSE_RANGE_BONUS_MPH;
        }
      }
    } else {
      mph = PATROL_CRUISE_MPH;
    }
  } else if (v.beingPursued) {
    mph = spec?.fleeMph ?? v.maxSpeedMph * PERP_FLEE_MULTIPLIER;
  } else {
    mph = PERP_CRUISE_MPH;
  }
  return mph * SIM_MOVEMENT_SCALE;
}

export function isPoliceAvailableForPursuit(v: SimVehicle): boolean {
  return v.role === 'police' && v.status !== 'down' && (v.status === 'patrol' || v.status === 'idle');
}

export function isPerpPursuitTarget(v: SimVehicle): boolean {
  return v.role === 'perp' && v.status !== 'caught' && v.status !== 'escaped';
}

function randomPatrolRoute(start: SimLatLng): SimLatLng[] {
  const dest = randomPointInZone(
    OlatheBounds.latMin,
    OlatheBounds.latMax,
    OlatheBounds.lngMin,
    OlatheBounds.lngMax
  );
  return buildRoadRouteToDestination(start, dest);
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function spreadAnchors(): SimLatLng[] {
  const { latMin, latMax, lngMin, lngMax } = OlatheBounds;
  const latMid = (latMin + latMax) / 2;
  const lngMid = (lngMin + lngMax) / 2;
  const latQ1 = latMin + (latMax - latMin) * 0.25;
  const latQ3 = latMin + (latMax - latMin) * 0.75;
  const lngQ1 = lngMin + (lngMax - lngMin) * 0.25;
  const lngQ3 = lngMin + (lngMax - lngMin) * 0.75;
  return [
    { lat: latMin, lng: lngMin },
    { lat: latMin, lng: lngMax },
    { lat: latMax, lng: lngMin },
    { lat: latMax, lng: lngMax },
    { lat: latMid, lng: lngMin },
    { lat: latMid, lng: lngMax },
    { lat: latMin, lng: lngMid },
    { lat: latMax, lng: lngMid },
    { lat: latQ1, lng: lngQ1 },
    { lat: latQ1, lng: lngQ3 },
    { lat: latQ3, lng: lngQ1 },
    { lat: latQ3, lng: lngQ3 },
    { lat: latMid, lng: lngMid },
    { lat: latQ1, lng: lngMid },
    { lat: latQ3, lng: lngMid },
    { lat: latMid, lng: lngQ1 },
  ].map(snapToRoad);
}

function mapCorners(): SimLatLng[] {
  return spreadAnchors().slice(0, 8);
}

function pickSpreadAnchors(count: number, avoid: SimLatLng[] = []): SimLatLng[] {
  const anchors = shuffleInPlace([...spreadAnchors()]);
  const picked: SimLatLng[] = [];
  for (const anchor of anchors) {
    if (picked.length >= count) break;
    const farFromAvoid = [...avoid, ...picked].every(
      (p) => haversineMeters(anchor.lat, anchor.lng, p.lat, p.lng) >= MIN_VEHICLE_SPAWN_SEP_M
    );
    if (farFromAvoid) picked.push(anchor);
  }
  for (const anchor of anchors) {
    if (picked.length >= count) break;
    if (picked.some((p) => p.lat === anchor.lat && p.lng === anchor.lng)) continue;
    picked.push(anchor);
  }
  while (picked.length < count) {
    picked.push(
      snapToRoad({
        lat: rand(OlatheBounds.latMin, OlatheBounds.latMax),
        lng: rand(OlatheBounds.lngMin, OlatheBounds.lngMax),
      })
    );
  }
  return picked.slice(0, count);
}

/** Suspects spawn across spread anchors so larger fleets stay apart. */
function pickPerpSpreadSpawns(count: number): SimLatLng[] {
  return pickSpreadAnchors(count);
}

function pickPerpDestination(from: SimLatLng, used: SimLatLng[] = []): SimLatLng {
  const ranked = mapCorners()
    .filter((c) => !used.some((u) => u.lat === c.lat && u.lng === c.lng))
    .map((corner) => ({ corner, dist: haversineMeters(from.lat, from.lng, corner.lat, corner.lng) }))
    .sort((a, b) => b.dist - a.dist);
  if (ranked.length > 0) return ranked[0].corner;
  return farthestMapCorner(from);
}

function assignPerpDestinations(spawns: SimLatLng[]): SimLatLng[] {
  const used: SimLatLng[] = [];
  return spawns.map((spawn) => {
    const dest = pickPerpDestination(spawn, used);
    used.push(dest);
    return dest;
  });
}

function farthestMapCorner(start: SimLatLng): SimLatLng {
  const corners = [
    { lat: OlatheBounds.latMin, lng: OlatheBounds.lngMin },
    { lat: OlatheBounds.latMin, lng: OlatheBounds.lngMax },
    { lat: OlatheBounds.latMax, lng: OlatheBounds.lngMin },
    { lat: OlatheBounds.latMax, lng: OlatheBounds.lngMax },
  ];
  let best = corners[0];
  let bestDist = 0;
  for (const c of corners) {
    const d = haversineMeters(start.lat, start.lng, c.lat, c.lng);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return snapToRoad(best);
}

function routeHasMovement(route: SimLatLng[]): boolean {
  for (let i = 1; i < route.length; i++) {
    if (haversineMeters(route[i - 1].lat, route[i - 1].lng, route[i].lat, route[i].lng) > 40) {
      return true;
    }
  }
  return false;
}

function ensurePerpReady(v: SimVehicle) {
  if (v.role !== 'perp' || v.status === 'caught' || v.status === 'escaped') return;
  if (v.status !== 'patrol') v.status = 'patrol';

  const pos = { lat: v.lat, lng: v.lng };
  const destDistance = v.destination
    ? haversineMeters(pos.lat, pos.lng, v.destination.lat, v.destination.lng)
    : 0;

  // Only pick a new destination when none exists or the current one was reached.
  // Mid-chase reassignment was collapsing police routes into straight lines.
  if (!v.destination || destDistance <= DEST_ARRIVAL_M) {
    v.destination = pickPerpDestination(pos);
    applyRouteWithProgress(v, buildRoadRouteToDestination(pos, v.destination));
    return;
  }

  if (v.route.length < 2 || !routeHasMovement(v.route) || !routeFollowsRoads(v.route)) {
    if (!canRebuildRoute(v)) return;
    applyRouteWithProgress(v, buildRoadRouteToDestination(pos, v.destination));
  }
}

function randomPoliceSpawn(existing: SimLatLng[]): SimLatLng {
  return pickSpreadAnchors(1, existing)[0];
}

function advanceVehicle(v: SimVehicle, elapsedSec: number, pursuedPerp?: SimVehicle) {
  if (v.route.length < 2 || elapsedSec <= 0 || v.status === 'caught' || v.status === 'escaped') return;

  const speed = mphToMps(getOperationalSpeedMph(v, pursuedPerp));
  if (speed <= 0) return;

  let remaining = speed * elapsedSec;
  let guard = 0;

  while (remaining > 0 && v.route.length >= 2 && guard++ < 80) {
    if (v.routeIndex >= v.route.length - 1) {
      if (!canRebuildRoute(v)) {
        remaining = 0;
        break;
      }
      if (v.role === 'police' && v.status === 'patrol') {
        applyRouteWithProgress(v, randomPatrolRoute({ lat: v.lat, lng: v.lng }), true);
      } else if (v.role === 'police' && v.status === 'pursuing' && pursuedPerp) {
        // Prefer throttled ensurePursuitRoute over immediate short rebuilds.
        ensurePursuitRoute(v, pursuedPerp);
        if (!hasForwardPath(v) && canRebuildRoute(v, true)) {
          const gap = haversineMeters(v.lat, v.lng, pursuedPerp.lat, pursuedPerp.lng);
          const rebuilt = buildPursuitRoadRoute(v, pursuedPerp);
          if (isUsablePursuitRoute(rebuilt, gap)) {
            applyRouteWithProgress(v, rebuilt, false);
          }
        }
      } else if (v.role === 'perp') {
        const dest = pickPerpDestination({ lat: v.lat, lng: v.lng });
        v.destination = dest;
        applyRouteWithProgress(
          v,
          buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, dest),
          true
        );
      } else {
        remaining = 0;
      }
      // If rebuild didn't create forward motion, stop this tick to avoid shake loops.
      if (!hasForwardPath(v)) remaining = 0;
      break;
    }

    const cur = v.route[v.routeIndex];
    const next = v.route[v.routeIndex + 1];
    const segLen = haversineMeters(cur.lat, cur.lng, next.lat, next.lng);

    // Skip micro-segments without rebuilding — rebuild thrash was the shake source.
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

const downReasons = [
  'Engine overheated — unit offline',
  'Tire blowout — awaiting backup',
  'Radio distress — mechanical failure',
  'Accident damage — out of pursuit',
];

function schedulePoliceDowns(vehicles: SimVehicle[], roundStart: number) {
  const police = vehicles.filter((v) => v.role === 'police');
  if (police.length < 2) return;
  const downCount = Math.min(randInt(1, 2), police.length - 1);
  const shuffled = [...police].sort(() => Math.random() - 0.5);
  for (let i = 0; i < downCount; i++) {
    const vehicle = vehicles.find((v) => v.id === shuffled[i].id);
    if (!vehicle) continue;
    vehicle.downAt = roundStart + randInt(Math.floor(ROUND_MS * 0.2), Math.floor(ROUND_MS * 0.75));
    vehicle.downReason = downReasons[randInt(0, downReasons.length - 1)];
  }
}

function applyPoliceDowns(vehicles: SimVehicle[], now: number) {
  for (const v of vehicles) {
    if (v.role !== 'police' || !v.downAt || now < v.downAt || v.status === 'down') continue;
    if (v.status === 'pursuing' && v.pursuingPerpId) {
      const perp = vehicles.find((p) => p.id === v.pursuingPerpId);
      if (perp) perp.beingPursued = false;
    }
    v.status = 'down';
    v.pursuingPerpId = undefined;
    if (v.downReason) v.evaluation = v.downReason;
  }
}

export { ensureRoadNetwork } from './olatheRoadNetwork';

export function getRoundElapsedMs(session: SimSession, now = Date.now()): number {
  const roundStart = session.roundStartMs ?? session.roundEndsAt - ROUND_MS;
  return Math.max(0, now - roundStart);
}

export function canResetRound(session: SimSession, now = Date.now()): boolean {
  return session.phase === 'active' && getRoundElapsedMs(session, now) >= ROUND_RESET_AVAILABLE_MS;
}

export function resetActiveRound(session: SimSession): SimSession {
  return createSimSession(session.userId, session.round);
}

/** Start the next round immediately (after completed/cooldown), skipping remaining wait. */
export function startNextRound(session: SimSession): SimSession {
  if (session.phase !== 'completed' && session.phase !== 'cooldown') return session;
  return createSimSession(session.userId, session.round + 1);
}

export function createSimSession(userId: string, round = 1): SimSession {
  const { policeCount, perpCount } = randomFleetCounts();
  const perpSpawns = pickPerpSpreadSpawns(perpCount);
  const policeSpawns = pickSpreadAnchors(policeCount, perpSpawns);
  const perpDestinations = assignPerpDestinations(perpSpawns);
  const vehicles: SimVehicle[] = [];

  for (let i = 0; i < policeCount; i++) {
    const start = policeSpawns[i];
    const fleet = policeFleet[i % policeFleet.length];
    const profile = policeProfiles[i % policeProfiles.length];
    const route = randomPatrolRoute(start);
    vehicles.push({
      id: uid('police'),
      role: 'police',
      lat: start.lat,
      lng: start.lng,
      heading: route.length > 1 ? bearingHeading(route[0], route[1]) : rand(0, 360),
      route,
      routeIndex: 0,
      routeProgress: 0,
      maxSpeedMph: fleet.ratedMaxMph + randInt(-2, 2),
      officerName: `Officer ${officerNames[i % officerNames.length]}`,
      officerRank: profile.rank,
      evaluation: profile.eval,
      vehicleModel: fleet.model,
      status: 'patrol',
      beingPursued: false,
    });
  }

  for (let i = 0; i < perpCount; i++) {
    const start = perpSpawns[i];
    const dest = perpDestinations[i];
    const fleet = perpFleet[i % perpFleet.length];
    const route = buildRoadRouteToDestination(start, dest);
    const perp: SimVehicle = {
      id: uid('perp'),
      role: 'perp',
      lat: start.lat,
      lng: start.lng,
      heading: route.length > 1 ? bearingHeading(route[0], route[1]) : rand(0, 360),
      route,
      routeIndex: 0,
      routeProgress: 0,
      maxSpeedMph: fleet.ratedMaxMph + randInt(-3, 3),
      officerName: perpNames[i % perpNames.length],
      evaluation: 'Suspect vehicle — evasive driving toward destination',
      vehicleModel: fleet.model,
      destination: dest,
      status: 'patrol',
      beingPursued: false,
    };
    ensurePerpReady(perp);
    vehicles.push(perp);
  }

  const now = Date.now();
  schedulePoliceDowns(vehicles, now);
  return {
    id: uid('session'),
    userId,
    phase: 'active',
    round,
    roundEndsAt: now + ROUND_MS,
    roundStartMs: now,
    vehicles,
    stats: {
      round,
      roundDurationSec: 0,
      totalPolice: policeCount,
      totalPerps: perpCount,
      policeDown: 0,
      policeUsed: 0,
      pursuitsLaunched: 0,
      caught: 0,
      escaped: 0,
      outcome: '',
      operationalScore: 0,
      decisions: [],
      policeStatus: [],
    },
  };
}

export function buildRoundStats(session: SimSession, result: SimRoundResult): RoundStats {
  const police = session.vehicles.filter((v) => v.role === 'police');
  const perps = session.vehicles.filter((v) => v.role === 'perp');
  const usedIds = new Set(session.stats?.decisions.map((d) => d.policeId) ?? []);

  const decisions = (session.stats?.decisions ?? []).map((d) => {
    const perp = perps.find((p) => p.id === d.perpId);
    return {
      ...d,
      outcome: perp?.status === 'caught' ? 'caught' as const : 'escaped' as const,
    };
  });

  const roundStart = session.roundStartMs ?? session.roundEndsAt - ROUND_MS;
  return {
    round: session.round,
    roundDurationSec: Math.round((session.roundEndsAt - roundStart) / 1000),
    totalPolice: police.length,
    totalPerps: perps.length,
    policeDown: police.filter((v) => v.status === 'down').length,
    policeUsed: usedIds.size,
    pursuitsLaunched: session.stats?.pursuitsLaunched ?? decisions.length,
    caught: result.caught,
    escaped: result.escaped,
    outcome: result.outcome,
    operationalScore: result.score,
    decisions,
    policeStatus: police.map((v) => ({
      name: v.officerName,
      status: v.status,
      model: v.vehicleModel,
      speed: v.maxSpeedMph,
      rank: v.officerRank,
    })),
  };
}

function markPerpEscaped(v: SimVehicle, vehicles: SimVehicle[]) {
  v.status = 'escaped';
  v.beingPursued = false;
  v.evaluation = 'Suspect evaded — reached destination';
  for (const unit of vehicles) {
    if (unit.role === 'police' && unit.pursuingPerpId === v.id) {
      releasePoliceForReassignment(unit);
    }
  }
}

function perpReachedDestination(v: SimVehicle): boolean {
  if (!v.destination) return false;
  return haversineMeters(v.lat, v.lng, v.destination.lat, v.destination.lng) <= DEST_ARRIVAL_M;
}

function shouldFinishRoundEarly(vehicles: SimVehicle[]): boolean {
  const perps = vehicles.filter((v) => v.role === 'perp');
  if (perps.length === 0) return false;
  return perps.every((v) => v.status === 'caught' || v.status === 'escaped');
}

export function tickSimSession(session: SimSession, elapsedSec: number): SimSession {
  const now = Date.now();
  const next = { ...session, vehicles: session.vehicles.map((v) => ({ ...v, route: [...v.route] })) };

  if (next.phase === 'completed' || next.phase === 'cooldown') {
    if (next.cooldownEndsAt && now >= next.cooldownEndsAt) {
      return createSimSession(next.userId, next.round + 1);
    }
    return next;
  }

  applyPoliceDowns(next.vehicles, now);

  const perpPositions: Record<string, SimLatLng> = {};
  for (const v of next.vehicles) {
    if (v.role === 'perp' && v.status !== 'caught' && v.status !== 'escaped') {
      ensurePerpReady(v);
      advanceVehicle(v, elapsedSec);
      if (perpReachedDestination(v)) {
        markPerpEscaped(v, next.vehicles);
      } else {
        perpPositions[v.id] = { lat: v.lat, lng: v.lng };
      }
    }
  }

  for (const v of next.vehicles) {
    if (v.role !== 'police' || v.status === 'down') continue;
    if (v.status === 'idle') v.status = 'patrol';

    if (v.status === 'pursuing' && v.pursuingPerpId) {
      const perp = next.vehicles.find((p) => p.id === v.pursuingPerpId);
      if (!perpPositions[v.pursuingPerpId] || !perp || perp.status === 'caught' || perp.status === 'escaped') {
        releasePoliceForReassignment(v);
        advanceVehicle(v, elapsedSec * 0.5);
        continue;
      }
      ensurePursuitRoute(v, perp);
      advanceVehicle(v, elapsedSec, perp);
      if (haversineMeters(v.lat, v.lng, perp.lat, perp.lng) <= CATCH_METERS) {
        perp.status = 'caught';
        perp.beingPursued = false;
        releasePoliceForReassignment(v);
      }
    } else if (v.status === 'patrol') {
      advanceVehicle(v, elapsedSec);
    }
  }

  if (shouldFinishRoundEarly(next.vehicles)) {
    return finishSimRound(next);
  }

  if (now >= next.roundEndsAt) {
    return finishSimRound(next);
  }

  return next;
}

function finishSimRound(session: SimSession): SimSession {
  let caught = 0;
  let total = 0;
  for (const v of session.vehicles) {
    if (v.role === 'perp') {
      total++;
      if (v.status !== 'caught') v.status = 'escaped';
      else caught++;
    }
    if (v.role === 'police' && v.status === 'pursuing') {
      v.status = 'patrol';
      v.pursuingPerpId = undefined;
    }
  }
  const escaped = total - caught;
  let outcome: SimRoundResult['outcome'] = 'partial_win';
  let score = Math.round((caught / total) * 100);
  let grade = 'C';
  let message = `Partial win — ${caught} of ${total} suspects caught.`;
  if (caught === 0) {
    outcome = 'total_failure';
    score = 0;
    grade = 'F';
    message = 'Total failure — all suspects evaded.';
  } else if (caught === total) {
    outcome = 'total_win';
    score = 100;
    grade = 'A+';
    message = 'Total win — every suspect apprehended.';
  } else if (score >= 75) grade = 'B';
  else if (score < 50) grade = 'D';

  return {
    ...session,
    phase: 'completed',
    cooldownEndsAt: Date.now() + ROUND_COOLDOWN_MS,
    result: (() => {
      const result = { outcome, caught, escaped, totalPerps: total, score, message, grade };
      return { ...result, stats: buildRoundStats(session, result) };
    })(),
    stats: buildRoundStats(session, { outcome, caught, escaped, totalPerps: total, score, message, grade }),
  };
}

export function armPursuit(session: SimSession, policeId: string): SimSession {
  if (session.phase !== 'active') return session;
  return { ...session, armedPoliceId: policeId };
}

export function startPursuit(session: SimSession, policeId: string, perpId: string): SimSession {
  if (session.phase !== 'active') return session;
  const police = session.vehicles.find((v) => v.id === policeId);
  const perp = session.vehicles.find((v) => v.id === perpId);
  if (!police || !perp || !isPoliceAvailableForPursuit(police) || !isPerpPursuitTarget(perp)) {
    return session;
  }

  const pursuitRoute = buildPursuitRoadRoute(police, perp);
  const pursuitDraft: SimVehicle = {
    ...police,
    route: pursuitRoute,
    routeIndex: 0,
    routeProgress: 0,
  };
  applyRouteWithProgress(pursuitDraft, pursuitRoute);

  const vehicles = session.vehicles.map((v) => {
    if (v.id === policeId) {
      return {
        ...v,
        status: 'pursuing' as const,
        pursuingPerpId: perpId,
        route: pursuitDraft.route,
        routeIndex: pursuitDraft.routeIndex,
        routeProgress: pursuitDraft.routeProgress,
        lat: pursuitDraft.lat,
        lng: pursuitDraft.lng,
      };
    }
    if (v.id === perpId) {
      return { ...v, beingPursued: true };
    }
    return { ...v };
  });

  const stats = session.stats ?? {
    round: session.round,
    roundDurationSec: 0,
    totalPolice: 0,
    totalPerps: 0,
    policeDown: 0,
    policeUsed: 0,
    pursuitsLaunched: 0,
    caught: 0,
    escaped: 0,
    outcome: '',
    operationalScore: 0,
    decisions: [],
    policeStatus: [],
  };

  stats.decisions = [
    ...stats.decisions,
    {
      policeId,
      policeName: police.officerName,
      policeSpeed: police.maxSpeedMph,
      policeRank: police.officerRank,
      vehicleModel: police.vehicleModel,
      perpId,
      perpName: perp.officerName,
      perpSpeed: perp.maxSpeedMph,
      perpModel: perp.vehicleModel,
      timestampMs: Date.now(),
    },
  ];
  stats.pursuitsLaunched = stats.decisions.length;
  stats.policeUsed = new Set(stats.decisions.map((d) => d.policeId)).size;

  return { ...session, vehicles, armedPoliceId: undefined, stats };
}

export function mergeServerSession(local: SimSession, server: SimSession): SimSession {
  if (!server?.vehicles?.length) return local;
  return {
    ...server,
    roundEndsAt: new Date(server.roundEndsAt as unknown as string).getTime() || local.roundEndsAt,
    cooldownEndsAt: server.cooldownEndsAt
      ? new Date(server.cooldownEndsAt as unknown as string).getTime()
      : undefined,
    vehicles: server.vehicles.map((sv) => ({
      ...sv,
      route: sv.route || [],
      destination: sv.destination,
    })),
  };
}

export function simSessionFromAPI(raw: Record<string, unknown>): SimSession {
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    phase: raw.phase as SimSession['phase'],
    round: Number(raw.round),
    roundEndsAt: new Date(raw.roundEndsAt as string).getTime(),
    cooldownEndsAt: raw.cooldownEndsAt ? new Date(raw.cooldownEndsAt as string).getTime() : undefined,
    vehicles: (raw.vehicles as SimVehicle[]) || [],
    result: raw.result as SimRoundResult | undefined,
    armedPoliceId: raw.armedPoliceId as string | undefined,
  };
}

export function isStoredSessionUsable(session: SimSession): boolean {
  const perpN = session.vehicles.filter((v) => v.role === 'perp').length;
  const polN = session.vehicles.filter((v) => v.role === 'police').length;
  const total = perpN + polN;
  return total >= FLEET_TOTAL_MIN && total <= FLEET_TOTAL_MAX && polN >= 1 && perpN >= 1;
}
