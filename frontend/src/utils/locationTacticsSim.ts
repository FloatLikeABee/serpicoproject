/**
 * Turn-based multi-floor building raid.
 *
 * Officers spend a move budget, then suspects take their turn. Suspects run for the front
 * gate the officers came through, so leaving it open costs you the raid. Shots are scarce and
 * cover is a gamble: rounds still get through it, but standing in the open ends you in one hit.
 */

import { LandmarkKind, MapLandmark } from './pursuitSim';

export type ScenarioMode = 'chase' | 'gunfight' | 'hide';
export type TacticsPhase = 'briefing' | 'active' | 'completed';
export type TurnPhase = 'officers' | 'suspects';
/** Structural tile type. `gate` is the front door: officer start and the only way out. */
export type CellKind = 'floor' | 'wall' | 'cover' | 'gate' | 'stair';
/** Functional zone — drives floor-map color so the venue reads at a glance. */
export type FloorZone =
  | 'hall'
  | 'bar'
  | 'booth'
  | 'kitchen'
  | 'restroom'
  | 'stage'
  | 'dance'
  | 'vip'
  | 'loading'
  | 'machine'
  | 'office'
  | 'unit'
  | 'stair'
  | 'court'
  | 'basement'
  | 'alley'
  | 'entry'
  | 'wall';

export interface GridCell {
  x: number;
  y: number;
  kind: CellKind;
  zone: FloorZone;
  /** Stairs only: tiles this connects to on other floors. A shaft can serve up and down. */
  links?: Array<{ floor: number; x: number; y: number }>;
}

export interface FloorLabel {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BuildingFloor {
  index: number;
  name: string;
  width: number;
  height: number;
  cells: GridCell[];
  labels: FloorLabel[];
}

export interface TacticsUnit {
  id: string;
  side: 'cop' | 'perp';
  name: string;
  floor: number;
  x: number;
  y: number;
  lives: number;
  maxLives: number;
  status: 'active' | 'down' | 'caught' | 'escaped';
  /** Player-visible this turn (fog / line of sight / radio glimpse). */
  spotted: boolean;
  moves: number;
  maxMoves: number;
  /** Remaining gunshot opportunities for this officer (suspects use ammo the same way). */
  shots: number;
  inCover: boolean;
  /** Spent the turn hunkering — much harder to hit until the next turn. */
  hunkered: boolean;
  armed: boolean;
}

/** Purely visual tracer; damage is already applied when it spawns. */
export interface TacticsTracer {
  id: string;
  floor: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  side: 'cop' | 'perp';
  hit: boolean;
  life: number;
}

export interface TacticsLogEntry {
  turn: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'warn' | 'radio';
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
  floors: number;
  shotsFired: number;
  shotsLeft: number;
  officersDown: number;
  gateEscapes: number;
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
  turnPhase: TurnPhase;
  turn: number;
  maxTurns: number;
  floors: BuildingFloor[];
  /** Floor the map is currently showing. */
  viewFloor: number;
  /** Front gate: where officers entered and the only way suspects get out. */
  gate: { floor: number; x: number; y: number };
  units: TacticsUnit[];
  tracers: TacticsTracer[];
  /** Fog per floor. */
  revealed: boolean[][][];
  selectedUnitId?: string;
  /** Shared magazine for gunfights; raid modes use per-officer shots instead. */
  squadAmmo: number;
  maxSquadAmmo: number;
  shotsFired: number;
  gateEscapes: number;
  /** Latest radio call-out about suspect whereabouts. */
  radio: string | null;
  nextRadioTurn: number;
  /** What the suspects did on their last turn, for the recap strip. */
  lastSuspectMoves: string[];
  log: TacticsLogEntry[];
  decisions: string[];
  result?: TacticsResult;
  stats?: LocationTacticsStats;
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

/** Officer gunshot opportunities per raid (outside gunfights). */
export const OFFICER_SHOTS = 2;
/** Shared rounds for a gunfight. */
export const GUNFIGHT_AMMO = 30;
/** Cover is a bet, not a wall — this fraction of shots still lands. */
const COVER_HIT_CHANCE = 0.32;
const HUNKERED_HIT_CHANCE = 0.16;
const OPEN_HIT_CHANCE = 0.82;
const SHOT_RANGE = 7;

const COP_NAMES = ['Reyes', 'Okada', 'Brooks', 'Hassan', 'Nguyen', 'Carter', 'Diaz', 'Walsh'];
const PERP_NAMES = ['Vex', 'Rook', 'Shade', 'Bolt', 'Kite', 'Moth', 'Jinx', 'Dust', 'Hex', 'Pike'];

const MODE_META: Record<ScenarioMode, { title: string; tip: string }> = {
  chase: { title: 'Foot Chase', tip: 'Runners break for the front gate — cut the stairs.' },
  gunfight: { title: 'Gunfight', tip: 'Cover or shoot. Standing in the open ends you.' },
  hide: { title: 'Hide & Seek', tip: 'Work the radio calls floor by floor.' },
};

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

// ---------------------------------------------------------------------------
// Floor construction
// ---------------------------------------------------------------------------

function blankFloor(index: number, name: string, w: number, h: number, zone: FloorZone): BuildingFloor {
  const cells: GridCell[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) cells.push({ x, y, kind: 'floor', zone });
  }
  const floor: BuildingFloor = { index, name, width: w, height: h, cells, labels: [] };
  frameWalls(floor);
  return floor;
}

function cellOn(floor: BuildingFloor, x: number, y: number): GridCell | null {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return null;
  return floor.cells[y * floor.width + x] ?? null;
}

function paint(floor: BuildingFloor, x: number, y: number, kind: CellKind, zone?: FloorZone) {
  const cell = cellOn(floor, x, y);
  if (!cell) return;
  cell.kind = kind;
  if (zone) cell.zone = zone;
}

function room(
  floor: BuildingFloor,
  x0: number,
  y0: number,
  w: number,
  h: number,
  zone: FloorZone,
  kind: CellKind = 'floor'
) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) paint(floor, x, y, kind, zone);
  }
}

function frameWalls(floor: BuildingFloor) {
  for (let x = 0; x < floor.width; x++) {
    paint(floor, x, 0, 'wall', 'wall');
    paint(floor, x, floor.height - 1, 'wall', 'wall');
  }
  for (let y = 0; y < floor.height; y++) {
    paint(floor, 0, y, 'wall', 'wall');
    paint(floor, floor.width - 1, y, 'wall', 'wall');
  }
}

function partition(
  floor: BuildingFloor,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  doors: Array<{ x: number; y: number }> = []
) {
  const doorSet = new Set(doors.map((d) => `${d.x},${d.y}`));
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  let x = x0;
  let y = y0;
  for (;;) {
    if (!doorSet.has(`${x},${y}`)) paint(floor, x, y, 'wall', 'wall');
    if (x === x1 && y === y1) break;
    x += dx;
    y += dy;
  }
}

function label(floor: BuildingFloor, id: string, name: string, x: number, y: number, w: number, h: number) {
  floor.labels.push({ id, name, x, y, w, h });
}

/** Two-way stairs at the same coordinates on both floors. */
function linkStairs(a: BuildingFloor, b: BuildingFloor, x: number, y: number) {
  paint(a, x, y, 'stair', 'stair');
  paint(b, x, y, 'stair', 'stair');
  const ca = cellOn(a, x, y);
  const cb = cellOn(b, x, y);
  if (ca) ca.links = [...(ca.links ?? []), { floor: b.index, x, y }];
  if (cb) cb.links = [...(cb.links ?? []), { floor: a.index, x, y }];
}

interface Building {
  floors: BuildingFloor[];
  gate: { floor: number; x: number; y: number };
  copStart: Array<{ floor: number; x: number; y: number }>;
  perpSpawns: Array<{ floor: number; x: number; y: number }>;
}

