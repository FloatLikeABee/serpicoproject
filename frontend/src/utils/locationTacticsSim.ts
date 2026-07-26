/** On-foot / indoor tactical sims for bars, clubs, factories, and projects. */

import { LandmarkKind, MapLandmark } from './pursuitSim';

export type RoomKind =
  | 'entry'
  | 'main'
  | 'side'
  | 'kitchen'
  | 'alley'
  | 'basement'
  | 'stairwell'
  | 'roof'
  | 'storage'
  | 'courtyard';

export type OfficerStatus = 'ready' | 'covering' | 'hurt';
export type PerpStatus = 'hiding' | 'fleeing' | 'caught' | 'escaped';
export type TacticsPhase = 'briefing' | 'active' | 'completed';

export interface TacticsRoom {
  id: string;
  name: string;
  kind: RoomKind;
  /** Fogged until scouted — basements and dead zones. */
  unknown: boolean;
  revealed: boolean;
  connectedTo: string[];
  danger: 'low' | 'med' | 'high';
  isExit: boolean;
}

export interface TacticsOfficer {
  id: string;
  name: string;
  status: OfficerStatus;
  roomId: string;
  coveringExit: boolean;
}

export interface TacticsPerp {
  id: string;
  name: string;
  armed: boolean;
  weapon?: string;
  roomId: string;
  status: PerpStatus;
}

