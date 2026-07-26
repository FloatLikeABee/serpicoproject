import React, { useEffect, useMemo } from 'react';
import {
  FLOOR_ZONE_COLORS,
  FloorZone,
  LocationAIEvaluation,
  LocationTacticsGame,
  reachableCells,
  selectTacticsOfficer,
  shootTargets,
  tacticsInteractCell,
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
    { zone: 'alley', label: 'Alley' },
  ],
  club: [
    { zone: 'dance', label: 'Dance' },
    { zone: 'stage', label: 'Stage' },
    { zone: 'vip', label: 'VIP' },
    { zone: 'bar', label: 'Bar' },
    { zone: 'loading', label: 'Loading' },
  ],
  factory: [
    { zone: 'machine', label: 'Assembly' },
    { zone: 'office', label: 'Office' },
    { zone: 'basement', label: 'Pit' },
    { zone: 'loading', label: 'Dock' },
  ],
  projects: [
    { zone: 'court', label: 'Court' },
    { zone: 'unit', label: 'Units' },
    { zone: 'stair', label: 'Stairs' },
    { zone: 'basement', label: 'Laundry' },
  ],
};

function cellFill(
  zone: FloorZone,
  kind: string,
  fog: boolean,
  canMove: boolean,
  canShoot: boolean
): string {
  if (fog) return '#0a0a0c';
  if (canShoot) return '#9f1239';
  if (canMove) return '#0e7490';
  if (kind === 'wall') return FLOOR_ZONE_COLORS.wall;
  if (kind === 'exit') return '#7f1d1d';
  if (kind === 'spawn') return '#155e75';
  if (kind === 'cover') {
    // Darken zone color for cover furniture
    return FLOOR_ZONE_COLORS[zone] || '#78716c';
  }
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
  const selected = game.units.find((u) => u.id === game.selectedUnitId && u.side === 'cop');
  const reach = useMemo(
    () => (selected && game.phase === 'active' ? reachableCells(game, selected.id) : []),
    [game, selected]
  );
  const targets = useMemo(
    () => (selected && game.phase === 'active' ? shootTargets(game, selected.id) : []),
    [game, selected]
  );
  const reachSet = useMemo(() => new Set(reach.map((c) => `${c.x},${c.y}`)), [reach]);
  const targetSet = useMemo(() => new Set(targets.map((t) => `${t.x},${t.y}`)), [targets]);

  const caught = game.units.filter((u) => u.side === 'perp' && u.status === 'caught').length;
  const escaped = game.units.filter((u) => u.side === 'perp' && u.status === 'escaped').length;
  const activePerps = game.units.filter((u) => u.side === 'perp' && u.status === 'active').length;
  const showEscapeFaces =
    !!game.result &&
    (game.result.outcome === 'escaped' || (game.result.escaped > 0 && game.result.outcome !== 'total_win'));

  useEffect(() => {
    if (game.phase !== 'active' || game.bullets.length === 0) return;
    const id = window.setTimeout(() => onChange(tickBullets(game)), 70);
    return () => window.clearTimeout(id);
  }, [game.phase, game.bullets, onChange, game]);

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
                : `Floor map · T${game.turn}/${game.maxTurns} · ${activePerps} loose`}
            </p>
          </div>
          <span className="text-[10px] text-neon-cyan font-display uppercase flex-shrink-0">Expand</span>
        </button>
      </div>
    );
  }

  const gap = 1;
  const cellSize = Math.max(16, Math.min(26, Math.floor(320 / Math.max(game.width, game.height))));
  const mapW = game.width * (cellSize + gap);
  const mapH = game.height * (cellSize + gap);
  const legend = VENUE_LEGEND[game.landmarkKind] || [];

  return (
    <div className="absolute inset-x-2 top-2 bottom-2 sm:inset-auto sm:top-2 sm:right-2 sm:bottom-2 sm:w-[400px] z-[1150] pointer-events-auto flex flex-col">
      <div className="game-panel border border-neon-amber/45 flex flex-col max-h-full overflow-hidden shadow-xl">
        <div className="px-3 py-2 border-b border-white/10 flex items-start justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
              {MODE_LABEL[game.mode]} · floor map
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
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono px-1">
                <span className="text-neon-cyan">T{game.turn}/{game.maxTurns}</span>
                <span className="text-neon-green">✓{caught}</span>
                <span className="text-neon-magenta">●{activePerps}</span>
                <span className="text-gray-500">↗{escaped}</span>
                {selected && (
                  <span className="text-neon-amber">
                    AP{selected.ap}
                    {game.mode === 'gunfight' ? ` Ammo${selected.ammo}` : ''}
                  </span>
                )}
                <span className="text-synth-muted truncate">{game.briefing}</span>
              </div>

              <div className="flex flex-wrap gap-1 px-1">
                {game.units
                  .filter((u) => u.side === 'cop')
                  .map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      disabled={o.status !== 'active'}
                      onClick={() => onChange(selectTacticsOfficer(game, o.id))}
                      className={`px-2 py-1 rounded text-[10px] border min-h-0 min-w-0 ${
                        o.status !== 'active'
                          ? 'border-gray-600 text-gray-500'
                          : selected?.id === o.id
                          ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                          : 'border-white/15 text-gray-200'
                      }`}
                    >
                      {o.name.replace('Ofc. ', '')}
                      {o.status !== 'active' ? ' ↓' : ''}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => onChange(tacticsWait(game))}
                  className="px-2 py-1 rounded text-[10px] border border-white/15 text-gray-300 min-h-0 min-w-0"
                >
                  End turn
                </button>
              </div>

              {/* Venue floor map */}
              <div className="relative mx-auto rounded-md border border-white/15 bg-[#05040a] p-1.5 overflow-auto">
                <div className="relative" style={{ width: mapW, height: mapH }}>
                  {game.cells.map((cell) => {
                    const fog = !game.revealed[cell.y]?.[cell.x] && game.mode !== 'gunfight';
                    const canMove = reachSet.has(`${cell.x},${cell.y}`);
                    const canShoot = targetSet.has(`${cell.x},${cell.y}`);
                    const bg = cellFill(cell.zone, cell.kind, fog, canMove, canShoot);
                    return (
                      <button
                        key={`${cell.x}-${cell.y}`}
                        type="button"
                        disabled={game.phase !== 'active' || (fog && game.mode === 'hide' && !canMove)}
                        onClick={() => onChange(tacticsInteractCell(game, cell.x, cell.y))}
                        className="absolute min-h-0 min-w-0 p-0 border-0"
                        style={{
                          left: cell.x * (cellSize + gap),
                          top: cell.y * (cellSize + gap),
                          width: cellSize,
                          height: cellSize,
                          background: bg,
                          boxShadow:
                            cell.kind === 'cover' && !fog
                              ? 'inset 0 0 0 1px rgba(253,230,138,0.45)'
                              : cell.kind === 'exit' && !fog
                              ? 'inset 0 0 0 1px rgba(252,165,165,0.7)'
                              : undefined,
                        }}
                        aria-label={`${cell.zone} ${cell.x},${cell.y}`}
                      />
                    );
                  })}

                  {/* Room labels */}
                  {(game.labels || []).map((label) => {
                    const fogged =
                      game.mode !== 'gunfight' &&
                      !game.revealed[label.y]?.[label.x];
                    if (fogged) return null;
                    return (
                      <div
                        key={label.id}
                        className="absolute pointer-events-none flex items-start justify-start overflow-hidden"
                        style={{
                          left: label.x * (cellSize + gap) + 2,
                          top: label.y * (cellSize + gap) + 1,
                          width: label.w * (cellSize + gap) - 4,
                          height: label.h * (cellSize + gap) - 2,
                          zIndex: 2,
                        }}
                      >
                        <span
                          className="px-0.5 rounded text-[8px] font-semibold uppercase tracking-wide text-white/70 bg-black/35 leading-tight"
                          style={{ fontSize: Math.max(7, Math.min(9, cellSize * 0.42)) }}
                        >
                          {label.name}
                        </span>
                      </div>
                    );
                  })}

                  {/* Units */}
                  {game.units.map((u) => {
                    if (u.side === 'perp' && !u.spotted && u.status === 'active') return null;
                    if (u.status === 'escaped') return null;
                    const color =
                      u.side === 'cop'
                        ? u.status === 'hurt'
                          ? '#64748b'
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
                              : u.inCover
                              ? 'inset 0 0 0 2px #fde68a'
                              : '0 1px 2px rgba(0,0,0,0.5)',
                          opacity: u.status === 'hurt' ? 0.55 : 1,
                          zIndex: 5,
                        }}
                        title={u.name}
                      >
                        {u.side === 'cop' ? 'C' : 'P'}
                      </div>
                    );
                  })}

                  {game.bullets.map((b) => (
                    <div
                      key={b.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        left: b.x * (cellSize + gap) + cellSize * 0.35,
                        top: b.y * (cellSize + gap) + cellSize * 0.35,
                        width: Math.max(4, cellSize * 0.28),
                        height: Math.max(4, cellSize * 0.28),
                        background: b.side === 'cop' ? '#fde047' : '#fb7185',
                        boxShadow: `0 0 6px ${b.side === 'cop' ? '#fde047' : '#fb7185'}`,
                        zIndex: 8,
                      }}
                    />
                  ))}
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
                  <i className="inline-block w-2 h-2 rounded-sm bg-red-800" />Exit
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="inline-block w-2 h-2 rounded-sm bg-cyan-400" />Cop
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="inline-block w-2 h-2 rounded-sm bg-pink-400" />Perp
                </span>
              </div>

              <ul className="space-y-0.5 max-h-14 overflow-y-auto px-1">
                {[...game.log].reverse().slice(0, 3).map((e, i) => (
                  <li
                    key={`${e.turn}-${i}`}
                    className={`text-[10px] leading-snug ${
                      e.tone === 'good'
                        ? 'text-neon-green'
                        : e.tone === 'bad'
                        ? 'text-neon-magenta'
                        : e.tone === 'warn'
                        ? 'text-neon-amber'
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
                  ? 'Site secured'
                  : game.result.outcome === 'partial_win'
                  ? 'Partial win'
                  : 'Suspects escaped'}
              </h4>
              <p className="text-[11px] text-synth-muted">
                {MODE_LABEL[game.mode]} · {game.result.caught}/{game.result.totalPerps} · Score{' '}
                {game.result.score}
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
