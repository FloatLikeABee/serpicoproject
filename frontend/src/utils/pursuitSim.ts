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

export type LandmarkKind = 'bar' | 'club' | 'factory' | 'projects';

export interface MapLandmark {
  id: string;
  kind: LandmarkKind;
  name: string;
  lat: number;
  lng: number;
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
  /** Extra police the player may place on the map this round. */
  reinforcementsLeft: number;
  /** Spawn cluster center — keeps the opening view tight. */
  clusterCenter?: SimLatLng;
  /** Named points of interest placed randomly each round. */
  landmarks: MapLandmark[];
}

/** Start lean: fewer cops than suspects; player may reinforce mid-round. */
export const INITIAL_POLICE_COUNT = 1;
export const MAX_POLICE_REINFORCEMENTS = 2;
export const PERP_COUNT_MIN = 4;
export const PERP_COUNT_MAX = 6;
export const FLEET_TOTAL_MIN = INITIAL_POLICE_COUNT + PERP_COUNT_MIN;
export const FLEET_TOTAL_MAX =
  INITIAL_POLICE_COUNT + MAX_POLICE_REINFORCEMENTS + PERP_COUNT_MAX;

function initialFleetCounts(): { policeCount: number; perpCount: number } {
  return {
    policeCount: INITIAL_POLICE_COUNT,
    perpCount: randInt(PERP_COUNT_MIN, PERP_COUNT_MAX),
  };
}

/** Faster chases without changing relative police vs perp gap. */
export const SIM_MOVEMENT_SCALE = 2.2;

export const ROUND_MS = 20 * 60 * 1000;
export const ROUND_RESET_AVAILABLE_MS = 2 * 60 * 1000;
/** Gap after a round ends before auto-start; user can also start manually sooner. */
export const ROUND_COOLDOWN_MS = 2 * 60 * 1000;
const CATCH_METERS = 55;
const CATCH_CLOSE_METERS = 120;
const DEST_ARRIVAL_M = 40;
/** Playable Olathe city box — map pan/zoom is locked to this. */
export const OLATHE_BOUNDS = { latMin: 38.86, latMax: 38.91, lngMin: -94.85, lngMax: -94.78 };
const OlatheBounds = OLATHE_BOUNDS;
export const OLATHE_CENTER: [number, number] = [38.8814, -94.8191];
export const OLATHE_MIN_ZOOM = 13;
export const OLATHE_MAX_ZOOM = 17;
/** Fallback grid step when OSM roads are still loading (~22 m). */
const ROAD_GRID_STEP = 0.0002;
const MIN_SEGMENT_M = 4;
/** Re-aim a chase this often; routing is cheap enough to stay locked on the suspect. */
const PURSUIT_REBUILD_MS = 900;
const PATROL_REBUILD_MS = 2500;
/** Re-aim early when the suspect has left the current chase line by this much. */
const PURSUIT_TARGET_DRIFT_M = 120;
/** Aim at where the suspect will be, not where it is — capped so leads stay plausible. */
const MAX_INTERCEPT_SEC = 22;
const MAX_INTERCEPT_LEAD_M = 700;
/** Inside this gap, drive straight at the suspect instead of at a lead point. */
const PURSUIT_DIRECT_GAP_M = 170;
/** Steering limit so markers rotate instead of flicking between segment bearings. */
const MAX_TURN_DEG_PER_SEC = 300;
/** Heading is taken from this far ahead on the route — smooths corner-to-corner jitter. */
const HEADING_LOOKAHEAD_M = 20;

/** Throttle route rebuilds per vehicle so routing stays off the animation critical path. */
const lastRouteRebuildAt = new Map<string, number>();
/** Simulated milliseconds since the round started — throttling must not depend on frame rate. */
let simClockMs = 0;
/** Close spawn cluster — units start near each other for short, fast pursuits. */
const CLUSTER_RADIUS_M = 800;
const MIN_VEHICLE_SPAWN_SEP_M = 100;
const PERP_DEST_MIN_M = 900;
const PERP_DEST_MAX_M = 2200;
const PATROL_RADIUS_M = 900;

const PATROL_CRUISE_MPH = 34;
const PERP_CRUISE_MPH = 36;
/** Police stay clearly faster than fleeing suspects, still in real-world range. */
const POLICE_PURSUIT_BONUS_MPH = 10;
const POLICE_MIN_SPEED_OVER_PERP_MPH = 14;
const POLICE_CLOSE_RANGE_BONUS_MPH = 12;
const POLICE_PURSUIT_MULTIPLIER = 1.0;
const PERP_FLEE_MULTIPLIER = 1.0;
const PURSUIT_CLOSURE_BOOST = 1.08;

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

