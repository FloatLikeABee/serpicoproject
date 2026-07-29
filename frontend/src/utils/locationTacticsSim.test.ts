import {
  COVER_DEFENSE_FACTOR,
  COVER_SHOOTER_PENALTY,
  MOVE_BLOCKS_PER_TURN,
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
    // Leave one perp adjacent; mark others already caught
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
});
