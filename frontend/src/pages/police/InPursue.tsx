import React, { useCallback, useEffect, useRef, useState } from 'react';
import PursuitMapCanvas, { PursuitMapVehicle } from '../../components/PursuitMapCanvas';
import LocationTacticsPanel from '../../components/LocationTacticsPanel';
import { useAuth } from '../../contexts/AuthContext';
import { pursuitExamAPI } from '../../services/api';
import {
  HELPER_COUNT,
  INITIAL_SQUAD_COUNT,
  MapLandmark,
  OLATHE_CENTER,
  PERP_COUNT,
  SimSession,
  SimVehicle,
  WEAPON_COSTS,
  WEAPON_LABELS,
  WEAPON_SHORT_LABELS,
  WeaponKind,
  canAffordWeapon,
  createSimSession,
  deployWeapon,
  ensureRoadNetwork,
  helpersActive,
  helpersCountdownSec,
  redirectPoliceTo,
  tickSimSession,
} from '../../utils/pursuitSim';
import {
  LocationAIEvaluation,
  LocationTacticsGame,
  beginTacticsRaid,
  localFallbackLocationEvaluation,
  startLocationTactics,
} from '../../utils/locationTacticsSim';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function toMapVehicle(v: SimVehicle): PursuitMapVehicle {
  return {
    id: v.id,
    role: v.role,
    policeKind: v.policeKind,
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
    color: v.color,
  };
}

const weaponKinds: WeaponKind[] = ['drone', 'robocop', 'laser'];

const noticeColor: Record<SimSession['notices'][number]['kind'], string> = {
  caught: 'border-neon-green/50 bg-neon-green/15 text-neon-green',
  escaped: 'border-serpico-red/50 bg-serpico-red/15 text-serpico-red',
  helper: 'border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan',
  weapon: 'border-neon-amber/50 bg-neon-amber/15 text-neon-amber',
  warn: 'border-neon-amber/60 bg-neon-amber/20 text-neon-amber',
  info: 'border-serpico-blue/50 bg-serpico-blue/15 text-serpico-blue',
};

