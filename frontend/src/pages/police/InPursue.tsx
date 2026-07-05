import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PursuitMapCanvas, { PursuitMapVehicle } from '../../components/PursuitMapCanvas';
import { useAuth } from '../../contexts/AuthContext';
import {
  pursuitExamAPI,
  PursuitExamSession,
  PursuitVehicle,
} from '../../services/api';

const OLATHE_CENTER: [number, number] = [38.8814, -94.8191];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function toMapVehicle(v: PursuitVehicle): PursuitMapVehicle {
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
  };
}

const InPursue: React.FC = () => {
  const { user } = useAuth();
  const [session, setSession] = useState<PursuitExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoliceId, setSelectedPoliceId] = useState<string | null>(null);
  const [pursueModePoliceId, setPursueModePoliceId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const userId = user?.id || 'guest';

  const refresh = useCallback(async () => {
    try {
      const { session: s } = await pursuitExamAPI.getState(userId);
      setSession(s);
      setError(null);
    } catch (e) {
      console.error('Pursuit exam sync failed:', e);
      setError('Could not sync pursuit exam. Retrying…');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 1500);
    return () => clearInterval(poll);
  }, [refresh]);

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
    return Math.max(0, Math.floor((new Date(session.roundEndsAt).getTime() - now) / 1000));
  }, [session, now]);

  const cooldownSecondsLeft = useMemo(() => {
    if (!session?.cooldownEndsAt) return 0;
    return Math.max(0, Math.floor((new Date(session.cooldownEndsAt).getTime() - now) / 1000));
  }, [session, now]);

  const handleVehicleClick = async (vehicle: PursuitMapVehicle) => {
    if (!session || session.phase !== 'active') return;

    if (vehicle.role === 'police' && vehicle.status !== 'caught' && vehicle.status !== 'idle') {
      setSelectedPoliceId(vehicle.id);
      setPursueModePoliceId(null);
      return;
    }

    if (vehicle.role === 'perp' && pursueModePoliceId && vehicle.status !== 'caught') {
      try {
        const { session: s } = await pursuitExamAPI.startPursuit(userId, pursueModePoliceId, vehicle.id);
        setSession(s);
        setPursueModePoliceId(null);
        setSelectedPoliceId(null);
      } catch (e) {
        console.error('Pursue failed:', e);
      }
    }
  };

  const handleArmPursue = async () => {
    if (!selectedPoliceId || !session) return;
    try {
      const { session: s } = await pursuitExamAPI.armPursuit(userId, selectedPoliceId);
      setSession(s);
      setPursueModePoliceId(selectedPoliceId);
    } catch (e) {
      console.error('Arm pursue failed:', e);
    }
  };

  const caughtCount = perpUnits.filter((v) => v.status === 'caught').length;
  const activePursuits = policeUnits.filter((v) => v.status === 'pursuing').length;

  if (loading && !session) {
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
              Round {session?.round ?? 1} · Strategy training sim
            </p>
          </div>
          {session?.phase === 'active' && (
            <div className="text-right flex-shrink-0">
              <div className="font-display text-lg sm:text-xl font-bold neon-text-cyan tabular-nums">
                {formatTime(roundSecondsLeft)}
              </div>
              <div className="text-[10px] text-synth-muted uppercase tracking-wider">Time left</div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-[10px] text-neon-amber mt-1">{error}</p>
        )}

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
          armedPoliceId={session?.armedPoliceId}
          pursueModePoliceId={pursueModePoliceId}
          onVehicleClick={handleVehicleClick}
        />

        {selectedPolice && session?.phase === 'active' && (
          <div className="absolute bottom-2 left-2 right-2 sm:left-auto sm:right-3 sm:bottom-3 sm:w-72 z-[1000] game-panel p-3 border border-neon-cyan/40 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-neon-cyan font-display uppercase tracking-wider">Patrol Unit</p>
                <h3 className="font-display font-bold text-sm truncate">{selectedPolice.officerName}</h3>
                <p className="text-[10px] text-synth-muted mt-0.5">{selectedPolice.officerRank}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedPoliceId(null); setPursueModePoliceId(null); }}
                className="text-synth-muted hover:text-white text-xs px-1"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-2 leading-snug">{selectedPolice.evaluation}</p>
            <div className="mt-2 flex items-center justify-between text-[10px] sm:text-xs">
              <span className="text-synth-muted truncate mr-2">{selectedPolice.vehicleModel}</span>
              <span className="font-display font-bold text-neon-cyan flex-shrink-0">
                {Math.round(selectedPolice.maxSpeedMph)} mph
              </span>
            </div>
            {selectedPolice.status === 'patrol' && (
              <button
                type="button"
                onClick={handleArmPursue}
                className="mt-3 w-full btn-neon-primary py-2 rounded-lg text-xs font-display uppercase tracking-wider"
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

        {session?.phase === 'completed' && session.result && (
          <div className="absolute inset-0 z-[1001] flex items-center justify-center p-4 bg-synth-void/80 backdrop-blur-sm">
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
          Tap police unit → review stats → Pursue → tap suspect
        </p>
      </div>
    </div>
  );
};

export default InPursue;
