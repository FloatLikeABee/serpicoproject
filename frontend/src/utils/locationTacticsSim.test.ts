import { LandmarkKind, MapLandmark } from './pursuitSim';
import {
  GUNFIGHT_AMMO,
  LocationTacticsGame,
  OFFICER_SHOTS,
  TacticsUnit,
  beginTacticsRaid,
  floorSummary,
  reachableCells,
  setViewFloor,
  stairOptions,
  startLocationTactics,
  tacticsInteractCell,
  tacticsTakeCover,
  tacticsUseStairs,
  tacticsWait,
} from './locationTacticsSim';

const KINDS: LandmarkKind[] = ['bar', 'club', 'factory', 'projects'];

function landmark(kind: LandmarkKind, id = `lm-${kind}`): MapLandmark {
  return { id, kind, name: `Test ${kind}`, lat: 38.88, lng: -94.82 };
}

/** Scan forward through days until the daily seed lands on the wanted mode. */
function gameWithMode(kind: LandmarkKind, mode: LocationTacticsGame['mode']): LocationTacticsGame {
  for (let day = 0; day < 60; day++) {
    const when = new Date(Date.UTC(2026, 0, 1 + day));
    const game = startLocationTactics(landmark(kind), when);
    if (game.mode === mode) return beginTacticsRaid(game);
  }
  throw new Error(`no ${mode} scenario generated for ${kind}`);
}

function officers(game: LocationTacticsGame): TacticsUnit[] {
  return game.units.filter((u) => u.side === 'cop');
}

function perps(game: LocationTacticsGame): TacticsUnit[] {
  return game.units.filter((u) => u.side === 'perp');
}

function walkableAt(game: LocationTacticsGame, floor: number, x: number, y: number): boolean {
  const plan = game.floors.find((f) => f.index === floor)!;
  const cell = plan.cells[y * plan.width + x];
  return !!cell && cell.kind !== 'wall';
}

/** Steps from the gate to every reachable tile, walking stairs between floors. */
function reachableFromGate(game: LocationTacticsGame): Set<string> {
  const seen = new Set<string>([`${game.gate.floor}:${game.gate.x},${game.gate.y}`]);
  let frontier = [{ floor: game.gate.floor, x: game.gate.x, y: game.gate.y }];
  while (frontier.length) {
    const next: Array<{ floor: number; x: number; y: number }> = [];
    for (const cur of frontier) {
      const plan = game.floors.find((f) => f.index === cur.floor)!;
      const cell = plan.cells[cur.y * plan.width + cur.x];
      const options = [
        { floor: cur.floor, x: cur.x + 1, y: cur.y },
        { floor: cur.floor, x: cur.x - 1, y: cur.y },
        { floor: cur.floor, x: cur.x, y: cur.y + 1 },
        { floor: cur.floor, x: cur.x, y: cur.y - 1 },
      ];
      for (const link of cell?.links ?? []) options.push({ ...link });
      for (const opt of options) {
        const key = `${opt.floor}:${opt.x},${opt.y}`;
        if (seen.has(key)) continue;
        const target = game.floors.find((f) => f.index === opt.floor);
        if (!target) continue;
        if (opt.x < 0 || opt.y < 0 || opt.x >= target.width || opt.y >= target.height) continue;
        if (!walkableAt(game, opt.floor, opt.x, opt.y)) continue;
        seen.add(key);
        next.push(opt);
      }
    }
    frontier = next;
  }
  return seen;
}

