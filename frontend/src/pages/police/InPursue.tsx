import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PursuitMapCanvas, { PursuitMapVehicle } from '../../components/PursuitMapCanvas';
import { usePursuitExam } from '../../contexts/PursuitExamContext';
import { PursuitAIEvaluation } from '../../services/api';
import {
  SimVehicle,
  RoundStats,
  isPoliceAvailableForPursuit,
  isPerpPursuitTarget,
  ROUND_DURATION_MIN,
  getDisplayOperationalMph,
} from '../../utils/pursuitSim';

function localFallbackEvaluation(stats: RoundStats): PursuitAIEvaluation {
  const catchRate = stats.totalPerps > 0 ? stats.caught / stats.totalPerps : 0;
  let grade = 'C';
  let score = 55;
  if (catchRate >= 0.75 && stats.pursuitsLaunched > 0) {
    grade = 'A';
    score = 92;
  } else if (catchRate >= 0.4 || stats.caught >= 2) {
    grade = 'B';
    score = 76;
  }
  return {
    grade,
    score,
    summary: catchRate >= 0.75
      ? 'Strong operational efficiency under resource constraints.'
      : catchRate >= 0.4
      ? 'Partial success — strategy showed promise but needs refinement.'
      : 'Low apprehension rate — reassess unit assignment and speed matching.',
    strategyAnalysis: `You committed ${stats.pursuitsLaunched} pursuit(s) using ${stats.policeUsed} of ${stats.totalPolice} available units against ${stats.totalPerps} suspects, apprehending ${stats.caught}.`,
    resourceAnalysis: `Police-to-suspect ratio was ${stats.totalPolice}:${stats.totalPerps}. ${stats.policeDown} unit(s) went down mid-round, reducing available capacity.`,
    strengths: catchRate >= 0.5 ? ['Effective pressure on multiple suspect vehicles'] : ['Attempted pursuits under difficult odds'],
    improvements: ['Deploy faster interceptors on high-speed suspects', 'Prioritize targets before units go offline'],
  };
}

const OLATHE_CENTER: [number, number] = [38.8814, -94.8191];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function toMapVehicle(v: SimVehicle): PursuitMapVehicle {
  return {
    id: v.id,
    role: v.role,
    lat: v.lat,
    lng: v.lng,
    heading: v.heading,
    status: v.status,
    beingPursued: v.beingPursued,
    pursuingPerpId: v.pursuingPerpId,
    route: v.route,
    destination: v.destination,
  };
}

