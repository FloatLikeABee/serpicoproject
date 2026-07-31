/** Visual on-site tactics: building-block chase, cover gunfight, hide-and-seek. */

import { LandmarkKind, MapLandmark } from './pursuitSim';

export type ScenarioMode = 'chase' | 'gunfight' | 'hide';
export type TacticsPhase = 'briefing' | 'active' | 'completed';
export type RoundPhase = 'player' | 'perp';
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
  /** Hide/chase: once found, stay visible so the player can chase / arrest. */
  known?: boolean;
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

export const SHOOT_RANGE_BLOCKS = 2;
export const MOVE_BLOCKS_PER_TURN = 1;
/** Armed fleeing suspects get at most this many shots per their turn (fairer vs officers). */
export const PERP_AMMO_PER_ROUND = 1;
/** Gunfight officers get two actions: move and/or fire in either order. */
export const OFFICER_AP_GUNFIGHT = 2;
export const OFFICER_AP_DEFAULT = 1;

/** Base hit chance by Manhattan distance (blocks). Closer = more accurate. */
export const SHOOT_HIT_BY_DISTANCE: Record<number, number> = {
  1: 0.9,
  2: 0.68,
};

/** Target hunkered in cover — harder to hit (softened so cover is useful, not impenetrable). */
export const COVER_DEFENSE_FACTOR = 0.62;
/** Shooter firing from cover — mild peek-and-shoot penalty. */
export const COVER_SHOOTER_PENALTY = 0.85;

