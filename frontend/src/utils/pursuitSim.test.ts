import {
  OLATHE_BOUNDS,
  SimSession,
  SimVehicle,
  createSimSession,
  ensureRoadNetwork,
  getOperationalSpeedMph,
  startPursuit,
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

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

describe('pursuit simulation', () => {
  beforeAll(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => olatheGridResponse(),
    }) as unknown as typeof fetch;
    sessionStorage.clear();
    await ensureRoadNetwork();
  });

  it('closes on the tapped suspect without teleporting', () => {
    const started = createSimSession('test-user');
    const policeId = started.vehicles.find((v) => v.role === 'police')!.id;
    const perpId = started.vehicles.find((v) => v.role === 'perp')!.id;

    let session = startPursuit(started, policeId, perpId);
    const police = unit(session, policeId);
    expect(police.status).toBe('pursuing');
    expect(police.route.length).toBeGreaterThan(1);
    // The chase line must begin exactly where the car already sits.
    expect(metersBetween(police, police.route[0])).toBeLessThan(1);

    const dt = 1 / 30;
    const openingGap = metersBetween(unit(session, policeId), unit(session, perpId));
    let closestGap = openingGap;
    let worstJump = 0;
    let caught = false;

    for (let step = 0; step < 900; step++) {
      const before = unit(session, policeId);
      const speedCap = getOperationalSpeedMph(before, unit(session, perpId)) * 0.44704;
      session = tickSimSession(session, dt);
      const after = unit(session, policeId);

      worstJump = Math.max(worstJump, metersBetween(before, after) / (speedCap * dt));
      const perp = unit(session, perpId);
      closestGap = Math.min(closestGap, metersBetween(after, perp));
      if (perp.status === 'caught') {
        caught = true;
        break;
      }
      if (perp.status === 'escaped' || session.phase !== 'active') break;
    }

    // A single frame may never advance the car further than its own speed allows.
    expect(worstJump).toBeLessThan(1.3);
    expect(caught || closestGap < openingGap * 0.5).toBe(true);
  });

  it('keeps every unit inside the Olathe play area', () => {
    let session = createSimSession('test-user');
    for (let step = 0; step < 300; step++) {
      session = tickSimSession(session, 1 / 30);
      if (session.phase !== 'active') break;
    }
    for (const v of session.vehicles) {
      expect(v.lat).toBeGreaterThanOrEqual(OLATHE_BOUNDS.latMin - 0.002);
      expect(v.lat).toBeLessThanOrEqual(OLATHE_BOUNDS.latMax + 0.002);
      expect(v.lng).toBeGreaterThanOrEqual(OLATHE_BOUNDS.lngMin - 0.002);
      expect(v.lng).toBeLessThanOrEqual(OLATHE_BOUNDS.lngMax + 0.002);
    }
  });
});