/** Corner bar: beer cellar below, public room at street level, staff office upstairs. */
function buildBar(rng: () => number): Building {
  const w = 14;
  const h = 10;
  const cellar = blankFloor(0, 'Cellar', w, h, 'basement');
  const ground = blankFloor(1, 'Ground', w, h, 'hall');
  const upper = blankFloor(2, 'Upstairs', w, h, 'office');

  // Cellar: kegs, cold store, dead-end crawlway.
  room(cellar, 1, 1, 6, 4, 'basement');
  room(cellar, 8, 1, 5, 4, 'kitchen');
  partition(cellar, 7, 1, 7, 4, [{ x: 7, y: 3 }]);
  room(cellar, 1, 6, 12, 3, 'loading');
  partition(cellar, 1, 5, 12, 5, [{ x: 3, y: 5 }, { x: 10, y: 5 }]);
  for (const p of [{ x: 2, y: 2 }, { x: 4, y: 3 }, { x: 9, y: 2 }, { x: 11, y: 3 }, { x: 5, y: 7 }]) {
    paint(cellar, p.x, p.y, 'cover');
  }
  label(cellar, 'kegs', 'Keg Room', 1, 1, 6, 4);
  label(cellar, 'cold', 'Cold Store', 8, 1, 5, 4);
  label(cellar, 'crawl', 'Crawlway', 1, 6, 12, 3);

  // Ground: gate on the west wall, bar rail, booths, kitchen, restroom.
  room(ground, 1, 1, 4, 3, 'entry');
  room(ground, 5, 1, 5, 5, 'hall');
  for (let x = 5; x <= 9; x++) paint(ground, x, 3, 'cover', 'bar');
  room(ground, 5, 4, 5, 2, 'bar');
  room(ground, 10, 1, 3, 4, 'booth');
  partition(ground, 10, 1, 10, 4, [{ x: 10, y: 2 }]);
  room(ground, 1, 5, 3, 4, 'kitchen');
  partition(ground, 4, 5, 4, 8, [{ x: 4, y: 6 }]);
  room(ground, 5, 7, 3, 2, 'restroom');
  partition(ground, 5, 7, 7, 7, [{ x: 6, y: 7 }]);
  room(ground, 9, 6, 4, 3, 'alley');
  partition(ground, 9, 6, 9, 8, [{ x: 9, y: 7 }]);
  for (const p of [{ x: 6, y: 2 }, { x: 8, y: 2 }, { x: 11, y: 2 }, { x: 11, y: 4 }]) {
    paint(ground, p.x, p.y, 'cover');
  }
  if (rng() > 0.4) paint(ground, 2, 7, 'cover', 'kitchen');
  label(ground, 'entry', 'Front Room', 1, 1, 4, 2);
  label(ground, 'bar', 'Bar', 5, 3, 5, 3);
  label(ground, 'booths', 'Booths', 10, 1, 2, 4);
  label(ground, 'kitchen', 'Kitchen', 1, 5, 3, 4);
  label(ground, 'wc', 'WC', 5, 7, 3, 2);
  label(ground, 'store', 'Back Store', 9, 6, 3, 3);

  // Upstairs: office, staff room, roof landing.
  room(upper, 1, 1, 5, 4, 'office');
  room(upper, 7, 1, 6, 4, 'unit');
  partition(upper, 6, 1, 6, 4, [{ x: 6, y: 2 }]);
  room(upper, 1, 6, 12, 3, 'hall');
  partition(upper, 1, 5, 12, 5, [{ x: 4, y: 5 }, { x: 9, y: 5 }]);
  for (const p of [{ x: 2, y: 2 }, { x: 4, y: 3 }, { x: 8, y: 2 }, { x: 11, y: 3 }]) {
    paint(upper, p.x, p.y, 'cover');
  }
  label(upper, 'office', 'Office', 1, 1, 5, 4);
  label(upper, 'staff', 'Staff Room', 7, 1, 6, 4);
  label(upper, 'landing', 'Roof Landing', 1, 6, 12, 3);

  linkStairs(cellar, ground, 11, 7);
  linkStairs(ground, upper, 2, 3);

  paint(ground, 0, 2, 'gate', 'entry');

  return {
    floors: [cellar, ground, upper],
    gate: { floor: 1, x: 0, y: 2 },
    copStart: [
      { floor: 1, x: 1, y: 2 },
      { floor: 1, x: 1, y: 1 },
      { floor: 1, x: 2, y: 2 },
    ],
    perpSpawns: [
      { floor: 1, x: 7, y: 5 },
      { floor: 1, x: 11, y: 3 },
      { floor: 2, x: 9, y: 2 },
      { floor: 2, x: 3, y: 7 },
      { floor: 0, x: 3, y: 2 },
      { floor: 0, x: 10, y: 2 },
    ],
  };
}

/** Nightclub: utility basement, main room, mezzanine VIP over the dance floor. */
function buildClub(rng: () => number): Building {
  const w = 15;
  const h = 11;
  const under = blankFloor(0, 'Basement', w, h, 'basement');
  const main = blankFloor(1, 'Main Floor', w, h, 'dance');
  const mezz = blankFloor(2, 'Mezzanine', w, h, 'vip');

  // Basement: plant room, dressing rooms, beer store.
  room(under, 1, 1, 5, 4, 'machine');
  room(under, 7, 1, 7, 4, 'office');
  partition(under, 6, 1, 6, 4, [{ x: 6, y: 3 }]);
  room(under, 1, 6, 6, 3, 'loading');
  room(under, 8, 6, 6, 3, 'basement');
  partition(under, 1, 5, 13, 5, [{ x: 3, y: 5 }, { x: 11, y: 5 }]);
  partition(under, 7, 6, 7, 9, [{ x: 7, y: 7 }]);
  for (const p of [{ x: 3, y: 2 }, { x: 9, y: 2 }, { x: 12, y: 3 }, { x: 4, y: 7 }, { x: 10, y: 7 }]) {
    paint(under, p.x, p.y, 'cover');
  }
  label(under, 'plant', 'Plant Room', 1, 1, 5, 4);
  label(under, 'dress', 'Dressing', 7, 1, 7, 4);
  label(under, 'store', 'Beer Store', 1, 6, 6, 3);
  label(under, 'tunnel', 'Service', 8, 6, 6, 3);

  // Main floor: coat check by the gate, dance floor, stage, bar, loading bay.
  room(main, 1, 1, 3, 3, 'entry');
  room(main, 4, 1, 7, 6, 'dance');
  room(main, 11, 1, 3, 3, 'stage');
  partition(main, 11, 1, 11, 3, [{ x: 11, y: 2 }]);
  room(main, 11, 4, 3, 3, 'booth');
  partition(main, 11, 4, 11, 6, [{ x: 11, y: 5 }]);
  room(main, 1, 5, 3, 3, 'bar');
  for (let y = 5; y <= 7; y++) paint(main, 3, y, 'cover', 'bar');
  room(main, 1, 8, 4, 2, 'restroom');
  partition(main, 1, 8, 4, 8, [{ x: 2, y: 8 }]);
  room(main, 6, 8, 4, 2, 'office');
  partition(main, 6, 8, 9, 8, [{ x: 7, y: 8 }]);
  room(main, 11, 8, 3, 2, 'loading');
  partition(main, 11, 7, 13, 7, [{ x: 12, y: 7 }]);
  for (const p of [{ x: 6, y: 3 }, { x: 8, y: 3 }, { x: 6, y: 5 }, { x: 8, y: 5 }, { x: 12, y: 5 }]) {
    paint(main, p.x, p.y, 'cover');
  }
  if (rng() > 0.3) paint(main, 12, 2, 'cover', 'stage');
  label(main, 'coat', 'Coat Check', 1, 1, 3, 3);
  label(main, 'dance', 'Dance Floor', 4, 1, 7, 6);
  label(main, 'stage', 'Stage', 11, 1, 3, 3);
  label(main, 'green', 'Green Room', 11, 4, 3, 3);
  label(main, 'bar', 'Bar', 1, 5, 3, 3);
  label(main, 'wc', 'Restrooms', 1, 8, 4, 2);
  label(main, 'office', 'Office', 6, 8, 4, 2);
  label(main, 'load', 'Loading', 11, 8, 3, 2);

  // Mezzanine: VIP booths ringing an open void over the dance floor.
  room(mezz, 1, 1, 13, 2, 'vip');
  room(mezz, 1, 3, 3, 5, 'booth');
  room(mezz, 11, 3, 3, 5, 'booth');
  room(mezz, 4, 3, 7, 5, 'wall');
  for (let y = 3; y <= 7; y++) {
    for (let x = 4; x <= 10; x++) paint(mezz, x, y, 'wall', 'wall');
  }
  room(mezz, 1, 8, 13, 1, 'hall');
  for (const p of [{ x: 3, y: 1 }, { x: 7, y: 1 }, { x: 11, y: 1 }, { x: 2, y: 5 }, { x: 12, y: 5 }]) {
    paint(mezz, p.x, p.y, 'cover');
  }
  label(mezz, 'vip', 'VIP Rail', 1, 1, 13, 2);
  label(mezz, 'westbooth', 'Booths', 1, 3, 3, 5);
  label(mezz, 'eastbooth', 'Booths', 11, 3, 3, 5);
  label(mezz, 'void', 'Open to Below', 5, 5, 5, 1);
  label(mezz, 'walk', 'Walkway', 1, 8, 13, 1);

  linkStairs(under, main, 12, 8);
  linkStairs(main, mezz, 2, 3);

  paint(main, 0, 2, 'gate', 'entry');

  return {
    floors: [under, main, mezz],
    gate: { floor: 1, x: 0, y: 2 },
    copStart: [
      { floor: 1, x: 1, y: 2 },
      { floor: 1, x: 1, y: 1 },
      { floor: 1, x: 2, y: 2 },
    ],
    perpSpawns: [
      { floor: 1, x: 7, y: 4 },
      { floor: 1, x: 12, y: 5 },
      { floor: 2, x: 12, y: 5 },
      { floor: 2, x: 6, y: 1 },
      { floor: 0, x: 3, y: 2 },
      { floor: 0, x: 10, y: 7 },
    ],
  };
}

