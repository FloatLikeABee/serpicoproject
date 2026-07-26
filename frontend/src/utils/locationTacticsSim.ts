/** Visual on-site tactics: building-block chase, cover gunfight, hide-and-seek. */

import { LandmarkKind, MapLandmark } from './pursuitSim';

export type ScenarioMode = 'chase' | 'gunfight' | 'hide';
export type TacticsPhase = 'briefing' | 'active' | 'completed';
export type CellKind = 'floor' | 'wall' | 'cover' | 'exit' | 'spawn';

export interface GridCell {
  x: number;
  y: number;
  kind: CellKind;
}

export interface TacticsUnit {
  id: string;
  side: 'cop' | 'perp';
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  status: 'active' | 'hurt' | 'caught' | 'escaped' | 'down';
  /** Player-visible this frame (fog / intermittent spotting). */
  spotted: boolean;
  ap: number;
  ammo: number;
  inCover: boolean;
}

export interface TacticsBullet {
  id: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  fromId: string;
  side: 'cop' | 'perp';
  damage: number;
  progress: number;
}

export interface TacticsLogEntry {
  turn: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'warn';
}

export interface TacticsResult {
  outcome: 'total_win' | 'partial_win' | 'escaped';
  caught: number;
  escaped: number;
  totalPerps: number;
  officersHurt: number;
  turnsUsed: number;
  score: number;
  message: string;
}

export interface LocationTacticsStats {
  landmarkId: string;
  landmarkName: string;
  landmarkKind: LandmarkKind;
  dayKey: string;
  scenarioTitle: string;
  scenarioMode: ScenarioMode;
  turnsUsed: number;
  totalPolice: number;
  policeHurt: number;
  policeUsed: number;
  totalPerps: number;
  armedPerps: number;
  caught: number;
  escaped: number;
  unknownRoomsScouted: number;
  outcome: string;
  operationalScore: number;
  decisions: string[];
}

export interface LocationTacticsGame {
  id: string;
  landmarkId: string;
  landmarkName: string;
  landmarkKind: LandmarkKind;
  dayKey: string;
  scenarioTitle: string;
  briefing: string;
  mode: ScenarioMode;
  phase: TacticsPhase;
  turn: number;
  maxTurns: number;
  width: number;
  height: number;
  cells: GridCell[];
  units: TacticsUnit[];
  bullets: TacticsBullet[];
  revealed: boolean[][]; // fog for hide / chase
  selectedUnitId?: string;
  moveRange: number;
  log: TacticsLogEntry[];
  decisions: string[];
  result?: TacticsResult;
  stats?: LocationTacticsStats;
  /** Chase: turns until next forced perp glimpse. */
  nextGlimpseTurn: number;
}

export interface LocationAIEvaluation {
  grade: string;
  score: number;
  summary: string;
  strategyAnalysis: string;
  resourceAnalysis: string;
  strengths: string[];
  improvements: string[];
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function uid(prefix: string, rng: () => number) {
  return `${prefix}-${Math.floor(rng() * 1e9).toString(36)}`;
}

function cloneGame(game: LocationTacticsGame): LocationTacticsGame {
  return JSON.parse(JSON.stringify(game)) as LocationTacticsGame;
}

const COP_NAMES = ['Reyes', 'Okada', 'Brooks', 'Hassan', 'Nguyen', 'Carter', 'Diaz', 'Walsh'];
const PERP_NAMES = ['Vex', 'Rook', 'Shade', 'Bolt', 'Kite', 'Moth', 'Jinx', 'Dust', 'Hex', 'Pike'];

const MODE_META: Record<
  ScenarioMode,
  { title: string; briefing: (place: string) => string }
> = {
  chase: {
    title: 'Foot Chase',
    briefing: (place) =>
      `${place}: suspects are running the floor plan toward exits. You won't see them constantly — only glimpses and line-of-sight. Cut them off before they vanish.`,
  },
  gunfight: {
    title: 'Cover Gunfight',
    briefing: (place) =>
      `${place}: armed crew dug into cover. Use walls, peek, and trade shots — bullets fly on the map. Rushing open ground will get officers hurt.`,
  },
  hide: {
    title: 'Hide & Seek',
    briefing: (place) =>
      `${place}: limited manpower (1–2 officers). Suspects are somewhere in the dark. Search carefully — if the clock runs out, they walk free.`,
  },
};

function emptyGrid(w: number, h: number, fill: CellKind = 'floor'): GridCell[] {
  const cells: GridCell[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      cells.push({ x, y, kind: fill });
    }
  }
  return cells;
}

