/** Client-side pursuit exam simulation — drives smooth map movement. */

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

export const POLICE_COUNT_MIN = 3;
export const POLICE_COUNT_MAX = 5;
export const PERP_COUNT_MIN = 3;
export const PERP_COUNT_MAX = 5;
/** Boosts sim travel speed so units feel responsive on the map grid. */
export const SIM_MOVEMENT_SCALE = 6.0;

const ROUND_MS = 2 * 60 * 1000;
const CATCH_METERS = 85;
const DEST_ARRIVAL_M = 150;
const OlatheBounds = { latMin: 38.86, latMax: 38.91, lngMin: -94.85, lngMax: -94.78 };
/** ~45 m city blocks — vehicles move only on N/S/E/W grid lines. */
const ROAD_GRID_STEP = 0.0004;
const PURSUIT_ROUTE_REBUILD_M = 320;
const MIN_PERP_POLICE_SPAWN_M = 600;
const MIN_PERP_DEST_DISTANCE_M = 7200;
const MIN_VEHICLE_SPAWN_SEP_M = 1200;

const PATROL_CRUISE_MPH = 52;
const PERP_CRUISE_MPH = 62;

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
  { model: 'Dodge Charger Pursuit', ratedMaxMph: 149, pursuitMph: 125 },
  { model: 'Ford Police Interceptor Utility', ratedMaxMph: 137, pursuitMph: 110 },
  { model: 'Chevy Tahoe PPV', ratedMaxMph: 120, pursuitMph: 98 },
  { model: 'Ford F-150 Police Responder', ratedMaxMph: 100, pursuitMph: 88 },
  { model: 'Harley-Davidson Police Motorcycle', ratedMaxMph: 105, pursuitMph: 92 },
  { model: 'Ram 1500 Special Service', ratedMaxMph: 115, pursuitMph: 95 },
];

const perpFleet: FleetSpec[] = [
  { model: 'Stolen Honda Civic', ratedMaxMph: 137, fleeMph: 105 },
  { model: 'Black Ford F-150', ratedMaxMph: 107, fleeMph: 95 },
  { model: 'Sport Motorcycle', ratedMaxMph: 130, fleeMph: 118 },
  { model: 'Gray Panel Van', ratedMaxMph: 90, fleeMph: 78 },
  { model: 'Red Toyota Corolla', ratedMaxMph: 118, fleeMph: 98 },
];

const perpNames = [
  'Subject Alpha', 'Subject Bravo', 'Subject Charlie', 'Subject Delta',
  'Subject Echo', 'Subject Foxtrot', 'Subject Ghost', 'Subject Havoc', 'Subject Ion',
];