/** Shuttered factory: machine pit, assembly hall, catwalk offices. */
function buildFactory(rng: () => number): Building {
  const w = 15;
  const h = 11;
  const pit = blankFloor(0, 'Machine Pit', w, h, 'basement');
  const floorMain = blankFloor(1, 'Assembly', w, h, 'machine');
  const catwalk = blankFloor(2, 'Catwalk', w, h, 'office');

  // Pit: sumps, conveyor tunnel, spares.
  room(pit, 1, 1, 6, 4, 'basement');
  room(pit, 8, 1, 6, 4, 'machine');
  partition(pit, 7, 1, 7, 4, [{ x: 7, y: 2 }]);
  room(pit, 1, 6, 13, 3, 'loading');
  partition(pit, 1, 5, 13, 5, [{ x: 4, y: 5 }, { x: 11, y: 5 }]);
  for (const p of [{ x: 3, y: 2 }, { x: 5, y: 3 }, { x: 10, y: 2 }, { x: 12, y: 3 }, { x: 7, y: 7 }]) {
    paint(pit, p.x, p.y, 'cover');
  }
  label(pit, 'sump', 'Sump', 1, 1, 6, 4);
  label(pit, 'spares', 'Spares', 8, 1, 6, 4);
  label(pit, 'conveyor', 'Conveyor Run', 1, 6, 13, 3);

  // Assembly: gate at the guard door, machine rows, dock, cage.
  room(floorMain, 1, 1, 3, 3, 'entry');
  room(floorMain, 4, 1, 8, 6, 'machine');
  for (let i = 0; i < 5; i++) {
    const mx = 5 + (i % 3) * 2;
    const my = 2 + Math.floor(i / 3) * 2;
    room(floorMain, mx, my, 2, 1, 'machine', 'cover');
    if (rng() > 0.5) paint(floorMain, mx, my + 1, 'wall', 'wall');
  }
  room(floorMain, 12, 1, 2, 4, 'office');
  partition(floorMain, 12, 1, 12, 4, [{ x: 12, y: 2 }]);
  room(floorMain, 12, 5, 2, 3, 'loading');
  partition(floorMain, 12, 5, 12, 7, [{ x: 12, y: 6 }]);
  room(floorMain, 1, 5, 3, 5, 'court');
  partition(floorMain, 4, 5, 4, 9, [{ x: 4, y: 7 }]);
  room(floorMain, 5, 8, 7, 2, 'loading');
  for (const p of [{ x: 6, y: 5 }, { x: 9, y: 4 }, { x: 6, y: 9 }, { x: 2, y: 7 }]) {
    paint(floorMain, p.x, p.y, 'cover');
  }
  label(floorMain, 'gate', 'Guard Post', 1, 1, 3, 3);
  label(floorMain, 'asm', 'Assembly Floor', 4, 1, 8, 6);
  label(floorMain, 'office', 'Foreman', 12, 1, 2, 4);
  label(floorMain, 'cage', 'Parts Cage', 12, 5, 2, 3);
  label(floorMain, 'yard', 'Scrap Yard', 1, 5, 3, 5);
  label(floorMain, 'dock', 'Loading Dock', 5, 8, 7, 2);

  // Catwalk: gantry ring with offices at each end, open drop in the middle.
  room(catwalk, 1, 1, 13, 2, 'office');
  room(catwalk, 1, 3, 2, 5, 'hall');
  room(catwalk, 12, 3, 2, 5, 'hall');
  for (let y = 3; y <= 7; y++) {
    for (let x = 3; x <= 11; x++) paint(catwalk, x, y, 'wall', 'wall');
  }
  room(catwalk, 1, 8, 13, 1, 'unit');
  for (const p of [{ x: 4, y: 1 }, { x: 8, y: 1 }, { x: 11, y: 1 }, { x: 1, y: 5 }, { x: 13, y: 5 }]) {
    paint(catwalk, p.x, p.y, 'cover');
  }
  label(catwalk, 'crib', 'Tool Crib', 1, 1, 13, 2);
  label(catwalk, 'drop', 'Open Drop', 5, 5, 5, 1);
  label(catwalk, 'gantry', 'Gantry', 1, 8, 13, 1);

  linkStairs(pit, floorMain, 2, 7);
  linkStairs(floorMain, catwalk, 13, 6);

  paint(floorMain, 0, 2, 'gate', 'entry');

  return {
    floors: [pit, floorMain, catwalk],
    gate: { floor: 1, x: 0, y: 2 },
    copStart: [
      { floor: 1, x: 1, y: 2 },
      { floor: 1, x: 1, y: 1 },
      { floor: 1, x: 2, y: 2 },
    ],
    perpSpawns: [
      { floor: 1, x: 8, y: 3 },
      { floor: 1, x: 8, y: 9 },
      { floor: 2, x: 8, y: 1 },
      { floor: 2, x: 6, y: 8 },
      { floor: 0, x: 4, y: 2 },
      { floor: 0, x: 11, y: 2 },
    ],
  };
}

