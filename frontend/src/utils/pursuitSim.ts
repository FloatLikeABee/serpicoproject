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
  /** Client-only: last simulation tick timestamp for catch-up after tab restore */
  lastTickAt?: number;
}

/** Round length — ~8 min mirrors a typical extended multi-unit suburban pursuit operation. */
export const ROUND_MS = 8 * 60 * 1000;
export const ROUND_DURATION_MIN = 8;
/** Scales road travel to offset grid routing distance vs real roads (training responsiveness). */
export const SIM_MOVEMENT_SCALE = 1.85;
const CATCH_METERS = 85;
const OlatheBounds = { latMin: 38.86, latMax: 38.91, lngMin: -94.85, lngMax: -94.78 };

/** Urban patrol cruise — real-world typical (mph). */
const PATROL_CRUISE_MPH = 42;
/** Suspect cruising speed before pursuit (mph). */
const PERP_CRUISE_MPH = 54;

interface FleetSpec {
  model: string;
  /** Manufacturer / pursuit-package rated top speed (shown in UI). */
  ratedMaxMph: number;
  /** Typical high-speed pursuit operational speed (mph). */
  pursuitMph?: number;
  /** Typical fleeing suspect speed under pressure (mph). */
  fleeMph?: number;
}

const policeProfiles = [
  { rank: 'Patrol Officer', eval: 'Steady responder — reliable on routine intercepts' },
  { rank: 'Senior Officer', eval: 'Tactical ace — excels at high-speed coordination' },
  { rank: 'Corporal', eval: 'Veteran tracker — reads suspect patterns quickly' },
  { rank: 'Sergeant', eval: 'Command mindset — optimal unit deployment instincts' },
  { rank: 'Field Training Officer', eval: 'Precision driver — tight gap closure specialist' },
  { rank: 'Traffic Unit', eval: 'Speed specialist — fastest straight-line pursuit' },
];

const policeFleet: FleetSpec[] = [
  // Rated max: Mopar pursuit calibration / manufacturer pursuit package specs
  { model: 'Dodge Charger Pursuit', ratedMaxMph: 149, pursuitMph: 120 },
  { model: 'Ford Police Interceptor Utility', ratedMaxMph: 137, pursuitMph: 105 },
  { model: 'Chevy Tahoe PPV', ratedMaxMph: 120, pursuitMph: 95 },
  { model: 'Ford F-150 Police Responder', ratedMaxMph: 100, pursuitMph: 82 },
  { model: 'Harley-Davidson Police Motorcycle', ratedMaxMph: 105, pursuitMph: 88 },
];

const perpFleet: FleetSpec[] = [
  { model: 'Stolen Honda Civic', ratedMaxMph: 137, fleeMph: 100 },
  { model: 'Black Ford F-150', ratedMaxMph: 107, fleeMph: 90 },
  { model: 'Sport Motorcycle', ratedMaxMph: 130, fleeMph: 115 },
  { model: 'Gray Panel Van', ratedMaxMph: 90, fleeMph: 75 },
  { model: 'Red Toyota Corolla', ratedMaxMph: 118, fleeMph: 95 },
];

const perpNames = [
  'Subject Alpha', 'Subject Bravo', 'Subject Charlie', 'Subject Delta',
  'Subject Echo', 'Subject Foxtrot', 'Subject Ghost', 'Subject Havoc', 'Subject Ion',
];

const MIN_FLEET_DISTANCE_M = 5200;

const officerNames = ['Martinez', 'Chen', 'Johnson', 'Williams', 'Patel', 'Garcia', 'Thompson', 'Davis'];

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

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const dLng = (lng2 - lng1) * rad;
  const y = Math.sin(dLng) * Math.cos(lat2 * rad);
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}


