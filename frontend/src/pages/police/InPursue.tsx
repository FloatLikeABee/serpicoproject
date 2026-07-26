import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PursuitMapCanvas, { PursuitMapVehicle } from '../../components/PursuitMapCanvas';
import { useAuth } from '../../contexts/AuthContext';
import { pursuitExamAPI, PursuitAIEvaluation } from '../../services/api';
import {
  SimSession,
  SimVehicle,
  RoundStats,
  OLATHE_BOUNDS,
  OLATHE_CENTER,
  armPursuit,
  canDeployReinforcement,
  canResetRound,
  createSimSession,
  deployPoliceAt,
  ensureRoadNetwork,
  resetActiveRound,
  startNextRound,
  simSessionFromAPI,
  startPursuit,
  tickSimSession,
  isPoliceAvailableForPursuit,
  isPerpPursuitTarget,
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
      ? 'Strong catch rate with disciplined unit use.'
      : catchRate >= 0.4
      ? 'Partial success — tighten target priority next round.'
      : 'Low catch rate under a heavy suspect load.',
    strategyAnalysis: `Launched ${stats.pursuitsLaunched} pursuits; caught ${stats.caught} of ${stats.totalPerps}.`,
    resourceAnalysis: `Used ${stats.policeUsed} of ${stats.totalPolice} police vs ${stats.totalPerps} suspects.`,
    strengths: [catchRate >= 0.5 ? 'Kept pressure on active pursuits' : 'Engaged under difficult odds'],
    improvements: ['Deploy backups earlier on escaping targets'],
  };
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
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
    routeIndex: v.routeIndex,
    routeProgress: v.routeProgress,
    destination: v.destination,
  };
}

