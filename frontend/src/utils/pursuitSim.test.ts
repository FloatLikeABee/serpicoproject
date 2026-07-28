import {
  BASE_SCORE,
  CATCH_SCORE,
  HELPER_COUNT,
  INITIAL_SQUAD_COUNT,
  OLATHE_BOUNDS,
  PERP_COUNT,
  WEAPON_COSTS,
  createSimSession,
  deployWeapon,
  ensureRoadNetwork,
  helpersActive,
  redirectPoliceTo,
  tickSimSession,
} from './pursuitSim';

const STEP_DEG = 0.0025;

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

function run(session: ReturnType<typeof createSimSession>, seconds: number, dt = 1 / 20) {
  let cur = session;
  for (let t = 0; t < seconds; t += dt) cur = tickSimSession(cur, dt);
  return cur;
}

describe('endless auto-chase pursuit', () => {
  beforeAll(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => olatheGridResponse(),
    }) as unknown as typeof fetch;
    sessionStorage.clear();
    await ensureRoadNetwork();
  });

  it('opens with 3 squad cars auto-chasing and 20 fleeing suspects', () => {
    const session = createSimSession('test');
    const police = session.vehicles.filter((v) => v.role === 'police');
    const perps = session.vehicles.filter((v) => v.role === 'perp' && v.status === 'fleeing');

    expect(police).toHaveLength(INITIAL_SQUAD_COUNT);
    expect(police.every((p) => p.policeKind === 'squad')).toBe(true);
    expect(police.every((p) => p.status === 'chasing' && !!p.pursuingPerpId)).toBe(true);
    expect(perps).toHaveLength(PERP_COUNT);
    expect(session.score).toBe(BASE_SCORE);
    // Every squad target is distinct at open.
    expect(new Set(police.map((p) => p.pursuingPerpId)).size).toBe(INITIAL_SQUAD_COUNT);
    // Suspects use non-blue colors.
    expect(perps.every((p) => p.color && !/2563eb|1d4ed8|3b82f6/i.test(p.color))).toBe(true);
  });

  it('lets the player redirect a cruiser onto a chosen suspect', () => {
    let session = createSimSession('test');
    const police = session.vehicles.find((v) => v.role === 'police')!;
    const other = session.vehicles.find(
      (v) => v.role === 'perp' && v.status === 'fleeing' && v.id !== police.pursuingPerpId
    )!;

    session = redirectPoliceTo(session, police.id, other.id);
    const redirected = session.vehicles.find((v) => v.id === police.id)!;
    expect(redirected.pursuingPerpId).toBe(other.id);
    expect(redirected.playerAssigned).toBe(true);
    expect(redirected.status).toBe('chasing');
  });

  it('spends score to instantly neutralize a suspect with a weapon', () => {
    let session = createSimSession('test');
    const target = session.vehicles.find((v) => v.role === 'perp' && v.status === 'fleeing')!;
    const before = session.score;

    const result = deployWeapon(session, 'drone', target.id);
    expect(result.ok).toBe(true);
    session = result.session;

    expect(session.score).toBe(before - WEAPON_COSTS.drone + CATCH_SCORE);
    expect(session.caughtTotal).toBe(1);
    expect(session.vehicles.find((v) => v.id === target.id)?.status).toBe('caught');
    expect(session.notices.some((n) => n.kind === 'weapon')).toBe(true);
  });

  it('refuses a weapon the player cannot afford', () => {
    let session = createSimSession('test');
    session = { ...session, score: 10 };
    const target = session.vehicles.find((v) => v.role === 'perp' && v.status === 'fleeing')!;
    const result = deployWeapon(session, 'laser', target.id);
    expect(result.ok).toBe(false);
    expect(result.session.vehicles.find((v) => v.id === target.id)?.status).toBe('fleeing');
    expect(result.session.notices.some((n) => n.kind === 'warn')).toBe(true);
  });

  it('keeps about 20 fleeing suspects by respawning resolved ones', () => {
    let session = createSimSession('test');
    // Force-resolve half the wave.
    session = {
      ...session,
      vehicles: session.vehicles.map((v, i) =>
        v.role === 'perp' && i % 2 === 0
          ? { ...v, status: 'caught' as const, resolvedAtSimMs: 0, beingPursued: false }
          : v
      ),
    };

    session = run(session, 6);
    const fleeing = session.vehicles.filter((v) => v.role === 'perp' && v.status === 'fleeing');
    expect(fleeing.length).toBe(PERP_COUNT);
  });

  it('brings timed helpers online, then recalls them', () => {
    let session = createSimSession('test');
    expect(helpersActive(session)).toBe(false);

    session = run(session, 30);
    expect(helpersActive(session)).toBe(true);
    expect(
      session.vehicles.filter((v) => v.role === 'police' && v.policeKind === 'helper')
    ).toHaveLength(HELPER_COUNT);
    expect(
      session.vehicles
        .filter((v) => v.policeKind === 'helper')
        .every((v) => v.status === 'chasing' && !!v.pursuingPerpId)
    ).toBe(true);

    session = run(session, 50);
    expect(helpersActive(session)).toBe(false);
    expect(session.vehicles.filter((v) => v.policeKind === 'helper')).toHaveLength(0);
  });

  it('scores catches when a chasing cruiser closes the gap', () => {
    let session = createSimSession('test');
    const startScore = session.score;

    for (let i = 0; i < 9000 && session.caughtTotal === 0; i += 1) {
      session = tickSimSession(session, 1 / 30);
    }

    expect(session.caughtTotal).toBeGreaterThanOrEqual(1);
    expect(session.score).toBeGreaterThanOrEqual(startScore + CATCH_SCORE);
  });
});