const officerNames = [
  'Martinez', 'Chen', 'Johnson', 'Williams', 'Patel', 'Garcia',
  'Thompson', 'Davis', 'Wilson', 'Anderson', 'Lee', 'Brown',
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

function gridHeading(from: SimLatLng, to: SimLatLng): number {
  const dLat = Math.abs(to.lat - from.lat);
  const dLng = Math.abs(to.lng - from.lng);
  if (dLng >= dLat) return to.lng > from.lng ? 90 : 270;
  return to.lat > from.lat ? 0 : 180;
}

function randomPointInZone(latMin: number, latMax: number, lngMin: number, lngMax: number): SimLatLng {
  return snapToRoadGrid({ lat: rand(latMin, latMax), lng: rand(lngMin, lngMax) });
}

function buildRoadRouteToDestination(start: SimLatLng, dest: SimLatLng): SimLatLng[] {
  const route: SimLatLng[] = [snapToRoadGrid(start)];
  let cur = { ...route[0] };
  const end = snapToRoadGrid(dest);
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

function ensurePursuitRoute(v: SimVehicle, target: SimLatLng) {
  const end = v.route[v.route.length - 1];
  const stale =
    v.route.length < 2 ||
    !end ||
    haversineMeters(end.lat, end.lng, target.lat, target.lng) > PURSUIT_ROUTE_REBUILD_M;
  if (stale) {
    v.route = buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, target);
    v.routeIndex = 0;
    v.routeProgress = 0;
  }
}

function releasePoliceForReassignment(v: SimVehicle) {
  v.status = 'patrol';
  v.pursuingPerpId = undefined;
  v.route = randomPatrolRoute({ lat: v.lat, lng: v.lng });
  v.routeIndex = 0;
  v.routeProgress = 0;
}

function fleetSpecForVehicle(v: SimVehicle): FleetSpec | undefined {
  const fleet = v.role === 'police' ? policeFleet : perpFleet;
  return fleet.find((f) => f.model === v.vehicleModel);
}

export function getOperationalSpeedMph(v: SimVehicle): number {
  if (v.status === 'caught' || v.status === 'escaped' || v.status === 'down') return 0;
  const spec = fleetSpecForVehicle(v);
  let mph = 0;
  if (v.role === 'police') {
    mph = v.status === 'pursuing'
      ? (spec?.pursuitMph ?? v.maxSpeedMph * 0.82)
      : PATROL_CRUISE_MPH;
  } else if (v.beingPursued) {
    mph = spec?.fleeMph ?? v.maxSpeedMph * 0.75;
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

/** Random scatter spawns across the full map — police and suspects share the same pool. */
function pickMixedRandomSpawns(count: number): SimLatLng[] {
  const { latMin, latMax, lngMin, lngMax } = OlatheBounds;
  const picked: SimLatLng[] = [];
  for (let attempt = 0; picked.length < count && attempt < count * 150; attempt++) {
    const p = randomPointInZone(latMin, latMax, lngMin, lngMax);
    if (picked.every((e) => haversineMeters(p.lat, p.lng, e.lat, e.lng) >= MIN_VEHICLE_SPAWN_SEP_M)) {
      picked.push(p);
    }
  }
  while (picked.length < count) {
    picked.push(randomPointInZone(latMin, latMax, lngMin, lngMax));
  }
  return shuffleInPlace(picked);
}

function pickPerpDestination(from: SimLatLng): SimLatLng {
  return farthestMapCorner(from);
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
  return snapToRoadGrid(best);
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

  if (!v.destination || destDistance < MIN_PERP_DEST_DISTANCE_M * 0.85 || destDistance <= DEST_ARRIVAL_M) {
    v.destination = pickPerpDestination(pos);
  }

  if (v.route.length < 2 || !routeHasMovement(v.route)) {
    v.route = buildRoadRouteToDestination(pos, v.destination!);
    v.routeIndex = 0;
    v.routeProgress = 0;
  }
}

function randomPoliceSpawn(existing: SimLatLng[]): SimLatLng {
  const spawns = pickMixedRandomSpawns(1);
  return spawns[0];
}

function advanceVehicle(v: SimVehicle, elapsedSec: number) {
  if (v.route.length < 2 || elapsedSec <= 0 || v.status === 'caught' || v.status === 'escaped') return;

  const speed = mphToMps(getOperationalSpeedMph(v));
  if (speed <= 0) return;

  let remaining = speed * elapsedSec;

  while (remaining > 0 && v.route.length >= 2) {
    const cur = v.route[v.routeIndex];
    const nextIdx = v.routeIndex + 1;
    if (nextIdx >= v.route.length) {
      if (v.role === 'police' && v.status === 'patrol') {
        v.route = randomPatrolRoute({ lat: v.lat, lng: v.lng });
        v.routeIndex = 0;
        v.routeProgress = 0;
      } else if (v.role === 'perp') {
        const dest = pickPerpDestination({ lat: v.lat, lng: v.lng });
        v.destination = dest;
        v.route = buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, dest);
        v.routeIndex = 0;
        v.routeProgress = 0;
      }
      break;
    }
    const next = v.route[nextIdx];
    const segLen = haversineMeters(cur.lat, cur.lng, next.lat, next.lng);
    if (segLen < 1) {
      if (v.role === 'perp' && v.destination) {
        v.route = buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, v.destination);
        v.routeIndex = 0;
        v.routeProgress = 0;
        break;
      }
      v.routeIndex = nextIdx;
      v.routeProgress = 0;
      continue;
    }
    const distLeft = segLen * (1 - v.routeProgress);
    if (remaining >= distLeft) {
      remaining -= distLeft;
      v.routeIndex = nextIdx;
      v.routeProgress = 0;
      v.lat = next.lat;
      v.lng = next.lng;
      v.heading = gridHeading(cur, next);
      if (v.role === 'police' && v.status === 'patrol' && nextIdx >= v.route.length - 1) {
        v.route = randomPatrolRoute({ lat: v.lat, lng: v.lng });
        v.routeIndex = 0;
        v.routeProgress = 0;
      }
    } else {
      v.routeProgress += remaining / segLen;
      v.lat = cur.lat + (next.lat - cur.lat) * v.routeProgress;
      v.lng = cur.lng + (next.lng - cur.lng) * v.routeProgress;
      v.heading = gridHeading(cur, next);
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
  if (police.length < POLICE_COUNT_MIN) return;
  const downCount = Math.min(randInt(1, 3), Math.max(1, police.length - 4));
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

export function createSimSession(userId: string, round = 1): SimSession {
  const perpCount = randInt(PERP_COUNT_MIN, PERP_COUNT_MAX);
  const policeCount = randInt(POLICE_COUNT_MIN, POLICE_COUNT_MAX);
  const mixedSpawns = pickMixedRandomSpawns(policeCount + perpCount);
  const roles: Array<'police' | 'perp'> = [
    ...Array(policeCount).fill('police' as const),
    ...Array(perpCount).fill('perp' as const),
  ];
  shuffleInPlace(roles);

  const vehicles: SimVehicle[] = [];
  let policeIdx = 0;
  let perpIdx = 0;

  for (let i = 0; i < mixedSpawns.length; i++) {
    const start = mixedSpawns[i];
    if (roles[i] === 'police') {
      const fleet = policeFleet[policeIdx % policeFleet.length];
      const profile = policeProfiles[policeIdx % policeProfiles.length];
      const route = randomPatrolRoute(start);
      vehicles.push({
        id: uid('police'),
        role: 'police',
        lat: start.lat,
        lng: start.lng,
        heading: route.length > 1 ? gridHeading(route[0], route[1]) : rand(0, 360),
        route,
        routeIndex: 0,
        routeProgress: 0,
        maxSpeedMph: fleet.ratedMaxMph + randInt(-2, 2),
        officerName: `Officer ${officerNames[policeIdx % officerNames.length]}`,
        officerRank: profile.rank,
        evaluation: profile.eval,
        vehicleModel: fleet.model,
        status: 'patrol',
        beingPursued: false,
      });
      policeIdx++;
    } else {
      const dest = pickPerpDestination(start);
      const fleet = perpFleet[perpIdx % perpFleet.length];
      const route = buildRoadRouteToDestination(start, dest);
      const perp: SimVehicle = {
        id: uid('perp'),
        role: 'perp',
        lat: start.lat,
        lng: start.lng,
        heading: route.length > 1 ? gridHeading(route[0], route[1]) : rand(0, 360),
        route,
        routeIndex: 0,
        routeProgress: 0,
        maxSpeedMph: fleet.ratedMaxMph + randInt(-3, 3),
        officerName: perpNames[perpIdx % perpNames.length],
        evaluation: 'Suspect vehicle — evasive driving toward destination',
        vehicleModel: fleet.model,
        destination: dest,
        status: 'patrol',
        beingPursued: false,
      };
      ensurePerpReady(perp);
      vehicles.push(perp);
      perpIdx++;
    }
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
      const target = perpPositions[v.pursuingPerpId];
      if (!target || !perp || perp.status === 'caught' || perp.status === 'escaped') {
        releasePoliceForReassignment(v);
        advanceVehicle(v, elapsedSec * 0.5);
        continue;
      }
      ensurePursuitRoute(v, target);
      advanceVehicle(v, elapsedSec);
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
    cooldownEndsAt: Date.now() + 20 * 1000,
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

  const perpTarget = { lat: perp.lat, lng: perp.lng };
  const vehicles = session.vehicles.map((v) => {
    if (v.id === policeId) {
      return {
        ...v,
        status: 'pursuing' as const,
        pursuingPerpId: perpId,
        route: buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, perpTarget),
        routeIndex: 0,
        routeProgress: 0,
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
  return perpN >= PERP_COUNT_MIN && perpN <= PERP_COUNT_MAX && polN >= POLICE_COUNT_MIN && polN <= POLICE_COUNT_MAX;
}
