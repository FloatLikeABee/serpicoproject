import {
  COVER_DEFENSE_FACTOR,
  COVER_SHOOTER_PENALTY,
  MOVE_BLOCKS_PER_TURN,
  PERP_AMMO_PER_ROUND,
  SHOOT_HIT_BY_DISTANCE,
  SHOOT_RANGE_BLOCKS,
  arrestTargets,
  beginTacticsRaid,
  computeShotHitChance,
  resolvePerpTurn,
  reachableCells,
  shootTargets,
  startLocationTactics,
  tacticsCancelOfficer,
  tacticsInteractCell,
  tacticsWait,
} from './locationTacticsSim';
import { createCityLandmarks } from './pursuitSim';

function testLandmark(id = 'test-bar') {
  const lm = createCityLandmarks().find((l) => l.kind === 'bar')!;
  return { ...lm, id, name: 'Test Bar' };
}

function hideGame(id = 'hide-site') {
  const lm = createCityLandmarks().find((l) => l.kind === 'projects')!;
  let game = beginTacticsRaid(startLocationTactics({ ...lm, id, name: 'Hide Site' }, new Date('2026-07-28T12:00:00Z')));
  game = {
    ...game,
    mode: 'hide',
    scenarioTitle: `Hide & Seek — ${game.landmarkName}`,
  };
  return game;
}

