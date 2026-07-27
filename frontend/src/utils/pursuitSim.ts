/**
 * Client-side patrol simulation. The player drives one cruiser by hand: suspects roll slowly
 * toward their own destinations, and every meter the cruiser covers comes from a tapped road
 * order. There are no rounds — waves of suspects keep coming.
 */

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

export type PoliceStatus = 'holding' | 'driving';
export type PerpStatus = 'fleeing' | 'caught' | 'escaped';
export type SimVehicleStatus = PoliceStatus | PerpStatus;

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
  status: SimVehicleStatus;
  destination?: SimLatLng;
  /** Suspects only: sim-clock stamp of the stop or escape, used to clear the marker. */
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

export type SimNoticeKind = 'caught' | 'escaped' | 'wave' | 'warn';

/** Short-lived radio line for the player — the sim expires these on its own. */
export interface SimNotice {
  id: string;
  kind: SimNoticeKind;
  text: string;
  /** Sim-clock stamp, so notices age with the simulation rather than the wall clock. */
  atSimMs: number;
}

export interface SimSession {
  id: string;
  userId: string;
  vehicles: SimVehicle[];
  /** Named points of interest for on-foot raids. */
  landmarks: MapLandmark[];
  /** Suspect wave counter — purely informational, the shift never ends. */
  wave: number;
  caughtTotal: number;
  escapedTotal: number;
  notices: SimNotice[];
  /** Extra cruisers the player may still place on the map. */
  reinforcementsLeft: number;
  /** Spawn cluster center — keeps the opening view tight. */
  clusterCenter?: SimLatLng;
  startedAtMs: number;
}

export const INITIAL_POLICE_COUNT = 1;
export const MAX_POLICE_REINFORCEMENTS = 2;
/** Suspects per wave — a fresh wave spawns as soon as the last one is resolved. */
export const WAVE_PERP_COUNT = 5;

/**
 * Furthest a single tapped drive order may sit from the cruiser. This is deliberately about a
 * block of road: the car should cover a tapped hop in a few seconds and then wait for the next
 * tap, rather than disappearing up a long route on its own.
 */
export const MAX_DRIVE_ORDER_M = 150;
/** How far off a road centerline a tap may land and still count as "on the road". */
export const ROAD_TAP_TOLERANCE_M = 30;
/** Ignore taps basically on top of the car so a mis-tap never cancels momentum. */
const MIN_DRIVE_ORDER_M = 12;

const CATCH_METERS = 60;
const DEST_ARRIVAL_M = 45;
/** Keep a resolved suspect's marker on screen this long before it disappears. */
const RESOLVED_VISIBLE_MS = 4000;
const NOTICE_TTL_MS = 5000;
const MAX_NOTICES = 6;

/** Playable Olathe city box — map pan/zoom is locked to this. */
export const OLATHE_BOUNDS = { latMin: 38.86, latMax: 38.91, lngMin: -94.85, lngMax: -94.78 };
const OlatheBounds = OLATHE_BOUNDS;
export const OLATHE_CENTER: [number, number] = [38.8814, -94.8191];
export const OLATHE_MIN_ZOOM = 13;
export const OLATHE_MAX_ZOOM = 17;

/** Fallback grid step when OSM roads are still loading (~22 m). */
const ROAD_GRID_STEP = 0.0002;
const MIN_SEGMENT_M = 4;
const PERP_REBUILD_MS = 2500;
/** Steering limit so markers rotate instead of flicking between segment bearings. */
const MAX_TURN_DEG_PER_SEC = 300;
/** Heading is taken from this far ahead on the route — smooths corner-to-corner jitter. */
const HEADING_LOOKAHEAD_M = 20;

/** Throttle route rebuilds per vehicle so routing stays off the animation critical path. */
const lastRouteRebuildAt = new Map<string, number>();
/** Simulated milliseconds since the shift started — throttling must not depend on frame rate. */
let simClockMs = 0;

/** Opening cluster — the cruiser and the first wave start within sight of each other. */
const CLUSTER_RADIUS_M = 700;
const MIN_VEHICLE_SPAWN_SEP_M = 100;
/** Later waves appear around the cruiser, close enough to be reachable by hand. */
const WAVE_SPAWN_MIN_M = 450;
const WAVE_SPAWN_MAX_M = 1200;
/**
 * How far a suspect has to crawl before it is gone. This is the shift's only clock: suspects stay
 * slow, but a near drop point gives the player barely two minutes to reach that one.
 */
const PERP_DEST_MIN_M = 800;
const PERP_DEST_MAX_M = 1800;

