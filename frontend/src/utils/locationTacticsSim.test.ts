import {
  MOVE_BLOCKS_PER_TURN,
  SHOOT_HIT_BY_DISTANCE,
  SHOOT_RANGE_BLOCKS,
  beginTacticsRaid,
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
    const turnBefore = game.turn;
    const perpsBefore = game.units
      .filter((u) => u.side === 'perp' && u.status === 'active')
      .map((p) => ({ id: p.id, x: p.x, y: p.y }));

    game = tacticsWait(game);
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

  it('tracks main entrance for suspect escape routing', () => {
    const game = beginTacticsRaid(startLocationTactics(testLandmark(), new Date('2026-07-28T12:00:00Z')));
    expect(game.mainEntrance).toBeDefined();
    const spawn = game.cells.find((c) => c.kind === 'spawn');
    expect(spawn).toBeTruthy();
    expect(game.mainEntrance.x).toBe(spawn!.x);
    expect(game.mainEntrance.y).toBe(spawn!.y);
  });
});