const InPursue: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || 'guest';

  const [session, setSession] = useState<SimSession | null>(null);
  const [selectedPoliceId, setSelectedPoliceId] = useState<string | null>(null);
  const [pursueModePoliceId, setPursueModePoliceId] = useState<string | null>(null);
  const [deployMode, setDeployMode] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [useServer, setUseServer] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState<PursuitAIEvaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const evaluatedRoundRef = useRef<number | null>(null);

  const sessionRef = useRef<SimSession | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const pursueModeRef = useRef<string | null>(null);
  const deployModeRef = useRef(false);

  const [roadsReady, setRoadsReady] = useState(false);
  const [roadsError, setRoadsError] = useState(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    pursueModeRef.current = pursueModePoliceId;
  }, [pursueModePoliceId]);

  useEffect(() => {
    deployModeRef.current = deployMode;
  }, [deployMode]);

  // Load OSM road network then start sim (vehicles snap to real roads)
  useEffect(() => {
    let cancelled = false;
    setRoadsReady(false);
    setRoadsError(false);
    ensureRoadNetwork()
      .then(() => {
        if (!cancelled) {
          setRoadsReady(true);
          setSession(createSimSession(userId));
          setUseServer(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoadsError(true);
          setRoadsReady(true);
          setSession(createSimSession(userId));
          setUseServer(false);
        }
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Local simulation tick (~30fps)
  useEffect(() => {
    let frame: number;
    const loop = (ts: number) => {
      const elapsed = Math.min((ts - lastTickRef.current) / 1000, 0.1);
      lastTickRef.current = ts;
      const cur = sessionRef.current;
      if (cur) {
        if (cur.phase === 'active') {
          const next = tickSimSession(cur, elapsed);
          setSession(next);
          sessionRef.current = next;
        } else if (cur.cooldownEndsAt && Date.now() >= cur.cooldownEndsAt) {
          const next = createSimSession(cur.userId, cur.round + 1);
          setSession(next);
          sessionRef.current = next;
          setSelectedPoliceId(null);
          setPursueModePoliceId(null);
          setDeployMode(false);
          setAiEvaluation(null);
          evaluatedRoundRef.current = null;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // AI evaluation when round completes
  useEffect(() => {
    if (session?.phase !== 'completed' || !session.result?.stats) return;
    if (evaluatedRoundRef.current === session.round) return;
    evaluatedRoundRef.current = session.round;

    const runEval = async () => {
      setEvalLoading(true);
      try {
        const { evaluation } = await pursuitExamAPI.evaluateRound(session.result!.stats!);
        setAiEvaluation(evaluation);
      } catch {
        setAiEvaluation(localFallbackEvaluation(session.result!.stats!));
      } finally {
        setEvalLoading(false);
      }
    };
    runEval();
  }, [session?.phase, session?.round, session?.result]);

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

  const showResetRound = useMemo(() => {
    if (!session || session.phase !== 'active') return false;
    return canResetRound(session, now);
  }, [session, now]);

  const cooldownSecondsLeft = useMemo(() => {
    if (!session?.cooldownEndsAt) return 0;
    return Math.max(0, Math.floor((session.cooldownEndsAt - now) / 1000));
  }, [session, now]);

  const canPursue = selectedPolice &&
    isPoliceAvailableForPursuit(selectedPolice) &&
    session?.phase === 'active';

  const handleVehicleClick = useCallback(async (vehicle: PursuitMapVehicle) => {
    const cur = sessionRef.current;
    const armedPolice = pursueModeRef.current;
    if (!cur || cur.phase !== 'active') return;
    if (deployModeRef.current) return;

    if (vehicle.role === 'police' && vehicle.status !== 'caught') {
      setSelectedPoliceId(vehicle.id);

      // One tap: select + arm targeting so Pursue does not require a second button press.
      if (isPoliceAvailableForPursuit(vehicle as SimVehicle)) {
        const policeId = vehicle.id;
        pursueModeRef.current = policeId;
        setPursueModePoliceId(policeId);
        let next = armPursuit(cur, policeId);
        setSession(next);
        sessionRef.current = next;

        if (useServer) {
          try {
            const { session: raw } = await pursuitExamAPI.armPursuit(userId, policeId);
            next = simSessionFromAPI(raw as unknown as Record<string, unknown>);
            setSession(next);
            sessionRef.current = next;
          } catch {
            setUseServer(false);
          }
        }
      } else {
        setPursueModePoliceId(null);
        pursueModeRef.current = null;
      }
      return;
    }

    if (vehicle.role === 'perp' && armedPolice && isPerpPursuitTarget(vehicle as SimVehicle)) {
      const policeId = armedPolice;
      let next = startPursuit(cur, policeId, vehicle.id);
      setSession(next);
      sessionRef.current = next;
      setPursueModePoliceId(null);
      pursueModeRef.current = null;
      setSelectedPoliceId(null);

      if (useServer) {
        try {
          const { session: raw } = await pursuitExamAPI.startPursuit(userId, policeId, vehicle.id);
          next = simSessionFromAPI(raw as unknown as Record<string, unknown>);
          setSession(next);
          sessionRef.current = next;
        } catch {
          setUseServer(false);
        }
      }
    }
  }, [useServer, userId]);

  const handleArmPursue = useCallback(async () => {
    if (!selectedPoliceId || !sessionRef.current) return;
    const policeId = selectedPoliceId;
    pursueModeRef.current = policeId;
    setPursueModePoliceId(policeId);

    let next = armPursuit(sessionRef.current, policeId);
    setSession(next);
    sessionRef.current = next;

    if (useServer) {
      try {
        const { session: raw } = await pursuitExamAPI.armPursuit(userId, policeId);
        next = simSessionFromAPI(raw as unknown as Record<string, unknown>);
        setSession(next);
        sessionRef.current = next;
      } catch {
        setUseServer(false);
      }
    }
  }, [selectedPoliceId, useServer, userId]);

  const cancelTargeting = useCallback(() => {
    setPursueModePoliceId(null);
    pursueModeRef.current = null;
    setSession((s) => (s ? { ...s, armedPoliceId: undefined } : s));
  }, []);

  const handleToggleDeploy = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur || !canDeployReinforcement(cur)) return;
    setDeployMode((v) => !v);
    setPursueModePoliceId(null);
    pursueModeRef.current = null;
    setSelectedPoliceId(null);
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    const cur = sessionRef.current;
    if (!cur || !deployModeRef.current || !canDeployReinforcement(cur)) return;
    // Reject taps outside the locked Olathe play area.
    if (
      lat < OLATHE_BOUNDS.latMin ||
      lat > OLATHE_BOUNDS.latMax ||
      lng < OLATHE_BOUNDS.lngMin ||
      lng > OLATHE_BOUNDS.lngMax
    ) {
      return;
    }
    let next = deployPoliceAt(cur, lat, lng);
    setSession(next);
    sessionRef.current = next;
    if ((next.reinforcementsLeft ?? 0) <= 0) {
      setDeployMode(false);
    }
    if (useServer) {
      try {
        const { session: raw } = await pursuitExamAPI.deployPolice(userId, lat, lng);
        next = simSessionFromAPI(raw as unknown as Record<string, unknown>);
        setSession(next);
        sessionRef.current = next;
        if ((next.reinforcementsLeft ?? 0) <= 0) setDeployMode(false);
      } catch {
        setUseServer(false);
      }
    }
  }, [useServer, userId]);

  const handleResetRound = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur || !canResetRound(cur)) return;
    const next = resetActiveRound(cur);
    setSession(next);
    sessionRef.current = next;
    setSelectedPoliceId(null);
    setPursueModePoliceId(null);
    pursueModeRef.current = null;
    setDeployMode(false);
    setAiEvaluation(null);
    evaluatedRoundRef.current = null;
  }, []);

  const handleStartNextRound = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur || (cur.phase !== 'completed' && cur.phase !== 'cooldown')) return;
    const next = startNextRound(cur);
    setSession(next);
    sessionRef.current = next;
    setSelectedPoliceId(null);
    setPursueModePoliceId(null);
    pursueModeRef.current = null;
    setDeployMode(false);
    setAiEvaluation(null);
    evaluatedRoundRef.current = null;
  }, []);

  const caughtCount = perpUnits.filter((v) => v.status === 'caught').length;
  const activePursuits = policeUnits.filter((v) => v.status === 'pursuing').length;
  const downCount = policeUnits.filter((v) => v.status === 'down').length;

  if (!session || !roadsReady) {
    return (
      <div className="page-fill items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-neon-cyan font-display text-sm animate-pulse tracking-wide">
            {roadsError ? 'Loading road fallback grid…' : 'Loading Olathe map…'}
          </p>

          <div className="game-panel p-4 text-left space-y-3">
            <h2 className="font-display text-xs uppercase tracking-widest text-serpico-red text-center">
              How to play
            </h2>
            <ol className="space-y-2.5 text-[12px] sm:text-sm text-synth-text leading-snug">
              <li className="flex gap-2.5">
                <span className="font-mono text-neon-cyan flex-shrink-0 w-4">1</span>
                <span>
                  Start with <span className="text-serpico-blue font-semibold">1 police</span> vs{' '}
                  <span className="text-serpico-red font-semibold">4–6 suspects</span> clustered close on the map.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-mono text-neon-cyan flex-shrink-0 w-4">2</span>
                <span>
                  <span className="text-serpico-blue font-semibold">Tap a police</span>, then{' '}
                  <span className="text-serpico-red font-semibold">tap a suspect</span> to chase.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-mono text-neon-cyan flex-shrink-0 w-4">3</span>
                <span>
                  Use <span className="text-neon-amber font-semibold">Deploy</span> to place up to 2 backup units where you want.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-mono text-neon-cyan flex-shrink-0 w-4">4</span>
                <span>Catch as many as you can — rounds last 20 minutes max.</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-display font-bold text-serpico-red tracking-wide">
              Pursue Exam
            </h1>
            <p className="text-[10px] sm:text-xs text-synth-muted mt-0.5 font-mono uppercase tracking-wider truncate">
              Round {session.round} · {useServer ? 'Live sim' : 'Local sim'}
            </p>
          </div>
          {session.phase === 'active' && (
            <div className="text-right flex-shrink-0">
              <div className="font-display text-lg sm:text-xl font-bold neon-text-cyan tabular-nums">
                {formatTime(roundSecondsLeft)}
              </div>
              <div className="text-[10px] text-synth-muted uppercase tracking-wider">Time left</div>
              <div className="mt-1.5 flex flex-col items-end gap-1">
                {canDeployReinforcement(session) && (
                  <button
                    type="button"
                    onClick={handleToggleDeploy}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border transition-colors touch-manipulation min-h-0 min-w-0 ${
                      deployMode
                        ? 'border-neon-amber bg-neon-amber/30 text-neon-amber'
                        : 'border-serpico-blue/50 bg-serpico-blue/15 text-serpico-blue hover:bg-serpico-blue/25'
                    }`}
                  >
                    {deployMode ? 'Cancel deploy' : `Deploy (${session.reinforcementsLeft} left)`}
                  </button>
                )}
                {showResetRound && (
                  <button
                    type="button"
                    onClick={handleResetRound}
                    className="px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-amber/50 bg-neon-amber/15 text-neon-amber hover:bg-neon-amber/25 transition-colors touch-manipulation min-h-0 min-w-0"
                  >
                    Reset round
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {deployMode && (
          <div className="mt-2 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-neon-amber/50 bg-neon-amber/10">
            <p className="text-[10px] sm:text-xs text-neon-amber font-display uppercase tracking-wide animate-pulse">
              Tap the map to place a backup unit ({session.reinforcementsLeft} left)
            </p>
            <button
              type="button"
              onClick={() => setDeployMode(false)}
              className="text-[10px] text-synth-muted hover:text-white px-2 py-0.5 min-h-0 min-w-0"
            >
              Cancel
            </button>
          </div>
        )}

        {pursueModePoliceId && !deployMode && (
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
          zoom={15}
          vehicles={vehicles.map(toMapVehicle)}
          landmarks={session.landmarks ?? []}
          selectedId={selectedPoliceId}
          armedPoliceId={pursueModePoliceId || session.armedPoliceId}
          pursueModePoliceId={pursueModePoliceId}
          fitKey={session.id}
          deployMode={deployMode}
          onVehicleClick={handleVehicleClick}
          onMapClick={handleMapClick}
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
                    <button
                      type="button"
                      onClick={cancelTargeting}
                      className="px-2 py-0.5 rounded text-[9px] font-display uppercase text-neon-magenta border border-neon-magenta/40 animate-pulse touch-manipulation min-h-0 min-w-0"
                    >
                      Targeting · Cancel
                    </button>
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
                {Math.round(selectedPolice.maxSpeedMph)} mph
              </span>
            </div>
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
                <p className="text-xs text-neon-cyan mt-3 animate-pulse font-display">AI grading…</p>
              ) : aiEvaluation ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <p className="text-4xl font-display font-bold text-white leading-none">{aiEvaluation.grade}</p>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-gray-200 leading-snug">{aiEvaluation.summary}</p>
                      <p className="text-[11px] text-gray-400 leading-snug">{aiEvaluation.strategyAnalysis}</p>
                      <p className="text-[11px] text-gray-400 leading-snug">{aiEvaluation.resourceAnalysis}</p>
                      {(aiEvaluation.improvements?.[0] || aiEvaluation.strengths?.[0]) && (
                        <p className="text-[11px] text-neon-amber leading-snug">
                          {aiEvaluation.improvements?.[0]
                            ? `Next: ${aiEvaluation.improvements[0]}`
                            : `Strength: ${aiEvaluation.strengths[0]}`}
                        </p>
                      )}
                    </div>
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

              {cooldownSecondsLeft > 0 ? (
                <p className="mt-4 text-center text-[10px] text-synth-muted font-mono uppercase">
                  Auto next round in {formatTime(cooldownSecondsLeft)}
                </p>
              ) : (
                <p className="mt-4 text-center text-[10px] text-neon-green font-mono uppercase">
                  Ready for next round
                </p>
              )}

              <button
                type="button"
                onClick={handleStartNextRound}
                className="mt-3 w-full rounded-xl border border-serpico-blue/50 bg-serpico-blue/20 px-4 py-2.5 text-sm font-display font-bold uppercase tracking-wide text-serpico-blue transition hover:bg-serpico-blue/30"
              >
                {cooldownSecondsLeft > 0 ? 'Start next round now' : 'Start next round'}
              </button>
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
            <span className="text-synth-muted">Down</span>
            <span className="font-bold text-gray-400 ml-auto">{downCount}</span>
          </div>
        </div>
        <p className="text-[9px] text-synth-muted mt-1.5 font-mono truncate">
          Olathe only · Bars/clubs/factories/projects · Tap police → suspect · Deploy backups
        </p>
      </div>
    </div>
  );
};

export default InPursue;