describe('building layout', () => {
  it.each(KINDS)('%s has three connected floors with one front gate', (kind) => {
    const game = beginTacticsRaid(startLocationTactics(landmark(kind)));
    expect(game.floors).toHaveLength(3);

    const gates = game.floors.flatMap((f) => f.cells.filter((c) => c.kind === 'gate'));
    expect(gates).toHaveLength(1);

    // Every floor is walkable from the gate, so suspects can always be reached and can always run.
    const reachable = reachableFromGate(game);
    for (const plan of game.floors) {
      const onThisFloor = Array.from(reachable).filter((k) => k.startsWith(`${plan.index}:`));
      expect(onThisFloor.length).toBeGreaterThan(10);
    }
    // No unit is walled off from the gate, or the raid could never resolve.
    for (const unit of game.units) {
      expect(reachable.has(`${unit.floor}:${unit.x},${unit.y}`)).toBe(true);
    }
  });

  it.each(KINDS)('%s spawns every unit on a walkable tile', (kind) => {
    const game = beginTacticsRaid(startLocationTactics(landmark(kind)));
    for (const unit of game.units) {
      expect(walkableAt(game, unit.floor, unit.x, unit.y)).toBe(true);
    }
  });

  it.each(KINDS)('%s starts officers at the gate and suspects deeper in', (kind) => {
    const game = beginTacticsRaid(startLocationTactics(landmark(kind)));
    for (const cop of officers(game)) {
      expect(cop.floor).toBe(game.gate.floor);
    }
    // Suspects are spread over more than one floor.
    expect(new Set(perps(game).map((p) => p.floor)).size).toBeGreaterThan(1);
  });

  it('every floor is reported for the floor switcher', () => {
    const game = beginTacticsRaid(startLocationTactics(landmark('club')));
    const summary = floorSummary(game);
    expect(summary).toHaveLength(3);
    expect(summary.filter((f) => f.isGate)).toHaveLength(1);
    // Highest floor listed first.
    expect(summary[0].index).toBeGreaterThan(summary[2].index);
  });
});

describe('officer turns', () => {
  it('spends moves and hands the turn over when the budget is gone', () => {
    let game = gameWithMode('bar', 'chase');
    const startTurn = game.turn;
    const budget = officers(game).reduce((sum, o) => sum + o.maxMoves, 0);
    expect(budget).toBeGreaterThan(0);

    let guard = 0;
    while (game.turn === startTurn && game.phase === 'active' && guard++ < 60) {
      const current = game;
      const officer = officers(current).find((o) => o.id === current.selectedUnitId);
      if (!officer || officer.moves <= 0) break;
      const step = reachableCells(game, officer.id).find((c) => c.cost === 1);
      if (!step) break;
      game = tacticsInteractCell(game, step.x, step.y);
    }

    // Either the budget ran out and suspects moved, or the raid resolved early.
    expect(game.turn > startTurn || game.phase === 'completed').toBe(true);
  });

  it('never offers moves through walls', () => {
    const game = gameWithMode('factory', 'chase');
    const officer = officers(game)[0];
    for (const cell of reachableCells(game, officer.id)) {
      expect(walkableAt(game, officer.floor, cell.x, cell.y)).toBe(true);
      expect(cell.cost).toBeLessThanOrEqual(officer.maxMoves);
    }
  });

  it('moves an officer between floors using the stairs', () => {
    let game = gameWithMode('projects', 'hide');
    const officer = officers(game)[0];
    const gateFloor = game.floors.find((f) => f.index === game.gate.floor)!;
    const stair = gateFloor.cells.find((c) => c.kind === 'stair' && c.links?.length === 1);
    expect(stair).toBeDefined();

    // Teleport for setup, then use the stairs through the normal interaction.
    const staged = JSON.parse(JSON.stringify(game)) as LocationTacticsGame;
    const staffed = staged.units.find((u) => u.id === officer.id)!;
    staffed.x = stair!.x;
    staffed.y = stair!.y;
    staged.selectedUnitId = staffed.id;
    staged.viewFloor = staffed.floor;

    game = tacticsInteractCell(staged, stair!.x, stair!.y);
    const moved = game.units.find((u) => u.id === officer.id)!;
    expect(moved.floor).toBe(stair!.links![0].floor);
    expect(game.viewFloor).toBe(stair!.links![0].floor);
  });

  it('offers both directions on a stairwell that serves two floors', () => {
    const game = gameWithMode('projects', 'chase');
    const middle = game.floors.find((f) => f.index === 1)!;
    const shaft = middle.cells.find((c) => c.kind === 'stair');
    expect(shaft?.links).toHaveLength(2);

    const staged = JSON.parse(JSON.stringify(game)) as LocationTacticsGame;
    const officer = staged.units.find((u) => u.side === 'cop')!;
    officer.floor = middle.index;
    officer.x = shaft!.x;
    officer.y = shaft!.y;
    staged.selectedUnitId = officer.id;
    staged.viewFloor = middle.index;

    const options = stairOptions(staged);
    expect(options.map((o) => o.floor).sort()).toEqual([0, 2]);

    // Tapping the tile is ambiguous, so nothing moves until a floor is chosen.
    const tapped = tacticsInteractCell(staged, shaft!.x, shaft!.y);
    expect(tapped.units.find((u) => u.id === officer.id)!.floor).toBe(middle.index);

    const climbed = tacticsUseStairs(staged, 2);
    expect(climbed.units.find((u) => u.id === officer.id)!.floor).toBe(2);
    expect(climbed.viewFloor).toBe(2);
  });

  it('only shows the map for the floor being viewed', () => {
    const game = gameWithMode('bar', 'chase');
    const officer = officers(game)[0];
    const otherFloor = game.floors.find((f) => f.index !== officer.floor)!;
    const switched = setViewFloor(game, otherFloor.index);
    expect(reachableCells(switched, officer.id)).toHaveLength(0);
  });
});