export interface TacticsReinforcement {
  arriveOnTurn: number;
  count: number;
  arrived: boolean;
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
  phase: TacticsPhase;
  turn: number;
  maxTurns: number;
  rooms: TacticsRoom[];
  officers: TacticsOfficer[];
  perps: TacticsPerp[];
  reinforcements: TacticsReinforcement[];
  log: TacticsLogEntry[];
  selectedOfficerId?: string;
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

/** Seeded RNG so each location's scenario is stable for the calendar day. */
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

function shuffle<T>(rng: () => number, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function uid(prefix: string, rng: () => number) {
  return `${prefix}-${Math.floor(rng() * 1e9).toString(36)}`;
}

const OFFICER_NAMES = [
  'Reyes', 'Okada', 'Brooks', 'Hassan', 'Nguyen', 'Carter', 'Diaz', 'Singh', 'Walsh', 'Mbeki',
];

const PERP_NAMES = [
  'Vex', 'Rook', 'Shade', 'Bolt', 'Kite', 'Moth', 'Jinx', 'Dust', 'Hex', 'Pike', 'Crow', 'Wren',
];

const WEAPONS = ['handgun', 'knife', 'sawed-off', 'pipe', 'stolen Glock'];

type ScenarioTemplate = {
  title: string;
  briefing: string;
  rooms: Array<Omit<TacticsRoom, 'id' | 'revealed' | 'connectedTo'> & { key: string; links: string[] }>;
};

const SCENARIOS: Record<LandmarkKind, ScenarioTemplate[]> = {
  bar: [
    {
      title: 'Cash-out Brawl',
      briefing:
        'A gang jumped the till after last call. Two lookouts peeled toward the alley; someone ducked into a locked cellar when sirens hit.',
      rooms: [
        { key: 'entry', name: 'Front Door', kind: 'entry', unknown: false, danger: 'low', isExit: true, links: ['main', 'alley'] },
        { key: 'main', name: 'Bar Floor', kind: 'main', unknown: false, danger: 'med', isExit: false, links: ['entry', 'kitchen', 'side'] },
        { key: 'kitchen', name: 'Kitchen Pass', kind: 'kitchen', unknown: false, danger: 'med', isExit: false, links: ['main', 'alley'] },
        { key: 'side', name: 'Booth Hall', kind: 'side', unknown: false, danger: 'low', isExit: false, links: ['main', 'basement'] },
        { key: 'basement', name: 'Beer Cellar', kind: 'basement', unknown: true, danger: 'high', isExit: false, links: ['side'] },
        { key: 'alley', name: 'Side Alley', kind: 'alley', unknown: false, danger: 'med', isExit: true, links: ['entry', 'kitchen'] },
      ],
    },
    {
      title: 'Pool-Table Ambush',
      briefing:
        'Witnesses say a crew flashed steel after a bad bet. One runner is still inside; another may be using the basement service hatch.',
      rooms: [
        { key: 'entry', name: 'Vestibule', kind: 'entry', unknown: false, danger: 'low', isExit: true, links: ['main'] },
        { key: 'main', name: 'Pool Room', kind: 'main', unknown: false, danger: 'high', isExit: false, links: ['entry', 'side', 'storage'] },
        { key: 'side', name: 'Restroom Corridor', kind: 'side', unknown: false, danger: 'med', isExit: false, links: ['main', 'alley'] },
        { key: 'storage', name: 'Stock Closet', kind: 'storage', unknown: false, danger: 'med', isExit: false, links: ['main', 'basement'] },
        { key: 'basement', name: 'Service Hatch', kind: 'basement', unknown: true, danger: 'high', isExit: true, links: ['storage'] },
        { key: 'alley', name: 'Dumpster Cut', kind: 'alley', unknown: false, danger: 'med', isExit: true, links: ['side'] },
      ],
    },
  ],
  club: [
    {
      title: 'After-Hours Sweep',
      briefing:
        'Security cut the music when shots were reported near VIP. Crowd panic bought the crew time — one exit still open, basement lounge unconfirmed.',
      rooms: [
        { key: 'entry', name: 'Coat Check', kind: 'entry', unknown: false, danger: 'low', isExit: true, links: ['main', 'alley'] },
        { key: 'main', name: 'Dance Floor', kind: 'main', unknown: false, danger: 'med', isExit: false, links: ['entry', 'side', 'kitchen'] },
        { key: 'side', name: 'VIP Booths', kind: 'side', unknown: false, danger: 'high', isExit: false, links: ['main', 'basement'] },
        { key: 'kitchen', name: 'DJ Booth Stairs', kind: 'kitchen', unknown: false, danger: 'med', isExit: false, links: ['main', 'roof'] },
        { key: 'basement', name: 'Basement Lounge', kind: 'basement', unknown: true, danger: 'high', isExit: false, links: ['side'] },
        { key: 'roof', name: 'Roof Access', kind: 'roof', unknown: false, danger: 'med', isExit: true, links: ['kitchen'] },
        { key: 'alley', name: 'Loading Door', kind: 'alley', unknown: false, danger: 'med', isExit: true, links: ['entry'] },
      ],
    },
    {
      title: 'Neon Lockdown',
      briefing:
        'A theft ring mixed into the crowd. Armed lookouts are cycling exits. An unmarked utility basement may be their stash route.',
      rooms: [
        { key: 'entry', name: 'Ticket Arch', kind: 'entry', unknown: false, danger: 'low', isExit: true, links: ['main'] },
        { key: 'main', name: 'Main Floor', kind: 'main', unknown: false, danger: 'med', isExit: false, links: ['entry', 'side', 'courtyard'] },
        { key: 'side', name: 'Green Room', kind: 'side', unknown: false, danger: 'high', isExit: false, links: ['main', 'basement', 'alley'] },
        { key: 'basement', name: 'Utility Basement', kind: 'basement', unknown: true, danger: 'high', isExit: false, links: ['side'] },
        { key: 'courtyard', name: 'Smokers Patio', kind: 'courtyard', unknown: false, danger: 'med', isExit: true, links: ['main'] },
        { key: 'alley', name: 'Staff Exit', kind: 'alley', unknown: false, danger: 'med', isExit: true, links: ['side'] },
      ],
    },
  ],
  factory: [
    {
      title: 'Midnight Strip Crew',
      briefing:
        'Scrap thieves cut copper overnight. Footsteps on the catwalk, a dark basement machine pit, and a loading dock still rolling.',
      rooms: [
        { key: 'entry', name: 'Guard Gate', kind: 'entry', unknown: false, danger: 'low', isExit: true, links: ['main', 'courtyard'] },
        { key: 'main', name: 'Assembly Floor', kind: 'main', unknown: false, danger: 'med', isExit: false, links: ['entry', 'storage', 'stairwell'] },
        { key: 'storage', name: 'Parts Cage', kind: 'storage', unknown: false, danger: 'med', isExit: false, links: ['main', 'basement'] },
        { key: 'stairwell', name: 'Catwalk Stairs', kind: 'stairwell', unknown: false, danger: 'high', isExit: false, links: ['main', 'roof'] },
        { key: 'basement', name: 'Machine Pit', kind: 'basement', unknown: true, danger: 'high', isExit: false, links: ['storage'] },
        { key: 'roof', name: 'Roof Hatch', kind: 'roof', unknown: false, danger: 'med', isExit: true, links: ['stairwell'] },
        { key: 'courtyard', name: 'Loading Dock', kind: 'courtyard', unknown: false, danger: 'med', isExit: true, links: ['entry'] },
      ],
    },
    {
      title: 'Silent Foundry',
      briefing:
        'A gang used the abandoned foundry as a stash house. Armed couriers are inside. The basement pour room is unmapped tonight.',
      rooms: [
        { key: 'entry', name: 'Roll-up Door', kind: 'entry', unknown: false, danger: 'low', isExit: true, links: ['main'] },
        { key: 'main', name: 'Foundry Hall', kind: 'main', unknown: false, danger: 'high', isExit: false, links: ['entry', 'side', 'alley'] },
        { key: 'side', name: 'Office Mezzanine', kind: 'side', unknown: false, danger: 'med', isExit: false, links: ['main', 'basement'] },
        { key: 'basement', name: 'Pour Room', kind: 'basement', unknown: true, danger: 'high', isExit: false, links: ['side'] },
        { key: 'alley', name: 'Rail Siding', kind: 'alley', unknown: false, danger: 'med', isExit: true, links: ['main'] },
      ],
    },
  ],
  projects: [
    {
      title: 'Stairwell Chase',
      briefing:
        'A crew bolted from a hallway deal. Neighbors report doors slamming — someone may be in the basement laundry they keep chaining shut.',
      rooms: [
        { key: 'entry', name: 'Lobby', kind: 'entry', unknown: false, danger: 'low', isExit: true, links: ['stairwell', 'courtyard'] },
        { key: 'stairwell', name: 'North Stairs', kind: 'stairwell', unknown: false, danger: 'med', isExit: false, links: ['entry', 'main', 'basement', 'roof'] },
        { key: 'main', name: '3rd Floor Hall', kind: 'main', unknown: false, danger: 'high', isExit: false, links: ['stairwell', 'side'] },
        { key: 'side', name: 'Unit 3C', kind: 'side', unknown: false, danger: 'high', isExit: false, links: ['main'] },
        { key: 'basement', name: 'Laundry Basement', kind: 'basement', unknown: true, danger: 'high', isExit: true, links: ['stairwell'] },
        { key: 'roof', name: 'Roof Door', kind: 'roof', unknown: false, danger: 'med', isExit: true, links: ['stairwell'] },
        { key: 'courtyard', name: 'Courtyard Gate', kind: 'courtyard', unknown: false, danger: 'med', isExit: true, links: ['entry'] },
      ],
    },
    {
      title: 'Courtyard Break',
      briefing:
        'Two units flagged a fleeing crew cutting through the projects. Expect stair traps, a dirty basement cut-through, and civilians in the halls.',
      rooms: [
        { key: 'entry', name: 'Breezeway', kind: 'entry', unknown: false, danger: 'low', isExit: true, links: ['courtyard', 'stairwell'] },
        { key: 'courtyard', name: 'Inner Court', kind: 'courtyard', unknown: false, danger: 'med', isExit: true, links: ['entry', 'main'] },
        { key: 'main', name: 'Walkup Corridor', kind: 'main', unknown: false, danger: 'med', isExit: false, links: ['courtyard', 'side', 'stairwell'] },
        { key: 'side', name: 'Abandoned Unit', kind: 'side', unknown: false, danger: 'high', isExit: false, links: ['main', 'basement'] },
        { key: 'stairwell', name: 'Fire Stairs', kind: 'stairwell', unknown: false, danger: 'med', isExit: false, links: ['entry', 'main', 'roof'] },
        { key: 'basement', name: 'Boiler Cut', kind: 'basement', unknown: true, danger: 'high', isExit: true, links: ['side'] },
        { key: 'roof', name: 'Roof Edge', kind: 'roof', unknown: false, danger: 'high', isExit: true, links: ['stairwell'] },
      ],
    },
  ],
};

function buildRooms(
  template: ScenarioTemplate,
  rng: () => number
): TacticsRoom[] {
  const idByKey = new Map<string, string>();
  for (const r of template.rooms) {
    idByKey.set(r.key, uid(`room-${r.key}`, rng));
  }
  return template.rooms.map((r) => ({
    id: idByKey.get(r.key)!,
    name: r.name,
    kind: r.kind,
    unknown: r.unknown,
    revealed: !r.unknown,
    danger: r.danger,
    isExit: r.isExit,
    connectedTo: r.links.map((k) => idByKey.get(k)!).filter(Boolean),
  }));
}

export function startLocationTactics(landmark: MapLandmark, now = new Date()): LocationTacticsGame {
  const key = dayKey(now);
  const rng = makeRng(hashSeed(`${key}|${landmark.id}|${landmark.name}|${landmark.kind}`));
  const templates = SCENARIOS[landmark.kind];
  const template = pick(rng, templates);
  const rooms = buildRooms(template, rng);
  const entry = rooms.find((r) => r.kind === 'entry') ?? rooms[0];
  const hideRooms = rooms.filter((r) => r.kind !== 'entry');

  const perpCount = 2 + Math.floor(rng() * 3); // 2-4
  const armedCount = Math.max(1, Math.floor(perpCount * (0.35 + rng() * 0.4)));
  const names = shuffle(rng, PERP_NAMES);
  const perps: TacticsPerp[] = [];
  for (let i = 0; i < perpCount; i++) {
    const armed = i < armedCount;
    perps.push({
      id: uid('perp', rng),
      name: names[i % names.length],
      armed,
      weapon: armed ? pick(rng, WEAPONS) : undefined,
      roomId: pick(rng, hideRooms).id,
      status: 'hiding',
    });
  }

  const officerNames = shuffle(rng, OFFICER_NAMES);
  const officers: TacticsOfficer[] = [0, 1].map((i) => ({
    id: uid('off', rng),
    name: `Ofc. ${officerNames[i]}`,
    status: 'ready' as const,
    roomId: entry.id,
    coveringExit: false,
  }));

  const firstWave = 2 + Math.floor(rng() * 2); // turn 2-3
  const secondWave = 4 + Math.floor(rng() * 3); // turn 4-6
  const reinforcements: TacticsReinforcement[] = [
    { arriveOnTurn: firstWave, count: 1 + Math.floor(rng() * 2), arrived: false },
    { arriveOnTurn: secondWave, count: 1 + Math.floor(rng() * 2), arrived: false },
  ];

  const maxTurns = 9 + Math.floor(rng() * 3); // 9-11

  return {
    id: uid('tactics', rng),
    landmarkId: landmark.id,
    landmarkName: landmark.name,
    landmarkKind: landmark.kind,
    dayKey: key,
    scenarioTitle: template.title,
    briefing: template.briefing,
    phase: 'briefing',
    turn: 1,
    maxTurns,
    rooms,
    officers,
    perps,
    reinforcements,
    log: [
      {
        turn: 1,
        text: `${landmark.name}: ${template.title}. Two officers on scene — backup ETA unknown.`,
        tone: 'info',
      },
    ],
    decisions: [],
  };
}

function roomById(game: LocationTacticsGame, id: string) {
  return game.rooms.find((r) => r.id === id);
}

function activeOfficers(game: LocationTacticsGame) {
  return game.officers.filter((o) => o.status !== 'hurt');
}

function livingPerps(game: LocationTacticsGame) {
  return game.perps.filter((p) => p.status === 'hiding' || p.status === 'fleeing');
}

function pushLog(game: LocationTacticsGame, text: string, tone: TacticsLogEntry['tone'] = 'info') {
  game.log = [...game.log.slice(-18), { turn: game.turn, text, tone }];
}

function clearCovers(game: LocationTacticsGame) {
  for (const o of game.officers) {
    if (o.status === 'covering') {
      o.status = 'ready';
      o.coveringExit = false;
    }
  }
}

function applyReinforcements(game: LocationTacticsGame) {
  const entry = game.rooms.find((r) => r.kind === 'entry') ?? game.rooms[0];
  for (const wave of game.reinforcements) {
    if (wave.arrived || game.turn < wave.arriveOnTurn) continue;
    wave.arrived = true;
    const names = shuffle(() => Math.random(), OFFICER_NAMES);
    for (let i = 0; i < wave.count; i++) {
      game.officers.push({
        id: `off-re-${game.turn}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Ofc. ${names[i % names.length]}`,
        status: 'ready',
        roomId: entry.id,
        coveringExit: false,
      });
    }
    pushLog(game, `Backup arrived: +${wave.count} officer(s) at ${entry.name}.`, 'good');
  }
}

function tryHurtOfficer(game: LocationTacticsGame, officer: TacticsOfficer, perp: TacticsPerp): boolean {
  if (!perp.armed) return false;
  const allies = activeOfficers(game).filter((o) => o.roomId === officer.roomId).length;
  const chance = Math.max(0.18, 0.48 - (allies - 1) * 0.12);
  if (Math.random() > chance) return false;
  officer.status = 'hurt';
  officer.coveringExit = false;
  pushLog(
    game,
    `${officer.name} hit by ${perp.name}'s ${perp.weapon || 'weapon'} — unable to continue.`,
    'bad'
  );
  return true;
}

function catchPerpsInRoom(game: LocationTacticsGame, officer: TacticsOfficer): number {
  const room = roomById(game, officer.roomId);
  if (!room || (room.unknown && !room.revealed)) {
    pushLog(game, `${officer.name} can't clear an unknown area — scout it first.`, 'warn');
    return 0;
  }
  let caught = 0;
  for (const perp of livingPerps(game)) {
    if (perp.roomId !== officer.roomId) continue;
    if (perp.armed && tryHurtOfficer(game, officer, perp)) {
      // Officer down — perp may still slip if no other ready officers here.
      const helpers = activeOfficers(game).filter((o) => o.roomId === officer.roomId);
      if (helpers.length === 0) {
        pushLog(game, `${perp.name} slips the contact after the hit.`, 'warn');
        continue;
      }
    }
    if (officer.status === 'hurt') break;
    perp.status = 'caught';
    caught += 1;
    pushLog(
      game,
      `${officer.name} cuffed ${perp.name}${perp.armed ? ` (armed: ${perp.weapon})` : ''}.`,
      'good'
    );
  }
  if (caught === 0 && officer.status !== 'hurt') {
    pushLog(game, `${officer.name} clears ${room.name} — no suspects held.`, 'info');
  }
  return caught;
}

function movePerps(game: LocationTacticsGame) {
  const coveredExits = new Set(
    game.officers.filter((o) => o.coveringExit && o.status !== 'hurt').map((o) => o.roomId)
  );
  for (const perp of livingPerps(game)) {
    const room = roomById(game, perp.roomId);
    if (!room) continue;

    // Pressure rises late; unknown basements are escape highways if revealed to them (they know).
    const escapeBias = room.isExit ? 0.35 : room.kind === 'basement' ? 0.28 : 0.12;
    const turnPressure = game.turn / game.maxTurns;
    if (Math.random() < escapeBias + turnPressure * 0.25) {
      if (room.isExit || room.kind === 'basement') {
        if (coveredExits.has(room.id) && Math.random() < 0.7) {
          pushLog(game, `${perp.name} tested ${room.name} but cover held.`, 'good');
          continue;
        }
        perp.status = 'escaped';
        pushLog(game, `${perp.name} escaped via ${room.name}.`, 'bad');
        continue;
      }
    }

    // Otherwise drift toward exits / basement.
    const options = room.connectedTo
      .map((id) => roomById(game, id))
      .filter((r): r is TacticsRoom => !!r)
      .filter((r) => r.revealed || r.unknown); // perps know layout
    if (!options.length) continue;
    const ranked = [...options].sort((a, b) => {
      const score = (r: TacticsRoom) => (r.isExit ? 3 : 0) + (r.kind === 'basement' ? 2 : 0) + (r.danger === 'high' ? 1 : 0);
      return score(b) - score(a);
    });
    const dest = Math.random() < 0.65 ? ranked[0] : pick(() => Math.random(), options);
    perp.roomId = dest.id;
    perp.status = 'fleeing';
  }
}

function buildStats(game: LocationTacticsGame, result: TacticsResult): LocationTacticsStats {
  return {
    landmarkId: game.landmarkId,
    landmarkName: game.landmarkName,
    landmarkKind: game.landmarkKind,
    dayKey: game.dayKey,
    scenarioTitle: game.scenarioTitle,
    turnsUsed: result.turnsUsed,
    totalPolice: game.officers.length,
    policeHurt: game.officers.filter((o) => o.status === 'hurt').length,
    policeUsed: game.officers.length,
    totalPerps: result.totalPerps,
    armedPerps: game.perps.filter((p) => p.armed).length,
    caught: result.caught,
    escaped: result.escaped,
    unknownRoomsScouted: game.rooms.filter((r) => r.unknown && r.revealed).length,
    outcome: result.outcome,
    operationalScore: result.score,
    decisions: game.decisions,
  };
}

function finalize(game: LocationTacticsGame): LocationTacticsGame {
  const caught = game.perps.filter((p) => p.status === 'caught').length;
  // Remaining runners count as escaped at timeout / end.
  for (const p of livingPerps(game)) p.status = 'escaped';
  const total = game.perps.length;
  const hurt = game.officers.filter((o) => o.status === 'hurt').length;
  let outcome: TacticsResult['outcome'] = 'escaped';
  let score = Math.round((caught / Math.max(total, 1)) * 100) - hurt * 8;
  let message = 'Suspects slipped the perimeter — citizens are shaken.';
  if (caught === total) {
    outcome = 'total_win';
    score = Math.max(score, 90);
    message = 'Site secured — every suspect in custody.';
  } else if (caught > 0) {
    outcome = 'partial_win';
    score = Math.max(40, score);
    message = 'Partial containment — some runners got out.';
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
    perps: game.perps.map((p) => ({ ...p })),
    officers: game.officers.map((o) => ({ ...o })),
    result,
    stats: buildStats(game, result),
  };
}

function endTurn(game: LocationTacticsGame): LocationTacticsGame {
  clearCovers(game);
  game.turn += 1;
  applyReinforcements(game);
  movePerps(game);
  if (livingPerps(game).length === 0 || game.turn > game.maxTurns) {
    return finalize(game);
  }
  return { ...game, rooms: game.rooms.map((r) => ({ ...r })), officers: [...game.officers], perps: [...game.perps], reinforcements: [...game.reinforcements] };
}

export function beginTacticsRaid(game: LocationTacticsGame): LocationTacticsGame {
  if (game.phase !== 'briefing') return game;
  const firstReady = game.officers.find((o) => o.status !== 'hurt');
  const next = {
    ...game,
    phase: 'active' as const,
    selectedOfficerId: firstReady?.id ?? game.officers[0]?.id,
    decisions: [...game.decisions, 'Entered the site with a two-officer stack'],
  };
  pushLog(next, 'Raid is live. Move, scout unknowns, cover exits, clear rooms.', 'info');
  pushLog(next, next.briefing, 'warn');
  applyReinforcements(next);
  return { ...next };
}

export function selectTacticsOfficer(game: LocationTacticsGame, officerId: string): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const off = game.officers.find((o) => o.id === officerId);
  if (!off || off.status === 'hurt') return game;
  return { ...game, selectedOfficerId: officerId };
}

function cloneGame(game: LocationTacticsGame): LocationTacticsGame {
  return JSON.parse(JSON.stringify(game)) as LocationTacticsGame;
}

export function tacticsMove(
  game: LocationTacticsGame,
  officerId: string,
  roomId: string
): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  const officer = g.officers.find((o) => o.id === officerId);
  if (!officer || officer.status === 'hurt') return game;
  const from = roomById(g, officer.roomId);
  const to = roomById(g, roomId);
  if (!from || !to || !from.connectedTo.includes(to.id)) return game;
  if (to.unknown && !to.revealed) {
    pushLog(g, `${to.name} is unknown ground — scout before moving in stacked.`, 'warn');
    return g;
  }
  officer.roomId = to.id;
  officer.coveringExit = false;
  officer.status = 'ready';
  g.selectedOfficerId = officer.id;
  g.decisions.push(`Moved ${officer.name} to ${to.name}`);
  pushLog(g, `${officer.name} moves to ${to.name}.`, 'info');
  return endTurn(g);
}

