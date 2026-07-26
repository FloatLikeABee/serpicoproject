import React, { useMemo } from 'react';
import {
  LocationAIEvaluation,
  LocationTacticsGame,
  TacticsOfficer,
  beginTacticsRaid,
  selectTacticsOfficer,
  tacticsClear,
  tacticsCoverExit,
  tacticsMove,
  tacticsScout,
  tacticsWait,
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

function OfficerChip({
  officer,
  selected,
  roomName,
  onSelect,
}: {
  officer: TacticsOfficer;
  selected: boolean;
  roomName: string;
  onSelect: () => void;
}) {
  const hurt = officer.status === 'hurt';
  return (
    <button
      type="button"
      disabled={hurt}
      onClick={onSelect}
      className={`px-2 py-1 rounded-md text-left text-[10px] border transition-colors min-h-0 min-w-0 ${
        hurt
          ? 'border-gray-600 bg-gray-800/40 text-gray-500'
          : selected
          ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
          : 'border-white/15 bg-black/30 text-gray-200 hover:border-neon-cyan/40'
      }`}
    >
      <div className="font-display font-bold truncate">{officer.name}</div>
      <div className="text-synth-muted truncate">
        {hurt ? 'Hurt — out' : officer.coveringExit ? `Covering ${roomName}` : roomName}
      </div>
    </button>
  );
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
  const selected = game.officers.find((o) => o.id === game.selectedOfficerId) ?? null;
  const selectedRoom = game.rooms.find((r) => r.id === selected?.roomId);
  const adjacent = useMemo(() => {
    if (!selectedRoom) return [];
    return selectedRoom.connectedTo
      .map((id) => game.rooms.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => !!r);
  }, [game.rooms, selectedRoom]);

  const caught = game.perps.filter((p) => p.status === 'caught').length;
  const escaped = game.perps.filter((p) => p.status === 'escaped').length;
  const activePerps = game.perps.filter((p) => p.status === 'hiding' || p.status === 'fleeing').length;
  const escapedOutcome = game.result?.outcome === 'escaped' || (game.result && game.result.escaped > 0 && game.result.caught === 0);

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
              On-site · {game.landmarkName}
            </p>
            <p className="text-[11px] text-gray-300 truncate">
              {game.phase === 'completed'
                ? game.result?.message
                : `${game.scenarioTitle} · T${game.turn}/${game.maxTurns} · ${activePerps} active suspects`}
            </p>
          </div>
          <span className="text-[10px] text-neon-cyan font-display uppercase flex-shrink-0">Expand</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-2 top-2 bottom-2 sm:inset-auto sm:top-2 sm:right-2 sm:bottom-2 sm:w-[360px] z-[1150] pointer-events-auto flex flex-col">
      <div className="game-panel border border-neon-amber/45 flex flex-col max-h-full overflow-hidden shadow-xl">
        <div className="px-3 py-2 border-b border-white/10 flex items-start justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
              {game.landmarkKind} · on-foot tactics
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

        <div className="px-3 py-2 flex-1 overflow-y-auto space-y-3 min-h-0">
          {game.phase === 'briefing' && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-200 leading-snug">{game.briefing}</p>
              <p className="text-[10px] text-synth-muted">
                Start with 2 officers. More backup arrives randomly. Armed suspects can injure officers.
                Unknown basements stay fogged until scouted.
              </p>
              <button
                type="button"
                onClick={() => onChange(beginTacticsRaid(game))}
                className="w-full rounded-lg border border-neon-cyan/50 bg-neon-cyan/20 px-3 py-2 text-xs font-display font-bold uppercase tracking-wide text-neon-cyan"
              >
                Enter site
              </button>
            </div>
          )}

          {game.phase === 'active' && (
            <>
              <p className="text-[11px] text-gray-300 leading-snug border border-neon-amber/25 rounded-md px-2 py-1.5 bg-neon-amber/5">
                {game.briefing}
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                <span className="text-neon-cyan">T{game.turn}/{game.maxTurns}</span>
                <span className="text-neon-green">Caught {caught}</span>
                <span className="text-neon-magenta">Loose {activePerps}</span>
                <span className="text-gray-400">Escaped {escaped}</span>
                <span className="text-amber-300">
                  Armed {game.perps.filter((p) => p.armed && (p.status === 'hiding' || p.status === 'fleeing')).length}
                </span>
              </div>

              <div>
                <p className="text-[10px] font-display uppercase tracking-wider text-synth-muted mb-1">Officers</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {game.officers.map((o) => (
                    <OfficerChip
                      key={o.id}
                      officer={o}
                      selected={selected?.id === o.id}
                      roomName={game.rooms.find((r) => r.id === o.roomId)?.name || '—'}
                      onSelect={() => onChange(selectTacticsOfficer(game, o.id))}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-display uppercase tracking-wider text-synth-muted mb-1">Rooms</p>
                <div className="flex flex-wrap gap-1">
                  {game.rooms.map((r) => {
                    const here = selected?.roomId === r.id;
                    const fog = r.unknown && !r.revealed;
                    return (
                      <span
                        key={r.id}
                        className={`px-1.5 py-0.5 rounded text-[9px] border ${
                          fog
                            ? 'border-dashed border-gray-500 text-gray-500'
                            : here
                            ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
                            : r.isExit
                            ? 'border-neon-amber/40 text-neon-amber'
                            : 'border-white/10 text-gray-300'
                        }`}
                      >
                        {fog ? `? ${r.name}` : r.name}
                        {r.kind === 'basement' ? ' ↓' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>

              {selected && selected.status !== 'hurt' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-display uppercase tracking-wider text-neon-cyan">
                    {selected.name} @ {selectedRoom?.name}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onChange(tacticsClear(game, selected.id))}
                      className="px-2 py-1.5 rounded border border-neon-green/40 bg-neon-green/10 text-[10px] font-display uppercase text-neon-green"
                    >
                      Clear room
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(tacticsScout(game, selected.id))}
                      className="px-2 py-1.5 rounded border border-neon-purple/40 bg-neon-purple/10 text-[10px] font-display uppercase text-fuchsia-300"
                    >
                      Scout unknown
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(tacticsCoverExit(game, selected.id))}
                      className="px-2 py-1.5 rounded border border-neon-amber/40 bg-neon-amber/10 text-[10px] font-display uppercase text-neon-amber"
                    >
                      Cover exit
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(tacticsWait(game))}
                      className="px-2 py-1.5 rounded border border-white/15 bg-white/5 text-[10px] font-display uppercase text-gray-300"
                    >
                      Hold / wait
                    </button>
                  </div>
                  {adjacent.length > 0 && (
                    <div>
                      <p className="text-[9px] text-synth-muted mb-1">Move to</p>
                      <div className="flex flex-wrap gap-1">
                        {adjacent.map((r) => {
                          const fog = r.unknown && !r.revealed;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              disabled={fog}
                              onClick={() => onChange(tacticsMove(game, selected.id, r.id))}
                              className={`px-2 py-1 rounded text-[10px] border min-h-0 min-w-0 ${
                                fog
                                  ? 'border-gray-600 text-gray-500'
                                  : 'border-serpico-blue/40 text-serpico-blue hover:bg-serpico-blue/15'
                              }`}
                            >
                              {fog ? `Scout first: ${r.name}` : r.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-[10px] font-display uppercase tracking-wider text-synth-muted mb-1">Radio log</p>
                <ul className="space-y-1 max-h-28 overflow-y-auto">
                  {[...game.log].reverse().map((e, i) => (
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
              </div>
            </>
          )}

          {game.phase === 'completed' && game.result && (
            <div className="space-y-3">
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
                Caught {game.result.caught}/{game.result.totalPerps} · Hurt {game.result.officersHurt} · Score{' '}
                {game.result.score}
              </p>

              {(escapedOutcome || (game.result.escaped > 0 && game.result.outcome !== 'total_win')) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 p-2 text-center">
                    <div className="text-3xl" aria-hidden>
                      😢
                    </div>
                    <p className="text-[10px] text-sky-200 mt-1 font-display uppercase tracking-wide">Citizens</p>
                    <p className="text-[10px] text-gray-300 leading-snug">Neighborhood feels less safe tonight.</p>
                  </div>
                  <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-center">
                    <div className="text-3xl" aria-hidden>
                      😠
                    </div>
                    <p className="text-[10px] text-red-200 mt-1 font-display uppercase tracking-wide">Chief</p>
                    <p className="text-[10px] text-gray-300 leading-snug">Wants answers on the perimeter failure.</p>
                  </div>
                </div>
              )}

              {evalLoading ? (
                <p className="text-xs text-neon-cyan animate-pulse font-display">AI grading the raid…</p>
              ) : evaluation ? (
                <div className="space-y-1">
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
