import React, { useEffect, useMemo } from 'react';
import {
  FLOOR_ZONE_COLORS,
  FloorZone,
  LocationAIEvaluation,
  LocationTacticsGame,
  floorOf,
  floorSummary,
  reachableCells,
  selectTacticsOfficer,
  setViewFloor,
  shootTargets,
  stairOptions,
  tacticsInteractCell,
  tacticsTakeCover,
  tacticsUseStairs,
  tacticsWait,
  tickBullets,
} from '../utils/locationTacticsSim';

interface LocationTacticsPanelProps {
  game: LocationTacticsGame;
  collapsed: boolean;
  evaluation?: LocationAIEvaluation | null;
  evalLoading?: boolean;
  onChange: (game: LocationTacticsGame) => void;
  onToggleCollapse: () => void;
  onClose: () => void;
}

const MODE_LABEL: Record<string, string> = {
  chase: 'Foot chase',
  gunfight: 'Gunfight',
  hide: 'Hide & seek',
};

const VENUE_LEGEND: Record<string, Array<{ zone: FloorZone; label: string }>> = {
  bar: [
    { zone: 'bar', label: 'Bar' },
    { zone: 'booth', label: 'Booths' },
    { zone: 'kitchen', label: 'Kitchen' },
    { zone: 'basement', label: 'Cellar' },
  ],
  club: [
    { zone: 'dance', label: 'Dance' },
    { zone: 'stage', label: 'Stage' },
    { zone: 'vip', label: 'VIP' },
    { zone: 'basement', label: 'Basement' },
  ],
  factory: [
    { zone: 'machine', label: 'Machines' },
    { zone: 'office', label: 'Office' },
    { zone: 'loading', label: 'Dock' },
    { zone: 'basement', label: 'Pit' },
  ],
  projects: [
    { zone: 'unit', label: 'Units' },
    { zone: 'court', label: 'Court' },
    { zone: 'hall', label: 'Corridor' },
    { zone: 'basement', label: 'Laundry' },
  ],
};

function tileFill(zone: FloorZone, kind: string, fog: boolean, canMove: boolean, canShoot: boolean): string {
  if (fog) return '#08080b';
  if (canShoot) return '#9f1239';
  if (canMove) return '#0f766e';
  if (kind === 'wall') return FLOOR_ZONE_COLORS.wall;
  if (kind === 'gate') return '#7f1d1d';
  if (kind === 'stair') return FLOOR_ZONE_COLORS.stair;
  return FLOOR_ZONE_COLORS[zone] || FLOOR_ZONE_COLORS.hall;
}

