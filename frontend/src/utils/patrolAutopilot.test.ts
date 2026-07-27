import { getRoadNetwork, snapToRoadSegment } from './olatheRoadNetwork';
import {
  MAX_DRIVE_ORDER_M,
  OLATHE_BOUNDS,
  SimLatLng,
  SimSession,
  SimVehicle,
  createSimSession,
  ensureRoadNetwork,
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
  return {
    elements: [
      ...lats.map((lat) => ({ type: 'way', geometry: lngs.map((lng) => ({ lat, lon: lng })) })),
      ...lngs.map((lng) => ({ type: 'way', geometry: lats.map((lat) => ({ lat, lon: lng })) })),
    ],
  };
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

function offsetMeters(from: SimLatLng, meters: number, bearingDeg: number): SimLatLng {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    lat: from.lat + (meters * Math.cos(rad)) / 111320,
    lng: from.lng + (meters * Math.sin(rad)) / (111320 * Math.cos((from.lat * Math.PI) / 180)),
  };
}

/**
 * Stand-in for a player's eye: scan the streets inside the drive ring and tap whichever one
 * closes the most ground on the suspect. Only the outer part of the ring counts, since a player
 * reaching for the next hop aims as far up the street as the order allows.
 */
function tapPoint(cop: SimVehicle, target: SimLatLng): SimLatLng | null {
  const network = getRoadNetwork();
  if (!network) return null;
  const gapNow = metersBetween(cop, target);
  let best: SimLatLng | null = null;
  let bestGain = -Infinity;

  for (const reach of [0.9, 0.7, 0.5].map((f) => MAX_DRIVE_ORDER_M * f)) {
    for (let deg = 0; deg < 360; deg += 15) {
      const snap = snapToRoadSegment(network, offsetMeters(cop, reach, deg));
      if (!snap) continue;
      const hop = metersBetween(cop, snap.point);
      if (hop > MAX_DRIVE_ORDER_M || hop < MAX_DRIVE_ORDER_M * 0.6) continue;
      const gain = gapNow - metersBetween(snap.point, target);
      if (gain > bestGain) {
        bestGain = gain;
        best = snap.point;
      }
    }
  }
  return best;
}

interface BotRun {
  session: SimSession;
  orders: number;
  refusedOrders: number;
  tapsWithNoUsableRoad: number;
}

/** Play the game the way the controls intend: chase the nearest suspect, one tap at a time. */
function playChasingNearest(minutes: number): BotRun {
  let session = createSimSession('bot');
  const policeId = session.vehicles.find((v) => v.role === 'police')!.id;
  const dt = 1 / 30;
  let orders = 0;
  let refusedOrders = 0;
  let tapsWithNoUsableRoad = 0;

  for (let step = 0; step < 30 * 60 * minutes; step++) {
    const cop = session.vehicles.find((v) => v.id === policeId)!;
    const nearest = session.vehicles
      .filter((v) => v.role === 'perp' && v.status === 'fleeing')
      .map((p) => ({ p, d: metersBetween(cop, p) }))
      .sort((a, b) => a.d - b.d)[0];

    // Tap again as the cruiser finishes its hop, which is how the controls are meant to be used.
    if (nearest && remainingRouteMeters(cop) < 15) {
      const aim = tapPoint(cop, nearest.p);
      if (!aim) {
        tapsWithNoUsableRoad += 1;
      } else {
        const res = orderPoliceTo(session, policeId, aim.lat, aim.lng);
        session = res.session;
        orders += 1;
        if (!res.ok) refusedOrders += 1;
      }
    }

    session = tickSimSession(session, dt);
  }

  return { session, orders, refusedOrders, tapsWithNoUsableRoad };
}

describe('hand-driven patrol is playable', () => {
  beforeAll(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => olatheGridResponse(),
    }) as unknown as typeof fetch;
    sessionStorage.clear();
    await ensureRoadNetwork();
  });

  it('lets a player who taps toward the nearest suspect make stops', () => {
    const { session, orders, refusedOrders, tapsWithNoUsableRoad } = playChasingNearest(10);

    expect(session.caughtTotal).toBeGreaterThanOrEqual(2);
    // Scanning the ring the way a player reads the street always leaves a legal hop to tap.
    expect(tapsWithNoUsableRoad).toBe(0);
    expect(refusedOrders / orders).toBeLessThan(0.05);
    // Suspects still get away, so there is something to play for.
    expect(session.caughtTotal + session.escapedTotal).toBeGreaterThan(session.caughtTotal);
    // Hand-driven means hand-driven: a shift is many short hops, not a few long routes.
    const tapsPerMinute = orders / 10;
    expect(tapsPerMinute).toBeGreaterThan(8);
    expect(tapsPerMinute).toBeLessThan(40);
  }, 60000);

  it('keeps sending waves through a long shift without piling up units', () => {
    let session = createSimSession('bot');
    for (let step = 0; step < 30 * 60 * 30; step++) session = tickSimSession(session, 1 / 30);

    expect(session.wave).toBeGreaterThan(3);
    expect(session.escapedTotal).toBeGreaterThan(10);
    // One cruiser plus at most one wave, whatever happened before.
    expect(session.vehicles.length).toBeLessThanOrEqual(7);
  }, 120000);
});