function cellAt(cells: GridCell[], w: number, x: number, y: number): GridCell | null {
  if (x < 0 || y < 0 || x >= w) return null;
  return cells.find((c) => c.x === x && c.y === y) ?? null;
}

function setKind(cells: GridCell[], w: number, x: number, y: number, kind: CellKind) {
  const c = cellAt(cells, w, x, y);
  if (c) c.kind = kind;
}

function walkable(kind: CellKind) {
  return kind === 'floor' || kind === 'cover' || kind === 'exit' || kind === 'spawn';
}

function neighbors(x: number, y: number) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function hasLos(
  cells: GridCell[],
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i < steps; i++) {
    if (Math.abs(x1 - x) >= Math.abs(y1 - y)) x += dx;
    else y += dy;
    if (x === x1 && y === y1) return true;
    const c = cellAt(cells, w, x, y);
    if (!c || c.kind === 'wall') return false;
  }
  return true;
}

function buildChaseMap(rng: () => number, kind: LandmarkKind) {
  const w = 12;
  const h = 9;
  const cells = emptyGrid(w, h, 'floor');
  // Outer walls
  for (let x = 0; x < w; x++) {
    setKind(cells, w, x, 0, 'wall');
    setKind(cells, w, x, h - 1, 'wall');
  }
  for (let y = 0; y < h; y++) {
    setKind(cells, w, 0, y, 'wall');
    setKind(cells, w, w - 1, y, 'wall');
  }
  // Interior blocks (building partitions)
  const blockCount = 8 + Math.floor(rng() * 5);
  for (let i = 0; i < blockCount; i++) {
    const x = 2 + Math.floor(rng() * (w - 4));
    const y = 2 + Math.floor(rng() * (h - 4));
    const len = 2 + Math.floor(rng() * 3);
    const horiz = rng() > 0.45;
    for (let k = 0; k < len; k++) {
      const cx = horiz ? x + k : x;
      const cy = horiz ? y : y + k;
      if (cx > 0 && cy > 0 && cx < w - 1 && cy < h - 1) setKind(cells, w, cx, cy, 'wall');
    }
  }
  // Door gaps
  for (let i = 0; i < 6; i++) {
    const x = 1 + Math.floor(rng() * (w - 2));
    const y = 1 + Math.floor(rng() * (h - 2));
    setKind(cells, w, x, y, 'floor');
  }
  // Exits
  const exits = [
    { x: 1, y: Math.floor(h / 2) },
    { x: w - 2, y: 1 + Math.floor(rng() * (h - 2)) },
    { x: 2 + Math.floor(rng() * (w - 4)), y: h - 2 },
  ];
  if (kind === 'factory' || kind === 'projects') {
    exits.push({ x: w - 2, y: h - 2 });
  }
  for (const e of exits) setKind(cells, w, e.x, e.y, 'exit');

  const copSpawns = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
  ].filter((p) => walkable(cellAt(cells, w, p.x, p.y)!.kind));
  for (const p of copSpawns) setKind(cells, w, p.x, p.y, 'spawn');

  return { w, h, cells, exits, copSpawns };
}

function buildGunfightMap(rng: () => number) {
  const w = 11;
  const h = 9;
  const cells = emptyGrid(w, h, 'floor');
  for (let x = 0; x < w; x++) {
    setKind(cells, w, x, 0, 'wall');
    setKind(cells, w, x, h - 1, 'wall');
  }
  for (let y = 0; y < h; y++) {
    setKind(cells, w, 0, y, 'wall');
    setKind(cells, w, w - 1, y, 'wall');
  }
  // Cover pillars / low walls
  const covers: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 14; i++) {
    const x = 2 + Math.floor(rng() * (w - 4));
    const y = 2 + Math.floor(rng() * (h - 4));
    setKind(cells, w, x, y, rng() > 0.35 ? 'cover' : 'wall');
    if (cellAt(cells, w, x, y)?.kind === 'cover') covers.push({ x, y });
  }
  // Clear spawn lanes
  for (let y = 1; y < h - 1; y++) {
    setKind(cells, w, 1, y, 'floor');
    setKind(cells, w, w - 2, y, 'floor');
  }
  const copSpawns = [
    { x: 1, y: 2 },
    { x: 1, y: 4 },
    { x: 1, y: 6 },
  ];
  const perpSpawns = [
    { x: w - 2, y: 2 },
    { x: w - 2, y: 4 },
    { x: w - 2, y: 6 },
    { x: w - 3, y: 3 },
  ];
  return { w, h, cells, covers, copSpawns, perpSpawns };
}