/** Housing walk-up: lobby and courtyard at street level, two residential floors above. */
function buildProjects(rng: () => number): Building {
  const w = 14;
  const h = 11;
  const lobby = blankFloor(0, 'Lobby', w, h, 'hall');
  const second = blankFloor(1, 'Floor 2', w, h, 'unit');
  const third = blankFloor(2, 'Floor 3', w, h, 'unit');

  // Lobby: gate, courtyard and mail room off a spine corridor, bins and rear court behind.
  room(lobby, 1, 1, 4, 3, 'entry');
  room(lobby, 5, 1, 4, 3, 'court');
  partition(lobby, 5, 1, 5, 3, [{ x: 5, y: 2 }]);
  room(lobby, 9, 1, 4, 3, 'office');
  partition(lobby, 9, 1, 9, 3, [{ x: 9, y: 2 }]);
  partition(lobby, 1, 4, 12, 4, [{ x: 2, y: 4 }, { x: 7, y: 4 }, { x: 11, y: 4 }]);
  room(lobby, 1, 5, 12, 2, 'hall');
  partition(lobby, 1, 7, 12, 7, [{ x: 3, y: 7 }, { x: 9, y: 7 }]);
  room(lobby, 1, 8, 5, 2, 'loading');
  room(lobby, 7, 8, 6, 2, 'court');
  partition(lobby, 6, 8, 6, 9);
  for (const p of [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 11, y: 2 }, { x: 3, y: 9 }, { x: 10, y: 9 }]) {
    paint(lobby, p.x, p.y, 'cover');
  }
  if (rng() > 0.4) paint(lobby, 8, 9, 'cover', 'court');
  label(lobby, 'lobby', 'Lobby', 1, 1, 4, 3);
  label(lobby, 'court', 'Courtyard', 5, 1, 4, 3);
  label(lobby, 'mail', 'Mail Room', 9, 1, 4, 3);
  label(lobby, 'hall', 'Corridor', 1, 5, 12, 2);
  label(lobby, 'bins', 'Bin Store', 1, 8, 5, 2);
  label(lobby, 'rear', 'Rear Court', 7, 8, 6, 2);

  // Residential floors: six apartments off a central corridor, each with one door.
  for (const level of [second, third]) {
    room(level, 1, 1, 12, 3, 'unit'); // north apartments
    room(level, 1, 5, 12, 2, 'hall'); // corridor
    room(level, 1, 8, 12, 2, 'unit'); // south apartments
    partition(level, 4, 1, 4, 3);
    partition(level, 9, 1, 9, 3);
    partition(level, 1, 4, 12, 4, [{ x: 2, y: 4 }, { x: 6, y: 4 }, { x: 11, y: 4 }]);
    partition(level, 1, 7, 12, 7, [{ x: 2, y: 7 }, { x: 6, y: 7 }, { x: 11, y: 7 }]);
    partition(level, 4, 8, 4, 9);
    partition(level, 9, 8, 9, 9);
    for (const p of [
      { x: 2, y: 2 },
      { x: 7, y: 2 },
      { x: 11, y: 2 },
      { x: 2, y: 9 },
      { x: 7, y: 9 },
      { x: 11, y: 9 },
    ]) {
      paint(level, p.x, p.y, 'cover');
    }
    const suffix = level.index === 1 ? '2' : '3';
    label(level, `a${suffix}`, `${suffix}A`, 1, 1, 3, 3);
    label(level, `b${suffix}`, `${suffix}B`, 5, 1, 4, 3);
    label(level, `c${suffix}`, `${suffix}C`, 10, 1, 3, 3);
    label(level, `h${suffix}`, 'Corridor', 1, 5, 12, 2);
    label(level, `d${suffix}`, `${suffix}D`, 1, 8, 3, 2);
    label(level, `e${suffix}`, `${suffix}E`, 5, 8, 4, 2);
    label(level, `f${suffix}`, `${suffix}F`, 10, 8, 3, 2);
  }

  linkStairs(lobby, second, 12, 5);
  linkStairs(second, third, 12, 5);

  paint(lobby, 0, 2, 'gate', 'entry');

  return {
    floors: [lobby, second, third],
    gate: { floor: 0, x: 0, y: 2 },
    copStart: [
      { floor: 0, x: 1, y: 2 },
      { floor: 0, x: 1, y: 1 },
      { floor: 0, x: 2, y: 2 },
    ],
    perpSpawns: [
      { floor: 1, x: 2, y: 2 },
      { floor: 1, x: 7, y: 9 },
      { floor: 2, x: 11, y: 2 },
      { floor: 2, x: 3, y: 9 },
      { floor: 0, x: 7, y: 2 },
      { floor: 0, x: 10, y: 8 },
    ],
  };
}

function buildVenue(kind: LandmarkKind, rng: () => number): Building {
  if (kind === 'bar') return buildBar(rng);
  if (kind === 'club') return buildClub(rng);
  if (kind === 'factory') return buildFactory(rng);
  return buildProjects(rng);
}

/** Zone colors for the floor-map UI. */
export const FLOOR_ZONE_COLORS: Record<FloorZone, string> = {
  hall: '#2a2140',
  bar: '#4a3728',
  booth: '#3b2f4a',
  kitchen: '#3f3a2e',
  restroom: '#2c3340',
  stage: '#4a2860',
  dance: '#35204a',
  vip: '#5c2a4a',
  loading: '#3a3a32',
  machine: '#3a4038',
  office: '#2e3d4a',
  unit: '#403530',
  stair: '#4b4a6b',
  court: '#2a3a30',
  basement: '#1f2430',
  alley: '#2a2a2a',
  entry: '#1e3a44',
  wall: '#52525b',
};

// ---------------------------------------------------------------------------
// Grid queries
// ---------------------------------------------------------------------------

function walkable(kind: CellKind) {
  return kind === 'floor' || kind === 'cover' || kind === 'gate' || kind === 'stair';
}

export function floorOf(game: LocationTacticsGame, index: number): BuildingFloor {
  return game.floors.find((f) => f.index === index) ?? game.floors[0];
}

function cellAt(game: LocationTacticsGame, floor: number, x: number, y: number): GridCell | null {
  return cellOn(floorOf(game, floor), x, y);
}