const InPursue: React.FC = () => {
  const {
    session,
    useServer,
    selectedPoliceId,
    pursueModePoliceId,
    aiEvaluation,
    evalLoading,
    setSelectedPoliceId,
    armPursue,
    cancelTargeting,
    launchPursuit,
    pursueModeRef,
    sessionRef,
  } = usePursuitExam();

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const vehicles = session?.vehicles ?? [];
  const policeUnits = vehicles.filter((v) => v.role === 'police');
  const perpUnits = vehicles.filter((v) => v.role === 'perp');
  const selectedPolice = policeUnits.find((v) => v.id === selectedPoliceId) ?? null;

  const roundSecondsLeft = useMemo(() => {
    if (!session?.roundEndsAt || session.phase !== 'active') return 0;
    return Math.max(0, Math.floor((session.roundEndsAt - now) / 1000));
  }, [session, now]);

  const cooldownSecondsLeft = useMemo(() => {
    if (!session?.cooldownEndsAt) return 0;
    return Math.max(0, Math.floor((session.cooldownEndsAt - now) / 1000));
  }, [session, now]);

  const canPursue = selectedPolice &&
    isPoliceAvailableForPursuit(selectedPolice) &&
    session?.phase === 'active';

  const displayEvaluation = useMemo(() => {
    if (aiEvaluation) return aiEvaluation;
    if (session?.result?.stats && !evalLoading) {
      return localFallbackEvaluation(session.result.stats);
    }
    return null;
  }, [aiEvaluation, session?.result?.stats, evalLoading]);

  const handleVehicleClick = useCallback(async (vehicle: PursuitMapVehicle) => {
    const cur = sessionRef.current;
    const armedPolice = pursueModeRef.current;
    if (!cur || cur.phase !== 'active') return;

    if (vehicle.role === 'police' && vehicle.status !== 'caught') {
      setSelectedPoliceId(vehicle.id);
      if (vehicle.status !== 'down') {
        cancelTargeting();
      }
      return;
    }

    if (
      vehicle.role === 'perp' &&
      armedPolice &&
      isPerpPursuitTarget(vehicle as SimVehicle)
    ) {
      await launchPursuit(armedPolice, vehicle.id);
    }
  }, [cancelTargeting, launchPursuit, pursueModeRef, sessionRef, setSelectedPoliceId]);

  const handleArmPursue = useCallback(async () => {
    if (!selectedPoliceId) return;
    await armPursue(selectedPoliceId);
  }, [armPursue, selectedPoliceId]);

  const caughtCount = perpUnits.filter((v) => v.status === 'caught').length;
  const activePursuits = policeUnits.filter((v) => v.status === 'pursuing').length;
  const availablePolice = policeUnits.filter((v) => isPoliceAvailableForPursuit(v)).length;

  if (!session) {
    return (
      <div className="page-fill items-center justify-center">
        <p className="text-neon-cyan font-display text-sm animate-pulse">Initializing pursuit exam…</p>
      </div>
    );
  }

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3 flex-shrink-0">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0 justify-self-start">
            <h1 className="text-lg sm:text-xl font-display font-bold text-serpico-red tracking-wide">
              Pursue Exam
            </h1>
            <p className="text-[10px] sm:text-xs text-synth-muted mt-0.5 font-mono uppercase tracking-wider truncate">
              Round {session.round} · {useServer ? 'Live sim' : 'Local sim'}
            </p>
          </div>

          {session.phase === 'active' ? (
            <div className="justify-self-center text-center px-2">
              <div className="font-display text-2xl sm:text-3xl font-bold neon-text-cyan tabular-nums leading-none">
                {formatTime(roundSecondsLeft)}
              </div>
              <div className="text-[9px] sm:text-[10px] text-synth-muted uppercase tracking-widest mt-0.5">
                Time left · {ROUND_DURATION_MIN} min op
              </div>
            </div>
          ) : (
            <div className="justify-self-center" aria-hidden="true" />
          )}

          <div className="justify-self-end text-right min-w-0">
            <p className="text-[9px] sm:text-[10px] text-synth-muted font-mono uppercase tracking-wider hidden sm:block">
              Real-world speeds
            </p>
            <p className="text-[9px] text-synth-muted/80 font-mono hidden sm:block">
              Pursuit 82–120 mph
            </p>
          </div>
        </div>

        {pursueModePoliceId && (
          <div className="mt-2 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-neon-magenta/50 bg-neon-magenta/10">
            <p className="text-[10px] sm:text-xs text-neon-magenta font-display uppercase tracking-wide animate-pulse">
              Lock on — tap a suspect vehicle
            </p>
            <button
              type="button"
              onClick={cancelTargeting}
              className="text-[10px] text-synth-muted hover:text-white px-2 py-0.5 min-h-0 min-w-0"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        <PursuitMapCanvas
          center={OLATHE_CENTER}
          zoom={13}
          vehicles={vehicles.map(toMapVehicle)}
          selectedId={selectedPoliceId}
          armedPoliceId={pursueModePoliceId || session.armedPoliceId}
          pursueModePoliceId={pursueModePoliceId}
          onVehicleClick={handleVehicleClick}
        />

        {selectedPolice && session.phase === 'active' && (
          <div className="absolute top-2 left-2 right-2 sm:top-auto sm:bottom-16 sm:left-auto sm:right-3 sm:w-64 z-[1100] game-panel p-2.5 sm:p-3 border border-neon-cyan/40 shadow-lg pointer-events-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-neon-cyan font-display uppercase tracking-wider">Patrol Unit</p>
                  {canPursue && !pursueModePoliceId && (
                    <button
                      type="button"
                      onClick={handleArmPursue}
                      className="px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25 transition-colors touch-manipulation min-h-0 min-w-0"
                    >
                      Pursue
                    </button>
                  )}
                  {pursueModePoliceId === selectedPolice.id && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-display uppercase text-neon-magenta border border-neon-magenta/40 animate-pulse">
                      Targeting
                    </span>
                  )}
                </div>
                <h3 className="font-display font-bold text-sm truncate">{selectedPolice.officerName}</h3>
                <p className="text-[10px] text-synth-muted mt-0.5">{selectedPolice.officerRank}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedPoliceId(null); cancelTargeting(); }}
                className="text-synth-muted hover:text-white text-xs px-1 min-h-0 min-w-0"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-gray-300 mt-1.5 leading-snug line-clamp-2">{selectedPolice.evaluation}</p>
            <div className="mt-1.5 flex items-center justify-between text-[10px] gap-2">
              <span className="text-synth-muted truncate">{selectedPolice.vehicleModel}</span>
              <span className="font-display font-bold text-neon-cyan flex-shrink-0 whitespace-nowrap">
                {Math.round(selectedPolice.maxSpeedMph)} mph rated
              </span>
            </div>
            {selectedPolice.status === 'pursuing' && (
              <p className="text-[9px] text-synth-muted mt-1 text-right font-mono">
                Pursuit ~{getDisplayOperationalMph(selectedPolice)} mph
              </p>
            )}
            {selectedPolice.status === 'down' && (
              <p className="mt-2 text-[10px] text-red-400 font-display uppercase tracking-wide text-center">
                ✕ Unit down — unavailable
              </p>
            )}
            {selectedPolice.status === 'pursuing' && (
              <p className="mt-2 text-[10px] text-neon-green font-display uppercase tracking-wide text-center">
                ● In active pursuit
              </p>
            )}
            {canPursue && (
              <p className="mt-2 text-[10px] text-neon-cyan/80 font-mono text-center">
                Available for reassignment
              </p>
            )}
          </div>
        )}

        {session.phase === 'completed' && session.result && (
          <div className="absolute inset-0 z-[1200] flex items-center justify-center p-4 bg-synth-void/80 backdrop-blur-sm pointer-events-auto overflow-y-auto">
            <div className="game-panel max-w-md w-full p-4 sm:p-5 border border-neon-purple/50 max-h-[90vh] overflow-y-auto">
              <p className="text-[10px] font-display uppercase tracking-widest text-synth-muted">Round complete</p>
              <h2 className={`text-xl font-display font-bold mt-1 ${
                session.result.outcome === 'total_win' ? 'neon-text-green' :
                session.result.outcome === 'partial_win' ? 'neon-text-cyan' : 'text-neon-magenta'
              }`}>
                {session.result.outcome === 'total_win' ? 'Total Win' :
                 session.result.outcome === 'partial_win' ? 'Partial Win' : 'Total Failure'}
              </h2>

              {evalLoading ? (
                <p className="text-xs text-neon-cyan mt-3 animate-pulse font-display">AI analyzing your operations…</p>
              ) : displayEvaluation ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-4xl font-display font-bold text-white">{displayEvaluation.grade}</p>
                    <div>
                      <p className="text-xs text-gray-300">{displayEvaluation.summary}</p>
                      <p className="text-[10px] text-synth-muted mt-0.5">Score: {displayEvaluation.score}</p>
                    </div>
                  </div>
                  <div className="text-[11px] space-y-2">
                    <div>
                      <p className="text-neon-cyan font-display uppercase text-[10px] tracking-wider">Strategy</p>
                      <p className="text-gray-300 mt-0.5 leading-snug">{displayEvaluation.strategyAnalysis}</p>
                    </div>
                    <div>
                      <p className="text-neon-magenta font-display uppercase text-[10px] tracking-wider">Resources</p>
                      <p className="text-gray-300 mt-0.5 leading-snug">{displayEvaluation.resourceAnalysis}</p>
                    </div>
                    {displayEvaluation.strengths?.length > 0 && (
                      <div>
                        <p className="text-neon-green font-display uppercase text-[10px] tracking-wider">Strengths</p>
                        <ul className="text-gray-300 mt-0.5 list-disc list-inside">
                          {displayEvaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {displayEvaluation.improvements?.length > 0 && (
                      <div>
                        <p className="text-neon-amber font-display uppercase text-[10px] tracking-wider">Improve</p>
                        <ul className="text-gray-300 mt-0.5 list-disc list-inside">
                          {displayEvaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-4xl font-display font-bold mt-2 text-white">{session.result.grade}</p>
              )}

              <div className="mt-3 pt-3 border-t border-neon-purple/20 grid grid-cols-2 gap-2 text-[10px] font-display">
                <span className="text-synth-muted">Police used: <span className="text-white">{session.result.stats?.policeUsed ?? '—'}/{session.result.stats?.totalPolice}</span></span>
                <span className="text-synth-muted">Pursuits: <span className="text-white">{session.result.stats?.pursuitsLaunched ?? 0}</span></span>
                <span className="text-neon-green">Caught: {session.result.caught}</span>
                <span className="text-neon-magenta">Escaped: {session.result.escaped}</span>
                <span className="text-synth-muted">Units down: <span className="text-white">{session.result.stats?.policeDown ?? 0}</span></span>
                <span className="text-neon-cyan">Suspects: {session.result.totalPerps}</span>
              </div>

              {cooldownSecondsLeft > 0 && (
                <p className="mt-4 text-center text-[10px] text-synth-muted font-mono uppercase">
                  Next round in {formatTime(cooldownSecondsLeft)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="game-header border-t border-neon-purple/20 p-2 sm:p-3 flex-shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-serpico-blue flex-shrink-0" />
            <span className="text-synth-muted">Police</span>
            <span className="font-bold text-serpico-blue ml-auto">{policeUnits.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-serpico-red flex-shrink-0" />
            <span className="text-synth-muted">Suspects</span>
            <span className="font-bold text-serpico-red ml-auto">{perpUnits.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green flex-shrink-0" />
            <span className="text-synth-muted">Caught</span>
            <span className="font-bold text-neon-green ml-auto">{caughtCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-cyan flex-shrink-0" />
            <span className="text-synth-muted">Pursuing</span>
            <span className="font-bold text-neon-cyan ml-auto">{activePursuits}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" />
            <span className="text-synth-muted">Available</span>
            <span className="font-bold text-gray-400 ml-auto">{availablePolice}</span>
          </div>
        </div>
        <p className="text-[9px] text-synth-muted mt-1.5 font-mono truncate">
          Rated max = manufacturer spec · Pursuit 82–120 mph · {ROUND_DURATION_MIN}-min round (extended multi-unit op)
        </p>
      </div>
    </div>
  );
};

export default InPursue;
