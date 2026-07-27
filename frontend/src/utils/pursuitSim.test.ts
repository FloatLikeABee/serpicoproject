import { getRoadNetwork, snapToRoadSegment } from './olatheRoadNetwork';
import {
  MAX_DRIVE_ORDER_M,
  OLATHE_BOUNDS,
  ROAD_TAP_TOLERANCE_M,
  SimLatLng,
  SimSession,
  SimVehicle,
  WAVE_PERP_COUNT,
  createSimSession,
  cruiseSpeedMph,
  ensureRoadNetwork,
  holdPolice,
  orderPoliceTo,
  remainingRouteMeters,
  tickSimSession,
} from './pursuitSim';

const STEP_DEG = 0.0025;

/** Overpass-shaped street grid covering the whole playable box. */
function olatheGridResponse() {
  const lats: number[] = [];
  const lngs: number[] = [];
  for (let lat = OLATHE_BOUNDS.latMin; lat <= OLATHE_BOUNDS.latMax; lat += STEP_DEG) lats.push(lat);
  for (let lng = OLATHE_BOUNDS.lngMin; lng <= OLATHE_BOUNDS.lngMax; lng += STEP_DEG) lngs.push(lng);

  const elements = [
    ...lats.map((lat) => ({
      type: 'way',
      geometry: lngs.map((lng) => ({ lat, lon: lng })),
    })),
    ...lngs.map((lng) => ({
      type: 'way',
      geometry: lats.map((lat) => ({ lat, lon: lng })),
    })),
  ];
  return { elements };
}

function metersBetween(a: SimLatLng, b: SimLatLng) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function unit(session: SimSession, id: string): SimVehicle {
  const found = session.vehicles.find((v) => v.id === id);
  if (!found) throw new Error(`missing vehicle ${id}`);
  return found;
}

function firstPolice(session: SimSession): SimVehicle {
  const police = session.vehicles.find((v) => v.role === 'police');
  if (!police) throw new Error('no cruiser in session');
  return police;
}

function livePerps(session: SimSession): SimVehicle[] {
  return session.vehicles.filter((v) => v.role === 'perp' && v.status === 'fleeing');
}

function routeLength(v: SimVehicle): number {
  let total = 0;
  for (let i = 1; i < v.route.length; i++) total += metersBetween(v.route[i - 1], v.route[i]);
  return total;
}

function offsetMeters(from: SimLatLng, meters: number, bearingDeg: number): SimLatLng {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    lat: from.lat + (meters * Math.cos(rad)) / 111320,
    lng: from.lng + (meters * Math.sin(rad)) / (111320 * Math.cos((from.lat * Math.PI) / 180)),
  };
}

/** A point sitting on a street exactly `targetM` from `from` — the kind of spot a player taps. */
function roadPointNear(from: SimLatLng, targetM: number): SimLatLng {
  const network = getRoadNetwork();
  if (!network) throw new Error('road network not loaded');
  for (let deg = 0; deg < 360; deg += 5) {
    const candidate = offsetMeters(from, targetM, deg);
    const snap = snapToRoadSegment(network, candidate);
    if (snap && snap.distM <= 3) return candidate;
  }
  throw new Error(`no street ${targetM} m from the cruiser`);
}

/** A spot inside the drive ring that is well off any centerline. */
function offRoadPointNear(from: SimLatLng): SimLatLng {
  const network = getRoadNetwork();
  if (!network) throw new Error('road network not loaded');
  for (const reach of [70, 90, 110, 130]) {
    for (let deg = 0; deg < 360; deg += 5) {
      const candidate = offsetMeters(from, reach, deg);
      const snap = snapToRoadSegment(network, candidate);
      if (snap && snap.distM > ROAD_TAP_TOLERANCE_M * 2) return candidate;
    }
  }
  throw new Error('no off-road point inside the ring');
}

function run(session: SimSession, seconds: number, dt = 1 / 30): SimSession {
  let cur = session;
  for (let t = 0; t < seconds; t += dt) cur = tickSimSession(cur, dt);
  return cur;
}

