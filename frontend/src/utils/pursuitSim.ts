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

export interface SimRoundResult {
  outcome: 'total_failure' | 'partial_win' | 'total_win';
  caught: number;
  escaped: number;
  totalPerps: number;
  score: number;
  message: string;
  grade: string;
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
}

const ROUND_MS = 4 * 60 * 1000;
const CATCH_METERS = 85;
const OlatheBounds = { latMin: 38.86, latMax: 38.91, lngMin: -94.85, lngMax: -94.78 };

const policeProfiles = [
  { rank: 'Patrol Officer', eval: 'Steady responder — reliable on routine intercepts' },
  { rank: 'Senior Officer', eval: 'Tactical ace — excels at high-speed coordination' },
  { rank: 'Corporal', eval: 'Veteran tracker — reads suspect patterns quickly' },
  { rank: 'Sergeant', eval: 'Command mindset — optimal unit deployment instincts' },
  { rank: 'Field Training Officer', eval: 'Precision driver — tight gap closure specialist' },
  { rank: 'Traffic Unit', eval: 'Speed specialist — fastest straight-line pursuit' },
];

const policeFleet = [
  { model: 'Dodge Charger Pursuit', speed: 145 },
  { model: 'Ford Police Interceptor Utility', speed: 131 },
  { model: 'Chevy Tahoe PPV', speed: 124 },
  { model: 'Ford F-150 Police Responder', speed: 118 },
  { model: 'Harley-Davidson Police Motorcycle', speed: 112 },
];

const perpFleet = [
  { model: 'Stolen Honda Civic', speed: 108 },
  { model: 'Black Ford F-150', speed: 115 },
  { model: 'Sport Motorcycle', speed: 125 },
  { model: 'Gray Panel Van', speed: 98 },
  { model: 'Red Toyota Corolla', speed: 105 },
];

const perpNames = ['Subject Alpha', 'Subject Bravo', 'Subject Charlie', 'Subject Delta'];

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

function destinationPoint(lat: number, lng: number, bearDeg: number, distM: number): SimLatLng {
  const R = 6371000;
  const rad = Math.PI / 180;
  const bear = bearDeg * rad;
  const lat1 = lat * rad;
  const lng1 = lng * rad;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distM / R) + Math.cos(lat1) * Math.sin(distM / R) * Math.cos(bear)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bear) * Math.sin(distM / R) * Math.cos(lat1),
      Math.cos(distM / R) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: lat2 / rad, lng: lng2 / rad };
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

function buildRoadRouteToDestination(start: SimLatLng, dest: SimLatLng): SimLatLng[] {
  const route: SimLatLng[] = [{ ...start }];
  let cur = { ...start };
  let safety = 0;
  while (haversineMeters(cur.lat, cur.lng, dest.lat, dest.lng) > 400 && safety < 24) {
    safety++;
    const dLat = dest.lat - cur.lat;
    const dLng = dest.lng - cur.lng;
    const step = 0.004 + Math.random() * 0.003;
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
  return randomPointInZone(38.872, 38.908, -94.82, -94.785);
}

function randomPoliceSpawn(existing: SimLatLng[]): SimLatLng {
  for (let i = 0; i < 40; i++) {
    const p = randomPointInZone(38.862, 38.898, -94.855, -94.815);
    if (existing.every((e) => haversineMeters(p.lat, p.lng, e.lat, e.lng) >= 1200)) {
      return p;
    }
  }
  return randomPointInZone(38.865, 38.895, -94.855, -94.82);
}

function randomPerpSpawn(existing: SimLatLng[], police: SimLatLng[]): SimLatLng {
  for (let i = 0; i < 50; i++) {
    const p = randomPerpDestination();
    const farFromPolice = police.every((e) => haversineMeters(p.lat, p.lng, e.lat, e.lng) >= 2800);
    const farFromPerps = existing.every((e) => haversineMeters(p.lat, p.lng, e.lat, e.lng) >= 1500);
    if (farFromPolice && farFromPerps) return p;
  }
  return randomPerpDestination();
}

function advanceVehicle(v: SimVehicle, elapsedSec: number) {
  if (v.route.length < 2 || elapsedSec <= 0 || v.status === 'caught' || v.status === 'escaped') return;

  let speed = mphToMps(v.maxSpeedMph);
  if (v.role === 'perp' && v.beingPursued) speed *= 1.12;
  if (v.role === 'police' && v.status === 'patrol') speed *= 0.55;

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
  const downCount = Math.min(police.length - 2, randInt(1, 2));
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

function moveToward(v: SimVehicle, targetLat: number, targetLng: number, distM: number) {
  if (distM <= 0) return;
  const bear = bearingDeg(v.lat, v.lng, targetLat, targetLng);
  const dest = destinationPoint(v.lat, v.lng, bear, distM);
  v.lat = dest.lat;
  v.lng = dest.lng;
  v.heading = bear;
}

export function createSimSession(userId: string, round = 1): SimSession {
  const perpCount = randInt(3, 4);
  const policeCount = randInt(4, 7);
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
      maxSpeedMph: fleet.speed + randInt(-3, 3),
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
      maxSpeedMph: fleet.speed + randInt(-4, 4),
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
    vehicles,
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
      const target = perpPositions[v.pursuingPerpId];
      if (!target) {
        v.status = 'patrol';
        v.pursuingPerpId = undefined;
        advanceVehicle(v, elapsedSec * 0.5);
        continue;
      }
      moveToward(v, target.lat, target.lng, mphToMps(v.maxSpeedMph) * 0.9 * elapsedSec);
      const perp = next.vehicles.find((p) => p.id === v.pursuingPerpId);
      if (perp && haversineMeters(v.lat, v.lng, perp.lat, perp.lng) <= CATCH_METERS) {
        perp.status = 'caught';
        perp.beingPursued = false;
        v.status = 'idle';
        v.pursuingPerpId = undefined;
      }
    } else if (v.status === 'patrol') {
      advanceVehicle(v, elapsedSec);
    }
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
    cooldownEndsAt: Date.now() + randInt(60, 120) * 1000,
    result: { outcome, caught, escaped, totalPerps: total, score, message, grade },
  };
}

export function armPursuit(session: SimSession, policeId: string): SimSession {
  if (session.phase !== 'active') return session;
  return { ...session, armedPoliceId: policeId };
}

export function startPursuit(session: SimSession, policeId: string, perpId: string): SimSession {
  if (session.phase !== 'active') return session;
  const vehicles = session.vehicles.map((v) => {
    if (v.id === policeId && v.role === 'police' && v.status !== 'down' && (v.status === 'patrol' || v.status === 'idle')) {
      return { ...v, status: 'pursuing' as const, pursuingPerpId: perpId };
    }
    if (v.id === perpId && v.role === 'perp' && v.status !== 'caught') {
      return { ...v, beingPursued: true };
    }
    return { ...v };
  });
  return { ...session, vehicles, armedPoliceId: undefined };
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