function officerApBudget(mode: ScenarioMode): number {
  return mode === 'gunfight' ? OFFICER_AP_GUNFIGHT : OFFICER_AP_DEFAULT;
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
  /** Player round vs suspect round within active play. */
  roundPhase: RoundPhase;
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
  /** Cop entry the suspects try to reach — escape route behind the stack. */
  mainEntrance: { x: number; y: number };
  /** Officers who already moved, shot, searched, or cancelled this round. */
  actedOfficerIds: string[];
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
      `${place}: runners bolting for the main entrance. Move or skip each officer, then they advance one block — they may fire once if you're in range. Cut them off, cuff adjacent, or return fire.`,
  },
  gunfight: {
    title: 'Cover Gunfight',
    briefing: (place) =>
      `${place}: each officer gets 2 actions (move and/or fire, either order). Fire ≤2 blocks — closer is deadlier. Cover helps both sides. Suspects move and fire at most once per turn.`,
  },
  hide: {
    title: 'Hide & Seek',
    briefing: (place) =>
      `${place}: search rooms, then cuff (adjacent) or shoot (≤2 blocks). Found suspects stay visible and push for the entrance (IN); they fire at most once per turn while fleeing.`,
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
  for (const p of copSpawns) setKind(cells, w, p.x, p.y, 'spawn');
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
  for (const p of copSpawns) setKind(cells, w, p.x, p.y, 'spawn');
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

function officerHasActed(game: LocationTacticsGame, officerId: string) {
  return game.actedOfficerIds.includes(officerId);
}

function allOfficersActed(game: LocationTacticsGame) {
  const active = livingCops(game);
  return active.length > 0 && active.every((c) => officerHasActed(game, c.id));
}

function markOfficerActed(game: LocationTacticsGame, officerId: string) {
  if (!officerHasActed(game, officerId)) {
    game.actedOfficerIds = [...game.actedOfficerIds, officerId];
  }
}

function nextUnactedOfficer(game: LocationTacticsGame): string | undefined {
  return livingCops(game).find((c) => !officerHasActed(game, c.id))?.id;
}

function unitInCover(game: LocationTacticsGame, unit: TacticsUnit): boolean {
  return cellAt(game.cells, game.width, unit.x, unit.y)?.kind === 'cover';
}

function refreshUnitCover(game: LocationTacticsGame, unit: TacticsUnit) {
  unit.inCover = unitInCover(game, unit);
}

/** Hit chance for a shot — distance, target cover (harder to hit), shooter cover (harder to aim). */
export function computeShotHitChance(
  game: LocationTacticsGame,
  from: TacticsUnit,
  to: TacticsUnit
): number {
  const blocks = dist(from, to);
  if (blocks > SHOOT_RANGE_BLOCKS || blocks < 1) return 0;
  if (!hasLos(game.cells, game.width, game.height, from.x, from.y, to.x, to.y)) return 0;

  let chance = SHOOT_HIT_BY_DISTANCE[blocks] ?? 0;
  if (unitInCover(game, to)) chance *= COVER_DEFENSE_FACTOR;
  if (unitInCover(game, from)) chance *= COVER_SHOOTER_PENALTY;
  return Math.max(0.05, Math.min(0.95, chance));
}

function shootHitChance(game: LocationTacticsGame, from: TacticsUnit, to: TacticsUnit): number {
  return computeShotHitChance(game, from, to);
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
      p.known = true;
      continue;
    }
    if (game.mode === 'hide') {
      const adjacent = livingCops(game).some((c) => dist(c, p) <= 1);
      if (adjacent) p.known = true;
      // Once found, stay visible so the player can arrest or watch them flee to the entrance.
      p.spotted = !!p.known;
      continue;
    }
    // Chase: LOS or periodic glimpse — once seen, keep known for pursuit.
    const inLos = livingCops(game).some((c) =>
      hasLos(game.cells, game.width, game.height, c.x, c.y, p.x, p.y) && dist(c, p) <= 5
    );
    const glimpse = game.turn >= game.nextGlimpseTurn;
    if (inLos || glimpse) p.known = true;
    p.spotted = !!p.known || inLos || glimpse;
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
  unitId: string,
  allowThroughUnits = false
): { x: number; y: number } {
  // BFS so suspects can route around walls toward escape.
  const queue: Array<{ x: number; y: number }> = [{ x: from.x, y: from.y }];
  const prev = new Map<string, string | null>();
  const key = (x: number, y: number) => `${x},${y}`;
  prev.set(key(from.x, from.y), null);

  let found: { x: number; y: number } | null = null;
  while (queue.length && !found) {
    const cur = queue.shift()!;
    if (cur.x === goal.x && cur.y === goal.y) {
      found = cur;
      break;
    }
    for (const n of neighbors(cur.x, cur.y)) {
      const k = key(n.x, n.y);
      if (prev.has(k)) continue;
      const cell = cellAt(game.cells, game.width, n.x, n.y);
      if (!cell || !walkable(cell.kind)) continue;
      const isGoal = n.x === goal.x && n.y === goal.y;
      if (!isGoal && !allowThroughUnits && occupied(game, n.x, n.y, unitId)) continue;
      prev.set(k, key(cur.x, cur.y));
      queue.push(n);
    }
  }

  if (found) {
    let curKey = key(found.x, found.y);
    let parent = prev.get(curKey) ?? null;
    if (!parent) return from;
    while (parent && parent !== key(from.x, from.y)) {
      curKey = parent;
      parent = prev.get(curKey) ?? null;
    }
    const [sx, sy] = curKey.split(',').map(Number);
    // Don't end the step on another living unit unless it's the escape tile.
    if ((sx !== goal.x || sy !== goal.y) && occupied(game, sx, sy, unitId)) {
      return from;
    }
    return { x: sx, y: sy };
  }

  return from;
}

function escapeGoals(game: LocationTacticsGame): Array<{ x: number; y: number }> {
  const goals: Array<{ x: number; y: number }> = [{ ...game.mainEntrance }];
  for (const c of game.cells) {
    if (c.kind === 'spawn' || c.kind === 'exit') {
      if (!goals.some((g) => g.x === c.x && g.y === c.y)) {
        goals.push({ x: c.x, y: c.y });
      }
    }
  }
  // Main entrance first — prefer breaking out behind the stack.
  return goals;
}

function pickEscapeGoal(
  game: LocationTacticsGame,
  from: { x: number; y: number },
  unitId: string
): { x: number; y: number } {
  const goals = escapeGoals(game);
  let best = goals[0];
  let bestDist = Infinity;
  for (const goal of goals) {
    // Prefer reachable paths that avoid units; fall back to paths through units.
    for (const through of [false, true]) {
      const step = pathStepToward(game, from, goal, unitId, through);
      const moved = step.x !== from.x || step.y !== from.y;
      const d = dist(from, goal);
      // Prefer main entrance when distances are close.
      const entranceBonus = goal.x === game.mainEntrance.x && goal.y === game.mainEntrance.y ? -0.5 : 0;
      const score = d + entranceBonus + (moved ? 0 : 20);
      if (score < bestDist) {
        bestDist = score;
        best = goal;
      }
      if (moved && through === false) break;
    }
  }
  return best;
}