function buildHideMap(rng: () => number) {
  const w = 10;
  const h = 8;
  const cells = emptyGrid(w, h, 'floor');
  for (let x = 0; x < w; x++) {
    setKind(cells, w, x, 0, 'wall');
    setKind(cells, w, x, h - 1, 'wall');
  }
  for (let y = 0; y < h; y++) {
    setKind(cells, w, 0, y, 'wall');
    setKind(cells, w, w - 1, y, 'wall');
  }
  // Room partitions
  for (let y = 1; y < h - 1; y++) {
    if (y !== 3 && y !== 5) setKind(cells, w, 4, y, 'wall');
  }
  for (let x = 1; x < w - 1; x++) {
    if (x !== 2 && x !== 7) setKind(cells, w, x, 4, 'wall');
  }
  // Extra clutter
  for (let i = 0; i < 5; i++) {
    const x = 1 + Math.floor(rng() * (w - 2));
    const y = 1 + Math.floor(rng() * (h - 2));
    if (rng() > 0.5) setKind(cells, w, x, y, 'cover');
  }
  setKind(cells, w, w - 2, h - 2, 'exit');
  setKind(cells, w, 1, h - 2, 'exit');
  const copSpawns = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
  const floors = cells.filter((c) => c.kind === 'floor' || c.kind === 'cover');
  return { w, h, cells, copSpawns, floors };
}

function floorsOf(cells: GridCell[]) {
  return cells.filter((c) => walkable(c.kind) && c.kind !== 'exit');
}

function pickMode(rng: () => number, kind: LandmarkKind): ScenarioMode {
  // Weight by venue flavor, still daily-random.
  const table: ScenarioMode[] =
    kind === 'bar' || kind === 'club'
      ? ['gunfight', 'chase', 'hide', 'gunfight', 'chase']
      : kind === 'factory'
      ? ['chase', 'gunfight', 'hide', 'chase']
      : ['hide', 'chase', 'gunfight', 'hide'];
  return pick(rng, table);
}

function pushLog(game: LocationTacticsGame, text: string, tone: TacticsLogEntry['tone'] = 'info') {
  game.log = [...game.log.slice(-16), { turn: game.turn, text, tone }];
}

function cops(game: LocationTacticsGame) {
  return game.units.filter((u) => u.side === 'cop');
}
function livingCops(game: LocationTacticsGame) {
  return cops(game).filter((u) => u.status === 'active');
}
function livingPerps(game: LocationTacticsGame) {
  return game.units.filter((u) => u.side === 'perp' && u.status === 'active');
}

function occupied(game: LocationTacticsGame, x: number, y: number, ignoreId?: string) {
  return game.units.some(
    (u) => u.id !== ignoreId && u.status === 'active' && u.x === x && u.y === y
  );
}

function refreshSpotting(game: LocationTacticsGame) {
  for (const p of livingPerps(game)) {
    if (game.mode === 'gunfight') {
      p.spotted = true;
      continue;
    }
    if (game.mode === 'hide') {
      // Visible only if adjacent to a cop or on a revealed searched cell near cop.
      p.spotted = livingCops(game).some((c) => dist(c, p) <= 1);
      continue;
    }
    // Chase: LOS or periodic glimpse
    const inLos = livingCops(game).some((c) =>
      hasLos(game.cells, game.width, game.height, c.x, c.y, p.x, p.y) && dist(c, p) <= 5
    );
    const glimpse = game.turn >= game.nextGlimpseTurn;
    p.spotted = inLos || glimpse;
  }
  if (game.mode === 'chase' && game.turn >= game.nextGlimpseTurn) {
    game.nextGlimpseTurn = game.turn + 2 + Math.floor(Math.random() * 2);
    if (livingPerps(game).some((p) => p.spotted)) {
      pushLog(game, 'Radio: fleeting glimpse of a runner!', 'warn');
    }
  }
}