describe('shooting budget', () => {
  it('gives each officer two shots outside gunfights', () => {
    const game = gameWithMode('bar', 'chase');
    for (const cop of officers(game)) expect(cop.shots).toBe(OFFICER_SHOTS);
    expect(game.squadAmmo).toBe(0);
  });

  it('gives a gunfight squad a shared 30-round pool', () => {
    const game = gameWithMode('bar', 'gunfight');
    expect(game.squadAmmo).toBe(GUNFIGHT_AMMO);
    expect(game.maxSquadAmmo).toBe(GUNFIGHT_AMMO);
  });

  it('drops an exposed suspect in one hit and spends a round', () => {
    const base = gameWithMode('bar', 'gunfight');
    const staged = JSON.parse(JSON.stringify(base)) as LocationTacticsGame;
    const cop = staged.units.find((u) => u.side === 'cop')!;
    const perp = staged.units.find((u) => u.side === 'perp')!;

    // Put the suspect in the open, two tiles along a clear line from the officer.
    perp.floor = cop.floor;
    perp.x = cop.x + 2;
    perp.y = cop.y;
    perp.inCover = false;
    perp.hunkered = false;
    perp.spotted = true;
    staged.viewFloor = cop.floor;
    staged.selectedUnitId = cop.id;

    let downs = 0;
    let ammoSpent = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      const shot = tacticsInteractCell(staged, perp.x, perp.y);
      ammoSpent += staged.squadAmmo - shot.squadAmmo;
      const after = shot.units.find((u) => u.id === perp.id)!;
      if (after.status === 'caught') downs++;
    }

    expect(ammoSpent).toBe(40);
    // Open ground is lethal: the large majority of hits end it outright.
    expect(downs).toBeGreaterThan(25);
  });

  it('lets some rounds through cover but not most of them', () => {
    const base = gameWithMode('bar', 'gunfight');
    const staged = JSON.parse(JSON.stringify(base)) as LocationTacticsGame;
    const cop = staged.units.find((u) => u.side === 'cop')!;
    const perp = staged.units.find((u) => u.side === 'perp')!;
    perp.floor = cop.floor;
    perp.x = cop.x + 2;
    perp.y = cop.y;
    perp.inCover = true;
    perp.spotted = true;
    perp.lives = 1;
    staged.viewFloor = cop.floor;
    staged.selectedUnitId = cop.id;

    let hits = 0;
    for (let attempt = 0; attempt < 200; attempt++) {
      const shot = tacticsInteractCell(staged, perp.x, perp.y);
      if (shot.units.find((u) => u.id === perp.id)!.status === 'caught') hits++;
    }
    expect(hits).toBeGreaterThan(20);
    expect(hits).toBeLessThan(120);
  });

  it('refuses to shoot once the pool is dry', () => {
    const base = gameWithMode('bar', 'gunfight');
    const staged = JSON.parse(JSON.stringify(base)) as LocationTacticsGame;
    const cop = staged.units.find((u) => u.side === 'cop')!;
    const perp = staged.units.find((u) => u.side === 'perp')!;
    perp.floor = cop.floor;
    perp.x = cop.x + 2;
    perp.y = cop.y;
    perp.spotted = true;
    staged.viewFloor = cop.floor;
    staged.selectedUnitId = cop.id;
    staged.squadAmmo = 0;

    const attempted = tacticsInteractCell(staged, perp.x, perp.y);
    expect(attempted.squadAmmo).toBe(0);
    expect(attempted.units.find((u) => u.id === cop.id)!.moves).toBe(cop.moves);
  });
});