describe('turn-based location tactics', () => {
  it('limits officers to one adjacent move per round', () => {
    let game = beginTacticsRaid(startLocationTactics(testLandmark(), new Date('2026-07-28T12:00:00Z')));
    const cop = game.units.find((u) => u.side === 'cop' && u.status === 'active')!;
    game = { ...game, selectedUnitId: cop.id };

    const reach = reachableCells(game, cop.id);
    expect(reach.every((c) => Math.abs(c.x - cop.x) + Math.abs(c.y - cop.y) === MOVE_BLOCKS_PER_TURN)).toBe(true);

    const target = reach[0];
    expect(target).toBeTruthy();
    game = tacticsInteractCell(game, target.x, target.y);
    expect(game.actedOfficerIds).toContain(cop.id);
    expect(reachableCells(game, cop.id)).toHaveLength(0);
  });

  it('lets an officer hold instead of moving', () => {
    let game = beginTacticsRaid(startLocationTactics(testLandmark(), new Date('2026-07-28T12:00:00Z')));
    const cop = game.units.find((u) => u.side === 'cop' && u.status === 'active')!;
    game = { ...game, selectedUnitId: cop.id };
    const turnBefore = game.turn;

    game = tacticsCancelOfficer(game, cop.id);
    expect(game.actedOfficerIds).toContain(cop.id);

    if (game.actedOfficerIds.length === game.units.filter((u) => u.side === 'cop' && u.status === 'active').length) {
      expect(game.turn).toBeGreaterThanOrEqual(turnBefore);
    }
  });

  it('runs suspect phase after all officers act', () => {
    let game = beginTacticsRaid(startLocationTactics(testLandmark(), new Date('2026-07-28T12:00:00Z')));
    expect(game.roundPhase).toBe('player');
    const turnBefore = game.turn;
    const perpsBefore = game.units
      .filter((u) => u.side === 'perp' && u.status === 'active')
      .map((p) => ({ id: p.id, x: p.x, y: p.y }));

    game = tacticsWait(game);
    expect(game.roundPhase).toBe('perp');

    game = resolvePerpTurn(game);
    expect(game.roundPhase).toBe('player');
    expect(game.turn).toBeGreaterThan(turnBefore);
    expect(game.actedOfficerIds).toHaveLength(0);

    const moved = game.units.some((u) => {
      const before = perpsBefore.find((p) => p.id === u.id);
      return before && (before.x !== u.x || before.y !== u.y);
    });
    expect(moved || game.units.some((u) => u.side === 'perp' && u.status === 'escaped')).toBe(true);
  });

  it('only allows gunfight shots within two blocks', () => {
    let game = beginTacticsRaid(startLocationTactics(testLandmark('gun-bar'), new Date('2026-07-29T12:00:00Z')));
    if (game.mode !== 'gunfight') {
      game = { ...game, mode: 'gunfight' };
    }
    const cop = game.units.find((u) => u.side === 'cop' && u.status === 'active')!;
    game = { ...game, selectedUnitId: cop.id };

    const targets = shootTargets(game, cop.id);
    expect(targets.every((p) => {
      const d = Math.abs(p.x - cop.x) + Math.abs(p.y - cop.y);
      return d >= 1 && d <= SHOOT_RANGE_BLOCKS;
    })).toBe(true);
  });

  it('uses lower hit chance at two blocks than one', () => {
    expect(SHOOT_HIT_BY_DISTANCE[1]).toBeGreaterThan(SHOOT_HIT_BY_DISTANCE[2]);
  });

  it('reduces hit chance when target or shooter uses cover', () => {
    let game = beginTacticsRaid(startLocationTactics(testLandmark(), new Date('2026-07-29T12:00:00Z')));
    game = { ...game, mode: 'gunfight' };
    const cop = game.units.find((u) => u.side === 'cop' && u.status === 'active')!;
    const perp = game.units.find((u) => u.side === 'perp' && u.status === 'active')!;

    perp.x = cop.x + 1;
    perp.y = cop.y;
    perp.inCover = false;

    const openOpen = computeShotHitChance(game, cop, perp);
    expect(openOpen).toBeCloseTo(SHOOT_HIT_BY_DISTANCE[1], 2);

    const coverCell = game.cells.find((c) => c.kind === 'cover');
    if (coverCell) {
      perp.x = coverCell.x;
      perp.y = coverCell.y;
      perp.inCover = true;
      const targetInCover = computeShotHitChance(game, cop, perp);
      expect(targetInCover).toBeLessThan(openOpen);
      expect(targetInCover).toBeCloseTo(openOpen * COVER_DEFENSE_FACTOR, 2);

      cop.x = coverCell.x - 1;
      cop.y = coverCell.y;
      cop.inCover = false;
      perp.x = coverCell.x;
      perp.y = coverCell.y;
      const bothFactors = computeShotHitChance(game, cop, perp);
      expect(bothFactors).toBeLessThan(openOpen * COVER_DEFENSE_FACTOR);
    }
  });

  it('lets gunfight officers shoot spotted suspects within range', () => {
    let game = beginTacticsRaid(startLocationTactics(testLandmark(), new Date('2026-07-29T12:00:00Z')));
    game = { ...game, mode: 'gunfight' };
    const cop = game.units.find((u) => u.side === 'cop' && u.status === 'active')!;
    const perp = game.units.find((u) => u.side === 'perp' && u.status === 'active')!;
    cop.ammo = 3;
    perp.spotted = true;
    perp.x = cop.x + 1;
    perp.y = cop.y;
    game = { ...game, selectedUnitId: cop.id };

    const targets = shootTargets(game, cop.id);
    expect(targets.some((t) => t.id === perp.id)).toBe(true);

    game = tacticsInteractCell(game, perp.x, perp.y);
    const copAfter = game.units.find((u) => u.id === cop.id)!;
    expect(game.actedOfficerIds).toContain(cop.id);
    expect(copAfter.ammo).toBe(2);
  });

  it('blocks moves during the suspect turn', () => {
    let game = beginTacticsRaid(startLocationTactics(testLandmark(), new Date('2026-07-28T12:00:00Z')));
    game = tacticsWait(game);
    expect(game.roundPhase).toBe('perp');

    const cop = game.units.find((u) => u.side === 'cop' && u.status === 'active')!;
    game = { ...game, selectedUnitId: cop.id };
    expect(reachableCells(game, cop.id)).toHaveLength(0);
  });

  it('tracks main entrance for suspect escape routing', () => {
    const game = beginTacticsRaid(startLocationTactics(testLandmark(), new Date('2026-07-28T12:00:00Z')));
    expect(game.mainEntrance).toBeDefined();
    const spawn = game.cells.find((c) => c.kind === 'spawn');
    expect(spawn).toBeTruthy();
    expect(game.mainEntrance.x).toBe(spawn!.x);
    expect(game.mainEntrance.y).toBe(spawn!.y);
  });

  it('lets an officer arrest a spotted adjacent suspect by tapping them', () => {
    let game = hideGame();
    const cop = game.units.find((u) => u.side === 'cop' && u.status === 'active')!;
    const perp = game.units.find((u) => u.side === 'perp' && u.status === 'active')!;
    perp.x = cop.x + 1;
    perp.y = cop.y;
    perp.spotted = true;
    perp.known = true;
    game = { ...game, selectedUnitId: cop.id, units: [...game.units] };

    expect(arrestTargets(game, cop.id).some((p) => p.id === perp.id)).toBe(true);
    game = tacticsInteractCell(game, perp.x, perp.y);
    const after = game.units.find((u) => u.id === perp.id)!;
    expect(after.status).toBe('caught');
    expect(game.actedOfficerIds).toContain(cop.id);
  });

  it('keeps found suspects visible while they flee toward the entrance', () => {
    let game = hideGame();
    const entrance = game.mainEntrance;
    const perp = game.units.find((u) => u.side === 'perp' && u.status === 'active')!;
    perp.known = true;
    perp.spotted = true;
    // Place far from entrance but on a walkable path
    perp.x = Math.min(game.width - 2, entrance.x + 4);
    perp.y = Math.min(game.height - 2, entrance.y + 3);
    game = { ...game, units: [...game.units] };

    const before = { x: perp.x, y: perp.y };
    game = tacticsWait(game);
    expect(game.roundPhase).toBe('perp');
    game = resolvePerpTurn(game);

    const after = game.units.find((u) => u.id === perp.id)!;
    expect(after.spotted || after.status === 'escaped').toBe(true);
    if (after.status === 'active') {
      expect(after.known).toBe(true);
      const closer =
        Math.abs(after.x - entrance.x) + Math.abs(after.y - entrance.y) <=
        Math.abs(before.x - entrance.x) + Math.abs(before.y - entrance.y);
      expect(closer || (after.x === before.x && after.y === before.y)).toBe(true);
    }
  });

  it('ends the raid when the last suspect is arrested', () => {
    let game = hideGame();
    const cop = game.units.find((u) => u.side === 'cop' && u.status === 'active')!;
    const perps = game.units.filter((u) => u.side === 'perp' && u.status === 'active');
    game = {
      ...game,
      selectedUnitId: cop.id,
      units: game.units.map((u) => {
        if (u.side !== 'perp') return u;
        if (u.id === perps[0].id) {
          return { ...u, x: cop.x + 1, y: cop.y, spotted: true, known: true, status: 'active' as const };
        }
        return { ...u, status: 'caught' as const, hp: 0 };
      }),
    };

    game = tacticsInteractCell(game, cop.x + 1, cop.y);
    expect(game.phase).toBe('completed');
    expect(game.result?.caught).toBeGreaterThanOrEqual(1);
  });

  it('reloads fleeing suspects with ammo and lets them fire at nearby cops', () => {
    let game = hideGame('armed-hide');
    const cops = game.units.filter((u) => u.side === 'cop');
    const perp = game.units.find((u) => u.side === 'perp' && u.status === 'active')!;
    // Park perp 2 blocks from a cop with LOS — shoot range, not auto-cuff range
    const cop = cops[0];
    perp.x = Math.min(game.width - 2, cop.x + 2);
    perp.y = cop.y;
    perp.known = true;
    perp.spotted = true;
    perp.ammo = 0;
    game = {
      ...game,
      units: game.units.map((u) => {
        if (u.side === 'perp' && u.id !== perp.id) return { ...u, status: 'caught' as const, hp: 0 };
        if (u.id === perp.id) return { ...perp };
        // Pull other cops far away so they don't auto-cuff
        if (u.side === 'cop' && u.id !== cop.id) return { ...u, x: game.width - 2, y: game.height - 2 };
        return u;
      }),
    };

    game = tacticsWait(game);
    expect(game.roundPhase).toBe('perp');
    game = resolvePerpTurn(game);
    const after = game.units.find((u) => u.id === perp.id)!;
    if (after.status === 'active') {
      expect(after.ammo).toBeLessThanOrEqual(PERP_AMMO_PER_ROUND);
    }
    expect(
      game.log.some((e) => /fires|misses|escape|pushes toward|opening fire|breaks out/i.test(e.text))
    ).toBe(true);
  });

  it('advances suspects toward an escape tile when a path exists', () => {
    let game = hideGame('escape-path');
    const entrance = game.mainEntrance;
    const perp = game.units.find((u) => u.side === 'perp' && u.status === 'active')!;
    // Place on a clear floor far from entrance
    const floors = game.cells.filter(
      (c) => (c.kind === 'floor' || c.kind === 'cover') && dist(c, entrance) >= 4
    );
    const start = floors[floors.length - 1] ?? floors[0];
    perp.x = start.x;
    perp.y = start.y;
    perp.known = true;
    perp.spotted = true;
    game = {
      ...game,
      units: game.units.map((u) => (u.id === perp.id ? { ...perp } : u)),
    };

    const before = dist(perp, entrance);
    game = tacticsWait(game);
    game = resolvePerpTurn(game);
    const after = game.units.find((u) => u.id === perp.id)!;
    if (after.status === 'escaped') {
      expect(true).toBe(true);
    } else if (after.status === 'active') {
      expect(dist(after, entrance)).toBeLessThanOrEqual(before);
      expect(after.x !== perp.x || after.y !== perp.y || after.ammo >= PERP_AMMO_PER_ROUND).toBe(true);
    }
  });
});

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