export function tacticsScout(game: LocationTacticsGame, officerId: string): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  const officer = g.officers.find((o) => o.id === officerId);
  if (!officer || officer.status === 'hurt') return game;
  const room = roomById(g, officer.roomId);
  if (!room) return game;

  // Scout adjacent unknown rooms.
  const unknownAdj = room.connectedTo
    .map((id) => roomById(g, id))
    .filter((r): r is TacticsRoom => !!r && r.unknown && !r.revealed);
  if (!unknownAdj.length) {
    pushLog(g, `${officer.name} finds no unknown approaches from ${room.name}.`, 'info');
    g.decisions.push(`${officer.name} scouted — no fog left nearby`);
    return endTurn(g);
  }
  const target = unknownAdj[0];
  target.revealed = true;
  g.decisions.push(`Scouted ${target.name}`);
  pushLog(g, `${officer.name} maps ${target.name} — unknown area revealed.`, 'good');

  // Ambush risk while scouting.
  const lurker = livingPerps(g).find((p) => p.roomId === target.id && p.armed);
  if (lurker && Math.random() < 0.4) {
    officer.roomId = target.id;
    tryHurtOfficer(g, officer, lurker);
  }
  return endTurn(g);
}

export function tacticsClear(game: LocationTacticsGame, officerId: string): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  const officer = g.officers.find((o) => o.id === officerId);
  if (!officer || officer.status === 'hurt') return game;
  const room = roomById(g, officer.roomId);
  g.decisions.push(`Cleared ${room?.name || 'room'} with ${officer.name}`);
  catchPerpsInRoom(g, officer);
  if (livingPerps(g).length === 0) return finalize(g);
  return endTurn(g);
}