const InPursue: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || 'guest';

  const [session, setSession] = useState<SimSession | null>(null);
  const [selectedPoliceId, setSelectedPoliceId] = useState<string | null>(null);
  const [redirectPoliceId, setRedirectPoliceId] = useState<string | null>(null);
  const [weaponMode, setWeaponMode] = useState<WeaponKind | null>(null);
  const [roadsReady, setRoadsReady] = useState(false);
  const [roadsError, setRoadsError] = useState(false);

  const [tacticsGame, setTacticsGame] = useState<LocationTacticsGame | null>(null);
  const [tacticsCollapsed, setTacticsCollapsed] = useState(false);
  const [tacticsEval, setTacticsEval] = useState<LocationAIEvaluation | null>(null);
  const [tacticsEvalLoading, setTacticsEvalLoading] = useState(false);

  const sessionRef = useRef<SimSession | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const redirectPoliceRef = useRef<string | null>(null);
  const weaponModeRef = useRef<WeaponKind | null>(null);
  const tacticsEvalKeyRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    redirectPoliceRef.current = redirectPoliceId;
  }, [redirectPoliceId]);

  useEffect(() => {
    weaponModeRef.current = weaponMode;
  }, [weaponMode]);

  useEffect(() => {
    let cancelled = false;
    setRoadsReady(false);
    setRoadsError(false);
    ensureRoadNetwork()
      .then(() => {
        if (!cancelled) {
          setRoadsReady(true);
          setSession(createSimSession(userId));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoadsError(true);
          setRoadsReady(true);
          setSession(createSimSession(userId));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let frame: number;
    const loop = (ts: number) => {
      const elapsed = Math.min((ts - lastTickRef.current) / 1000, 0.1);
      lastTickRef.current = ts;
      const cur = sessionRef.current;
      if (cur) {
        const next = tickSimSession(cur, elapsed);
        setSession(next);
        sessionRef.current = next;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!tacticsGame || tacticsGame.phase !== 'completed' || !tacticsGame.stats) return;
    const key = `${tacticsGame.id}:${tacticsGame.stats.outcome}`;
    if (tacticsEvalKeyRef.current === key) return;
    tacticsEvalKeyRef.current = key;

    const runEval = async () => {
      setTacticsEvalLoading(true);
      try {
        const { evaluation } = await pursuitExamAPI.evaluateLocationTactics(
          tacticsGame.stats as unknown as Record<string, unknown>
        );
        setTacticsEval(evaluation);
      } catch {
        setTacticsEval(localFallbackLocationEvaluation(tacticsGame.stats!));
      } finally {
        setTacticsEvalLoading(false);
      }
    };
    runEval();
  }, [tacticsGame]);

  const resetGame = useCallback(() => {
    const next = createSimSession(userId);
    setSession(next);
    sessionRef.current = next;
    setSelectedPoliceId(null);
    setRedirectPoliceId(null);
    setWeaponMode(null);
    setTacticsGame(null);
    setTacticsEval(null);
    tacticsEvalKeyRef.current = null;
  }, [userId]);

  const handleVehicleClick = useCallback((vehicle: PursuitMapVehicle) => {
    const cur = sessionRef.current;
    if (!cur) return;

    if (weaponModeRef.current) {
      if (vehicle.role === 'perp' && vehicle.status === 'fleeing') {
        const result = deployWeapon(cur, weaponModeRef.current, vehicle.id);
        setSession(result.session);
        sessionRef.current = result.session;
        if (result.ok) {
          setWeaponMode(null);
          weaponModeRef.current = null;
        }
      }
      return;
    }

    const redirectId = redirectPoliceRef.current;
    if (redirectId && vehicle.role === 'perp' && vehicle.status === 'fleeing') {
      const next = redirectPoliceTo(cur, redirectId, vehicle.id);
      setSession(next);
      sessionRef.current = next;
      setRedirectPoliceId(null);
      redirectPoliceRef.current = null;
      setSelectedPoliceId(null);
      return;
    }

    if (vehicle.role === 'police') {
      setSelectedPoliceId(vehicle.id);
      setRedirectPoliceId(vehicle.id);
      redirectPoliceRef.current = vehicle.id;
      setWeaponMode(null);
      weaponModeRef.current = null;
    }
  }, []);

  const cancelTargeting = useCallback(() => {
    setRedirectPoliceId(null);
    redirectPoliceRef.current = null;
    setWeaponMode(null);
    weaponModeRef.current = null;
  }, []);

  const handleLandmarkClick = useCallback((landmark: MapLandmark) => {
    cancelTargeting();
    setSelectedPoliceId(null);
    setTacticsCollapsed(false);
    setTacticsEval(null);
    tacticsEvalKeyRef.current = null;

    setTacticsGame((current) => {
      if (current && current.phase !== 'completed' && current.landmarkId !== landmark.id) return current;
      if (current && current.landmarkId === landmark.id && current.phase !== 'completed') return current;
      return beginTacticsRaid(startLocationTactics(landmark));
    });
  }, [cancelTargeting]);

  const vehicles = session?.vehicles ?? [];
  const policeUnits = vehicles.filter((v) => v.role === 'police');
  const helperUnits = policeUnits.filter((v) => v.policeKind === 'helper');
  const squadUnits = policeUnits.filter((v) => v.policeKind !== 'helper');
  const perpUnits = vehicles.filter((v) => v.role === 'perp');
  const fleeingPerps = perpUnits.filter((v) => v.status === 'fleeing');
  const selectedPolice = policeUnits.find((v) => v.id === selectedPoliceId) ?? null;
  const activePursuits = policeUnits.filter((v) => v.status === 'chasing').length;
  const helperSeconds = session ? helpersCountdownSec(session) : 0;
  const helperCopy = session && helpersActive(session)
    ? `Helpers leave in ${formatTime(helperSeconds)}`
    : `Next helpers in ${formatTime(helperSeconds)}`;

  if (!session || !roadsReady) {
    return (
      <div className="page-fill items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-neon-cyan font-display text-sm animate-pulse tracking-wide">
            {roadsError ? 'Loading road fallback grid...' : 'Loading Olathe map...'}
          </p>

          <div className="game-panel p-4 text-left space-y-3">
            <h2 className="font-display text-xs uppercase tracking-widest text-serpico-red text-center">
              Endless Pursuit
            </h2>
            <ol className="space-y-2.5 text-[12px] sm:text-sm text-synth-text leading-snug">
              <li>
                Start with {INITIAL_SQUAD_COUNT} squad cars automatically chasing {PERP_COUNT} scattered suspects.
              </li>
              <li>Tap a police car, then tap a suspect to override that unit's target.</li>
              <li>Use drones, robocops, or satellite lasers to instantly remove a tapped suspect for score.</li>
              <li>{HELPER_COUNT} helper cars periodically arrive, chase, then get recalled.</li>
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
              Patrol Shift
            </h1>
            <p className="text-[10px] sm:text-xs text-synth-muted mt-0.5 font-mono uppercase tracking-wider truncate">
              Endless auto-chase · {helperCopy}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-display text-lg sm:text-xl font-bold neon-text-cyan tabular-nums">
              {session.score}
            </div>
            <div className="text-[10px] text-synth-muted uppercase tracking-wider">Score</div>
            <button
              type="button"
              onClick={resetGame}
              className="mt-1 px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border border-white/15 text-synth-muted hover:text-white touch-manipulation min-h-0 min-w-0"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {weaponKinds.map((kind) => {
            const affordable = canAffordWeapon(session, kind);
            const active = weaponMode === kind;
            return (
              <button
                key={kind}
                type="button"
                disabled={!affordable && !active}
                onClick={() => {
                  setWeaponMode((cur) => (cur === kind ? null : kind));
                  weaponModeRef.current = weaponMode === kind ? null : kind;
                  setRedirectPoliceId(null);
                  redirectPoliceRef.current = null;
                }}
                className={`px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-display uppercase tracking-wider border transition-colors touch-manipulation min-h-0 min-w-0 ${
                  active
                    ? 'border-neon-amber bg-neon-amber/30 text-neon-amber'
                    : affordable
                    ? 'border-neon-amber/45 bg-neon-amber/10 text-neon-amber hover:bg-neon-amber/20'
                    : 'border-white/10 bg-white/5 text-synth-muted opacity-60'
                }`}
              >
                <span className="block truncate">{WEAPON_SHORT_LABELS[kind]}</span>
                <span className="block font-mono opacity-80">-{WEAPON_COSTS[kind]}</span>
              </button>
            );
          })}
        </div>

        {(redirectPoliceId || weaponMode) && (
          <div className="mt-2 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-neon-magenta/50 bg-neon-magenta/10">
            <p className="text-[10px] sm:text-xs text-neon-magenta font-display uppercase tracking-wide animate-pulse">
              {weaponMode ? `Tap a suspect for ${WEAPON_LABELS[weaponMode]}` : 'Redirect mode - tap a suspect'}
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
          armedPoliceId={redirectPoliceId}
          pursueModePoliceId={redirectPoliceId || (weaponMode ? 'weapon' : null)}
          fitKey={session.id}
          activeLandmarkId={tacticsGame?.landmarkId}
          onVehicleClick={handleVehicleClick}
          onLandmarkClick={handleLandmarkClick}
        />

        {session.notices.length > 0 && (
          <div className="absolute top-2 right-2 z-[1100] w-[min(320px,calc(100%-16px))] space-y-1 pointer-events-none">
            {session.notices.slice(-4).map((notice) => (
              <div
                key={notice.id}
                className={`rounded-lg border px-2.5 py-1.5 text-[10px] sm:text-xs font-display uppercase tracking-wide shadow-lg ${noticeColor[notice.kind]}`}
              >
                {notice.text}
              </div>
            ))}
          </div>
        )}

        {tacticsGame && (
          <LocationTacticsPanel
            game={tacticsGame}
            collapsed={tacticsCollapsed}
            evaluation={tacticsEval}
            evalLoading={tacticsEvalLoading}
            onChange={setTacticsGame}
            onToggleCollapse={() => setTacticsCollapsed((v) => !v)}
            onClose={() => {
              setTacticsGame(null);
              setTacticsEval(null);
              tacticsEvalKeyRef.current = null;
              setTacticsCollapsed(false);
            }}
          />
        )}

        {selectedPolice && (!tacticsGame || tacticsCollapsed) && (
          <div className="absolute bottom-3 left-2 z-[1100] w-[min(230px,50vw)] pointer-events-auto">
            <div className="game-panel p-2 border border-neon-cyan/40 shadow-lg">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-neon-cyan font-display uppercase tracking-wider">
                    {selectedPolice.policeKind === 'helper' ? 'Helper unit' : 'Squad unit'}
                  </p>
                  <h3 className="font-display font-bold text-xs truncate">{selectedPolice.officerName}</h3>
                  <p className="text-[9px] text-synth-muted truncate">{selectedPolice.officerRank}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPoliceId(null);
                    cancelTargeting();
                  }}
                  className="text-synth-muted hover:text-white text-[10px] px-1 min-h-0 min-w-0"
                  aria-label="Close panel"
                >
                  x
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] gap-1">
                <span className="text-synth-muted truncate">{selectedPolice.vehicleModel}</span>
                <span className="font-display font-bold text-neon-cyan flex-shrink-0">
                  {selectedPolice.status === 'chasing' ? 'Chasing' : 'Idle'}
                </span>
              </div>
              {selectedPolice.pursuingPerpId && (
                <p className="mt-1 text-[9px] text-neon-green font-display uppercase text-center">
                  {selectedPolice.playerAssigned ? 'Player assigned target' : 'Auto target'}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setRedirectPoliceId(selectedPolice.id);
                  redirectPoliceRef.current = selectedPolice.id;
                  setWeaponMode(null);
                  weaponModeRef.current = null;
                }}
                className="mt-2 w-full px-2 py-1 rounded text-[9px] font-display uppercase tracking-wider border border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan touch-manipulation min-h-0 min-w-0"
              >
                Redirect target
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="game-header border-t border-neon-purple/20 p-2 sm:p-3 flex-shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-serpico-blue flex-shrink-0" />
            <span className="text-synth-muted">Squad</span>
            <span className="font-bold text-serpico-blue ml-auto">{squadUnits.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-cyan flex-shrink-0" />
            <span className="text-synth-muted">Helpers</span>
            <span className="font-bold text-neon-cyan ml-auto">{helperUnits.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-serpico-red flex-shrink-0" />
            <span className="text-synth-muted">Fleeing</span>
            <span className="font-bold text-serpico-red ml-auto">{fleeingPerps.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green flex-shrink-0" />
            <span className="text-synth-muted">Caught</span>
            <span className="font-bold text-neon-green ml-auto">{session.caughtTotal}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-amber flex-shrink-0" />
            <span className="text-synth-muted">Escaped</span>
            <span className="font-bold text-neon-amber ml-auto">{session.escapedTotal}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-purple flex-shrink-0" />
            <span className="text-synth-muted">Chasing</span>
            <span className="font-bold text-neon-purple ml-auto">{activePursuits}</span>
          </div>
        </div>
        <p className="text-[9px] text-synth-muted mt-1.5 font-mono truncate">
          Tap police to redirect · Tap landmarks for on-foot raids · Collapse raid to keep vehicle chase live
        </p>
      </div>
    </div>
  );
};

export default InPursue;
