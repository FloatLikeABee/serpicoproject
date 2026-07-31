import React, { useEffect, useMemo } from 'react';
import {
  LocationAIEvaluation,
  LocationTacticsGame,
  MOVE_BLOCKS_PER_TURN,
  SHOOT_RANGE_BLOCKS,
  arrestTargets,
  computeShotHitChance,
  dangerCells,
  reachableCells,
  resolvePerpTurn,
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
    () => (selected && game.phase === 'active' && game.roundPhase === 'player' ? reachableCells(game, selected.id) : []),
    [game, selected]
  );
  const targets = useMemo(
    () => (selected && game.phase === 'active' && game.roundPhase === 'player' ? shootTargets(game, selected.id) : []),
    [game, selected]
  );
  const arrests = useMemo(
    () => (selected && game.phase === 'active' && game.roundPhase === 'player' ? arrestTargets(game, selected.id) : []),
    [game, selected]
  );
  const reachSet = useMemo(() => new Set(reach.map((c) => `${c.x},${c.y}`)), [reach]);
  const targetSet = useMemo(() => new Set(targets.map((t) => `${t.x},${t.y}`)), [targets]);
  const arrestSet = useMemo(() => new Set(arrests.map((t) => `${t.x},${t.y}`)), [arrests]);
  const danger = useMemo(
    () =>
      game.phase === 'active' && game.mode === 'gunfight' && game.roundPhase === 'player'
        ? dangerCells(game)
        : [],
    [game]
  );
  const dangerSet = useMemo(() => new Set(danger.map((c) => `${c.x},${c.y}`)), [danger]);
  const targetHitPct = useMemo(() => {
    const map = new Map<string, number>();
    if (!selected || game.phase !== 'active') return map;
    for (const t of targets) {
      map.set(`${t.x},${t.y}`, Math.round(computeShotHitChance(game, selected, t) * 100));
    }
    return map;
  }, [game, selected, targets]);

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

  // Suspect turn — brief pause, then resolve movement
  useEffect(() => {
    if (game.phase !== 'active' || game.roundPhase !== 'perp') return;
    const id = window.setTimeout(() => {
      onChange(resolvePerpTurn(game));
    }, 850);
    return () => window.clearTimeout(id);
  }, [game.phase, game.roundPhase, game.turn, onChange, game]);

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

  const gap = 2;
  // Fit the full floor plan in a larger panel — prefer showing every row/column.
  const mapBudgetW = 460;
  const mapBudgetH = 340;
  const cellByW = Math.floor(mapBudgetW / game.width) - gap;
  const cellByH = Math.floor(mapBudgetH / game.height) - gap;
  const cellSize = Math.max(16, Math.min(30, Math.min(cellByW, cellByH)));
  const gridW = game.width * (cellSize + gap);
  const gridH = game.height * (cellSize + gap);

  return (
    <div className="absolute inset-1.5 sm:inset-2 z-[1150] pointer-events-auto flex flex-col sm:left-auto sm:right-2 sm:w-[min(520px,calc(100vw-1rem))]">
      <div className="game-panel border border-neon-amber/45 flex flex-col h-full max-h-full overflow-hidden shadow-xl">
        <div className="px-3 py-1.5 border-b border-white/10 flex items-start justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
              {MODE_LABEL[game.mode]} · visual tactics
            </p>
            <h3 className="font-display font-bold text-sm text-white truncate">{game.landmarkName}</h3>
            <p className="text-[10px] text-gray-400 truncate">{game.scenarioTitle}</p>
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

        {game.phase !== 'completed' ? (
          <>
            <div className="px-2 pt-1.5 pb-1 space-y-1 flex-shrink-0 border-b border-white/5">
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono px-0.5">
                <span className="text-neon-cyan">T{game.turn}/{game.maxTurns}</span>
                <span
                  className={
                    game.roundPhase === 'player' ? 'text-neon-green font-semibold' : 'text-neon-magenta animate-pulse'
                  }
                >
                  {game.roundPhase === 'player' ? 'Your turn' : 'Suspects moving…'}
                </span>
                <span className="text-neon-green">Caught {caught}</span>
                <span className="text-neon-magenta">Loose {activePerps}</span>
                <span className="text-gray-400">Esc {escaped}</span>
                <span className="text-neon-amber">
                  {pendingOfficers} left
                </span>
                {selected && game.mode !== 'gunfight' && (
                  <span className="text-gray-300">Ammo {selected.ammo}</span>
                )}
                {selected && game.mode === 'gunfight' && selected.status === 'active' && (
                  <span className="text-gray-300">Ammo {selected.ammo}</span>
                )}
              </div>

              <p className="text-[9px] text-synth-muted px-0.5 leading-snug line-clamp-2">
                {game.mode === 'gunfight' ? (
                  <>
                    <span className="text-neon-cyan">2 actions</span> each: teal = move, red = fire (≤
                    {SHOOT_RANGE_BLOCKS}), green = cuff. Suspects fire once/turn.
                  </>
                ) : game.mode === 'hide' ? (
                  <>
                    Tap your cell to search. Adjacent = <span className="text-neon-green">cuff</span>, 2
                    blocks = <span className="text-red-300">shoot</span>. Suspects flee to IN.
                  </>
                ) : (
                  <>
                    Move/skip, then suspects flee &amp; may <span className="text-red-300">fire once</span>.
                    Cuff or shoot.
                  </>
                )}
              </p>

              {(game.mode === 'hide' || game.mode === 'chase' || game.mode === 'gunfight') &&
                selected &&
                selected.status === 'active' &&
                !actedSet.has(selected.id) &&
                game.roundPhase === 'player' && (
                  <p className="text-[9px] px-0.5 leading-snug truncate">
                    {game.mode === 'gunfight' && (
                      <span className="text-neon-cyan mr-2">AP {selected.ap}</span>
                    )}
                    {arrests.length > 0 ? (
                      <span className="text-neon-green">
                        Tap green to cuff ({arrests.map((t) => t.name).join(', ')})
                      </span>
                    ) : targets.length > 0 ? (
                      <span className="text-red-200">
                        Tap red to shoot (
                        {targets
                          .map((t) => `${t.name} ${targetHitPct.get(`${t.x},${t.y}`) ?? 0}%`)
                          .join(', ')}
                        )
                      </span>
                    ) : reach.length > 0 ? (
                      <span className="text-neon-cyan">Tap teal to move {MOVE_BLOCKS_PER_TURN} block</span>
                    ) : null}
                  </p>
                )}

              <div className="flex flex-wrap gap-1">
                {game.units
                  .filter((u) => u.side === 'cop')
                  .map((o) => {
                    const acted = actedSet.has(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={o.status !== 'active' || acted || game.roundPhase !== 'player'}
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
                        {o.status !== 'active'
                          ? ' (down)'
                          : acted
                          ? ' ✓'
                          : game.mode === 'gunfight'
                          ? ` ·${o.ap}`
                          : ''}
                      </button>
                    );
                  })}
                {selected && selected.status === 'active' && !actedSet.has(selected.id) && (
                  <button
                    type="button"
                    onClick={() => onChange(tacticsCancelOfficer(game, selected.id))}
                    disabled={game.roundPhase !== 'player'}
                    className="px-2 py-1 rounded text-[10px] border border-neon-amber/40 text-neon-amber min-h-0 min-w-0 disabled:opacity-40"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChange(tacticsWait(game))}
                  disabled={game.roundPhase !== 'player'}
                  className="px-2 py-1 rounded text-[10px] border border-white/15 text-gray-300 min-h-0 min-w-0 disabled:opacity-40"
                >
                  Skip all
                </button>
              </div>
            </div>

            {/* Map region — dedicated space so the full floor plan stays visible */}
            <div className="flex-1 min-h-0 overflow-auto px-2 py-2">
              <div
                className="relative mx-auto rounded-md border border-white/10 bg-[#07050f] p-1.5"
                style={{ width: gridW + 12, minHeight: gridH + 12 }}
              >
                {game.roundPhase === 'perp' && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 rounded-md pointer-events-none">
                    <p className="text-[11px] font-display uppercase tracking-wider text-neon-magenta animate-pulse">
                      Suspects moving…
                    </p>
                  </div>
                )}
                <div
                  className="relative grid"
                  style={{
                    gridTemplateColumns: `repeat(${game.width}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${game.height}, ${cellSize}px)`,
                    gap: `${gap}px`,
                    width: gridW,
                    height: gridH,
                  }}
                >
                  {game.cells.map((cell) => {
                    const fog = !game.revealed[cell.y]?.[cell.x] && game.mode !== 'gunfight';
                    const canMove = reachSet.has(`${cell.x},${cell.y}`);
                    const canShoot = targetSet.has(`${cell.x},${cell.y}`);
                    const canArrest = arrestSet.has(`${cell.x},${cell.y}`);
                    const inDanger = dangerSet.has(`${cell.x},${cell.y}`);
                    const hitPct = targetHitPct.get(`${cell.x},${cell.y}`);
                    let bg = '#1a1430';
                    if (cell.kind === 'wall') bg = '#3f3f46';
                    else if (cell.kind === 'cover') bg = '#78716c';
                    else if (cell.kind === 'exit') bg = '#7f1d1d';
                    else if (cell.kind === 'spawn') bg = '#164e63';
                    if (fog) bg = '#09090b';
                    if (inDanger && !canMove && !canShoot && !canArrest && !fog) bg = '#3f1d2e';
                    if (canMove) bg = '#155e75';
                    if (canShoot) bg = '#9f1239';
                    if (canArrest) bg = '#166534';

                    return (
                      <button
                        key={`${cell.x}-${cell.y}`}
                        type="button"
                        disabled={
                          game.phase !== 'active' ||
                          game.roundPhase !== 'player' ||
                          (fog && game.mode === 'hide' && !canMove)
                        }
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
                        {canShoot && hitPct !== undefined && (
                          <span className="absolute inset-0 flex items-end justify-center pb-0.5 text-[7px] text-red-100 font-bold leading-none z-[2]">
                            {hitPct}%
                          </span>
                        )}
                        {canArrest && (
                          <span className="absolute inset-0 flex items-end justify-center pb-0.5 text-[7px] text-green-100 font-bold leading-none z-[2]">
                            CUFF
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {game.units.map((u) => {
                    if (u.side === 'perp' && !u.spotted && u.status === 'active') return null;
                    if (u.status === 'escaped') return null;
                    const left = u.x * (cellSize + gap);
                    const top = u.y * (cellSize + gap);
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
                          width: cellSize - 1,
                          height: cellSize - 1,
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

              <div className="flex flex-wrap gap-2 text-[9px] text-synth-muted px-1 mt-1.5 justify-center">
                <span><i className="inline-block w-2 h-2 rounded-sm bg-cyan-400 mr-1" />Cops</span>
                <span><i className="inline-block w-2 h-2 rounded-sm bg-pink-400 mr-1" />Perps</span>
                <span><i className="inline-block w-2 h-2 rounded-sm bg-stone-500 mr-1" />Cover</span>
                <span><i className="inline-block w-2 h-2 rounded-sm bg-cyan-950 mr-1 border border-cyan-400/40" />IN</span>
                <span><i className="inline-block w-2 h-2 rounded-sm bg-red-900 mr-1" />Exit</span>
              </div>
            </div>

            <ul className="flex-shrink-0 space-y-0.5 max-h-16 overflow-y-auto px-2 py-1.5 border-t border-white/5">
              {[...game.log].reverse().slice(0, 5).map((e, i) => (
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
        ) : (
          game.result && (
            <div className="px-3 py-3 flex-1 overflow-y-auto space-y-3 min-h-0">
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
                    <div className="text-3xl" aria-hidden>
                      😢
                    </div>
                    <p className="text-[10px] text-sky-200 mt-1 font-display uppercase">Citizens</p>
                    <p className="text-[10px] text-gray-300">Neighborhood feels less safe.</p>
                  </div>
                  <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-center">
                    <div className="text-3xl" aria-hidden>
                      😠
                    </div>
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
          )
        )}
      </div>
    </div>
  );
};

export default LocationTacticsPanel;