const LocationTacticsPanel: React.FC<LocationTacticsPanelProps> = ({
  game,
  collapsed,
  evaluation,
  evalLoading,
  onChange,
  onToggleCollapse,
  onClose,
}) => {
  const officers = game.units.filter((u) => u.side === 'cop');
  const selected = officers.find((u) => u.id === game.selectedUnitId && u.status === 'active');
  const plan = floorOf(game, game.viewFloor);

  const reach = useMemo(
    () => (selected && game.phase === 'active' ? reachableCells(game, selected.id) : []),
    [game, selected]
  );
  const targets = useMemo(
    () => (selected && game.phase === 'active' ? shootTargets(game, selected.id) : []),
    [game, selected]
  );
  const reachMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reach) map.set(`${r.x},${r.y}`, r.cost);
    return map;
  }, [reach]);
  const targetSet = useMemo(() => new Set(targets.map((t) => `${t.x},${t.y}`)), [targets]);
  const floors = useMemo(() => floorSummary(game), [game]);
  const stairs = useMemo(() => (game.phase === 'active' ? stairOptions(game) : []), [game]);

  const movesLeft = officers
    .filter((o) => o.status === 'active')
    .reduce((sum, o) => sum + o.moves, 0);
  const caught = game.units.filter((u) => u.side === 'perp' && u.status === 'caught').length;
  const escaped = game.units.filter((u) => u.side === 'perp' && u.status === 'escaped').length;
  const loose = game.units.filter((u) => u.side === 'perp' && u.status === 'active').length;
  const showEscapeFaces =
    !!game.result &&
    (game.result.outcome === 'escaped' || (game.result.escaped > 0 && game.result.outcome !== 'total_win'));

  useEffect(() => {
    if (game.phase !== 'active' || game.tracers.length === 0) return;
    const id = window.setTimeout(() => onChange(tickBullets(game)), 90);
    return () => window.clearTimeout(id);
  }, [game.phase, game.tracers, onChange, game]);

  if (collapsed) {
    return (
      <div className="absolute left-2 right-2 bottom-2 z-[1150] pointer-events-auto">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full game-panel px-3 py-2 border border-neon-amber/40 flex items-center justify-between gap-2 text-left"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
              {MODE_LABEL[game.mode]} · {game.landmarkName}
            </p>
            <p className="text-[11px] text-gray-300 truncate">
              {game.phase === 'completed'
                ? game.result?.message
                : `T${game.turn}/${game.maxTurns} · ${plan.name} · ${loose} loose`}
            </p>
          </div>
          <span className="text-[10px] text-neon-cyan font-display uppercase flex-shrink-0">Expand</span>
        </button>
      </div>
    );
  }

  const gap = 1;
  const cellSize = Math.max(15, Math.min(24, Math.floor(330 / Math.max(plan.width, plan.height))));
  const mapW = plan.width * (cellSize + gap);
  const mapH = plan.height * (cellSize + gap);
  const legend = VENUE_LEGEND[game.landmarkKind] || [];
  const gateOnThisFloor = game.gate.floor === game.viewFloor;

  return (
    <div className="absolute inset-x-2 top-2 bottom-2 sm:inset-auto sm:top-2 sm:right-2 sm:bottom-2 sm:w-[420px] z-[1150] pointer-events-auto flex flex-col">
      <div className="game-panel border border-neon-amber/45 flex flex-col max-h-full overflow-hidden shadow-xl">
        <div className="px-3 py-2 border-b border-white/10 flex items-start justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
              {MODE_LABEL[game.mode]} · {game.floors.length} floors
            </p>
            <h3 className="font-display font-bold text-sm text-white truncate">{game.landmarkName}</h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="px-2 py-1 text-[10px] uppercase font-display border border-white/15 rounded text-synth-muted hover:text-white min-h-0 min-w-0"
            >
              Collapse
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-[10px] text-synth-muted hover:text-white min-h-0 min-w-0"
              aria-label="Close tactics"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-2 py-2 flex-1 overflow-y-auto space-y-2 min-h-0">
          {game.phase !== 'completed' && (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono px-1">
                <span className="text-neon-cyan">T{game.turn}/{game.maxTurns}</span>
                <span className="rounded bg-white/10 px-1 text-[9px] font-display uppercase tracking-wider text-white">
                  {movesLeft} {movesLeft === 1 ? 'move' : 'moves'} left
                </span>
                <span className="text-neon-green">✓{caught}</span>
                <span className="text-neon-magenta">●{loose}</span>
                <span className="text-gray-500">↗{escaped}</span>
                {game.mode === 'gunfight' ? (
                  <span className="text-neon-amber">
                    Ammo {game.squadAmmo}/{game.maxSquadAmmo}
                  </span>
                ) : (
                  <span className="text-neon-amber">
                    Shots {officers.reduce((sum, o) => sum + (o.status === 'active' ? o.shots : 0), 0)}
                  </span>
                )}
              </div>

              {game.radio && (
                <p className="mx-1 rounded border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-200">
                  <span className="font-display uppercase tracking-wider text-sky-300">Radio</span>{' '}
                  {game.radio}
                </p>
              )}

              {/* Floor selector — stacked top floor first */}
              <div className="flex gap-1 px-1">
                {floors.map((f) => (
                  <button
                    key={f.index}
                    type="button"
                    onClick={() => onChange(setViewFloor(game, f.index))}
                    className={`flex-1 rounded px-1 py-1 border text-[9px] font-display uppercase tracking-wide min-h-0 min-w-0 ${
                      f.index === game.viewFloor
                        ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                        : 'border-white/15 text-synth-muted'
                    }`}
                  >
                    <span className="block truncate">{f.name}</span>
                    <span className="block text-[8px] font-mono normal-case text-gray-400">
                      {f.officers > 0 ? `${f.officers}C ` : ''}
                      {f.contacts > 0 ? `${f.contacts}P ` : ''}
                      {f.isGate ? 'gate' : f.officers + f.contacts === 0 ? '—' : ''}
                    </span>
                  </button>
                ))}
              </div>

              {/* Officer roster with move pips and lives */}
              <div className="space-y-1 px-1">
                {officers.map((o) => {
                  const isSelected = selected?.id === o.id;
                  const down = o.status !== 'active';
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={down}
                      onClick={() => onChange(selectTacticsOfficer(game, o.id))}
                      className={`w-full flex items-center gap-2 rounded px-2 py-1 border text-left min-h-0 min-w-0 ${
                        down
                          ? 'border-gray-700 text-gray-500'
                          : isSelected
                          ? 'border-neon-cyan bg-neon-cyan/15'
                          : 'border-white/15'
                      }`}
                    >
                      <span className={`text-[10px] font-display truncate ${down ? '' : 'text-white'}`}>
                        {o.name.replace('Ofc. ', '')}
                        {down ? ' (down)' : ''}
                      </span>
                      <span className="text-[9px] font-mono text-neon-amber">
                        {'❤'.repeat(o.lives)}
                        <span className="text-gray-600">{'❤'.repeat(o.maxLives - o.lives)}</span>
                      </span>
                      <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                        <span className="text-[8px] uppercase text-synth-muted">
                          {floorOf(game, o.floor).name}
                        </span>
                        <span className="flex gap-0.5">
                          {Array.from({ length: o.maxMoves }).map((_, i) => (
                            <i
                              key={i}
                              className={`inline-block w-1.5 h-1.5 rounded-full ${
                                i < o.moves ? 'bg-neon-cyan' : 'bg-gray-700'
                              }`}
                            />
                          ))}
                        </span>
                        {game.mode !== 'gunfight' && (
                          <span className="text-[9px] font-mono text-neon-amber">{o.shots}★</span>
                        )}
                        {o.hunkered && <span className="text-[8px] text-sky-300">cover</span>}
                      </span>
                    </button>
                  );
                })}
              </div>

              {stairs.length > 0 && (
                <div className="flex items-center gap-1 px-1">
                  <span className="text-[9px] font-display uppercase tracking-wider text-indigo-300">
                    Stairs
                  </span>
                  {stairs.map((s) => (
                    <button
                      key={s.floor}
                      type="button"
                      onClick={() => onChange(tacticsUseStairs(game, s.floor))}
                      className="flex-1 px-2 py-1 rounded text-[10px] font-display uppercase border border-indigo-400/40 bg-indigo-500/15 text-indigo-200 min-h-0 min-w-0"
                    >
                      {s.floor > (selected?.floor ?? 0) ? '↑' : '↓'} {s.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-1 px-1">
                <button
                  type="button"
                  onClick={() => onChange(tacticsTakeCover(game))}
                  disabled={!selected || selected.moves <= 0}
                  className="flex-1 px-2 py-1 rounded text-[10px] font-display uppercase border border-sky-400/40 bg-sky-500/10 text-sky-200 disabled:opacity-40 min-h-0 min-w-0"
                >
                  {selected?.inCover ? 'Hunker down' : 'Take cover'}
                </button>
                <button
                  type="button"
                  onClick={() => onChange(tacticsWait(game))}
                  className="flex-1 px-2 py-1 rounded text-[10px] font-display uppercase border border-white/20 text-gray-300 min-h-0 min-w-0"
                >
                  End turn
                </button>
              </div>

              {/* Floor map */}
              <div className="relative mx-auto rounded-md border border-white/15 bg-[#05040a] p-1.5 overflow-auto">
                <div className="relative" style={{ width: mapW, height: mapH }}>
                  {plan.cells.map((cell) => {
                    const fog = !game.revealed[game.viewFloor]?.[cell.y]?.[cell.x];
                    const key = `${cell.x},${cell.y}`;
                    const moveCost = reachMap.get(key);
                    const canShoot = targetSet.has(key);
                    const bg = tileFill(cell.zone, cell.kind, fog, moveCost !== undefined, canShoot);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={game.phase !== 'active'}
                        onClick={() => onChange(tacticsInteractCell(game, cell.x, cell.y))}
                        className="absolute min-h-0 min-w-0 p-0 border-0 flex items-center justify-center"
                        style={{
                          left: cell.x * (cellSize + gap),
                          top: cell.y * (cellSize + gap),
                          width: cellSize,
                          height: cellSize,
                          background: bg,
                          boxShadow: fog
                            ? undefined
                            : cell.kind === 'cover'
                            ? 'inset 0 0 0 1px rgba(253,230,138,0.5)'
                            : cell.kind === 'gate'
                            ? 'inset 0 0 0 2px rgba(252,165,165,0.9)'
                            : cell.kind === 'stair'
                            ? 'inset 0 0 0 1px rgba(165,180,252,0.7)'
                            : undefined,
                          color: '#e5e7eb',
                          fontSize: Math.max(7, cellSize * 0.5),
                          lineHeight: 1,
                        }}
                        aria-label={`${cell.zone} ${cell.x},${cell.y}`}
                      >
                        {!fog && cell.kind === 'stair' ? '⇅' : ''}
                        {!fog && cell.kind === 'gate' ? '⌂' : ''}
                      </button>
                    );
                  })}

                  {/* Room labels */}
                  {plan.labels.map((room) => {
                    if (!game.revealed[game.viewFloor]?.[room.y]?.[room.x]) return null;
                    return (
                      <div
                        key={room.id}
                        className="absolute pointer-events-none overflow-hidden"
                        style={{
                          left: room.x * (cellSize + gap) + 2,
                          top: room.y * (cellSize + gap) + 1,
                          width: room.w * (cellSize + gap) - 4,
                          height: room.h * (cellSize + gap) - 2,
                          zIndex: 2,
                        }}
                      >
                        <span
                          className="px-0.5 rounded font-semibold uppercase tracking-wide text-white/70 bg-black/40 leading-tight"
                          style={{ fontSize: Math.max(7, Math.min(9, cellSize * 0.4)) }}
                        >
                          {room.name}
                        </span>
                      </div>
                    );
                  })}

                  {/* Tracers */}
                  {game.tracers
                    .filter((t) => t.floor === game.viewFloor)
                    .map((t) => {
                      const x1 = t.fromX * (cellSize + gap) + cellSize / 2;
                      const y1 = t.fromY * (cellSize + gap) + cellSize / 2;
                      const x2 = t.toX * (cellSize + gap) + cellSize / 2;
                      const y2 = t.toY * (cellSize + gap) + cellSize / 2;
                      const len = Math.hypot(x2 - x1, y2 - y1);
                      const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
                      return (
                        <div
                          key={t.id}
                          className="absolute pointer-events-none"
                          style={{
                            left: x1,
                            top: y1,
                            width: len,
                            height: 2,
                            transform: `rotate(${angle}deg)`,
                            transformOrigin: '0 50%',
                            background: t.hit
                              ? t.side === 'cop'
                                ? '#fde047'
                                : '#fb7185'
                              : 'rgba(148,163,184,0.7)',
                            opacity: Math.max(0.15, t.life),
                            zIndex: 7,
                          }}
                        />
                      );
                    })}

                  {/* Units on this floor */}
                  {game.units
                    .filter((u) => u.floor === game.viewFloor)
                    .map((u) => {
                      if (u.status === 'escaped') return null;
                      if (u.side === 'perp' && u.status === 'active' && !u.spotted) return null;
                      const color =
                        u.side === 'cop'
                          ? u.status !== 'active'
                            ? '#64748b'
                            : u.lives < u.maxLives
                            ? '#38bdf8'
                            : '#22d3ee'
                          : u.status === 'caught'
                          ? '#4ade80'
                          : '#f472b6';
                      return (
                        <div
                          key={u.id}
                          className="absolute rounded-sm flex items-center justify-center font-bold pointer-events-none"
                          style={{
                            left: u.x * (cellSize + gap) + 1,
                            top: u.y * (cellSize + gap) + 1,
                            width: cellSize - 2,
                            height: cellSize - 2,
                            background: color,
                            color: '#0b0f1a',
                            fontSize: Math.max(8, cellSize * 0.42),
                            boxShadow:
                              selected?.id === u.id
                                ? '0 0 0 2px #fff'
                                : u.hunkered
                                ? 'inset 0 0 0 2px #38bdf8'
                                : u.inCover
                                ? 'inset 0 0 0 2px #fde68a'
                                : '0 1px 2px rgba(0,0,0,0.5)',
                            opacity: u.status !== 'active' ? 0.55 : 1,
                            zIndex: 5,
                          }}
                          title={`${u.name}${u.armed && u.side === 'perp' ? ' (armed)' : ''}`}
                        >
                          {u.side === 'cop' ? 'C' : 'P'}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-synth-muted px-1">
                {legend.map((item) => (
                  <span key={item.zone} className="inline-flex items-center gap-1">
                    <i
                      className="inline-block w-2 h-2 rounded-sm"
                      style={{ background: FLOOR_ZONE_COLORS[item.zone] }}
                    />
                    {item.label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <i className="inline-block w-2 h-2 rounded-sm bg-indigo-400" />⇅ Stairs
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="inline-block w-2 h-2 rounded-sm bg-red-800" />
                  {gateOnThisFloor ? '⌂ Gate (escape)' : 'Gate below'}
                </span>
              </div>

              {game.lastSuspectMoves.length > 0 && (
                <div className="mx-1 rounded border border-neon-magenta/30 bg-neon-magenta/10 px-2 py-1">
                  <p className="text-[9px] font-display uppercase tracking-wider text-neon-magenta">
                    Suspects' move
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {game.lastSuspectMoves.map((note, i) => (
                      <li key={i} className="text-[10px] text-gray-300 leading-snug">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ul className="space-y-0.5 max-h-16 overflow-y-auto px-1">
                {[...game.log].reverse().slice(0, 4).map((e, i) => (
                  <li
                    key={`${e.turn}-${i}`}
                    className={`text-[10px] leading-snug ${
                      e.tone === 'good'
                        ? 'text-neon-green'
                        : e.tone === 'bad'
                        ? 'text-neon-magenta'
                        : e.tone === 'warn'
                        ? 'text-neon-amber'
                        : e.tone === 'radio'
                        ? 'text-sky-300'
                        : 'text-gray-500'
                    }`}
                  >
                    {e.text}
                  </li>
                ))}
              </ul>
            </>
          )}

          {game.phase === 'completed' && game.result && (
            <div className="space-y-3 px-1">
              <h4
                className={`font-display font-bold text-lg ${
                  game.result.outcome === 'total_win'
                    ? 'neon-text-green'
                    : game.result.outcome === 'partial_win'
                    ? 'neon-text-cyan'
                    : 'text-neon-magenta'
                }`}
              >
                {game.result.outcome === 'total_win'
                  ? 'Building cleared'
                  : game.result.outcome === 'partial_win'
                  ? 'Partial hold'
                  : 'Suspects escaped'}
              </h4>
              <p className="text-[11px] text-synth-muted">
                {MODE_LABEL[game.mode]} · {game.result.caught}/{game.result.totalPerps} caught ·{' '}
                {game.shotsFired} shots · Score {game.result.score}
              </p>

              {showEscapeFaces && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 p-2 text-center">
                    <div className="text-3xl" aria-hidden>😢</div>
                    <p className="text-[10px] text-sky-200 mt-1 font-display uppercase">Citizens</p>
                  </div>
                  <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-center">
                    <div className="text-3xl" aria-hidden>😠</div>
                    <p className="text-[10px] text-red-200 mt-1 font-display uppercase">Chief</p>
                  </div>
                </div>
              )}

              {evalLoading ? (
                <p className="text-xs text-neon-cyan animate-pulse font-display">AI grading…</p>
              ) : evaluation ? (
                <div className="flex items-start gap-2">
                  <p className="text-3xl font-display font-bold text-white leading-none">{evaluation.grade}</p>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[11px] text-gray-200 leading-snug">{evaluation.summary}</p>
                    <p className="text-[10px] text-gray-400 leading-snug">{evaluation.strategyAnalysis}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-serpico-blue/50 bg-serpico-blue/20 px-3 py-2 text-xs font-display font-bold uppercase text-serpico-blue"
              >
                Back to map chase
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationTacticsPanel;