function rebuildReady(v: SimVehicle, minGapMs: number): boolean {
  if (minGapMs <= 0) return true;
  const last = lastRouteRebuildAt.get(v.id);
  if (last === undefined) return true;
  return simClockMs - last >= minGapMs;
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

/** Point `aheadM` further along a route from a given index/progress. */
function pointAlongRoute(
  route: SimLatLng[],
  index: number,
  progress: number,
  aheadM: number
): SimLatLng | null {
  if (route.length < 2) return null;
  let idx = clamp(index, 0, route.length - 2);
  let frac = clamp(progress, 0, 1);
  let remaining = Math.max(aheadM, 0);

  if (remaining === 0) {
    return interpolateAlongSegment(route[idx], route[idx + 1], frac);
  }

  while (idx < route.length - 1) {
    const cur = route[idx];
    const next = route[idx + 1];
    const segLen = haversineMeters(cur.lat, cur.lng, next.lat, next.lng);
    if (segLen < 1) {
      idx++;
      frac = 0;
      continue;
    }
    const distLeft = segLen * (1 - frac);
    if (remaining <= distLeft) {
      return interpolateAlongSegment(cur, next, frac + remaining / segLen);
    }
    remaining -= distLeft;
    idx++;
    frac = 0;
  }

  return { ...route[route.length - 1] };
}

/** Drop leading road nodes the vehicle has already passed so it never backtracks. */
function trimLeadingBacktrack(pos: SimLatLng, path: SimLatLng[]): SimLatLng[] {
  if (path.length < 2) return path;

  let bestIdx = 0;
  let bestDist = Infinity;
  const scan = Math.min(path.length, 6);
  for (let i = 0; i < scan; i++) {
    const d = haversineMeters(pos.lat, pos.lng, path[i].lat, path[i].lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const next = path[bestIdx + 1];
  if (next) {
    const segLen = haversineMeters(
      path[bestIdx].lat,
      path[bestIdx].lng,
      next.lat,
      next.lng
    );
    const toNext = haversineMeters(pos.lat, pos.lng, next.lat, next.lng);
    // Already level with or past this node — head for the following one instead.
    if (toNext < segLen - MIN_SEGMENT_M) bestIdx += 1;
  }

  return path.slice(Math.min(bestIdx, path.length - 1));
}

/**
 * Attach a route that starts exactly where the vehicle already is, so map motion is
 * continuous: no projection, no snapping, no teleporting on re-aim.
 */
function commitRoute(v: SimVehicle, path: SimLatLng[]): boolean {
  if (path.length < 1) return false;
  const pos = { lat: v.lat, lng: v.lng };
  const route = dedupeRoute([pos, ...trimLeadingBacktrack(pos, path)]);
  if (route.length < 2) return false;

  v.route = route;
  v.routeIndex = 0;
  v.routeProgress = 0;
  lastRouteRebuildAt.set(v.id, simClockMs);
  return true;
}

function getPerpRoadTarget(perp: SimVehicle, lookaheadM: number): SimLatLng {
  const ahead = pointAlongRoute(perp.route, perp.routeIndex, perp.routeProgress, lookaheadM);
  if (!ahead) return snapToRoad({ lat: perp.lat, lng: perp.lng });
  return ahead;
}

/** Where the suspect will be by the time the chase car can get there. */
function interceptTarget(police: SimVehicle, perp: SimVehicle): SimLatLng {
  const gap = haversineMeters(police.lat, police.lng, perp.lat, perp.lng);
  if (gap <= PURSUIT_DIRECT_GAP_M) {
    return { lat: perp.lat, lng: perp.lng };
  }

  const policeMps = mphToMps(getOperationalSpeedMph(police, perp));
  const perpMps = mphToMps(getOperationalSpeedMph(perp));
  const closingMps = Math.max(policeMps - perpMps, policeMps * 0.15, 1);
  const secondsToClose = clamp(gap / closingMps, 0, MAX_INTERCEPT_SEC);
  const lead = clamp(perpMps * secondsToClose, 0, MAX_INTERCEPT_LEAD_M);
  return getPerpRoadTarget(perp, lead);
}

function buildPursuitRoadRoute(police: SimVehicle, perp: SimVehicle): SimLatLng[] {
  const start = { lat: police.lat, lng: police.lng };
  const routed = buildRoadRouteToDestination(start, interceptTarget(police, perp));
  if (routed.length >= 2) return routed;
  return buildRoadRouteToDestination(start, snapToRoad({ lat: perp.lat, lng: perp.lng }));
}

function ensurePursuitRoute(v: SimVehicle, perp: SimVehicle, force = false) {
  const atRouteEnd = !hasForwardPath(v);
  const target = interceptTarget(v, perp);
  const end = v.route[v.route.length - 1];
  const aimDrift = end ? haversineMeters(end.lat, end.lng, target.lat, target.lng) : Infinity;

  if (!force && !atRouteEnd && aimDrift <= PURSUIT_TARGET_DRIFT_M) return;
  if (!force && !rebuildReady(v, atRouteEnd ? 0 : PURSUIT_REBUILD_MS)) return;

  const routed = buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, target);
  if (routed.length >= 2) commitRoute(v, routed);
}

function releasePoliceForReassignment(v: SimVehicle) {
  v.status = 'patrol';
  v.pursuingPerpId = undefined;
  commitRoute(v, randomPatrolRoute({ lat: v.lat, lng: v.lng }));
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

/** Patrolling and already-chasing units can both be given a target. */
export function isPoliceAvailableForPursuit(v: SimVehicle): boolean {
  if (v.role !== 'police') return false;
  return v.status === 'patrol' || v.status === 'idle' || v.status === 'pursuing';
}

export function isPerpPursuitTarget(v: SimVehicle): boolean {
  return v.role === 'perp' && v.status !== 'caught' && v.status !== 'escaped';
}

function randomPatrolRoute(start: SimLatLng): SimLatLng[] {
  const dest = pickNearPoint(start, 250, PATROL_RADIUS_M);
  return buildRoadRouteToDestination(start, dest);
}

function buildPoliceVehicleAt(index: number, start: SimLatLng): SimVehicle {
  const fleet = policeFleet[index % policeFleet.length];
  const profile = policeProfiles[index % policeProfiles.length];
  const route = randomPatrolRoute(start);
  const unit: SimVehicle = {
    id: uid('police'),
    role: 'police',
    lat: start.lat,
    lng: start.lng,
    heading: route.length > 1 ? bearingHeading(route[0], route[1]) : rand(0, 360),
    route,
    routeIndex: 0,
    routeProgress: 0,
    maxSpeedMph: fleet.ratedMaxMph + randInt(-2, 2),
    officerName: `Officer ${officerNames[index % officerNames.length]}`,
    officerRank: profile.rank,
    evaluation: profile.eval,
    vehicleModel: fleet.model,
    status: 'patrol',
    beingPursued: false,
  };
  commitRoute(unit, route);
  return unit;
}

export function canDeployReinforcement(session: SimSession): boolean {
  return session.phase === 'active' && (session.reinforcementsLeft ?? 0) > 0;
}

/** Place one of the player's reinforcement police units at a map tap (snapped to road). */
export function deployPoliceAt(session: SimSession, lat: number, lng: number): SimSession {
  if (!canDeployReinforcement(session)) return session;
  const existing = session.vehicles.map((v) => ({ lat: v.lat, lng: v.lng }));
  const start = snapToRoad({ lat, lng });
  // Nudge if dropped on top of another unit.
  const placed =
    existing.every((p) => haversineMeters(start.lat, start.lng, p.lat, p.lng) >= MIN_VEHICLE_SPAWN_SEP_M * 0.5)
      ? start
      : pickNearPoint(start, 40, 180, existing);
  const policeIndex = session.vehicles.filter((v) => v.role === 'police').length;
  const unit = buildPoliceVehicleAt(policeIndex, placed);
  const vehicles = [...session.vehicles, unit];
  const reinforcementsLeft = Math.max(0, (session.reinforcementsLeft ?? 0) - 1);
  const stats = session.stats
    ? { ...session.stats, totalPolice: session.stats.totalPolice + 1 }
    : session.stats;
  return { ...session, vehicles, reinforcementsLeft, stats };
}

function offsetMeters(center: SimLatLng, northM: number, eastM: number): SimLatLng {
  const lat = center.lat + northM / 111320;
  const lng = center.lng + eastM / (111320 * Math.cos(center.lat * (Math.PI / 180)));
  return {
    lat: clamp(lat, OlatheBounds.latMin, OlatheBounds.latMax),
    lng: clamp(lng, OlatheBounds.lngMin, OlatheBounds.lngMax),
  };
}

function randomClusterCenter(): SimLatLng {
  // Keep a margin so the cluster radius stays inside Olathe.
  const marginLat = CLUSTER_RADIUS_M / 111320;
  const marginLng = CLUSTER_RADIUS_M / (111320 * Math.cos(38.88 * (Math.PI / 180)));
  return snapToRoad({
    lat: rand(OlatheBounds.latMin + marginLat, OlatheBounds.latMax - marginLat),
    lng: rand(OlatheBounds.lngMin + marginLng, OlatheBounds.lngMax - marginLng),
  });
}

function pickNearPoint(center: SimLatLng, minR: number, maxR: number, avoid: SimLatLng[] = []): SimLatLng {
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = rand(0, Math.PI * 2);
    const r = rand(minR, maxR);
    const candidate = snapToRoad(offsetMeters(center, Math.cos(angle) * r, Math.sin(angle) * r));
    const ok = avoid.every(
      (p) => haversineMeters(candidate.lat, candidate.lng, p.lat, p.lng) >= MIN_VEHICLE_SPAWN_SEP_M
    );
    if (ok) return candidate;
  }
  return snapToRoad(offsetMeters(center, rand(-maxR, maxR), rand(-maxR, maxR)));
}

/** Tight spawn cluster so the opening fit-bounds view shows everyone close. */
function pickClusterSpawns(count: number, center: SimLatLng, avoid: SimLatLng[] = []): SimLatLng[] {
  const picked: SimLatLng[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(pickNearPoint(center, 40, CLUSTER_RADIUS_M, [...avoid, ...picked]));
  }
  return picked;
}

function pickPerpDestination(from: SimLatLng, used: SimLatLng[] = []): SimLatLng {
  for (let attempt = 0; attempt < 30; attempt++) {
    const dest = pickNearPoint(from, PERP_DEST_MIN_M, PERP_DEST_MAX_M, used);
    const dist = haversineMeters(from.lat, from.lng, dest.lat, dest.lng);
    if (dist >= PERP_DEST_MIN_M * 0.7) return dest;
  }
  return pickNearPoint(from, PERP_DEST_MIN_M, PERP_DEST_MAX_M, used);
}

function assignPerpDestinations(spawns: SimLatLng[]): SimLatLng[] {
  const used: SimLatLng[] = [];
  return spawns.map((spawn) => {
    const dest = pickPerpDestination(spawn, used);
    used.push(dest);
    return dest;
  });
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
    const ok = avoid.every(
      (p) => haversineMeters(candidate.lat, candidate.lng, p.lat, p.lng) >= MIN_LANDMARK_SEP_M
    );
    if (ok) return candidate;
  }
  return {
    lat: rand(OlatheBounds.latMin + 0.003, OlatheBounds.latMax - 0.003),
    lng: rand(OlatheBounds.lngMin + 0.004, OlatheBounds.lngMax - 0.004),
  };
}

/** Place named bars, clubs, factories, and projects randomly across Olathe each round. */
export function createRoundLandmarks(): MapLandmark[] {
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
  if (!v.destination || destDistance <= DEST_ARRIVAL_M) {
    v.destination = pickPerpDestination(pos);
    commitRoute(v, buildRoadRouteToDestination(pos, v.destination));
    return;
  }

  if (!hasForwardPath(v) || !routeHasMovement(v.route)) {
    if (!rebuildReady(v, PATROL_REBUILD_MS)) return;
    commitRoute(v, buildRoadRouteToDestination(pos, v.destination));
  }
}

/** Rotate toward the road ahead instead of snapping to each segment bearing. */
function steerAlongRoute(v: SimVehicle, elapsedSec: number) {
  const ahead = pointAlongRoute(v.route, v.routeIndex, v.routeProgress, HEADING_LOOKAHEAD_M);
  if (!ahead) return;
  if (haversineMeters(v.lat, v.lng, ahead.lat, ahead.lng) < 1) return;

  const want = bearingHeading({ lat: v.lat, lng: v.lng }, ahead);
  const delta = ((want - v.heading + 540) % 360) - 180;
  const maxStep = MAX_TURN_DEG_PER_SEC * Math.max(elapsedSec, 0.001);
  v.heading = (v.heading + clamp(delta, -maxStep, maxStep) + 360) % 360;
}

function advanceVehicle(v: SimVehicle, elapsedSec: number, pursuedPerp?: SimVehicle) {
  if (v.route.length < 2 || elapsedSec <= 0 || v.status === 'caught' || v.status === 'escaped') return;

  const speed = mphToMps(getOperationalSpeedMph(v, pursuedPerp));
  if (speed <= 0) return;

  let remaining = speed * elapsedSec;
  let guard = 0;

  while (remaining > 0 && v.route.length >= 2 && guard++ < 80) {
    if (v.routeIndex >= v.route.length - 1) {
      if (v.role === 'police' && v.status === 'pursuing' && pursuedPerp) {
        ensurePursuitRoute(v, pursuedPerp, true);
      } else if (v.role === 'police') {
        commitRoute(v, randomPatrolRoute({ lat: v.lat, lng: v.lng }));
      } else if (v.role === 'perp') {
        const dest = pickPerpDestination({ lat: v.lat, lng: v.lng });
        v.destination = dest;
        commitRoute(v, buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, dest));
      }
      // Stop this tick if the new route gave no forward motion.
      if (!hasForwardPath(v)) remaining = 0;
      continue;
    }

    const cur = v.route[v.routeIndex];
    const next = v.route[v.routeIndex + 1];
    const segLen = haversineMeters(cur.lat, cur.lng, next.lat, next.lng);

    // Step over micro-segments instead of rebuilding — rebuild thrash caused the shake.
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
    } else {
      v.routeProgress += remaining / segLen;
      const pos = interpolateAlongSegment(cur, next, v.routeProgress);
      v.lat = pos.lat;
      v.lng = pos.lng;
      remaining = 0;
    }
  }

  steerAlongRoute(v, elapsedSec);
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
  lastRouteRebuildAt.clear();
  simClockMs = 0;
  const { policeCount, perpCount } = initialFleetCounts();
  const clusterCenter = randomClusterCenter();
  const perpSpawns = pickClusterSpawns(perpCount, clusterCenter);
  const policeSpawns = pickClusterSpawns(policeCount, clusterCenter, perpSpawns);
  const perpDestinations = assignPerpDestinations(perpSpawns);
  const vehicles: SimVehicle[] = [];

  for (let i = 0; i < policeCount; i++) {
    vehicles.push(buildPoliceVehicleAt(i, policeSpawns[i]));
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
    commitRoute(perp, route);
    ensurePerpReady(perp);
    vehicles.push(perp);
  }

  const now = Date.now();
  // With a single starting unit, downs are skipped until reinforcements arrive.
  schedulePoliceDowns(vehicles, now);
  return {
    id: uid('session'),
    userId,
    phase: 'active',
    round,
    roundEndsAt: now + ROUND_MS,
    roundStartMs: now,
    vehicles,
    reinforcementsLeft: MAX_POLICE_REINFORCEMENTS,
    clusterCenter,
    landmarks: createRoundLandmarks(),
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
  simClockMs += Math.max(elapsedSec, 0) * 1000;
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

  // Commit the intercept line on the tap so the car turns toward the suspect right away.
  const pursuitDraft: SimVehicle = {
    ...police,
    status: 'pursuing',
    pursuingPerpId: perpId,
    route: [...police.route],
    routeIndex: police.routeIndex,
    routeProgress: police.routeProgress,
  };
  commitRoute(pursuitDraft, buildPursuitRoadRoute(police, perp));

  // Re-tasking a unit drops its old target unless another car is still on it.
  const droppedPerpId =
    police.pursuingPerpId && police.pursuingPerpId !== perpId ? police.pursuingPerpId : null;
  const droppedStillChased =
    !!droppedPerpId &&
    session.vehicles.some(
      (v) => v.role === 'police' && v.id !== policeId && v.pursuingPerpId === droppedPerpId
    );

  const vehicles = session.vehicles.map((v) => {
    if (v.id === policeId) {
      return {
        ...v,
        status: 'pursuing' as const,
        pursuingPerpId: perpId,
        route: pursuitDraft.route,
        routeIndex: pursuitDraft.routeIndex,
        routeProgress: pursuitDraft.routeProgress,
        // Preserve live map position — never teleport on pursue start.
        lat: v.lat,
        lng: v.lng,
      };
    }
    if (v.id === perpId) {
      return { ...v, beingPursued: true };
    }
    if (droppedPerpId && v.id === droppedPerpId && !droppedStillChased) {
      return { ...v, beingPursued: false };
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
  const landmarks = Array.isArray(raw.landmarks)
    ? (raw.landmarks as MapLandmark[])
    : createRoundLandmarks();
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
    reinforcementsLeft:
      typeof raw.reinforcementsLeft === 'number' ? raw.reinforcementsLeft : MAX_POLICE_REINFORCEMENTS,
    clusterCenter: raw.clusterCenter as SimLatLng | undefined,
    landmarks,
  };
}

export function isStoredSessionUsable(session: SimSession): boolean {
  const perpN = session.vehicles.filter((v) => v.role === 'perp').length;
  const polN = session.vehicles.filter((v) => v.role === 'police').length;
  if (perpN < PERP_COUNT_MIN || perpN > PERP_COUNT_MAX) return false;
  if (polN < INITIAL_POLICE_COUNT || polN > INITIAL_POLICE_COUNT + MAX_POLICE_REINFORCEMENTS) {
    return false;
  }
  return true;
}