function aggressiveEscapeStep(
  game: LocationTacticsGame,
  from: { x: number; y: number },
  unitId: string
): { x: number; y: number; goal: { x: number; y: number } } {
  const goal = pickEscapeGoal(game, from, unitId);

  // 1) Clean path avoiding units
  let step = pathStepToward(game, from, goal, unitId, false);
  if (step.x !== from.x || step.y !== from.y) return { ...step, goal };

  // 2) Path allowing routing past units (won't land on them unless goal)
  step = pathStepToward(game, from, goal, unitId, true);
  if (step.x !== from.x || step.y !== from.y) return { ...step, goal };

  // 3) Greedy: any walkable neighbor that reduces distance to any escape goal
  const options = neighbors(from.x, from.y)
    .map((n) => ({ n, cell: cellAt(game.cells, game.width, n.x, n.y) }))
    .filter(
      ({ n, cell }) =>
        cell &&
        walkable(cell.kind) &&
        (!occupied(game, n.x, n.y, unitId) ||
          cell.kind === 'spawn' ||
          cell.kind === 'exit' ||
          (n.x === goal.x && n.y === goal.y))
    );
  if (!options.length) return { x: from.x, y: from.y, goal };

  options.sort((a, b) => {
    const da = Math.min(...escapeGoals(game).map((g) => dist(a.n, g)));
    const db = Math.min(...escapeGoals(game).map((g) => dist(b.n, g)));
    return da - db;
  });
  return { ...options[0].n, goal };
}

function isEscapeTile(game: LocationTacticsGame, x: number, y: number): boolean {
  const cell = cellAt(game.cells, game.width, x, y);
  if (!cell) return false;
  if (cell.kind === 'spawn' || cell.kind === 'exit') return true;
  return x === game.mainEntrance.x && y === game.mainEntrance.y;
}

function perpEscapedThroughEntrance(game: LocationTacticsGame, p: TacticsUnit) {
  if (!isEscapeTile(game, p.x, p.y)) return false;
  p.status = 'escaped';
  p.known = true;
  p.spotted = true;
  pushLog(game, `${p.name} breaks out through an escape point!`, 'bad');
  return true;
}

function tryPerpShoot(game: LocationTacticsGame, p: TacticsUnit, maxShots = PERP_AMMO_PER_ROUND): void {
  if (p.ammo <= 0 || maxShots <= 0) return;
  const shots = Math.min(p.ammo, maxShots);
  for (let i = 0; i < shots; i++) {
    if (p.ammo <= 0) break;
    const target = livingCops(game)
      .filter(
        (c) =>
          dist(p, c) <= SHOOT_RANGE_BLOCKS &&
          dist(p, c) >= 1 &&
          hasLos(game.cells, game.width, game.height, p.x, p.y, c.x, c.y)
      )
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (!target) break;
    p.ammo -= 1;
    // Opening fire reveals them in hide/chase.
    p.known = true;
    p.spotted = true;
    resolveShot(game, p, target, 1);
  }
}

