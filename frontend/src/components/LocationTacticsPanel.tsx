import React, { useEffect, useMemo } from 'react';
import {
  LocationAIEvaluation,
  LocationTacticsGame,
  MOVE_BLOCKS_PER_TURN,
  SHOOT_RANGE_BLOCKS,
  reachableCells,
  selectTacticsOfficer,
  shootTargets,
  tacticsCancelOfficer,
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
  const activeCops = game.units.filter((u) => u.side === 'cop' && u.status === 'active');
  const actedSet = useMemo(() => new Set(game.actedOfficerIds ?? []), [game.actedOfficerIds]);
  const pendingOfficers = activeCops.filter((o) => !actedSet.has(o.id)).length;
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

  // Animate bullets one step at a time
  useEffect(() => {
    if (game.phase !== 'active' || game.bullets.length === 0) return;
    const id = window.setTimeout(() => {
      onChange(tickBullets(game));
    }, 70);
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
              {MODE_LABEL[game.mode] || 'On-site'} · {game.landmarkName}
            </p>
            <p className="text-[11px] text-gray-300 truncate">
              {game.phase === 'completed'
                ? game.result?.message
                : `T${game.turn}/${game.maxTurns} · ${activePerps} active · tap to expand map`}
            </p>
          </div>
          <span className="text-[10px] text-neon-cyan font-display uppercase flex-shrink-0">Expand</span>
        </button>
      </div>
    );
  }

  const cellSize = Math.max(18, Math.min(28, Math.floor(300 / Math.max(game.width, game.height))));

  return (
    <div className="absolute inset-x-2 top-2 bottom-2 sm:inset-auto sm:top-2 sm:right-2 sm:bottom-2 sm:w-[380px] z-[1150] pointer-events-auto flex flex-col">
      <div className="game-panel border border-neon-amber/45 flex flex-col max-h-full overflow-hidden shadow-xl">
        <div className="px-3 py-2 border-b border-white/10 flex items-start justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
              {MODE_LABEL[game.mode]} · visual tactics
            </p>
            <h3 className="font-display font-bold text-sm text-white truncate">{game.landmarkName}</h3>
            <p className="text-[11px] text-gray-300 truncate">{game.scenarioTitle}</p>
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
              <p className="text-[10px] text-gray-300 leading-snug px-1">{game.briefing}</p>

              <div className="flex flex-wrap gap-2 text-[10px] font-mono px-1">
                <span className="text-neon-cyan">T{game.turn}/{game.maxTurns}</span>
                <span className="text-neon-green">Caught {caught}</span>
                <span className="text-neon-magenta">Loose {activePerps}</span>
                <span className="text-gray-400">Esc {escaped}</span>
                <span className="text-neon-amber">
                  {pendingOfficers} officer{pendingOfficers === 1 ? '' : 's'} left
                </span>
                {selected && (
                  <span className="text-gray-300">
                    {actedSet.has(selected.id) ? 'Acted' : '1 block / hold'}
                    {game.mode === 'gunfight' && selected.status === 'active' ? ` · Ammo ${selected.ammo}` : ''}
                  </span>
                )}
              </div>

              <p className="text-[9px] text-synth-muted px-1 leading-snug">
                Turn-based: each officer moves {MOVE_BLOCKS_PER_TURN} block, shoots (≤{SHOOT_RANGE_BLOCKS} blocks), or holds — then suspects push toward the main entrance (IN).
              </p>

              <div className="flex flex-wrap gap-1 px-1">
                {game.units
                  .filter((u) => u.side === 'cop')
                  .map((o) => {
                    const acted = actedSet.has(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={o.status !== 'active' || acted}
                        onClick={() => onChange(selectTacticsOfficer(game, o.id))}
                        className={`px-2 py-1 rounded text-[10px] border min-h-0 min-w-0 ${
                          o.status !== 'active'
                            ? 'border-gray-600 text-gray-500'
                            : acted
                            ? 'border-white/10 text-gray-500'
                            : selected?.id === o.id
                            ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                            : 'border-white/15 text-gray-200'
                        }`}
                      >
                        {o.name}
                        {o.status !== 'active' ? ' (down)' : acted ? ' ✓' : ''}
                      </button>
                    );
                  })}
                {selected && selected.status === 'active' && !actedSet.has(selected.id) && (
                  <button
                    type="button"
                    onClick={() => onChange(tacticsCancelOfficer(game, selected.id))}
                    className="px-2 py-1 rounded text-[10px] border border-neon-amber/40 text-neon-amber min-h-0 min-w-0"
                  >
                    Hold
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChange(tacticsWait(game))}
                  className="px-2 py-1 rounded text-[10px] border border-white/15 text-gray-300 min-h-0 min-w-0"
                >
                  End round
                </button>
              </div>

              {/* Building-block map */}
              <div className="relative mx-auto rounded-md border border-white/10 bg-[#07050f] p-1 overflow-auto">
                <div
                  className="relative grid gap-[2px]"
                  style={{
                    gridTemplateColumns: `repeat(${game.width}, ${cellSize}px)`,
                    width: game.width * (cellSize + 2),
                  }}
                >
                  {game.cells.map((cell) => {
                    const fog = !game.revealed[cell.y]?.[cell.x] && game.mode !== 'gunfight';
                    const canMove = reachSet.has(`${cell.x},${cell.y}`);
                    const canShoot = targetSet.has(`${cell.x},${cell.y}`);
                    let bg = '#1a1430';
                    if (cell.kind === 'wall') bg = '#3f3f46';
                    else if (cell.kind === 'cover') bg = '#78716c';
                    else if (cell.kind === 'exit') bg = '#7f1d1d';
                    else if (cell.kind === 'spawn') bg = '#164e63';
                    if (fog) bg = '#09090b';
                    if (canMove) bg = '#155e75';
                    if (canShoot) bg = '#9f1239';

                    return (
                      <button
                        key={`${cell.x}-${cell.y}`}
                        type="button"
                        disabled={game.phase !== 'active' || (fog && game.mode === 'hide' && !canMove)}
                        onClick={() => onChange(tacticsInteractCell(game, cell.x, cell.y))}
                        className="relative min-h-0 min-w-0 p-0 border-0"
                        style={{ width: cellSize, height: cellSize, background: bg }}
                        aria-label={`cell ${cell.x},${cell.y}`}
                      >
                        {cell.kind === 'cover' && !fog && (
                          <span className="absolute inset-0.5 border border-amber-200/40 rounded-sm" />
                        )}
                        {cell.kind === 'exit' && !fog && (
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] text-red-200 font-bold">
                            E
                          </span>
                        )}
                        {cell.kind === 'spawn' && !fog && (
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] text-cyan-100 font-bold">
                            IN
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Units */}
                  {game.units.map((u) => {
                    if (u.side === 'perp' && !u.spotted && u.status === 'active') return null;
                    if (u.status === 'escaped') return null;
                    const left = u.x * (cellSize + 2) + 2;
                    const top = u.y * (cellSize + 2) + 2;
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
                          left,
                          top,
                          width: cellSize - 2,
                          height: cellSize - 2,
                          background: color,
                          color: '#0b0f1a',
                          fontSize: Math.max(8, cellSize * 0.4),
                          boxShadow:
                            selected?.id === u.id ? '0 0 0 2px #fff' : u.inCover ? 'inset 0 0 0 2px #fde68a' : undefined,
                          opacity: u.status === 'hurt' ? 0.55 : 1,
                          zIndex: 5,
                        }}
                        title={u.name}
                      >
                        {u.side === 'cop' ? 'C' : 'P'}
                      </div>
                    );
                  })}

                  {/* Bullets */}
                  {game.bullets.map((b) => (
                    <div
                      key={b.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        left: b.x * (cellSize + 2) + cellSize * 0.35,
                        top: b.y * (cellSize + 2) + cellSize * 0.35,
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

              <div className="flex flex-wrap gap-2 text-[9px] text-synth-muted px-1">
                <span><i className="inline-block w-2 h-2 rounded-sm bg-cyan-400 mr-1" />Cops</span>
                <span><i className="inline-block w-2 h-2 rounded-sm bg-pink-400 mr-1" />Perps (when spotted)</span>
                <span><i className="inline-block w-2 h-2 rounded-sm bg-stone-500 mr-1" />Cover</span>
                <span><i className="inline-block w-2 h-2 rounded-sm bg-cyan-950 mr-1 border border-cyan-400/40" />Main entrance (IN)</span>
                <span><i className="inline-block w-2 h-2 rounded-sm bg-red-900 mr-1" />Side exit</span>
              </div>

              <ul className="space-y-0.5 max-h-20 overflow-y-auto px-1">
                {[...game.log].reverse().slice(0, 6).map((e, i) => (
                  <li
                    key={`${e.turn}-${i}`}
                    className={`text-[10px] leading-snug ${
                      e.tone === 'good'
                        ? 'text-neon-green'
                        : e.tone === 'bad'
                        ? 'text-neon-magenta'
                        : e.tone === 'warn'
                        ? 'text-neon-amber'
                        : 'text-gray-400'
                    }`}
                  >
                    <span className="text-synth-muted">T{e.turn}</span> {e.text}
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
              <p className="text-[12px] text-gray-200">{game.result.message}</p>
              <p className="text-[11px] text-synth-muted">
                {MODE_LABEL[game.mode]} · Caught {game.result.caught}/{game.result.totalPerps} · Hurt{' '}
                {game.result.officersHurt} · Score {game.result.score}
              </p>

              {showEscapeFaces && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 p-2 text-center">
                    <div className="text-3xl" aria-hidden>😢</div>
                    <p className="text-[10px] text-sky-200 mt-1 font-display uppercase">Citizens</p>
                    <p className="text-[10px] text-gray-300">Neighborhood feels less safe.</p>
                  </div>
                  <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-center">
                    <div className="text-3xl" aria-hidden>😠</div>
                    <p className="text-[10px] text-red-200 mt-1 font-display uppercase">Chief</p>
                    <p className="text-[10px] text-gray-300">Wants answers on the failure.</p>
                  </div>
                </div>
              )}

              {evalLoading ? (
                <p className="text-xs text-neon-cyan animate-pulse font-display">AI grading the raid…</p>
              ) : evaluation ? (
                <div className="flex items-start gap-2">
                  <p className="text-3xl font-display font-bold text-white leading-none">{evaluation.grade}</p>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[11px] text-gray-200 leading-snug">{evaluation.summary}</p>
                    <p className="text-[10px] text-gray-400 leading-snug">{evaluation.strategyAnalysis}</p>
                    <p className="text-[10px] text-gray-400 leading-snug">{evaluation.resourceAnalysis}</p>
                    {evaluation.improvements?.[0] && (
                      <p className="text-[10px] text-neon-amber leading-snug">Next: {evaluation.improvements[0]}</p>
                    )}
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
