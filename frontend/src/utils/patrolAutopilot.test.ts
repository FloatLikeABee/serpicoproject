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

function towards(from: SimLatLng, to: SimLatLng, meters: number): SimLatLng {
  const total = metersBetween(from, to);
  if (total <= meters) return { ...to };
  const f = meters / total;
  return { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f };
}

/** Stand-in for a player's eye: sight up the street toward the suspect, then tap it. */
function tapPoint(cop: SimVehicle, target: SimLatLng, reach: number): SimLatLng | null {
  const network = getRoadNetwork();
  if (!network) return null;
  return snapToRoadSegment(network, towards(cop, target, reach))?.point ?? null;
}

interface BotRun {
  session: SimSession;
  refusedOrders: number;
  tapsWithNoUsableRoad: number;
}

/** Play the game the way the controls intend: chase the nearest suspect, one tap at a time. */
function playChasingNearest(minutes: number): BotRun {
  let session = createSimSession('bot');
  const policeId = session.vehicles.find((v) => v.role === 'police')!.id;
  const dt = 1 / 30;
  let refusedOrders = 0;
  let tapsWithNoUsableRoad = 0;

  for (let step = 0; step < 30 * 60 * minutes; step++) {
    const cop = session.vehicles.find((v) => v.id === policeId)!;
    const nearest = session.vehicles
      .filter((v) => v.role === 'perp' && v.status === 'fleeing')
      .map((p) => ({ p, d: metersBetween(cop, p) }))
      .sort((a, b) => a.d - b.d)[0];

    // Re-tap as the current order runs out, which is how the controls are meant to be used.
    if (nearest && remainingRouteMeters(cop) < 90) {
      let issued = false;
      for (const reach of [0.9, 0.6, 0.3].map((f) => MAX_DRIVE_ORDER_M * f)) {
        const aim = tapPoint(cop, nearest.p, reach);
        if (!aim) continue;
        const res = orderPoliceTo(session, policeId, aim.lat, aim.lng);
        session = res.session;
        if (res.ok) {
          issued = true;
          break;
        }
        refusedOrders += 1;
      }
      if (!issued) tapsWithNoUsableRoad += 1;
    }

    session = tickSimSession(session, dt);
  }

  return { session, refusedOrders, tapsWithNoUsableRoad };
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
    const { session, refusedOrders, tapsWithNoUsableRoad } = playChasingNearest(10);

    expect(session.caughtTotal).toBeGreaterThanOrEqual(2);
    // Sighting up the street toward a target must always produce a legal order.
    expect(refusedOrders).toBe(0);
    expect(tapsWithNoUsableRoad).toBe(0);
    // Suspects still get away, so there is something to play for.
    expect(session.caughtTotal + session.escapedTotal).toBeGreaterThan(session.caughtTotal);
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