export function tacticsCoverExit(game: LocationTacticsGame, officerId: string): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  const officer = g.officers.find((o) => o.id === officerId);
  if (!officer || officer.status === 'hurt') return game;
  const room = roomById(g, officer.roomId);
  if (!room?.isExit && room?.kind !== 'basement') {
    pushLog(g, `${room?.name || 'Here'} is not an exit — cover a door or alley.`, 'warn');
    return g;
  }
  officer.status = 'covering';
  officer.coveringExit = true;
  g.decisions.push(`Covered ${room.name}`);
  pushLog(g, `${officer.name} covers ${room.name} — escape route pressured.`, 'good');
  return endTurn(g);
}

export function tacticsWait(game: LocationTacticsGame): LocationTacticsGame {
  if (game.phase !== 'active') return game;
  const g = cloneGame(game);
  g.decisions.push('Held for backup / clock pressure');
  pushLog(g, 'Stack holds — clock ticks, suspects may move.', 'warn');
  return endTurn(g);
}

export function localFallbackLocationEvaluation(stats: LocationTacticsStats): LocationAIEvaluation {
  const rate = stats.totalPerps > 0 ? stats.caught / stats.totalPerps : 0;
  let grade = 'C';
  let score = 55;
  if (rate >= 0.75 && stats.policeHurt <= 1) {
    grade = 'A';
    score = 92;
  } else if (rate >= 0.4 || stats.caught >= 2) {
    grade = 'B';
    score = 76;
  }
  return {
    grade,
    score,
    summary:
      rate >= 0.75
        ? 'Clean site work under armed pressure.'
        : rate >= 0.4
        ? 'Partial containment — exits needed tighter cover.'
        : 'Suspects broke out — perimeter collapsed.',
    strategyAnalysis: `Caught ${stats.caught}/${stats.totalPerps} in ${stats.turnsUsed} turns at ${stats.landmarkName}.`,
    resourceAnalysis: `${stats.totalPolice} officers used, ${stats.policeHurt} hurt, ${stats.armedPerps} armed suspects.`,
    strengths: [stats.unknownRoomsScouted > 0 ? 'Pushed into unknown ground' : 'Kept a live stack moving'],
    improvements: [rate < 0.75 ? 'Cover exits before clearing deep rooms' : 'Maintain the same exit discipline'],
  };
}