function revealAround(game: LocationTacticsGame, x: number, y: number, r = 1) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny >= 0 && ny < game.height && nx >= 0 && nx < game.width) {
        game.revealed[ny][nx] = true;
      }
    }
  }
}

function pathStepToward(
  game: LocationTacticsGame,
  from: { x: number; y: number },
  goal: { x: number; y: number },
  unitId: string
): { x: number; y: number } {
  const options = neighbors(from.x, from.y)
    .map((n) => ({ n, cell: cellAt(game.cells, game.width, n.x, n.y) }))
    .filter(
      ({ n, cell }) =>
        cell && walkable(cell.kind) && !occupied(game, n.x, n.y, unitId)
    );
  if (!options.length) return from;
  options.sort((a, b) => dist(a.n, goal) - dist(b.n, goal));
  // Slight randomness so packs don't lockstep
  if (options.length > 1 && Math.random() < 0.25) return options[1].n;
  return options[0].n;
}

function nearestExit(game: LocationTacticsGame, from: { x: number; y: number }) {
  const exits = game.cells.filter((c) => c.kind === 'exit');
  if (!exits.length) return from;
  return exits.slice().sort((a, b) => dist(from, a) - dist(from, b))[0];
}

function aiPerps(game: LocationTacticsGame) {
  for (const p of livingPerps(game)) {
    if (game.mode === 'hide') {
      // Mostly stay put; sometimes drift toward exit late.
      if (game.turn > game.maxTurns - 3 && Math.random() < 0.55) {
        const exit = nearestExit(game, p);
        const step = pathStepToward(game, p, exit, p.id);
        p.x = step.x;
        p.y = step.y;
      }
      continue;
    }
    if (game.mode === 'chase') {
      const exit = nearestExit(game, p);
      const steps = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (let s = 0; s < steps; s++) {
        const step = pathStepToward(game, p, exit, p.id);
        p.x = step.x;
        p.y = step.y;
        const cell = cellAt(game.cells, game.width, p.x, p.y);
        if (cell?.kind === 'exit') {
          p.status = 'escaped';
          pushLog(game, `${p.name} escaped through an exit!`, 'bad');
          break;
        }
      }
      continue;
    }
    // Gunfight: take cover / shoot nearest cop
    const coverCells = game.cells.filter((c) => c.kind === 'cover');
    if (!p.inCover && coverCells.length && Math.random() < 0.55) {
      const nearest = coverCells.slice().sort((a, b) => dist(p, a) - dist(p, b))[0];
      const step = pathStepToward(game, p, nearest, p.id);
      p.x = step.x;
      p.y = step.y;
      if (cellAt(game.cells, game.width, p.x, p.y)?.kind === 'cover') p.inCover = true;
    }
    const target = livingCops(game)
      .filter((c) => hasLos(game.cells, game.width, game.height, p.x, p.y, c.x, c.y))
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (target && p.ammo > 0 && Math.random() < (p.inCover ? 0.7 : 0.45)) {
      p.ammo -= 1;
      spawnBullet(game, p, target, 1);
    }
  }
}

function spawnBullet(game: LocationTacticsGame, from: TacticsUnit, to: TacticsUnit, damage: number) {
  game.bullets.push({
    id: `b-${Math.random().toString(36).slice(2, 8)}`,
    x: from.x,
    y: from.y,
    tx: to.x,
    ty: to.y,
    fromId: from.id,
    side: from.side,
    damage: from.inCover ? damage : damage,
    progress: 0,
  });
  pushLog(
    game,
    `${from.name} fires at ${to.name}!`,
    from.side === 'cop' ? 'info' : 'warn'
  );
}