function mphToMps(mph: number) {
  return mph * 0.44704;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function randomPointInZone(latMin: number, latMax: number, lngMin: number, lngMax: number): SimLatLng {
  const step = 0.003;
  const latSteps = Math.max(1, Math.floor((latMax - latMin) / step));
  const lngSteps = Math.max(1, Math.floor((lngMax - lngMin) / step));
  return {
    lat: latMin + Math.floor(Math.random() * (latSteps + 1)) * step,
    lng: lngMin + Math.floor(Math.random() * (lngSteps + 1)) * step,
  };
}

/** Smaller grid steps so vehicles follow road-like paths instead of flying diagonally. */
const ROAD_STEP_MIN = 0.0012;
const ROAD_STEP_MAX = 0.0022;
const PURSUIT_ROUTE_REBUILD_M = 220;

function buildRoadRouteToDestination(start: SimLatLng, dest: SimLatLng): SimLatLng[] {
  const route: SimLatLng[] = [{ ...start }];
  let cur = { ...start };
  let safety = 0;
  while (haversineMeters(cur.lat, cur.lng, dest.lat, dest.lng) > 120 && safety < 48) {
    safety++;
    const dLat = dest.lat - cur.lat;
    const dLng = dest.lng - cur.lng;
    const step = ROAD_STEP_MIN + Math.random() * (ROAD_STEP_MAX - ROAD_STEP_MIN);
    const next = { ...cur };
    if (Math.abs(dLat) >= Math.abs(dLng)) {
      next.lat += Math.sign(dLat) * step;
    } else {
      next.lng += Math.sign(dLng) * step;
    }
    next.lat = clamp(next.lat, OlatheBounds.latMin, OlatheBounds.latMax);
    next.lng = clamp(next.lng, OlatheBounds.lngMin, OlatheBounds.lngMax);
    route.push(next);
    cur = next;
  }
  route.push({ ...dest });
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
  const route = buildRoadRouteToDestination(start, dest);
  if (route.length < 3) {
    route.push(randomPointInZone(start.lat - 0.02, start.lat + 0.02, start.lng - 0.02, start.lng + 0.02));
  }
  return route;
}

function randomPerpDestination(): SimLatLng {
  return randomPointInZone(38.868, 38.912, -94.798, -94.762);
}

function randomPoliceSpawn(existing: SimLatLng[]): SimLatLng {
  for (let i = 0; i < 50; i++) {
    const p = randomPointInZone(38.858, 38.905, -94.872, -94.835);
    if (existing.every((e) => haversineMeters(p.lat, p.lng, e.lat, e.lng) >= 1500)) {
      return p;
    }
  }
  return randomPointInZone(38.858, 38.905, -94.872, -94.835);
}

function randomPerpSpawn(existing: SimLatLng[], police: SimLatLng[]): SimLatLng {
  for (let i = 0; i < 80; i++) {
    const p = randomPointInZone(38.868, 38.912, -94.798, -94.762);
    const farFromPolice = police.every((e) => haversineMeters(p.lat, p.lng, e.lat, e.lng) >= MIN_FLEET_DISTANCE_M);
    const farFromPerps = existing.every((e) => haversineMeters(p.lat, p.lng, e.lat, e.lng) >= 1800);
    if (farFromPolice && farFromPerps) return p;
  }
  return randomPointInZone(38.868, 38.912, -94.798, -94.762);
}

function fleetSpecForVehicle(v: SimVehicle): FleetSpec | undefined {
  const fleet = v.role === 'police' ? policeFleet : perpFleet;
  return fleet.find((f) => f.model === v.vehicleModel);
}

/** Operational speed used by the sim — grounded in real patrol/pursuit/flee behavior (mph). */
export function getOperationalSpeedMph(v: SimVehicle): number {
  if (v.status === 'caught' || v.status === 'escaped' || v.status === 'down') return 0;

  const spec = fleetSpecForVehicle(v);
  let mph = 0;

  if (v.role === 'police') {
    if (v.status === 'pursuing') {
      mph = spec?.pursuitMph ?? v.maxSpeedMph * 0.78;
    } else {
      mph = PATROL_CRUISE_MPH;
    }
  } else if (v.beingPursued) {
    mph = spec?.fleeMph ?? v.maxSpeedMph * 0.72;
  } else {
    mph = PERP_CRUISE_MPH;
  }

  return mph * SIM_MOVEMENT_SCALE;
}

/** Operational mph without sim scale — for UI labels. */
export function getDisplayOperationalMph(v: SimVehicle): number {
  if (v.status === 'caught' || v.status === 'escaped' || v.status === 'down') return 0;
  const spec = fleetSpecForVehicle(v);
  if (v.role === 'police') {
    if (v.status === 'pursuing') return spec?.pursuitMph ?? Math.round(v.maxSpeedMph * 0.78);
    return PATROL_CRUISE_MPH;
  }
  if (v.beingPursued) return spec?.fleeMph ?? Math.round(v.maxSpeedMph * 0.72);
  return PERP_CRUISE_MPH;
}

function advanceVehicle(v: SimVehicle, elapsedSec: number) {
  if (v.route.length < 2 || elapsedSec <= 0 || v.status === 'caught' || v.status === 'escaped') return;

  let speed = mphToMps(getOperationalSpeedMph(v));
  if (speed <= 0) return;

  let remaining = speed * elapsedSec;

  while (remaining > 0 && v.route.length >= 2) {
    const cur = v.route[v.routeIndex];
    let nextIdx = v.routeIndex + 1;
    if (nextIdx >= v.route.length) {
      if (v.role === 'perp') {
        const dest = randomPerpDestination();
        v.destination = dest;
        v.route = buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, dest);
        v.routeIndex = 0;
        v.routeProgress = 0;
        break;
      }
      const dest = randomPointInZone(OlatheBounds.latMin, OlatheBounds.latMax, OlatheBounds.lngMin, OlatheBounds.lngMax);
      v.route = buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, dest);
      v.routeIndex = 0;
      v.routeProgress = 0;
      break;
    }
    const next = v.route[nextIdx];
    const segLen = haversineMeters(cur.lat, cur.lng, next.lat, next.lng);
    if (segLen < 1) {
      v.routeIndex = nextIdx >= v.route.length ? 0 : nextIdx;
      v.routeProgress = 0;
      continue;
    }
    const distLeft = segLen * (1 - v.routeProgress);
    if (remaining >= distLeft) {
      remaining -= distLeft;
      v.routeIndex = nextIdx >= v.route.length - 1 ? 0 : nextIdx;
      v.routeProgress = 0;
      v.lat = next.lat;
      v.lng = next.lng;
      v.heading = bearingDeg(cur.lat, cur.lng, next.lat, next.lng);
      if (v.role === 'perp' && v.destination && haversineMeters(v.lat, v.lng, v.destination.lat, v.destination.lng) < 200) {
        const dest = randomPerpDestination();
        v.destination = dest;
        v.route = buildRoadRouteToDestination({ lat: v.lat, lng: v.lng }, dest);
        v.routeIndex = 0;
      }
    } else {
      v.routeProgress += remaining / segLen;
      v.lat = cur.lat + (next.lat - cur.lat) * v.routeProgress;
      v.lng = cur.lng + (next.lng - cur.lng) * v.routeProgress;
      v.heading = bearingDeg(cur.lat, cur.lng, next.lat, next.lng);
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
  if (police.length < 4) return;
  const downCount = Math.min(Math.max(police.length - 2, 1), randInt(1, 2));
  const shuffled = [...police].sort(() => Math.random() - 0.5);
  for (let i = 0; i < downCount; i++) {
    const unit = shuffled[i];
    const vehicle = vehicles.find((v) => v.id === unit.id);
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
  const perpCount = randInt(5, 9);
  const policeCount = randInt(4, 5);
  const policeSpawns: SimLatLng[] = [];
  const vehicles: SimVehicle[] = [];

  for (let i = 0; i < policeCount; i++) {
    const start = randomPoliceSpawn(policeSpawns);
    policeSpawns.push(start);
    const fleet = policeFleet[i % policeFleet.length];
    const profile = policeProfiles[i % policeProfiles.length];
    vehicles.push({
      id: uid('police'),
      role: 'police',
      lat: start.lat,
      lng: start.lng,
      heading: rand(0, 360),
      route: randomPatrolRoute(start),
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

  const perpSpawns: SimLatLng[] = [];
  for (let i = 0; i < perpCount; i++) {
    const start = randomPerpSpawn(perpSpawns, policeSpawns);
    perpSpawns.push(start);
    const dest = randomPerpDestination();
    const fleet = perpFleet[i % perpFleet.length];
    vehicles.push({
      id: uid('perp'),
      role: 'perp',
      lat: start.lat,
      lng: start.lng,
      heading: rand(0, 360),
      route: buildRoadRouteToDestination(start, dest),
      routeIndex: 0,
      routeProgress: 0,
      maxSpeedMph: fleet.ratedMaxMph + randInt(-3, 3),
      officerName: perpNames[i % perpNames.length],
      evaluation: 'Suspect vehicle — evasive driving toward destination',
      vehicleModel: fleet.model,
      destination: dest,
      status: 'patrol',
      beingPursued: false,
    });
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
    lastTickAt: now,
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
      advanceVehicle(v, elapsedSec);
      perpPositions[v.id] = { lat: v.lat, lng: v.lng };
    }
  }

  for (const v of next.vehicles) {
    if (v.role !== 'police' || v.status === 'down') continue;
    if (v.status === 'idle') {
      v.status = 'patrol';
    }
    if (v.status === 'pursuing' && v.pursuingPerpId) {
      const perp = next.vehicles.find((p) => p.id === v.pursuingPerpId);
      const target = perpPositions[v.pursuingPerpId];
      if (!target || !perp || perp.status === 'caught') {
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

  if (now >= next.roundEndsAt) {
    return finishSimRound(next);
  }

  next.lastTickAt = now;
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
    lastTickAt: Date.now(),
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

  if (police && perp) {
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
    const usedIds = new Set(stats.decisions.map((d) => d.policeId));
    stats.policeUsed = usedIds.size;
  }

  return { ...session, vehicles, armedPoliceId: undefined, stats };
}

/** Merge server snapshot into local session (keep sim running between polls). */
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
  const now = Date.now();
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
    lastTickAt: now,
  };
}

const STORAGE_PREFIX = 'pursuit-exam-session-';
const MAX_CATCHUP_SEC = 300;

export function pursuitSessionStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function saveSimSessionToStorage(session: SimSession) {
  try {
    localStorage.setItem(pursuitSessionStorageKey(session.userId), JSON.stringify(session));
  } catch {
    /* quota or private mode */
  }
}

export function loadSimSessionFromStorage(userId: string): SimSession | null {
  try {
    const raw = localStorage.getItem(pursuitSessionStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SimSession;
    if (!parsed?.id || parsed.userId !== userId || !parsed.vehicles?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSimSessionStorage(userId: string) {
  try {
    localStorage.removeItem(pursuitSessionStorageKey(userId));
  } catch {
    /* ignore */
  }
}

/** Fast-forward simulation after user was away (other modules / tab background). */
export function catchUpSimSession(session: SimSession, maxSec = MAX_CATCHUP_SEC): SimSession {
  const last = session.lastTickAt ?? session.roundStartMs ?? Date.now();
  let remaining = Math.min(Math.max(0, (Date.now() - last) / 1000), maxSec);
  if (remaining <= 0) return session;

  let next = session;
  while (remaining > 0) {
    const step = Math.min(remaining, 0.1);
    next = tickSimSession(next, step);
    remaining -= step;
    if (next.phase !== 'active') break;
  }
  return next;
}

export function isStoredSessionUsable(session: SimSession): boolean {
  const perpN = session.vehicles.filter((v) => v.role === 'perp').length;
  const polN = session.vehicles.filter((v) => v.role === 'police').length;
  return perpN >= 5 && perpN <= 9 && polN >= 4 && polN <= 5;
}