describe('manual patrol simulation', () => {
  beforeAll(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => olatheGridResponse(),
    }) as unknown as typeof fetch;
    sessionStorage.clear();
    await ensureRoadNetwork();
  });

  it('opens with one parked cruiser and a full wave of suspects', () => {
    const session = createSimSession('test-user');
    const police = session.vehicles.filter((v) => v.role === 'police');
    expect(police).toHaveLength(1);
    expect(police[0].status).toBe('holding');
    expect(police[0].route).toHaveLength(0);
    expect(livePerps(session)).toHaveLength(WAVE_PERP_COUNT);
    expect(session.wave).toBe(1);
  });

  it('never moves the cruiser without a player order', () => {
    const session = createSimSession('test-user');
    const policeId = firstPolice(session).id;
    const start = { lat: firstPolice(session).lat, lng: firstPolice(session).lng };

    const later = run(session, 30);
    const police = unit(later, policeId);
    expect(police.status).toBe('holding');
    expect(metersBetween(start, police)).toBe(0);
  });

  it('rolls suspects slowly toward their own destinations', () => {
    const session = createSimSession('test-user');
    const perp = livePerps(session)[0];
    const openingGap = metersBetween(perp, perp.destination!);

    const later = run(session, 20);
    const moved = unit(later, perp.id);
    expect(cruiseSpeedMph(moved)).toBeLessThan(cruiseSpeedMph(firstPolice(session)));
    // Slow means slow: roughly 20 mph over 20 s, never a highway sprint.
    const covered = metersBetween(perp, moved);
    expect(covered).toBeGreaterThan(50);
    expect(covered).toBeLessThan(250);
    expect(metersBetween(moved, moved.destination!)).toBeLessThan(openingGap);
  });

  it('refuses orders that are off the road or too far ahead', () => {
    const session = createSimSession('test-user');
    const police = firstPolice(session);

    const offRoad = orderPoliceTo(session, police.id, ...([
      offRoadPointNear(police).lat,
      offRoadPointNear(police).lng,
    ] as [number, number]));
    expect(offRoad.ok).toBe(false);
    expect(offRoad.reason).toBe('off_road');
    expect(offRoad.session.notices.at(-1)?.kind).toBe('warn');
    expect(unit(offRoad.session, police.id).status).toBe('holding');

    const distant = roadPointNear(police, MAX_DRIVE_ORDER_M * 2);
    const tooFar = orderPoliceTo(session, police.id, distant.lat, distant.lng);
    expect(tooFar.ok).toBe(false);
    expect(tooFar.reason).toBe('too_far');

    const onTop = orderPoliceTo(session, police.id, police.lat, police.lng);
    expect(onTop.reason).toBe('too_close');
  });

  it('drives a tapped order along the road and parks at the end of it', () => {
    let session = createSimSession('test-user');
    const policeId = firstPolice(session).id;
    const target = roadPointNear(firstPolice(session), MAX_DRIVE_ORDER_M * 0.8);

    const ordered = orderPoliceTo(session, policeId, target.lat, target.lng);
    expect(ordered.ok).toBe(true);
    session = ordered.session;

    const police = unit(session, policeId);
    expect(police.status).toBe('driving');
    // The path starts exactly under the car and stays inside one order's budget.
    expect(metersBetween(police, police.route[0])).toBeLessThan(1);
    expect(routeLength(police)).toBeLessThanOrEqual(MAX_DRIVE_ORDER_M + 1);
    // Road-legal: every waypoint sits on a street rather than cutting across a block.
    const network = getRoadNetwork()!;
    for (const point of police.route) {
      expect(snapToRoadSegment(network, point)?.distM ?? Infinity).toBeLessThan(5);
    }

    const dt = 1 / 30;
    const speedCap = cruiseSpeedMph(police) * 0.44704;
    let worstJump = 0;
    for (let step = 0; step < 3000; step++) {
      const before = unit(session, policeId);
      session = tickSimSession(session, dt);
      const after = unit(session, policeId);
      worstJump = Math.max(worstJump, metersBetween(before, after) / (speedCap * dt));
      if (after.status === 'holding') break;
    }

    const parked = unit(session, policeId);
    expect(parked.status).toBe('holding');
    expect(remainingRouteMeters(parked)).toBe(0);
    // One frame may never advance the car further than its own speed allows.
    expect(worstJump).toBeLessThan(1.3);
  });

  it('parks again after one short hop instead of driving on by itself', () => {
    let session = createSimSession('test-user');
    const policeId = firstPolice(session).id;
    const start = { lat: firstPolice(session).lat, lng: firstPolice(session).lng };

    const hop = roadPointNear(start, MAX_DRIVE_ORDER_M * 0.9);
    session = orderPoliceTo(session, policeId, hop.lat, hop.lng).session;

    // A hop is short enough to be a few seconds of driving, not a cross-town route.
    session = run(session, 12);
    const parked = unit(session, policeId);
    expect(parked.status).toBe('holding');
    expect(metersBetween(start, parked)).toBeLessThanOrEqual(MAX_DRIVE_ORDER_M);

    // With no further taps the cruiser stays put, however long the shift runs.
    const restedAt = { lat: parked.lat, lng: parked.lng };
    session = run(session, 60);
    expect(metersBetween(restedAt, unit(session, policeId))).toBe(0);
  });

  it('stops a suspect that drives into a parked cruiser', () => {
    let session = createSimSession('test-user');
    const perp = livePerps(session)[0];
    // Park the cruiser on the suspect's own road, a short way up its route.
    const ahead = perp.route[1];
    session = {
      ...session,
      vehicles: session.vehicles.map((v) =>
        v.role === 'police' ? { ...v, lat: ahead.lat, lng: ahead.lng } : v
      ),
    };

    for (let step = 0; step < 3000; step++) {
      session = tickSimSession(session, 1 / 30);
      if (session.vehicles.find((v) => v.id === perp.id)?.status !== 'fleeing') break;
    }

    expect(session.vehicles.find((v) => v.id === perp.id)?.status).toBe('caught');
    expect(session.caughtTotal).toBeGreaterThanOrEqual(1);
    // The stop is called out on the radio the moment it happens.
    expect(session.notices.some((n) => n.kind === 'caught')).toBe(true);
  });

  it('sends a fresh wave once the last suspect is resolved, and never ends', () => {
    let session = createSimSession('test-user');
    session = {
      ...session,
      vehicles: session.vehicles.map((v) =>
        v.role === 'perp' ? { ...v, status: 'escaped' as const, resolvedAtSimMs: 0 } : v
      ),
    };

    session = tickSimSession(session, 1 / 30);
    expect(session.wave).toBe(2);
    expect(livePerps(session)).toHaveLength(WAVE_PERP_COUNT);
    expect(session.notices.some((n) => n.kind === 'wave')).toBe(true);

    // Resolved markers clear themselves, leaving only the new wave and the cruiser.
    session = run(session, 6);
    expect(session.vehicles.filter((v) => v.status === 'escaped')).toHaveLength(0);
    expect(livePerps(session).length).toBeGreaterThanOrEqual(1);
  });

  it('lets the player cancel an order and hold position', () => {
    let session = createSimSession('test-user');
    const policeId = firstPolice(session).id;
    const target = roadPointNear(firstPolice(session), MAX_DRIVE_ORDER_M * 0.8);
    session = orderPoliceTo(session, policeId, target.lat, target.lng).session;
    session = run(session, 1);
    expect(remainingRouteMeters(unit(session, policeId))).toBeGreaterThan(0);

    session = holdPolice(session, policeId);
    const held = unit(session, policeId);
    expect(held.status).toBe('holding');
    expect(remainingRouteMeters(held)).toBe(0);

    const parkedAt = { lat: held.lat, lng: held.lng };
    session = run(session, 5);
    expect(metersBetween(parkedAt, unit(session, policeId))).toBe(0);
  });

  it('keeps every unit inside the Olathe play area', () => {
    const session = run(createSimSession('test-user'), 120);
    for (const v of session.vehicles) {
      expect(v.lat).toBeGreaterThanOrEqual(OLATHE_BOUNDS.latMin - 0.002);
      expect(v.lat).toBeLessThanOrEqual(OLATHE_BOUNDS.latMax + 0.002);
      expect(v.lng).toBeGreaterThanOrEqual(OLATHE_BOUNDS.lngMin - 0.002);
      expect(v.lng).toBeLessThanOrEqual(OLATHE_BOUNDS.lngMax + 0.002);
    }
  });
});