function applyBulletHits(game: LocationTacticsGame) {
  const remaining: TacticsBullet[] = [];
  for (const b of game.bullets) {
    b.progress += 0.34;
    b.x = b.x + (b.tx - b.x) * 0.34;
    b.y = b.y + (b.ty - b.y) * 0.34;
    if (b.progress < 1) {
      remaining.push(b);
      continue;
    }
    const target = game.units.find(
      (u) => u.status === 'active' && u.x === b.tx && u.y === b.ty && u.side !== b.side
    );
    if (!target) continue;
    let dmg = b.damage;
    if (target.inCover) dmg = Math.max(1, dmg - 1);
    // Hard mode: open-ground targets take more
    if (!target.inCover && Math.random() < 0.35) dmg += 1;
    target.hp -= dmg;
    if (target.hp <= 0) {
      if (target.side === 'cop') {
        target.status = 'hurt';
        target.hp = 0;
        pushLog(game, `${target.name} is down — unable to continue.`, 'bad');
      } else {
        target.status = 'caught';
        target.hp = 0;
        pushLog(game, `${target.name} neutralized.`, 'good');
      }
    } else {
      pushLog(game, `${target.name} hit (${target.hp} HP).`, 'warn');
    }
  }
  game.bullets = remaining;
}

function catchAdjacent(game: LocationTacticsGame) {
  for (const c of livingCops(game)) {
    for (const p of livingPerps(game)) {
      if (dist(c, p) === 0) {
        // Same cell — shove
        p.status = 'caught';
        pushLog(game, `${c.name} grabs ${p.name}!`, 'good');
      } else if (dist(c, p) === 1 && (game.mode === 'chase' || game.mode === 'hide')) {
        if (game.mode === 'hide' && !p.spotted) continue;
        if (Math.random() < (game.mode === 'hide' ? 0.85 : 0.7)) {
          p.status = 'caught';
          pushLog(game, `${c.name} cuffs ${p.name}!`, 'good');
        } else {
          pushLog(game, `${p.name} slips ${c.name}'s grab.`, 'warn');
        }
      }
    }
  }
}

function buildStats(game: LocationTacticsGame, result: TacticsResult): LocationTacticsStats {
  const police = cops(game);
  return {
    landmarkId: game.landmarkId,
    landmarkName: game.landmarkName,
    landmarkKind: game.landmarkKind,
    dayKey: game.dayKey,
    scenarioTitle: game.scenarioTitle,
    scenarioMode: game.mode,
    turnsUsed: result.turnsUsed,
    totalPolice: police.length,
    policeHurt: police.filter((u) => u.status === 'hurt' || u.status === 'down').length,
    policeUsed: police.length,
    totalPerps: result.totalPerps,
    armedPerps: game.mode === 'gunfight' ? livingPerps(game).length + result.caught : 0,
    caught: result.caught,
    escaped: result.escaped,
    unknownRoomsScouted: game.revealed.flat().filter(Boolean).length,
    outcome: result.outcome,
    operationalScore: result.score,
    decisions: game.decisions,
  };
}

function finalize(game: LocationTacticsGame): LocationTacticsGame {
  for (const p of livingPerps(game)) {
    p.status = 'escaped';
  }
  const perps = game.units.filter((u) => u.side === 'perp');
  const caught = perps.filter((p) => p.status === 'caught').length;
  const total = perps.length;
  const hurt = cops(game).filter((u) => u.status === 'hurt' || u.status === 'down').length;
  let outcome: TacticsResult['outcome'] = 'escaped';
  let score = Math.round((caught / Math.max(total, 1)) * 100) - hurt * 10;
  let message = 'Suspects got away — citizens are shaken.';
  if (caught === total) {
    outcome = 'total_win';
    score = Math.max(score, 88);
    message = 'Site locked down — every suspect accounted for.';
  } else if (caught > 0) {
    outcome = 'partial_win';
    score = Math.max(35, score);
    message = 'Partial success — some runners broke free.';
  } else {
    score = Math.max(0, score);
  }
  const result: TacticsResult = {
    outcome,
    caught,
    escaped: total - caught,
    totalPerps: total,
    officersHurt: hurt,
    turnsUsed: game.turn,
    score: Math.min(100, Math.max(0, score)),
    message,
  };
  return {
    ...game,
    phase: 'completed',
    bullets: [],
    result,
    stats: buildStats(game, result),
  };
}