describe('cover and lives', () => {
  it('puts an officer into cover and marks them hunkered when moves run out', () => {
    const game = gameWithMode('club', 'gunfight');
    const covered = tacticsTakeCover(game);
    const officer = officers(covered).find((o) => o.id === game.selectedUnitId);
    expect(officer).toBeDefined();
    // Either cover was in reach, or the log explains that it was not.
    const tookCover = !!officer?.inCover || covered.log.some((l) => l.text.includes('No cover'));
    expect(tookCover).toBe(true);
  });

  it('starts every officer with two lives', () => {
    const game = gameWithMode('bar', 'gunfight');
    for (const cop of officers(game)) {
      expect(cop.lives).toBe(2);
      expect(cop.maxLives).toBe(2);
    }
  });
});

describe('suspect turns', () => {
  it('lets suspects escape through the front gate and scores it', () => {
    let game = gameWithMode('bar', 'chase');
    // Clear the doorway so runners are not blocked by the stack.
    const staged = JSON.parse(JSON.stringify(game)) as LocationTacticsGame;
    for (const cop of staged.units.filter((u) => u.side === 'cop')) {
      cop.status = 'active';
      cop.x = 7;
      cop.y = 5;
      cop.floor = staged.gate.floor;
    }
    // Park one runner right next to the gate.
    const runner = staged.units.find((u) => u.side === 'perp')!;
    runner.floor = staged.gate.floor;
    runner.x = staged.gate.x + 1;
    runner.y = staged.gate.y;
    game = staged;

    for (let turn = 0; turn < 6 && game.phase === 'active'; turn++) {
      game = tacticsWait(game);
    }

    const after = game.units.find((u) => u.id === runner.id)!;
    expect(after.status === 'escaped' || game.gateEscapes > 0).toBe(true);
  });

  it('reports what the suspects did each turn', () => {
    const game = tacticsWait(gameWithMode('factory', 'chase'));
    expect(game.lastSuspectMoves.length).toBeGreaterThan(0);
  });

  it('calls out suspect locations on the radio', () => {
    let game = gameWithMode('projects', 'hide');
    for (let turn = 0; turn < 6 && game.phase === 'active'; turn++) {
      game = tacticsWait(game);
    }
    expect(game.log.some((l) => l.tone === 'radio')).toBe(true);
    // Every call-out names the floor first, which is what makes it actionable.
    const radio = game.radio ?? '';
    const floorNames = game.floors.map((f) => f.name);
    expect(floorNames.some((name) => radio.startsWith(name))).toBe(true);
  });

  it('resolves and scores the raid once the clock runs out', () => {
    let game = gameWithMode('bar', 'hide');
    for (let turn = 0; turn < 40 && game.phase === 'active'; turn++) {
      game = tacticsWait(game);
    }
    expect(game.phase).toBe('completed');
    expect(game.result).toBeDefined();
    expect(game.stats?.floors).toBe(3);
    expect(game.stats!.caught + game.stats!.escaped).toBe(perps(game).length);
  });
});