function aiPerps(game: LocationTacticsGame) {
  for (const p of livingPerps(game)) {
    // Top up enough for one shot — no multi-burst dump on the officers.
    p.ammo = Math.max(p.ammo, PERP_AMMO_PER_ROUND);

    const { x, y } = aggressiveEscapeStep(game, p, p.id);
    const threatened = livingCops(game).some(
      (c) =>
        dist(p, c) <= SHOOT_RANGE_BLOCKS &&
        hasLos(game.cells, game.width, game.height, p.x, p.y, c.x, c.y)
    );

    let fired = false;

    if (x !== p.x || y !== p.y) {
      // Escape first — at most one shot after relocating (not before and after).
      p.x = x;
      p.y = y;
      p.inCover = cellAt(game.cells, game.width, p.x, p.y)?.kind === 'cover';
      if (p.spotted || p.known) {
        pushLog(game, `${p.name} pushes toward escape.`, 'warn');
      }
      if (perpEscapedThroughEntrance(game, p)) continue;
      tryPerpShoot(game, p, 1);
      fired = true;
    } else if (threatened) {
      pushLog(game, `${p.name} is boxed in — opening fire.`, 'warn');
      tryPerpShoot(game, p, 1);
      fired = true;
    }

    if (!fired && threatened) {
      tryPerpShoot(game, p, 1);
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

function resolveShot(game: LocationTacticsGame, from: TacticsUnit, to: TacticsUnit, damage: number): boolean {
  refreshUnitCover(game, from);
  refreshUnitCover(game, to);

  const blocks = dist(from, to);
  if (blocks > SHOOT_RANGE_BLOCKS || blocks < 1) {
    pushLog(game, 'Out of range — shots only land within 2 blocks.', 'warn');
    return false;
  }
  if (!hasLos(game.cells, game.width, game.height, from.x, from.y, to.x, to.y)) {
    pushLog(game, 'No line of sight.', 'warn');
    return false;
  }

  const chance = shootHitChance(game, from, to);
  const coverNotes: string[] = [];
  if (unitInCover(game, to)) coverNotes.push('target in cover');
  if (unitInCover(game, from)) coverNotes.push('shooter in cover');
  const coverSuffix = coverNotes.length ? ` · ${coverNotes.join(', ')}` : '';

  if (Math.random() >= chance) {
    pushLog(
      game,
      `${from.name}'s shot at ${to.name} misses (${blocks} block${blocks > 1 ? 's' : ''}, ${Math.round(chance * 100)}%${coverSuffix}).`,
      'info'
    );
    return false;
  }
  spawnBullet(game, from, to, damage);
  return true;
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

function arrestPerp(game: LocationTacticsGame, cop: TacticsUnit, perp: TacticsUnit): void {
  if (perp.status !== 'active') return;
  perp.status = 'caught';
  perp.hp = 0;
  pushLog(game, `${cop.name} arrests ${perp.name}!`, 'good');
}

function catchAdjacent(game: LocationTacticsGame) {
  for (const c of livingCops(game)) {
    for (const p of livingPerps(game)) {
      const d = dist(c, p);
      if (d === 0) {
        arrestPerp(game, c, p);
      } else if (d === 1 && (game.mode === 'chase' || game.mode === 'hide')) {
        // Auto-cuff only when the suspect is already known / spotted.
        if (game.mode === 'hide' && !p.spotted && !p.known) continue;
        arrestPerp(game, c, p);
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

function playerTurnActive(game: LocationTacticsGame): boolean {
  return game.phase === 'active' && game.roundPhase === 'player';
}

function beginPerpPhase(game: LocationTacticsGame): LocationTacticsGame {
  applyBulletHits(game);
  catchAdjacent(game);
  let g = checkEnd(game);
  if (g.phase === 'completed') return g;

  g.roundPhase = 'perp';
  pushLog(g, 'Officers set — suspects take their turn.', 'warn');
  return g;
}

/** Run suspect movement after the player round (call from UI after a short pause). */
export function resolvePerpTurn(game: LocationTacticsGame): LocationTacticsGame {
  if (game.phase !== 'active' || game.roundPhase !== 'perp') return game;
  const g = cloneGame(game);

  pushLog(g, 'Suspects move one block toward the main entrance.', 'warn');
  aiPerps(g);
  applyBulletHits(g);
  for (const p of livingPerps(g)) {
    perpEscapedThroughEntrance(g, p);
  }
  catchAdjacent(g);
  refreshSpotting(g);

  g.turn += 1;
  g.actedOfficerIds = [];
  g.roundPhase = 'player';
  for (const c of livingCops(g)) {
    c.ap = officerApBudget(g.mode);
    c.inCover = cellAt(g.cells, g.width, c.x, c.y)?.kind === 'cover';
  }
  for (const p of livingPerps(g)) {
    p.inCover = cellAt(g.cells, g.width, p.x, p.y)?.kind === 'cover';
    p.ammo = Math.max(p.ammo, PERP_AMMO_PER_ROUND);
  }
  g.selectedUnitId = nextUnactedOfficer(g) ?? livingCops(g)[0]?.id;
  if (g.mode === 'gunfight') {
    pushLog(g, 'Your turn — each officer has 2 actions (move and/or fire).', 'info');
  } else {
    pushLog(g, 'Your turn — move each officer one block, cuff/shoot, or skip.', 'info');
  }

  return checkEnd(g);
}

function finishOfficerAction(g: LocationTacticsGame, officerId: string): LocationTacticsGame {
  markOfficerActed(g, officerId);
  const officer = g.units.find((u) => u.id === officerId);
  if (officer) officer.ap = 0;
  g.selectedUnitId = nextUnactedOfficer(g) ?? g.selectedUnitId;
  if (allOfficersActed(g)) return beginPerpPhase(g);
  return checkEnd(g);
}

/** Spend action points; gunfight keeps the officer selected if they still have AP. */
function spendOfficerAp(g: LocationTacticsGame, officer: TacticsUnit, cost = 1): LocationTacticsGame {
  officer.ap = Math.max(0, (officer.ap ?? 1) - cost);
  if (officer.ap <= 0) {
    return finishOfficerAction(g, officer.id);
  }
  pushLog(g, `${officer.name} has ${officer.ap} action left — move or fire.`, 'info');
  g.selectedUnitId = officer.id;
  return checkEnd(g);
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
      hp: mode === 'gunfight' ? 5 : 3,
      maxHp: mode === 'gunfight' ? 5 : 3,
      status: 'active',
      spotted: true,
      ap: officerApBudget(mode),
      ammo: mode === 'gunfight' ? 6 : 4,
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
      ap: 1,
      ammo: mode === 'gunfight' ? 3 : PERP_AMMO_PER_ROUND,
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

  const mainEntrance = copSpawns[0] ?? { x: 1, y: 1 };

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
    roundPhase: 'player',
    turn: 1,
    maxTurns,
    width,
    height,
    cells,
    units,
    bullets: [],
    revealed,
    selectedUnitId: units.find((u) => u.side === 'cop')?.id,
    moveRange: MOVE_BLOCKS_PER_TURN,
    mainEntrance,
    actedOfficerIds: [],
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
  g.roundPhase = 'player';
  g.selectedUnitId = livingCops(g)[0]?.id;
  g.decisions.push(`Started ${g.mode} scenario`);
  pushLog(g, g.briefing, 'warn');
  pushLog(
    g,
    g.mode === 'gunfight'
      ? 'Gunfight: each officer has 2 actions — move into position, then fire (or fire then move). Suspects fire at most once per turn.'
      : 'Turn-based: each officer moves 1 block, arrests/fires, or skips — then suspects move toward the main entrance.',
    'info'
  );
  if (g.mode === 'gunfight') {
    pushLog(
      g,
      'Tap teal to move, red to shoot (≤2 blocks). Adjacent suspects can be cuffed. Gold ring = cover.',
      'info'
    );
  }
  if (g.mode === 'hide' || g.mode === 'chase') {
    pushLog(g, 'Get next to a suspect and tap them to arrest. Found suspects stay visible and run for the main entrance (IN).', 'info');
  }
  refreshSpotting(g);
  return g;
}

export function selectTacticsOfficer(game: LocationTacticsGame, officerId: string): LocationTacticsGame {
  if (!playerTurnActive(game)) return game;
  const unit = game.units.find((u) => u.id === officerId && u.side === 'cop' && u.status === 'active');
  if (!unit || officerHasActed(game, officerId)) return game;
  return { ...game, selectedUnitId: officerId };
}

export function reachableCells(game: LocationTacticsGame, unitId: string): Array<{ x: number; y: number }> {
  if (!playerTurnActive(game)) return [];
  const unit = game.units.find((u) => u.id === unitId && u.status === 'active');
  if (!unit || officerHasActed(game, unitId)) return [];
  const out: Array<{ x: number; y: number }> = [];
  for (const n of neighbors(unit.x, unit.y)) {
    const cell = cellAt(game.cells, game.width, n.x, n.y);
    if (!cell || !walkable(cell.kind)) continue;
    const perpThere = livingPerps(game).find((p) => p.x === n.x && p.y === n.y);
    if (perpThere) {
      // Can step onto a perp cell to arrest when known / in gunfight adjacency.
      if (game.mode === 'gunfight') {
        out.push(n);
        continue;
      }
      out.push(n);
      continue;
    }
    if (occupied(game, n.x, n.y, unit.id)) continue;
    out.push(n);
  }
  return out;
}

export function shootTargets(game: LocationTacticsGame, unitId: string): TacticsUnit[] {
  if (!playerTurnActive(game)) return [];
  const unit = game.units.find((u) => u.id === unitId && u.side === 'cop' && u.status === 'active');
  if (!unit || officerHasActed(game, unitId) || unit.ammo <= 0) return [];
  return livingPerps(game).filter((p) => {
    if (!(p.spotted || p.known || game.mode === 'gunfight')) return false;
    const d = dist(unit, p);
    if (d < 1 || d > SHOOT_RANGE_BLOCKS) return false;
    // Hide/chase: adjacent taps are arrests — only highlight ranged shots here.
    if (game.mode !== 'gunfight' && d <= 1) return false;
    return hasLos(game.cells, game.width, game.height, unit.x, unit.y, p.x, p.y);
  });
}

/** Spotted suspects the selected officer can cuff (hide / chase / gunfight adjacent). */
export function arrestTargets(game: LocationTacticsGame, unitId: string): TacticsUnit[] {
  if (!playerTurnActive(game)) return [];
  const unit = game.units.find((u) => u.id === unitId && u.side === 'cop' && u.status === 'active');
  if (!unit || officerHasActed(game, unitId)) return [];
  return livingPerps(game).filter((p) => {
    if (dist(unit, p) > 1) return false;
    if (game.mode === 'gunfight') return true;
    return !!(p.spotted || p.known);
  });
}

/** Cells under threat from living suspects (LOS + range) — for UI danger highlights. */
export function dangerCells(game: LocationTacticsGame): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  for (const p of livingPerps(game)) {
    if (game.mode !== 'gunfight' && !(p.spotted || p.known)) continue;
    for (let y = 0; y < game.height; y++) {
      for (let x = 0; x < game.width; x++) {
        const cell = cellAt(game.cells, game.width, x, y);
        if (!cell || !walkable(cell.kind)) continue;
        const d = Math.abs(p.x - x) + Math.abs(p.y - y);
        if (d < 1 || d > SHOOT_RANGE_BLOCKS) continue;
        if (!hasLos(game.cells, game.width, game.height, p.x, p.y, x, y)) continue;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x, y });
      }
    }
  }
  return out;
}

export function tacticsCancelOfficer(game: LocationTacticsGame, officerId?: string): LocationTacticsGame {
  if (!playerTurnActive(game)) return game;
  const g = cloneGame(game);
  const id = officerId ?? g.selectedUnitId;
  const officer = g.units.find((u) => u.id === id && u.side === 'cop' && u.status === 'active');
  if (!officer || officerHasActed(g, officer.id)) return g;
  markOfficerActed(g, officer.id);
  g.decisions.push(`${officer.name} held position`);
  pushLog(g, `${officer.name} skips — holds position.`, 'info');
  g.selectedUnitId = nextUnactedOfficer(g) ?? g.selectedUnitId;
  if (allOfficersActed(g)) return beginPerpPhase(g);
  return g;
}

/** Primary interaction: tap a grid cell. */
export function tacticsInteractCell(
  game: LocationTacticsGame,
  x: number,
  y: number
): LocationTacticsGame {
  if (!playerTurnActive(game)) return game;
  const g = cloneGame(game);
  const selected = g.units.find((u) => u.id === g.selectedUnitId && u.side === 'cop' && u.status === 'active');
  if (!selected) {
    pushLog(g, 'Select an officer first.', 'warn');
    return g;
  }
  if (officerHasActed(g, selected.id)) {
    pushLog(g, 'That officer already acted this round.', 'warn');
    return g;
  }

  // Tap a spotted suspect: arrest if adjacent, otherwise shoot if in range
  {
    const perp = livingPerps(g).find(
      (p) => p.x === x && p.y === y && (p.spotted || p.known || g.mode === 'gunfight')
    );
    if (perp) {
      const range = dist(selected, perp);
      if (range <= 1) {
        perp.known = true;
        perp.spotted = true;
        arrestPerp(g, selected, perp);
        g.decisions.push(`Arrested ${perp.name}`);
        return spendOfficerAp(g, selected, 1);
      }
      if (range >= 1 && range <= SHOOT_RANGE_BLOCKS) {
        if (selected.ammo <= 0) {
          pushLog(g, 'Out of ammo — move adjacent to cuff or reposition.', 'warn');
          return g;
        }
        if (!hasLos(g.cells, g.width, g.height, selected.x, selected.y, perp.x, perp.y)) {
          pushLog(g, 'No line of sight.', 'warn');
          return g;
        }
        refreshUnitCover(g, selected);
        refreshUnitCover(g, perp);
        selected.ammo -= 1;
        const hitPct = Math.round(computeShotHitChance(g, selected, perp) * 100);
        if (resolveShot(g, selected, perp, selected.inCover ? 2 : 1)) {
          g.decisions.push(`Shot at ${perp.name} (${hitPct}% hit)`);
        } else {
          g.decisions.push(`Missed ${perp.name} (${hitPct}% hit)`);
        }
        applyBulletHits(g);
        return spendOfficerAp(g, selected, 1);
      }
      pushLog(g, 'Too far — get within 2 blocks to shoot, or adjacent to arrest.', 'warn');
      return g;
    }
  }

  const cell = cellAt(g.cells, g.width, x, y);
  if (!cell || !walkable(cell.kind)) {
    pushLog(g, 'Blocked.', 'warn');
    return g;
  }

  const d = dist(selected, { x, y });

  // Hide: search current cell as the officer's one action (wider sweep)
  if (d === 0 && g.mode === 'hide') {
    revealAround(g, x, y, 2);
    g.decisions.push(`Searched ${x},${y}`);
    pushLog(g, `${selected.name} searches the area.`, 'info');
    refreshSpotting(g);
    catchAdjacent(g);
    return spendOfficerAp(g, selected, 1);
  }

  if (d !== MOVE_BLOCKS_PER_TURN) {
    pushLog(g, 'One block per move — pick an adjacent cell.', 'warn');
    return g;
  }

  // Stepping onto a suspect = arrest
  const perpOnCell = livingPerps(g).find((p) => p.x === x && p.y === y);
  if (perpOnCell) {
    if (!(perpOnCell.spotted || perpOnCell.known) && g.mode === 'hide') {
      perpOnCell.known = true;
      perpOnCell.spotted = true;
    }
    selected.x = x;
    selected.y = y;
    selected.inCover = cell.kind === 'cover';
    arrestPerp(g, selected, perpOnCell);
    g.decisions.push(`Arrested ${perpOnCell.name}`);
    if (g.mode !== 'gunfight') revealAround(g, x, y, g.mode === 'hide' ? 2 : 2);
    refreshSpotting(g);
    return spendOfficerAp(g, selected, 1);
  }

  if (occupied(g, x, y, selected.id)) {
    pushLog(g, 'Cell occupied.', 'warn');
    return g;
  }

  selected.x = x;
  selected.y = y;
  selected.inCover = cell.kind === 'cover';
  g.decisions.push(`Moved ${selected.name} to ${x},${y}`);
  pushLog(g, `${selected.name} moves one block.`, 'info');
  if (g.mode !== 'gunfight') revealAround(g, x, y, g.mode === 'hide' ? 2 : 2);
  refreshSpotting(g);
  catchAdjacent(g);
  return spendOfficerAp(g, selected, 1);
}

export function tacticsWait(game: LocationTacticsGame): LocationTacticsGame {
  if (!playerTurnActive(game)) return game;
  const g = cloneGame(game);
  for (const c of livingCops(g)) {
    if (!officerHasActed(g, c.id)) {
      markOfficerActed(g, c.id);
      pushLog(g, `${c.name} skips.`, 'info');
    }
  }
  g.decisions.push('Skipped remaining officers');
  return beginPerpPhase(g);
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