function checkEnd(game: LocationTacticsGame): LocationTacticsGame {
  if (livingPerps(game).length === 0) return finalize(game);
  if (livingCops(game).length === 0) return finalize(game);
  if (game.turn > game.maxTurns) return finalize(game);
  return game;
}

function endPlayerTurn(game: LocationTacticsGame): LocationTacticsGame {
  applyBulletHits(game);
  catchAdjacent(game);
  let g = checkEnd(game);
  if (g.phase === 'completed') return g;

  g.turn += 1;
  for (const c of livingCops(g)) {
    c.ap = g.mode === 'gunfight' ? 2 : g.mode === 'hide' ? 3 : 3;
    c.inCover = cellAt(g.cells, g.width, c.x, c.y)?.kind === 'cover';
  }
  for (const p of livingPerps(g)) {
    p.inCover = cellAt(g.cells, g.width, p.x, p.y)?.kind === 'cover';
    if (g.mode === 'gunfight') p.ap = 2;
  }

  aiPerps(g);
  applyBulletHits(g);
  // Late chase escapes if standing on exit after AI move
  for (const p of livingPerps(g)) {
    if (cellAt(g.cells, g.width, p.x, p.y)?.kind === 'exit' && g.mode !== 'gunfight') {
      p.status = 'escaped';
      pushLog(g, `${p.name} slips out an exit!`, 'bad');
    }
  }
  catchAdjacent(g);
  refreshSpotting(g);
  g = checkEnd(g);
  return g;
}

export function startLocationTactics(landmark: MapLandmark, now = new Date()): LocationTacticsGame {
  const key = dayKey(now);
  const rng = makeRng(hashSeed(`${key}|${landmark.id}|${landmark.kind}|visual-v2`));
  const mode = pickMode(rng, landmark.kind);
  const meta = MODE_META[mode];

  let width = 12;
  let height = 9;
  let cells: GridCell[] = [];
  let copSpawns: Array<{ x: number; y: number }> = [];
  let perpSpawns: Array<{ x: number; y: number }> = [];

  if (mode === 'chase') {
    const map = buildChaseMap(rng, landmark.kind);
    width = map.w;
    height = map.h;
    cells = map.cells;
    copSpawns = map.copSpawns;
    perpSpawns = floorsOf(cells)
      .filter((c) => c.x > width / 2)
      .sort(() => rng() - 0.5)
      .slice(0, 3 + Math.floor(rng() * 2))
      .map((c) => ({ x: c.x, y: c.y }));
  } else if (mode === 'gunfight') {
    const map = buildGunfightMap(rng);
    width = map.w;
    height = map.h;
    cells = map.cells;
    copSpawns = map.copSpawns;
    perpSpawns = map.perpSpawns.slice(0, 3 + Math.floor(rng() * 2));
  } else {
    const map = buildHideMap(rng);
    width = map.w;
    height = map.h;
    cells = map.cells;
    const copCount = rng() > 0.55 ? 1 : 2;
    copSpawns = map.copSpawns.slice(0, copCount);
    perpSpawns = map.floors
      .filter((c) => dist(c, copSpawns[0]) > 3)
      .sort(() => rng() - 0.5)
      .slice(0, 2 + Math.floor(rng() * 2))
      .map((c) => ({ x: c.x, y: c.y }));
  }

  const units: TacticsUnit[] = [];
  copSpawns.forEach((s, i) => {
    units.push({
      id: uid('cop', rng),
      side: 'cop',
      name: `Ofc. ${COP_NAMES[i % COP_NAMES.length]}`,
      x: s.x,
      y: s.y,
      hp: mode === 'gunfight' ? 4 : 3,
      maxHp: mode === 'gunfight' ? 4 : 3,
      status: 'active',
      spotted: true,
      ap: mode === 'gunfight' ? 2 : 3,
      ammo: mode === 'gunfight' ? 5 : 0,
      inCover: false,
    });
  });
  perpSpawns.forEach((s, i) => {
    units.push({
      id: uid('perp', rng),
      side: 'perp',
      name: PERP_NAMES[i % PERP_NAMES.length],
      x: s.x,
      y: s.y,
      hp: mode === 'gunfight' ? 3 : 2,
      maxHp: mode === 'gunfight' ? 3 : 2,
      status: 'active',
      spotted: mode === 'gunfight',
      ap: 2,
      ammo: mode === 'gunfight' ? 4 : 0,
      inCover: cellAt(cells, width, s.x, s.y)?.kind === 'cover',
    });
  });

  const revealed = Array.from({ length: height }, () => Array<boolean>(width).fill(mode === 'gunfight'));
  if (mode !== 'gunfight') {
    for (const c of units.filter((u) => u.side === 'cop')) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) revealed[ny][nx] = true;
        }
      }
    }
  }

  const maxTurns = mode === 'hide' ? 10 + Math.floor(rng() * 3) : mode === 'chase' ? 12 + Math.floor(rng() * 3) : 14;

  const game: LocationTacticsGame = {
    id: uid('tactics', rng),
    landmarkId: landmark.id,
    landmarkName: landmark.name,
    landmarkKind: landmark.kind,
    dayKey: key,
    scenarioTitle: `${meta.title} — ${landmark.name}`,
    briefing: meta.briefing(landmark.name),
    mode,
    phase: 'briefing',
    turn: 1,
    maxTurns,
    width,
    height,
    cells,
    units,
    bullets: [],
    revealed,
    selectedUnitId: units.find((u) => u.side === 'cop')?.id,
    moveRange: mode === 'gunfight' ? 2 : 3,
    log: [{ turn: 1, text: `${meta.title} at ${landmark.name}. Plan carefully — this will not be easy.`, tone: 'info' }],
    decisions: [],
    nextGlimpseTurn: 2,
  };
  refreshSpotting(game);
  return game;
}