function sameFloor(a: { floor: number }, b: { floor: number }) {
  return a.floor === b.floor;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function neighbors(x: number, y: number) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
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

function occupied(game: LocationTacticsGame, floor: number, x: number, y: number, ignoreId?: string) {
  return game.units.some(
    (u) => u.id !== ignoreId && u.status === 'active' && u.floor === floor && u.x === x && u.y === y
  );
}

function hasLos(game: LocationTacticsGame, floor: number, from: { x: number; y: number }, to: { x: number; y: number }) {
  let x = from.x;
  let y = from.y;
  const dx = Math.sign(to.x - x);
  const dy = Math.sign(to.y - y);
  const steps = Math.abs(to.x - x) + Math.abs(to.y - y);
  for (let i = 0; i < steps; i++) {
    if (Math.abs(to.x - x) >= Math.abs(to.y - y)) x += dx;
    else y += dy;
    if (x === to.x && y === to.y) return true;
    const c = cellAt(game, floor, x, y);
    if (!c || c.kind === 'wall') return false;
  }
  return true;
}

/** Walk cost from a unit to every tile it could reach on its floor, respecting walls. */
function stepCosts(
  game: LocationTacticsGame,
  unit: TacticsUnit,
  limit: number
): Map<string, number> {
  const costs = new Map<string, number>([[`${unit.x},${unit.y}`, 0]]);
  let frontier = [{ x: unit.x, y: unit.y }];
  for (let step = 1; step <= limit; step++) {
    const next: Array<{ x: number; y: number }> = [];
    for (const cur of frontier) {
      for (const n of neighbors(cur.x, cur.y)) {
        const key = `${n.x},${n.y}`;
        if (costs.has(key)) continue;
        const cell = cellAt(game, unit.floor, n.x, n.y);
        if (!cell || !walkable(cell.kind)) continue;
        if (occupied(game, unit.floor, n.x, n.y, unit.id)) continue;
        costs.set(key, step);
        next.push(n);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return costs;
}

/**
 * Steps from every tile in the building to the nearest source, walking through stairs.
 * Suspects use this to break for the front gate, or to close on officers on another floor.
 */
function distanceField(
  game: LocationTacticsGame,
  sources: Array<{ floor: number; x: number; y: number }>
): Map<string, number> {
  const key = (f: number, x: number, y: number) => `${f}:${x},${y}`;
  const field = new Map<string, number>();
  let frontier: Array<{ floor: number; x: number; y: number }> = [];
  for (const src of sources) {
    const k = key(src.floor, src.x, src.y);
    if (field.has(k)) continue;
    field.set(k, 0);
    frontier.push({ floor: src.floor, x: src.x, y: src.y });
  }
  let step = 0;

  while (frontier.length) {
    step += 1;
    const next: Array<{ floor: number; x: number; y: number }> = [];
    for (const cur of frontier) {
      const cell = cellAt(game, cur.floor, cur.x, cur.y);
      const options = neighbors(cur.x, cur.y).map((n) => ({ floor: cur.floor, x: n.x, y: n.y }));
      for (const link of cell?.links ?? []) options.push({ ...link });
      for (const opt of options) {
        const k = key(opt.floor, opt.x, opt.y);
        if (field.has(k)) continue;
        const target = cellAt(game, opt.floor, opt.x, opt.y);
        if (!target || !walkable(target.kind)) continue;
        field.set(k, step);
        next.push(opt);
      }
    }
    frontier = next;
  }
  return field;
}

function stepsTo(field: Map<string, number>, floor: number, x: number, y: number): number {
  return field.get(`${floor}:${x},${y}`) ?? Infinity;
}

function roomNameAt(game: LocationTacticsGame, floor: number, x: number, y: number): string {
  const plan = floorOf(game, floor);
  const hit = plan.labels.find(
    (l) => x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h
  );
  return hit?.name ?? plan.name;
}

// ---------------------------------------------------------------------------
// Logging, fog, radio
// ---------------------------------------------------------------------------

function pushLog(game: LocationTacticsGame, text: string, tone: TacticsLogEntry['tone'] = 'info') {
  game.log = [...game.log.slice(-18), { turn: game.turn, text, tone }];
}

function revealAround(game: LocationTacticsGame, floor: number, x: number, y: number, r = 1) {
  const plan = floorOf(game, floor);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny >= 0 && ny < plan.height && nx >= 0 && nx < plan.width) {
        game.revealed[floor][ny][nx] = true;
      }
    }
  }
}

function refreshSpotting(game: LocationTacticsGame) {
  for (const p of livingPerps(game)) {
    if (game.mode === 'gunfight') {
      // Gunfights are loud: anyone sharing a floor with an officer is visible.
      p.spotted = livingCops(game).some((c) => sameFloor(c, p));
      continue;
    }
    p.spotted = livingCops(game).some(
      (c) => sameFloor(c, p) && dist(c, p) <= (game.mode === 'hide' ? 3 : 5) && hasLos(game, p.floor, c, p)
    );
  }
}

/** Periodic dispatch call-out — approximate, and sometimes names the wrong room. */
function radioCall(game: LocationTacticsGame, rng: () => number) {
  const loose = livingPerps(game);
  if (!loose.length) return;
  const target = pick(rng, loose);
  const plan = floorOf(game, target.floor);
  const trueRoom = roomNameAt(game, target.floor, target.x, target.y);
  // Dispatch is usually right about the floor, less reliably right about the room.
  const wrongRooms = plan.labels.map((l) => l.name).filter((n) => n !== trueRoom);
  const accurate = rng() > (game.mode === 'hide' ? 0.2 : 0.3) || !wrongRooms.length;
  const room = accurate ? trueRoom : pick(rng, wrongRooms);
  const headcount = loose.length > 1 && rng() > 0.6 ? ` — maybe ${loose.length} of them` : '';
  game.radio = `${plan.name}: movement near ${room || plan.name}${headcount}`;
  pushLog(game, `Radio — ${game.radio}`, 'radio');
  game.nextRadioTurn = game.turn + (game.mode === 'hide' ? 1 : 2) + Math.floor(rng() * 2);
}

// ---------------------------------------------------------------------------
// Shooting
// ---------------------------------------------------------------------------

function hitChanceAgainst(target: TacticsUnit): number {
  if (target.hunkered) return HUNKERED_HIT_CHANCE;
  if (target.inCover) return COVER_HIT_CHANCE;
  return OPEN_HIT_CHANCE;
}

function addTracer(game: LocationTacticsGame, shooter: TacticsUnit, target: TacticsUnit, hit: boolean) {
  game.tracers = [
    ...game.tracers.slice(-5),
    {
      id: `t-${Math.random().toString(36).slice(2, 8)}`,
      floor: shooter.floor,
      fromX: shooter.x,
      fromY: shooter.y,
      toX: target.x,
      toY: target.y,
      side: shooter.side,
      hit,
      life: 1,
    },
  ];
}

/**
 * Resolve one shot. Cover never breaks, but it never fully protects either — a fixed slice of
 * rounds still land. Anyone caught in the open goes down on the first hit.
 */
function resolveShot(game: LocationTacticsGame, shooter: TacticsUnit, target: TacticsUnit) {
  game.shotsFired += 1;
  const chance = hitChanceAgainst(target);
  const hit = Math.random() < chance;
  addTracer(game, shooter, target, hit);

  if (!hit) {
    pushLog(
      game,
      `${shooter.name} fires — ${target.inCover ? 'round buries in cover' : 'miss'}.`,
      shooter.side === 'cop' ? 'warn' : 'info'
    );
    return;
  }

  const exposed = !target.inCover && !target.hunkered;
  const damage = exposed ? target.lives : 1;
  target.lives = Math.max(0, target.lives - damage);

  if (target.lives <= 0) {
    if (target.side === 'cop') {
      target.status = 'down';
      target.moves = 0;
      pushLog(
        game,
        exposed ? `${target.name} caught in the open — down!` : `${target.name} is down.`,
        'bad'
      );
    } else {
      target.status = 'caught';
      pushLog(game, `${target.name} is down and cuffed.`, 'good');
    }
    return;
  }

  pushLog(
    game,
    `${target.name} hit through cover (${target.lives} ${target.lives === 1 ? 'life' : 'lives'} left).`,
    target.side === 'cop' ? 'bad' : 'good'
  );
}

function officerCanShoot(game: LocationTacticsGame, officer: TacticsUnit): boolean {
  if (officer.status !== 'active' || officer.moves <= 0) return false;
  return game.mode === 'gunfight' ? game.squadAmmo > 0 : officer.shots > 0;
}

function spendOfficerShot(game: LocationTacticsGame, officer: TacticsUnit) {
  officer.moves -= 1;
  if (game.mode === 'gunfight') game.squadAmmo = Math.max(0, game.squadAmmo - 1);
  else officer.shots = Math.max(0, officer.shots - 1);
}

// ---------------------------------------------------------------------------
// Suspect turn
// ---------------------------------------------------------------------------

function stepToward(
  game: LocationTacticsGame,
  unit: TacticsUnit,
  score: (floor: number, x: number, y: number) => number
): boolean {
  const here = cellAt(game, unit.floor, unit.x, unit.y);
  const options: Array<{ floor: number; x: number; y: number }> = neighbors(unit.x, unit.y).map((n) => ({
    floor: unit.floor,
    x: n.x,
    y: n.y,
  }));
  for (const link of here?.links ?? []) options.push({ ...link });

  const legal = options.filter((o) => {
    const cell = cellAt(game, o.floor, o.x, o.y);
    return cell && walkable(cell.kind) && !occupied(game, o.floor, o.x, o.y, unit.id);
  });
  if (!legal.length) return false;

  legal.sort((a, b) => score(a.floor, a.x, a.y) - score(b.floor, b.x, b.y));
  const best = legal[0];
  if (score(best.floor, best.x, best.y) >= score(unit.floor, unit.x, unit.y)) return false;

  unit.floor = best.floor;
  unit.x = best.x;
  unit.y = best.y;
  unit.inCover = cellAt(game, best.floor, best.x, best.y)?.kind === 'cover';
  return true;
}

function runForGate(
  game: LocationTacticsGame,
  perp: TacticsUnit,
  field: Map<string, number>,
  steps: number,
  notes: string[]
) {
  for (let s = 0; s < steps; s++) {
    const beforeFloor = perp.floor;
    const moved = stepToward(game, perp, (f, x, y) => stepsTo(field, f, x, y));
    if (!moved) break;
    if (perp.floor !== beforeFloor) {
      notes.push(`${perp.name} took the stairs to ${floorOf(game, perp.floor).name}`);
    }
    if (perp.floor === game.gate.floor && perp.x === game.gate.x && perp.y === game.gate.y) {
      perp.status = 'escaped';
      game.gateEscapes += 1;
      notes.push(`${perp.name} slipped out the front gate`);
      pushLog(game, `${perp.name} is out the front gate!`, 'bad');
      return;
    }
  }
}

function hideFromCops(game: LocationTacticsGame, perp: TacticsUnit, notes: string[]) {
  const hunters = livingCops(game).filter((c) => sameFloor(c, perp));
  if (!hunters.length) return;
  const nearest = hunters.slice().sort((a, b) => dist(perp, a) - dist(perp, b))[0];
  if (dist(perp, nearest) > 3) return;
  const moved = stepToward(game, perp, (f, x, y) =>
    f === nearest.floor ? -dist({ x, y }, nearest) : -12
  );
  if (moved) notes.push(`${perp.name} broke away from ${nearest.name}`);
}

function suspectGunplay(
  game: LocationTacticsGame,
  perp: TacticsUnit,
  field: Map<string, number>,
  notes: string[]
) {
  // Out of rounds: stop fighting and make a break for the door.
  if (perp.shots <= 0) {
    runForGate(game, perp, field, 2, notes);
    return;
  }

  const targets = livingCops(game).filter(
    (c) => sameFloor(c, perp) && dist(c, perp) <= SHOT_RANGE && hasLos(game, perp.floor, perp, c)
  );

  // No angle: work toward the officers, preferring cover, and take stairs to reach their floor.
  if (!targets.length) {
    const hunt = distanceField(game, livingCops(game));
    const advance = (f: number, x: number, y: number) =>
      stepsTo(hunt, f, x, y) - (cellAt(game, f, x, y)?.kind === 'cover' ? 0.5 : 0);
    const sharesFloor = livingCops(game).some((c) => sameFloor(c, perp));
    const steps = sharesFloor ? 1 : 2;
    for (let s = 0; s < steps; s++) {
      if (!stepToward(game, perp, advance)) break;
      if (s === 0) notes.push(`${perp.name} is working toward the officers`);
    }
    return;
  }

  const target = targets.sort((a, b) => dist(perp, a) - dist(perp, b))[0];
  const wantsCover = !perp.inCover && perp.lives <= 1 && Math.random() < 0.6;
  if (wantsCover) {
    const covers = floorOf(game, perp.floor).cells.filter((c) => c.kind === 'cover');
    const near = covers.slice().sort((a, b) => dist(perp, a) - dist(perp, b))[0];
    if (near && stepToward(game, perp, (f, x, y) => (f === perp.floor ? dist({ x, y }, near) : 20))) {
      notes.push(`${perp.name} ducked into cover`);
      return;
    }
  }

  perp.shots -= 1;
  notes.push(`${perp.name} fired at ${target.name}`);
  resolveShot(game, perp, target);
}

/** An armed runner who is cornered may turn and fire instead of running. */
function suspectSnapShot(game: LocationTacticsGame, perp: TacticsUnit, notes: string[]): boolean {
  if (!perp.armed || perp.shots <= 0) return false;
  const close = livingCops(game)
    .filter((c) => sameFloor(c, perp) && dist(c, perp) <= 4 && hasLos(game, perp.floor, perp, c))
    .sort((a, b) => dist(perp, a) - dist(perp, b))[0];
  if (!close || Math.random() > 0.45) return false;
  perp.shots -= 1;
  notes.push(`${perp.name} turned and fired on ${close.name}`);
  resolveShot(game, perp, close);
  return true;
}

function runSuspectTurn(game: LocationTacticsGame, rng: () => number) {
  const notes: string[] = [];
  const quiet: string[] = [];
  const field = distanceField(game, [game.gate]);

  for (const perp of livingPerps(game)) {
    perp.hunkered = false;
    const before = { floor: perp.floor, x: perp.x, y: perp.y };

    if (game.mode === 'gunfight') {
      suspectGunplay(game, perp, field, notes);
      continue;
    }
    if (suspectSnapShot(game, perp, notes)) continue;

    if (game.mode === 'hide') {
      const late = game.turn > game.maxTurns - 4;
      const flushed = livingCops(game).some((c) => sameFloor(c, perp) && dist(c, perp) <= 2);
      if (late || flushed) runForGate(game, perp, field, flushed ? 2 : 1, notes);
      else hideFromCops(game, perp, notes);
    } else {
      runForGate(game, perp, field, rng() < 0.4 ? 3 : 2, notes);
    }

    if (perp.status !== 'active') continue;
    const moved = perp.floor !== before.floor || perp.x !== before.x || perp.y !== before.y;
    if (!moved) continue;
    const room = roomNameAt(game, perp.floor, perp.x, perp.y);
    const floorName = floorOf(game, perp.floor).name;
    const where = room === floorName ? floorName : `${room}, ${floorName}`;
    if (perp.spotted) notes.push(`${perp.name} is moving through ${where}`);
    else quiet.push(where);
  }

  const recap = notes.slice(0, 3);
  if (quiet.length) {
    const spots = Array.from(new Set(quiet)).slice(0, 2).join(' · ');
    recap.push(`Movement heard: ${spots}`);
  }
  game.lastSuspectMoves = recap.length ? recap : ['Suspects held still — nothing on the radio'];
}

// ---------------------------------------------------------------------------
// Turn flow
// ---------------------------------------------------------------------------

function grabAdjacent(game: LocationTacticsGame) {
  for (const c of livingCops(game)) {
    for (const p of livingPerps(game)) {
      if (!sameFloor(c, p)) continue;
      const gap = dist(c, p);
      if (gap === 0) {
        p.status = 'caught';
        pushLog(game, `${c.name} tackles ${p.name}.`, 'good');
        continue;
      }
      // Rushing a suspect who is still shooting is suicide; rushing a dry one is not.
      const rushable =
        game.mode !== 'gunfight' || p.shots <= 0 || game.squadAmmo <= 0;
      if (gap === 1 && p.spotted && rushable) {
        if (Math.random() < (game.mode === 'gunfight' ? 0.6 : 0.72)) {
          p.status = 'caught';
          pushLog(game, `${c.name} cuffs ${p.name}.`, 'good');
        } else {
          pushLog(game, `${p.name} twists out of ${c.name}'s grip.`, 'warn');
        }
      }
    }
  }
}

function buildStats(game: LocationTacticsGame, result: TacticsResult): LocationTacticsStats {
  const police = cops(game);
  const perps = game.units.filter((u) => u.side === 'perp');
  const shotsLeft =
    game.mode === 'gunfight'
      ? game.squadAmmo
      : police.reduce((sum, u) => sum + u.shots, 0);
  return {
    landmarkId: game.landmarkId,
    landmarkName: game.landmarkName,
    landmarkKind: game.landmarkKind,
    dayKey: game.dayKey,
    scenarioTitle: game.scenarioTitle,
    scenarioMode: game.mode,
    turnsUsed: result.turnsUsed,
    totalPolice: police.length,
    policeHurt: police.filter((u) => u.status === 'down' || u.lives < u.maxLives).length,
    policeUsed: police.length,
    totalPerps: result.totalPerps,
    armedPerps: perps.filter((p) => p.armed).length,
    caught: result.caught,
    escaped: result.escaped,
    unknownRoomsScouted: game.revealed.reduce(
      (sum, plan) => sum + plan.reduce((rows, row) => rows + row.filter(Boolean).length, 0),
      0
    ),
    outcome: result.outcome,
    operationalScore: result.score,
    decisions: game.decisions,
    floors: game.floors.length,
    shotsFired: game.shotsFired,
    shotsLeft,
    officersDown: police.filter((u) => u.status === 'down').length,
    gateEscapes: game.gateEscapes,
  };
}

function finalize(game: LocationTacticsGame): LocationTacticsGame {
  for (const p of livingPerps(game)) p.status = 'escaped';
  const perps = game.units.filter((u) => u.side === 'perp');
  const caught = perps.filter((p) => p.status === 'caught').length;
  const total = perps.length;
  const down = cops(game).filter((u) => u.status === 'down').length;

  let outcome: TacticsResult['outcome'] = 'escaped';
  let score = Math.round((caught / Math.max(total, 1)) * 100) - down * 12;
  let message = 'Suspects broke out the front gate.';
  if (caught === total) {
    outcome = 'total_win';
    score = Math.max(score, 88);
    message = 'Building cleared — every suspect accounted for.';
  } else if (caught > 0) {
    outcome = 'partial_win';
    score = Math.max(35, score);
    message = 'Partial hold — some made the street.';
  } else {
    score = Math.max(0, score);
  }

  const result: TacticsResult = {
    outcome,
    caught,
    escaped: total - caught,
    totalPerps: total,
    officersHurt: cops(game).filter((u) => u.status === 'down' || u.lives < u.maxLives).length,
    turnsUsed: game.turn,
    score: Math.min(100, Math.max(0, score)),
    message,
  };

  return {
    ...game,
    phase: 'completed',
    tracers: [],
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

function movesForMode(mode: ScenarioMode): number {
  if (mode === 'chase') return 4;
  // Hide is a two-officer search of three floors — they need the legs.
  if (mode === 'hide') return 4;
  return 3;
}

function startOfficerTurn(game: LocationTacticsGame) {
  game.turnPhase = 'officers';
  for (const c of livingCops(game)) {
    c.moves = c.maxMoves;
    c.hunkered = false;
    c.inCover = cellAt(game, c.floor, c.x, c.y)?.kind === 'cover';
  }
  const ready = livingCops(game)[0];
  if (ready && !livingCops(game).some((c) => c.id === game.selectedUnitId)) {
    game.selectedUnitId = ready.id;
    game.viewFloor = ready.floor;
  }
}

/** Officers are done: suspects act, then a fresh officer turn begins. */
function runSuspectPhase(game: LocationTacticsGame): LocationTacticsGame {
  grabAdjacent(game);
  let g = checkEnd(game);
  if (g.phase === 'completed') return g;

  g.turnPhase = 'suspects';
  const rng = makeRng(hashSeed(`${g.id}|${g.turn}`) ^ Math.floor(Math.random() * 1e6));
  runSuspectTurn(g, rng);
  grabAdjacent(g);
  refreshSpotting(g);

  g = checkEnd(g);
  if (g.phase === 'completed') return g;

  g.turn += 1;
  if (g.turn > g.maxTurns) return finalize(g);
  if (g.turn >= g.nextRadioTurn) radioCall(g, rng);
  startOfficerTurn(g);
  return checkEnd(g);
}

function officersSpent(game: LocationTacticsGame): boolean {
  const active = livingCops(game);
  return active.length > 0 && active.every((c) => c.moves <= 0);
}

function afterOfficerAction(game: LocationTacticsGame): LocationTacticsGame {
  refreshSpotting(game);
  grabAdjacent(game);
  const g = checkEnd(game);
  if (g.phase === 'completed') return g;
  if (officersSpent(g)) return runSuspectPhase(g);
  // Hand the player their next officer with moves left.
  const selected = g.units.find((u) => u.id === g.selectedUnitId);
  if (!selected || selected.status !== 'active' || selected.moves <= 0) {
    const next = livingCops(g).find((c) => c.moves > 0);
    if (next) {
      g.selectedUnitId = next.id;
      g.viewFloor = next.floor;
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function pickMode(rng: () => number, kind: LandmarkKind): ScenarioMode {
  const table: ScenarioMode[] =
    kind === 'bar' || kind === 'club'
      ? ['gunfight', 'chase', 'hide', 'gunfight', 'chase']
      : kind === 'factory'
      ? ['chase', 'gunfight', 'hide', 'chase']
      : ['hide', 'chase', 'gunfight', 'hide'];
  return pick(rng, table);
}

/** Take one spawn per floor before doubling up, so a raid always means clearing upstairs too. */
function spreadSpawns(
  spawns: Array<{ floor: number; x: number; y: number }>,
  count: number,
  rng: () => number
): Array<{ floor: number; x: number; y: number }> {
  const pool = spawns.slice().sort(() => rng() - 0.5);
  const chosen: Array<{ floor: number; x: number; y: number }> = [];
  const usedFloors = new Set<number>();
  while (chosen.length < count && pool.length) {
    let idx = pool.findIndex((s) => !usedFloors.has(s.floor));
    if (idx < 0) {
      idx = 0;
      usedFloors.clear();
    }
    const [spot] = pool.splice(idx, 1);
    usedFloors.add(spot.floor);
    chosen.push(spot);
  }
  return chosen;
}

export function startLocationTactics(landmark: MapLandmark, now = new Date()): LocationTacticsGame {
  const key = dayKey(now);
  const rng = makeRng(hashSeed(`${key}|${landmark.id}|${landmark.kind}|floors-v1`));
  const mode = pickMode(rng, landmark.kind);
  const meta = MODE_META[mode];
  const building = buildVenue(landmark.kind, rng);

  // Hide needs two: one to flush the floors, one to sit on the gate.
  const copCount = mode === 'hide' ? 2 : 3;
  const perpCount = mode === 'hide' ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 2);
  const maxMoves = movesForMode(mode);

  const units: TacticsUnit[] = [];
  building.copStart.slice(0, copCount).forEach((spot, i) => {
    units.push({
      id: uid('cop', rng),
      side: 'cop',
      name: `Ofc. ${COP_NAMES[i % COP_NAMES.length]}`,
      floor: spot.floor,
      x: spot.x,
      y: spot.y,
      lives: 2,
      maxLives: 2,
      status: 'active',
      spotted: true,
      moves: maxMoves,
      maxMoves,
      shots: OFFICER_SHOTS,
      inCover: false,
      hunkered: false,
      armed: true,
    });
  });

  const spawnOrder = spreadSpawns(building.perpSpawns, perpCount, rng);
  spawnOrder.forEach((spot, i) => {
    const armed = mode === 'gunfight' || rng() > 0.6;
    units.push({
      id: uid('perp', rng),
      side: 'perp',
      name: PERP_NAMES[i % PERP_NAMES.length],
      floor: spot.floor,
      x: spot.x,
      y: spot.y,
      // One life: a landed round ends a suspect, which is what makes two shots enough.
      lives: 1,
      maxLives: 1,
      status: 'active',
      spotted: false,
      moves: 0,
      maxMoves: 0,
      shots: armed ? (mode === 'gunfight' ? 6 : 2) : 0,
      inCover: false,
      hunkered: false,
      armed,
    });
  });

  const revealed = building.floors.map((plan) =>
    Array.from({ length: plan.height }, () => Array<boolean>(plan.width).fill(mode === 'gunfight'))
  );

  const game: LocationTacticsGame = {
    id: uid('tactics', rng),
    landmarkId: landmark.id,
    landmarkName: landmark.name,
    landmarkKind: landmark.kind,
    dayKey: key,
    scenarioTitle: `${meta.title} · ${landmark.name}`,
    briefing: meta.tip,
    mode,
    phase: 'briefing',
    turnPhase: 'officers',
    turn: 1,
    maxTurns: mode === 'hide' ? 14 : 12 + Math.floor(rng() * 3),
    floors: building.floors,
    viewFloor: building.gate.floor,
    gate: building.gate,
    units,
    tracers: [],
    revealed,
    selectedUnitId: units[0]?.id,
    squadAmmo: mode === 'gunfight' ? GUNFIGHT_AMMO : 0,
    maxSquadAmmo: mode === 'gunfight' ? GUNFIGHT_AMMO : 0,
    shotsFired: 0,
    gateEscapes: 0,
    radio: null,
    nextRadioTurn: 2,
    lastSuspectMoves: [],
    log: [{ turn: 1, text: meta.tip, tone: 'info' }],
    decisions: [],
  };

  for (const c of units.filter((u) => u.side === 'cop')) {
    revealAround(game, c.floor, c.x, c.y, 2);
  }
  refreshSpotting(game);
  return game;
}

export function beginTacticsRaid(game: LocationTacticsGame): LocationTacticsGame {
  if (game.phase !== 'briefing') return game;
  const g = cloneGame(game);
  g.phase = 'active';
  g.decisions.push(`Entered ${g.landmarkKind} — ${g.mode}, ${g.floors.length} floors`);
  refreshSpotting(g);
  return g;
}

export function selectTacticsOfficer(game: LocationTacticsGame, officerId: string): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const unit = game.units.find((u) => u.id === officerId && u.side === 'cop' && u.status === 'active');
  if (!unit) return game;
  return { ...game, selectedUnitId: officerId, viewFloor: unit.floor };
}

export function setViewFloor(game: LocationTacticsGame, floor: number): LocationTacticsGame {
  if (!game.floors.some((f) => f.index === floor)) return game;
  return { ...game, viewFloor: floor };
}

export function reachableCells(
  game: LocationTacticsGame,
  unitId: string
): Array<{ x: number; y: number; cost: number }> {
  const unit = game.units.find((u) => u.id === unitId && u.status === 'active');
  if (!unit || unit.moves <= 0 || game.phase !== 'active') return [];
  if (unit.floor !== game.viewFloor) return [];
  const costs = stepCosts(game, unit, unit.moves);
  const out: Array<{ x: number; y: number; cost: number }> = [];
  costs.forEach((cost, key) => {
    if (cost === 0) return;
    const [x, y] = key.split(',').map(Number);
    out.push({ x, y, cost });
  });
  return out;
}

export function shootTargets(game: LocationTacticsGame, unitId: string): TacticsUnit[] {
  const unit = game.units.find((u) => u.id === unitId && u.side === 'cop' && u.status === 'active');
  if (!unit || game.phase !== 'active' || !officerCanShoot(game, unit)) return [];
  return livingPerps(game).filter(
    (p) =>
      sameFloor(p, unit) &&
      p.spotted &&
      dist(unit, p) <= SHOT_RANGE &&
      hasLos(game, unit.floor, unit, p)
  );
}

/** Primary interaction: tap a tile on the shown floor. */
export function tacticsInteractCell(
  game: LocationTacticsGame,
  x: number,
  y: number
): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  const officer = g.units.find((u) => u.id === g.selectedUnitId && u.side === 'cop' && u.status === 'active');
  if (!officer) {
    pushLog(g, 'Pick an officer first.', 'warn');
    return g;
  }
  if (officer.floor !== g.viewFloor) {
    pushLog(g, `${officer.name} is on ${floorOf(g, officer.floor).name}.`, 'warn');
    return g;
  }
  if (officer.moves <= 0) {
    pushLog(g, `${officer.name} is out of moves.`, 'warn');
    return g;
  }

  // Tap a visible suspect in range to spend a shot.
  const perp = livingPerps(g).find((p) => p.floor === g.viewFloor && p.x === x && p.y === y && p.spotted);
  if (perp) {
    if (!officerCanShoot(g, officer)) {
      pushLog(g, g.mode === 'gunfight' ? 'Squad is out of rounds.' : 'No shots left.', 'warn');
      return g;
    }
    if (dist(officer, perp) > SHOT_RANGE || !hasLos(g, officer.floor, officer, perp)) {
      pushLog(g, 'No clean angle.', 'warn');
      return g;
    }
    spendOfficerShot(g, officer);
    g.decisions.push(`${officer.name} shot at ${perp.name}`);
    resolveShot(g, officer, perp);
    return afterOfficerAction(g);
  }

  const cell = cellAt(g, g.viewFloor, x, y);
  if (!cell || !walkable(cell.kind)) {
    pushLog(g, 'Wall.', 'warn');
    return g;
  }

  // Standing still: take the stairs, or search the room in hide mode.
  if (officer.x === x && officer.y === y) {
    const links = cell.links ?? [];
    if (links.length === 1) return tacticsUseStairs(g, links[0].floor);
    if (links.length > 1) {
      pushLog(g, 'Stairs run both ways — pick a floor.', 'warn');
      return g;
    }
    if (g.mode === 'hide') {
      officer.moves -= 1;
      revealAround(g, officer.floor, x, y, 2);
      g.decisions.push(`Searched ${roomNameAt(g, officer.floor, x, y)}`);
      pushLog(g, `${officer.name} searches ${roomNameAt(g, officer.floor, x, y)}.`, 'info');
      return afterOfficerAction(g);
    }
    return g;
  }

  const costs = stepCosts(g, officer, officer.moves);
  const cost = costs.get(`${x},${y}`);
  if (cost === undefined) {
    pushLog(g, 'No path within remaining moves.', 'warn');
    return g;
  }

  officer.x = x;
  officer.y = y;
  officer.moves -= cost;
  officer.inCover = cell.kind === 'cover';
  officer.hunkered = false;
  revealAround(g, officer.floor, x, y, g.mode === 'hide' ? 2 : 2);
  g.decisions.push(`${officer.name} moved into ${roomNameAt(g, officer.floor, x, y)}`);
  return afterOfficerAction(g);
}

/** Floors the selected officer can step to from the stairs they are standing on. */
export function stairOptions(game: LocationTacticsGame): Array<{ floor: number; name: string }> {
  const officer = game.units.find(
    (u) => u.id === game.selectedUnitId && u.side === 'cop' && u.status === 'active'
  );
  if (!officer || game.phase !== 'active' || officer.moves <= 0) return [];
  const cell = cellAt(game, officer.floor, officer.x, officer.y);
  return (cell?.links ?? []).map((link) => ({ floor: link.floor, name: floorOf(game, link.floor).name }));
}

/** Move the selected officer up or down the stairs they are standing on. */
export function tacticsUseStairs(game: LocationTacticsGame, floor: number): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  const officer = g.units.find((u) => u.id === g.selectedUnitId && u.side === 'cop' && u.status === 'active');
  if (!officer || officer.moves <= 0) return g;
  const to = cellAt(g, officer.floor, officer.x, officer.y)?.links?.find((l) => l.floor === floor);
  if (!to) {
    pushLog(g, 'No stairs here.', 'warn');
    return g;
  }

  officer.floor = to.floor;
  officer.x = to.x;
  officer.y = to.y;
  officer.moves -= 1;
  officer.inCover = cellAt(g, to.floor, to.x, to.y)?.kind === 'cover';
  officer.hunkered = false;
  g.viewFloor = to.floor;
  revealAround(g, to.floor, to.x, to.y, 2);
  g.decisions.push(`${officer.name} took stairs to ${floorOf(g, to.floor).name}`);
  pushLog(g, `${officer.name} moves to ${floorOf(g, to.floor).name}.`, 'info');
  return afterOfficerAction(g);
}

/** Spend the rest of an officer's turn getting behind cover. */
export function tacticsTakeCover(game: LocationTacticsGame): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  const officer = g.units.find((u) => u.id === g.selectedUnitId && u.side === 'cop' && u.status === 'active');
  if (!officer || officer.moves <= 0) return g;

  if (officer.inCover) {
    officer.hunkered = true;
    officer.moves = 0;
    g.decisions.push(`${officer.name} hunkered down`);
    pushLog(g, `${officer.name} hunkers behind cover.`, 'info');
    return afterOfficerAction(g);
  }

  const costs = stepCosts(g, officer, officer.moves);
  let best: { x: number; y: number; cost: number } | null = null;
  costs.forEach((cost, key) => {
    if (cost === 0) return;
    const [x, y] = key.split(',').map(Number);
    if (cellAt(g, officer.floor, x, y)?.kind !== 'cover') return;
    if (!best || cost < best.cost) best = { x, y, cost };
  });

  if (!best) {
    pushLog(g, 'No cover in reach.', 'warn');
    return g;
  }

  const spot = best as { x: number; y: number; cost: number };
  officer.x = spot.x;
  officer.y = spot.y;
  officer.moves = Math.max(0, officer.moves - spot.cost);
  officer.inCover = true;
  officer.hunkered = officer.moves === 0;
  revealAround(g, officer.floor, spot.x, spot.y, 2);
  g.decisions.push(`${officer.name} took cover`);
  pushLog(g, `${officer.name} slides into cover.`, 'info');
  return afterOfficerAction(g);
}

/** End the officer turn early and let the suspects move. */
export function tacticsWait(game: LocationTacticsGame): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  g.decisions.push('Held position — passed the turn');
  pushLog(g, 'Stack holds. Suspects move.', 'warn');
  for (const c of livingCops(g)) c.moves = 0;
  return runSuspectPhase(g);
}