/**
 * Hand-driven cruising speed, and the slow suspect roll the player has to cut off. The cruiser
 * clears a full-length tapped hop in roughly five seconds, so the move reads as an answer to the
 * tap rather than a route the car drives off on by itself.
 */
const POLICE_DRIVE_MPH = 60;
const PERP_CRUISE_MPH = 17;
/** Reference figures the fleet tables are scaled against. */
const POLICE_PURSUIT_REFERENCE_MPH = 85;
const PERP_FLEE_REFERENCE_MPH = 68;

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

const perpErrands = [
  'heading for a stash house',
  'running a drop across town',
  'making for the interstate ramp',
  'circling toward a chop shop',
  'looking for a place to dump the car',
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

/** Road distance still ahead of the vehicle on its current route. */
export function remainingRouteMeters(v: SimVehicle): number {
  if (v.route.length < 2 || v.routeIndex >= v.route.length - 1) return 0;
  const cur = v.route[v.routeIndex];
  const next = v.route[v.routeIndex + 1];
  let total = haversineMeters(cur.lat, cur.lng, next.lat, next.lng) * (1 - v.routeProgress);
  for (let i = v.routeIndex + 1; i < v.route.length - 1; i++) {
    total += haversineMeters(v.route[i].lat, v.route[i].lng, v.route[i + 1].lat, v.route[i + 1].lng);
  }
  return total;
}

/** Cut a path so it covers at most `maxM` of driving, interpolating the final stop point. */
function trimRouteToLength(route: SimLatLng[], maxM: number): SimLatLng[] {
  if (route.length < 2) return route.map((p) => ({ ...p }));
  const out: SimLatLng[] = [{ ...route[0] }];
  let used = 0;
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1];
    const cur = route[i];
    const segLen = haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng);
    if (used + segLen <= maxM) {
      out.push({ ...cur });
      used += segLen;
      continue;
    }
    const left = maxM - used;
    if (left > MIN_SEGMENT_M) out.push(interpolateAlongSegment(prev, cur, left / segLen));
    break;
  }
  return out;
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
    const segLen = haversineMeters(path[bestIdx].lat, path[bestIdx].lng, next.lat, next.lng);
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

function fleetSpecForVehicle(v: SimVehicle): FleetSpec | undefined {
  const fleet = v.role === 'police' ? policeFleet : perpFleet;
  return fleet.find((f) => f.model === v.vehicleModel);
}

/**
 * Street speed this vehicle holds when it is moving. Cruisers run well clear of the slow
 * suspect roll, which is what makes hand-steering an intercept realistic.
 */
export function cruiseSpeedMph(v: SimVehicle): number {
  const spec = fleetSpecForVehicle(v);
  if (v.role === 'police') {
    const rating = spec?.pursuitMph ?? POLICE_PURSUIT_REFERENCE_MPH;
    return POLICE_DRIVE_MPH * (rating / POLICE_PURSUIT_REFERENCE_MPH);
  }
  const rating = spec?.fleeMph ?? PERP_FLEE_REFERENCE_MPH;
  return PERP_CRUISE_MPH * (rating / PERP_FLEE_REFERENCE_MPH);
}

/** Speed right now: parked cruisers and resolved suspects do not move at all. */
export function getOperationalSpeedMph(v: SimVehicle): number {
  if (v.status === 'caught' || v.status === 'escaped' || v.status === 'holding') return 0;
  return cruiseSpeedMph(v);
}

function buildPoliceVehicleAt(index: number, start: SimLatLng): SimVehicle {
  const fleet = policeFleet[index % policeFleet.length];
  const profile = policeProfiles[index % policeProfiles.length];
  return {
    id: uid('police'),
    role: 'police',
    lat: start.lat,
    lng: start.lng,
    heading: rand(0, 360),
    route: [],
    routeIndex: 0,
    routeProgress: 0,
    maxSpeedMph: fleet.ratedMaxMph + randInt(-2, 2),
    officerName: `Officer ${officerNames[index % officerNames.length]}`,
    officerRank: profile.rank,
    evaluation: profile.eval,
    vehicleModel: fleet.model,
    status: 'holding',
  };
}

export function canDeployReinforcement(session: SimSession): boolean {
  return (session.reinforcementsLeft ?? 0) > 0;
}