export function beginTacticsRaid(game: LocationTacticsGame): LocationTacticsGame {
  if (game.phase !== 'briefing') return game;
  const g = cloneGame(game);
  g.phase = 'active';
  g.selectedUnitId = livingCops(g)[0]?.id;
  g.decisions.push(`Started ${g.mode} scenario`);
  pushLog(g, g.briefing, 'warn');
  pushLog(g, 'Select a cop, then tap a highlighted cell. Gunfight: tap a spotted perp to shoot.', 'info');
  refreshSpotting(g);
  return g;
}

export function selectTacticsOfficer(game: LocationTacticsGame, officerId: string): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const unit = game.units.find((u) => u.id === officerId && u.side === 'cop' && u.status === 'active');
  if (!unit) return game;
  return { ...game, selectedUnitId: officerId };
}

export function reachableCells(game: LocationTacticsGame, unitId: string): Array<{ x: number; y: number }> {
  const unit = game.units.find((u) => u.id === unitId && u.status === 'active');
  if (!unit || unit.ap <= 0) return [];
  const max = Math.min(unit.ap, game.moveRange);
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) {
      const cell = cellAt(game.cells, game.width, x, y);
      if (!cell || !walkable(cell.kind)) continue;
      if (occupied(game, x, y, unit.id)) continue;
      const d = dist(unit, { x, y });
      if (d > 0 && d <= max) out.push({ x, y });
    }
  }
  return out;
}

export function shootTargets(game: LocationTacticsGame, unitId: string): TacticsUnit[] {
  const unit = game.units.find((u) => u.id === unitId && u.side === 'cop' && u.status === 'active');
  if (!unit || game.mode !== 'gunfight' || unit.ammo <= 0 || unit.ap <= 0) return [];
  return livingPerps(game).filter(
    (p) =>
      p.spotted &&
      dist(unit, p) <= 6 &&
      hasLos(game.cells, game.width, game.height, unit.x, unit.y, p.x, p.y)
  );
}

