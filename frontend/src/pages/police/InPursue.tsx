import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PursuitMapCanvas, { PursuitMapVehicle } from '../../components/PursuitMapCanvas';
import { useAuth } from '../../contexts/AuthContext';
import { pursuitExamAPI } from '../../services/api';
import {
  SimSession,
  SimVehicle,
  armPursuit,
  createSimSession,
  simSessionFromAPI,
  startPursuit,
  tickSimSession,
} from '../../utils/pursuitSim';

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
  const { user } = useAuth();
  const userId = user?.id || 'guest';

  const [session, setSession] = useState<SimSession | null>(null);
  const [selectedPoliceId, setSelectedPoliceId] = useState<string | null>(null);
  const [pursueModePoliceId, setPursueModePoliceId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [useServer, setUseServer] = useState(false);

  const sessionRef = useRef<SimSession | null>(null);
  const lastTickRef = useRef<number>(performance.now());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Server sync on init only; local sim drives movement
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { session: raw } = await pursuitExamAPI.getState(userId);
        if (cancelled) return;
        const serverSession = simSessionFromAPI(raw as unknown as Record<string, unknown>);
        if (serverSession.vehicles.length >= 8) {
          const perpN = serverSession.vehicles.filter((v) => v.role === 'perp').length;
          const polN = serverSession.vehicles.filter((v) => v.role === 'police').length;
          if (perpN >= 3 && perpN <= 4 && polN >= 5 && polN <= 8) {
            setSession(serverSession);
            setUseServer(true);
            return;
          }
        }
      } catch {
        /* local sim fallback */
      }
      if (!cancelled) {
        setSession(createSimSession(userId));
        setUseServer(false);
      }
    };
    init();
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
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

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
    (selectedPolice.status === 'patrol' || selectedPolice.status === 'idle') &&
    session?.phase === 'active';

  const handleVehicleClick = useCallback(async (vehicle: PursuitMapVehicle) => {
    const cur = sessionRef.current;
    if (!cur || cur.phase !== 'active') return;

    if (vehicle.role === 'police' && vehicle.status !== 'caught') {
      setSelectedPoliceId(vehicle.id);
      setPursueModePoliceId(null);
      return;
    }

    if (vehicle.role === 'perp' && pursueModePoliceId && vehicle.status !== 'caught') {
      let next = startPursuit(cur, pursueModePoliceId, vehicle.id);
      setSession(next);
      sessionRef.current = next;
      setPursueModePoliceId(null);
      setSelectedPoliceId(null);

      if (useServer) {
        try {
          const { session: raw } = await pursuitExamAPI.startPursuit(userId, pursueModePoliceId, vehicle.id);
          next = simSessionFromAPI(raw as unknown as Record<string, unknown>);
          setSession(next);
          sessionRef.current = next;
        } catch {
          setUseServer(false);
        }
      }
    }
  }, [pursueModePoliceId, useServer, userId]);

  const handleArmPursue = useCallback(async () => {
    if (!selectedPoliceId || !sessionRef.current) return;
    let next = armPursuit(sessionRef.current, selectedPoliceId);
    setSession(next);
    sessionRef.current = next;
    setPursueModePoliceId(selectedPoliceId);

    if (useServer) {
      try {
        const { session: raw } = await pursuitExamAPI.armPursuit(userId, selectedPoliceId);
        next = simSessionFromAPI(raw as unknown as Record<string, unknown>);
        setSession(next);
        sessionRef.current = next;
      } catch {
        setUseServer(false);
      }
    }
  }, [selectedPoliceId, useServer, userId]);

  const caughtCount = perpUnits.filter((v) => v.status === 'caught').length;
  const activePursuits = policeUnits.filter((v) => v.status === 'pursuing').length;

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
            </div>
          )}
        </div>

        {pursueModePoliceId && (
          <div className="mt-2 px-2 py-1.5 rounded-lg border border-neon-magenta/50 bg-neon-magenta/10 text-[10px] sm:text-xs text-neon-magenta font-display uppercase tracking-wide animate-pulse">
            Tap a suspect vehicle to assign pursuit
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        <PursuitMapCanvas
          center={OLATHE_CENTER}
          zoom={13}
          vehicles={vehicles.map(toMapVehicle)}
          selectedId={selectedPoliceId}
          armedPoliceId={session.armedPoliceId}
          pursueModePoliceId={pursueModePoliceId}
          onVehicleClick={handleVehicleClick}
        />

        {selectedPolice && session.phase === 'active' && (
          <div className="absolute top-2 left-2 right-2 sm:top-auto sm:bottom-16 sm:left-auto sm:right-3 sm:w-72 z-[1100] game-panel p-3 border border-neon-cyan/40 shadow-lg pointer-events-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-neon-cyan font-display uppercase tracking-wider">Patrol Unit</p>
                <h3 className="font-display font-bold text-sm truncate">{selectedPolice.officerName}</h3>
                <p className="text-[10px] text-synth-muted mt-0.5">{selectedPolice.officerRank}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedPoliceId(null); setPursueModePoliceId(null); }}
                className="text-synth-muted hover:text-white text-xs px-2 py-1 min-h-0 min-w-0"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-2 leading-snug">{selectedPolice.evaluation}</p>
            <div className="mt-2 flex items-center justify-between text-[10px] sm:text-xs gap-2">
              <span className="text-synth-muted truncate">{selectedPolice.vehicleModel}</span>
              <span className="font-display font-bold text-neon-cyan flex-shrink-0 whitespace-nowrap">
                {Math.round(selectedPolice.maxSpeedMph)} mph max
              </span>
            </div>
            {canPursue && (
              <button
                type="button"
                onClick={handleArmPursue}
                className="mt-3 w-full btn-neon-primary py-2.5 rounded-lg text-xs font-display uppercase tracking-wider touch-manipulation"
              >
                Pursue
              </button>
            )}
            {selectedPolice.status === 'pursuing' && (
              <p className="mt-3 text-[10px] text-neon-green font-display uppercase tracking-wide text-center">
                ● In active pursuit
              </p>
            )}
          </div>
        )}

        {session.phase === 'completed' && session.result && (
          <div className="absolute inset-0 z-[1200] flex items-center justify-center p-4 bg-synth-void/80 backdrop-blur-sm pointer-events-auto">
            <div className="game-panel max-w-sm w-full p-4 sm:p-5 border border-neon-purple/50">
              <p className="text-[10px] font-display uppercase tracking-widest text-synth-muted">Round complete</p>
              <h2 className={`text-2xl font-display font-bold mt-1 ${
                session.result.outcome === 'total_win' ? 'neon-text-green' :
                session.result.outcome === 'partial_win' ? 'neon-text-cyan' : 'text-neon-magenta'
              }`}>
                {session.result.outcome === 'total_win' ? 'Total Win' :
                 session.result.outcome === 'partial_win' ? 'Partial Win' : 'Total Failure'}
              </h2>
              <p className="text-4xl font-display font-bold mt-2 text-white">{session.result.grade}</p>
              <p className="text-xs text-gray-300 mt-2">{session.result.message}</p>
              <div className="mt-3 flex justify-between text-xs font-display">
                <span className="text-neon-green">Caught: {session.result.caught}</span>
                <span className="text-neon-magenta">Escaped: {session.result.escaped}</span>
                <span className="text-neon-cyan">Score: {session.result.score}</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] sm:text-xs">
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
        </div>
        <p className="text-[9px] text-synth-muted mt-1.5 font-mono truncate">
          Tap police → Pursue → tap suspect · Magenta dots = suspect destinations
        </p>
      </div>
    </div>
  );
};

export default InPursue;