/** Fade shot tracers (call from the UI animation tick). */
export function tickBullets(game: LocationTacticsGame): LocationTacticsGame {
  if (!game.tracers.length) return game;
  const tracers = game.tracers
    .map((t) => ({ ...t, life: t.life - 0.25 }))
    .filter((t) => t.life > 0);
  return { ...game, tracers };
}

export function floorSummary(
  game: LocationTacticsGame
): Array<{ index: number; name: string; officers: number; contacts: number; isGate: boolean }> {
  return game.floors
    .slice()
    .sort((a, b) => b.index - a.index)
    .map((plan) => ({
      index: plan.index,
      name: plan.name,
      officers: livingCops(game).filter((c) => c.floor === plan.index).length,
      contacts: livingPerps(game).filter((p) => p.floor === plan.index && p.spotted).length,
      isGate: plan.index === game.gate.floor,
    }));
}

export function localFallbackLocationEvaluation(stats: LocationTacticsStats): LocationAIEvaluation {
  const rate = stats.totalPerps > 0 ? stats.caught / stats.totalPerps : 0;
  let grade = 'C';
  let score = 55;
  if (rate >= 0.75 && stats.officersDown === 0) {
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
        ? `Strong ${mode} work across ${stats.floors} floors.`
        : rate >= 0.4
        ? `Partial ${mode} result — the gate leaked.`
        : `Suspects won the ${mode} — rethink stairs and the gate.`,
    strategyAnalysis: `Caught ${stats.caught}/${stats.totalPerps} in ${stats.turnsUsed} turns; ${stats.gateEscapes} out the front.`,
    resourceAnalysis: `${stats.totalPolice} officers, ${stats.officersDown} down, ${stats.shotsFired} shots fired.`,
    strengths: [rate >= 0.5 ? 'Held the gate while clearing' : 'Pushed a hard building'],
    improvements: [
      stats.gateEscapes > 0 ? 'Leave a body on the front gate' : 'Keep the same containment',
    ],
  };
}