/** Primary interaction: tap a grid cell. */
export function tacticsInteractCell(
  game: LocationTacticsGame,
  x: number,
  y: number
): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  const selected = g.units.find((u) => u.id === g.selectedUnitId && u.side === 'cop' && u.status === 'active');
  if (!selected) {
    pushLog(g, 'Select an officer first.', 'warn');
    return g;
  }

  // Gunfight shoot if tapping a perp cell
  if (g.mode === 'gunfight') {
    const perp = livingPerps(g).find((p) => p.x === x && p.y === y && p.spotted);
    if (perp && selected.ammo > 0 && selected.ap > 0) {
      if (!hasLos(g.cells, g.width, g.height, selected.x, selected.y, perp.x, perp.y)) {
        pushLog(g, 'No line of sight — use cover angles.', 'warn');
        return g;
      }
      selected.ammo -= 1;
      selected.ap -= 1;
      selected.inCover = cellAt(g.cells, g.width, selected.x, selected.y)?.kind === 'cover';
      spawnBullet(g, selected, perp, selected.inCover ? 2 : 1);
      g.decisions.push(`Shot at ${perp.name}`);
      applyBulletHits(g);
      if (selected.ap <= 0) return endPlayerTurn(g);
      return checkEnd(g);
    }
  }

  // Hide: searching current/adjacent fog cell costs AP even without move
  const cell = cellAt(g.cells, g.width, x, y);
  if (!cell || !walkable(cell.kind)) {
    pushLog(g, 'Blocked.', 'warn');
    return g;
  }

  const d = dist(selected, { x, y });
  if (d === 0) {
    if (g.mode === 'hide') {
      selected.ap -= 1;
      revealAround(g, x, y, 1);
      g.decisions.push(`Searched ${x},${y}`);
      pushLog(g, `${selected.name} searches the area.`, 'info');
      refreshSpotting(g);
      catchAdjacent(g);
      if (selected.ap <= 0) return endPlayerTurn(g);
      return checkEnd(g);
    }
    return g;
  }

  if (d > Math.min(selected.ap, g.moveRange)) {
    pushLog(g, 'Too far for remaining actions.', 'warn');
    return g;
  }
  if (occupied(g, x, y, selected.id)) {
    pushLog(g, 'Cell occupied.', 'warn');
    return g;
  }

  // Simple step validation: path must not require more than d orthogonal steps through walls
  // Allow any walkable cell within range (manhattan) for playable pacing, but block if wall between on short path
  selected.x = x;
  selected.y = y;
  selected.ap -= d;
  selected.inCover = cell.kind === 'cover';
  g.decisions.push(`Moved ${selected.name} to ${x},${y}`);
  pushLog(g, `${selected.name} moves.`, 'info');
  if (g.mode !== 'gunfight') revealAround(g, x, y, g.mode === 'hide' ? 1 : 2);
  refreshSpotting(g);
  catchAdjacent(g);

  if (selected.ap <= 0) return endPlayerTurn(g);
  return checkEnd(g);
}

export function tacticsWait(game: LocationTacticsGame): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  g.decisions.push('Ended turn / held');
  pushLog(g, 'Stack holds — suspects act.', 'warn');
  for (const c of livingCops(g)) c.ap = 0;
  return endPlayerTurn(g);
}

/** Advance flying bullets (call from UI animation tick). */
export function tickBullets(game: LocationTacticsGame): LocationTacticsGame {
  if (!game.bullets.length) return game;
  const g = cloneGame(game);
  applyBulletHits(g);
  return checkEnd(g);
}

export function localFallbackLocationEvaluation(stats: LocationTacticsStats): LocationAIEvaluation {
  const rate = stats.totalPerps > 0 ? stats.caught / stats.totalPerps : 0;
  let grade = 'C';
  let score = 55;
  if (rate >= 0.75 && stats.policeHurt <= 1) {
    grade = 'A';
    score = 92;
  } else if (rate >= 0.4 || stats.caught >= 1) {
    grade = 'B';
    score = 76;
  }
  const mode = stats.scenarioMode || 'raid';
  return {
    grade,
    score,
    summary:
      rate >= 0.75
        ? `Strong ${mode} work under pressure.`
        : rate >= 0.4
        ? `Partial ${mode} result — tighten the plan.`
        : `Suspects won the ${mode} — rethink angles and timing.`,
    strategyAnalysis: `Caught ${stats.caught}/${stats.totalPerps} in ${stats.turnsUsed} turns at ${stats.landmarkName}.`,
    resourceAnalysis: `${stats.totalPolice} officers, ${stats.policeHurt} hurt.`,
    strengths: [rate >= 0.5 ? 'Kept pressure on the objective' : 'Accepted a hard site'],
    improvements: [rate < 0.75 ? 'Use cover and cut exits earlier' : 'Keep the same discipline'],
  };
}