/** Place one of the player's spare cruisers at a map tap (snapped to road). */
export function deployPoliceAt(session: SimSession, lat: number, lng: number): SimSession {
  if (!canDeployReinforcement(session)) return session;
  const existing = session.vehicles.map((v) => ({ lat: v.lat, lng: v.lng }));
  const start = snapToRoad({ lat, lng });
  // Nudge if dropped on top of another unit.
  const placed = existing.every(
    (p) => haversineMeters(start.lat, start.lng, p.lat, p.lng) >= MIN_VEHICLE_SPAWN_SEP_M * 0.5
  )
    ? start
    : pickNearPoint(start, 40, 180, existing);
  const policeIndex = session.vehicles.filter((v) => v.role === 'police').length;
  const unit = buildPoliceVehicleAt(policeIndex, placed);
  return {
    ...session,
    vehicles: [...session.vehicles, unit],
    reinforcementsLeft: Math.max(0, (session.reinforcementsLeft ?? 0) - 1),
    notices: pushNotice(session.notices, 'wave', `${unit.officerName} is on scene and holding`),
  };
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

function pickNearPoint(
  center: SimLatLng,
  minR: number,
  maxR: number,
  avoid: SimLatLng[] = []
): SimLatLng {
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

function pickPerpDestination(from: SimLatLng, used: SimLatLng[] = []): SimLatLng {
  for (let attempt = 0; attempt < 30; attempt++) {
    const dest = pickNearPoint(from, PERP_DEST_MIN_M, PERP_DEST_MAX_M, used);
    if (haversineMeters(from.lat, from.lng, dest.lat, dest.lng) >= PERP_DEST_MIN_M * 0.7) {
      return dest;
    }
  }
  return pickNearPoint(from, PERP_DEST_MIN_M, PERP_DEST_MAX_M, used);
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

export function createCityLandmarks(): MapLandmark[] {
  const landmarks: MapLandmark[] = [];
  const placed: SimLatLng[] = [];

  for (const catalog of LANDMARK_CATALOG) {
    const names = shuffleCopy(catalog.names).slice(0, LANDMARK_COUNTS[catalog.kind]);
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

function buildPerpVehicleAt(index: number, start: SimLatLng, dest: SimLatLng): SimVehicle {
  const fleet = perpFleet[index % perpFleet.length];
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
    officerName: perpNames[index % perpNames.length],
    evaluation: `Suspect vehicle — ${perpErrands[index % perpErrands.length]}`,
    vehicleModel: fleet.model,
    destination: dest,
    status: 'fleeing',
  };
  commitRoute(perp, route);
  ensurePerpReady(perp);
  return perp;
}

/** A fresh wave of suspects around `center`, each rolling off toward its own destination. */
function spawnPerpWave(
  center: SimLatLng,
  avoid: SimLatLng[],
  minR: number,
  maxR: number,
  wave: number
): SimVehicle[] {
  const taken = [...avoid];
  const destinations: SimLatLng[] = [];
  const perps: SimVehicle[] = [];
  // Walk the name and vehicle tables forward each wave so a new call-out reads as new suspects.
  const base = (wave - 1) * WAVE_PERP_COUNT;

  for (let i = 0; i < WAVE_PERP_COUNT; i++) {
    const spawn = pickNearPoint(center, minR, maxR, taken);
    taken.push(spawn);
    const dest = pickPerpDestination(spawn, destinations);
    destinations.push(dest);
    perps.push(buildPerpVehicleAt(base + i, spawn, dest));
  }

  return perps;
}

function ensurePerpReady(v: SimVehicle) {
  if (v.role !== 'perp' || v.status !== 'fleeing') return;

  const pos = { lat: v.lat, lng: v.lng };
  if (!v.destination) {
    v.destination = pickPerpDestination(pos);
    commitRoute(v, buildRoadRouteToDestination(pos, v.destination));
    return;
  }

  // A route can run out short of the destination when routing had to fall back — re-aim.
  if (!hasForwardPath(v) && !perpReachedDestination(v)) {
    if (!rebuildReady(v, PERP_REBUILD_MS)) return;
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

/** Roll a vehicle along its committed route. Route end means stop — nothing re-aims itself. */
function advanceVehicle(v: SimVehicle, elapsedSec: number) {
  if (v.route.length < 2 || elapsedSec <= 0) return;

  const speed = mphToMps(getOperationalSpeedMph(v));
  if (speed <= 0) return;

  let remaining = speed * elapsedSec;
  let guard = 0;

  while (remaining > 0 && v.routeIndex < v.route.length - 1 && guard++ < 80) {
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

export { ensureRoadNetwork } from './olatheRoadNetwork';

function pushNotice(notices: SimNotice[], kind: SimNoticeKind, text: string): SimNotice[] {
  const next = [...notices, { id: uid('note'), kind, text, atSimMs: simClockMs }];
  return next.slice(-MAX_NOTICES);
}

function pruneNotices(notices: SimNotice[]): SimNotice[] {
  const live = notices.filter((n) => simClockMs - n.atSimMs < NOTICE_TTL_MS);
  return live.length === notices.length ? notices : live;
}

export function createSimSession(userId: string): SimSession {
  lastRouteRebuildAt.clear();
  simClockMs = 0;

  const clusterCenter = randomClusterCenter();
  const policeSpawns: SimLatLng[] = [];
  for (let i = 0; i < INITIAL_POLICE_COUNT; i++) {
    policeSpawns.push(pickNearPoint(clusterCenter, 0, 120, policeSpawns));
  }

  const vehicles: SimVehicle[] = policeSpawns.map((spawn, i) => buildPoliceVehicleAt(i, spawn));
  vehicles.push(...spawnPerpWave(clusterCenter, policeSpawns, 250, CLUSTER_RADIUS_M, 1));

  return {
    id: uid('session'),
    userId,
    vehicles,
    landmarks: createCityLandmarks(),
    wave: 1,
    caughtTotal: 0,
    escapedTotal: 0,
    notices: [],
    reinforcementsLeft: MAX_POLICE_REINFORCEMENTS,
    clusterCenter,
    startedAtMs: Date.now(),
  };
}

export type DriveOrderReason = 'unavailable' | 'off_road' | 'too_far' | 'too_close' | 'no_route';

export interface DriveOrderResult {
  session: SimSession;
  ok: boolean;
  reason?: DriveOrderReason;
  /** Straight-line meters from the cruiser to the tapped point. */
  distanceM?: number;
}

const DRIVE_ORDER_MESSAGES: Record<DriveOrderReason, string> = {
  unavailable: 'No unit selected',
  off_road: 'Tap the road itself — the cruiser can only follow streets',
  too_far: `Too far ahead — tap within ${MAX_DRIVE_ORDER_M} m of the cruiser`,
  too_close: 'Pick a point further up the road',
  no_route: 'No road connects the cruiser to that point',
};

/** Extend a path to the exact tapped spot, but never by doubling back on the last segment. */
function appendFinalApproach(path: SimLatLng[], target: SimLatLng): SimLatLng[] {
  if (path.length < 2) return [...path, { ...target }];
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  if (haversineMeters(last.lat, last.lng, target.lat, target.lng) <= MIN_SEGMENT_M) return path;

  const legBearing = bearingHeading(prev, last);
  const tailBearing = bearingHeading(last, target);
  const turn = Math.abs(((tailBearing - legBearing + 540) % 360) - 180);
  if (turn > 100) return path;
  return [...path, { ...target }];
}

/**
 * The player's only way to move a cruiser: tap a spot on the road ahead. The order is refused
 * unless it lands on a street within `MAX_DRIVE_ORDER_M`, and the resulting path is trimmed to
 * that same budget so a winding road can never turn one tap into a cross-town drive.
 */
export function orderPoliceTo(
  session: SimSession,
  policeId: string,
  lat: number,
  lng: number
): DriveOrderResult {
  const police = session.vehicles.find((v) => v.id === policeId && v.role === 'police');
  if (!police) return reject(session, 'unavailable');

  // Judge the range on the tap itself, which is what the player aimed at and sees ringed.
  const distanceM = haversineMeters(police.lat, police.lng, lat, lng);
  if (distanceM > MAX_DRIVE_ORDER_M) return reject(session, 'too_far', distanceM);

  const network = getRoadNetwork();
  const snap = network
    ? snapToRoadSegment(network, { lat, lng })
    : { point: snapToRoadGrid({ lat, lng }), distM: 0 };
  if (!snap || snap.distM > ROAD_TAP_TOLERANCE_M) return reject(session, 'off_road');

  const target = snap.point;
  if (haversineMeters(police.lat, police.lng, target.lat, target.lng) < MIN_DRIVE_ORDER_M) {
    return reject(session, 'too_close', distanceM);
  }

  const pos = { lat: police.lat, lng: police.lng };
  const path = network ? buildRoadNodePath(network, pos, target) : buildGridRouteFallback(pos, target);
  if (path.length < 2) return reject(session, 'no_route', distanceM);

  const draft: SimVehicle = { ...police, status: 'driving', route: [...police.route] };
  const ordered = trimRouteToLength(dedupeRoute(appendFinalApproach(path, target)), MAX_DRIVE_ORDER_M);
  if (!commitRoute(draft, ordered) || !hasForwardPath(draft)) {
    return reject(session, 'no_route', distanceM);
  }

  const vehicles = session.vehicles.map((v) =>
    v.id === policeId
      ? {
          ...v,
          status: 'driving' as const,
          route: draft.route,
          routeIndex: draft.routeIndex,
          routeProgress: draft.routeProgress,
        }
      : v
  );

  return { session: { ...session, vehicles }, ok: true, distanceM };
}

/** Cancel whatever is left of a cruiser's order and park it where it stands. */
export function holdPolice(session: SimSession, policeId: string): SimSession {
  const police = session.vehicles.find((v) => v.id === policeId && v.role === 'police');
  if (!police || police.status !== 'driving') return session;
  return {
    ...session,
    vehicles: session.vehicles.map((v) =>
      v.id === policeId
        ? { ...v, status: 'holding' as const, route: [], routeIndex: 0, routeProgress: 0 }
        : v
    ),
  };
}

function reject(
  session: SimSession,
  reason: DriveOrderReason,
  distanceM?: number
): DriveOrderResult {
  return {
    session: { ...session, notices: pushNotice(session.notices, 'warn', DRIVE_ORDER_MESSAGES[reason]) },
    ok: false,
    reason,
    distanceM,
  };
}

function perpReachedDestination(v: SimVehicle): boolean {
  if (!v.destination) return false;
  return haversineMeters(v.lat, v.lng, v.destination.lat, v.destination.lng) <= DEST_ARRIVAL_M;
}

function livePerps(vehicles: SimVehicle[]): SimVehicle[] {
  return vehicles.filter((v) => v.role === 'perp' && v.status === 'fleeing');
}

export function tickSimSession(session: SimSession, elapsedSec: number): SimSession {
  simClockMs += Math.max(elapsedSec, 0) * 1000;

  const next: SimSession = {
    ...session,
    vehicles: session.vehicles.map((v) => ({ ...v, route: [...v.route] })),
  };
  let notices = pruneNotices(next.notices);

  for (const v of next.vehicles) {
    if (v.role !== 'perp' || v.status !== 'fleeing') continue;
    ensurePerpReady(v);
    advanceVehicle(v, elapsedSec);
    if (perpReachedDestination(v)) {
      v.status = 'escaped';
      v.resolvedAtSimMs = simClockMs;
      v.evaluation = 'Suspect reached their destination and was lost';
      next.escapedTotal += 1;
      notices = pushNotice(notices, 'escaped', `${v.officerName} slipped away`);
    }
  }

  for (const v of next.vehicles) {
    if (v.role !== 'police') continue;
    if (v.status === 'driving') {
      advanceVehicle(v, elapsedSec);
      if (!hasForwardPath(v)) {
        v.status = 'holding';
        v.route = [];
        v.routeIndex = 0;
        v.routeProgress = 0;
      }
    }

    for (const perp of livePerps(next.vehicles)) {
      if (haversineMeters(v.lat, v.lng, perp.lat, perp.lng) > CATCH_METERS) continue;
      perp.status = 'caught';
      perp.resolvedAtSimMs = simClockMs;
      perp.evaluation = `Stopped by ${v.officerName}`;
      perp.route = [];
      next.caughtTotal += 1;
      notices = pushNotice(
        notices,
        'caught',
        `${perp.officerName} in custody — ${perp.vehicleModel} stopped`
      );
    }
  }

  // Resolved suspects stay put briefly so the player sees the outcome, then clear off the map.
  const kept = next.vehicles.filter(
    (v) => v.resolvedAtSimMs === undefined || simClockMs - v.resolvedAtSimMs < RESOLVED_VISIBLE_MS
  );
  if (kept.length !== next.vehicles.length) next.vehicles = kept;

  if (livePerps(next.vehicles).length === 0) {
    const police = next.vehicles.filter((v) => v.role === 'police');
    const center = police[0] ?? next.clusterCenter ?? { lat: OLATHE_CENTER[0], lng: OLATHE_CENTER[1] };
    next.wave += 1;
    next.vehicles = [
      ...next.vehicles,
      ...spawnPerpWave(
        { lat: center.lat, lng: center.lng },
        police.map((p) => ({ lat: p.lat, lng: p.lng })),
        WAVE_SPAWN_MIN_M,
        WAVE_SPAWN_MAX_M,
        next.wave
      ),
    ];
    notices = pushNotice(
      notices,
      'wave',
      `Dispatch: ${WAVE_PERP_COUNT} new suspect vehicles reported nearby`
    );
  }

  next.notices = notices;
  return next;
}
