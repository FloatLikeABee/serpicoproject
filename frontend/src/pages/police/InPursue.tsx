import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PursuitMapCanvas, { PursuitMapVehicle } from '../../components/PursuitMapCanvas';
import LocationTacticsPanel from '../../components/LocationTacticsPanel';
import { useAuth } from '../../contexts/AuthContext';
import { pursuitExamAPI } from '../../services/api';
import {
  SimNoticeKind,
  SimSession,
  SimVehicle,
  MapLandmark,
  MAX_DRIVE_ORDER_M,
  OLATHE_BOUNDS,
  OLATHE_CENTER,
  WAVE_PERP_COUNT,
  canDeployReinforcement,
  createSimSession,
  cruiseSpeedMph,
  deployPoliceAt,
  ensureRoadNetwork,
  holdPolice,
  orderPoliceTo,
  remainingRouteMeters,
  tickSimSession,
} from '../../utils/pursuitSim';
import {
  LocationAIEvaluation,
  LocationTacticsGame,
  beginTacticsRaid,
  localFallbackLocationEvaluation,
  startLocationTactics,
} from '../../utils/locationTacticsSim';

function toMapVehicle(v: SimVehicle): PursuitMapVehicle {
  return {
    id: v.id,
    role: v.role,
    lat: v.lat,
    lng: v.lng,
    heading: v.heading,
    status: v.status,
    route: v.route,
    routeIndex: v.routeIndex,
    routeProgress: v.routeProgress,
    destination: v.destination,
  };
}

const noticeTone: Record<SimNoticeKind, string> = {
  caught: 'border-neon-green/60 bg-neon-green/15 text-neon-green',
  escaped: 'border-neon-magenta/50 bg-neon-magenta/10 text-neon-magenta',
  wave: 'border-serpico-blue/50 bg-serpico-blue/15 text-serpico-blue',
  warn: 'border-neon-amber/60 bg-neon-amber/15 text-neon-amber',
};

const InPursue: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || 'guest';

  const [session, setSession] = useState<SimSession | null>(null);
  const [selectedPoliceId, setSelectedPoliceId] = useState<string | null>(null);
  const [markedPerpId, setMarkedPerpId] = useState<string | null>(null);
  const [deployMode, setDeployMode] = useState(false);
  const [followUnit, setFollowUnit] = useState(true);
  const [unitCardCollapsed, setUnitCardCollapsed] = useState(false);

  const [tacticsGame, setTacticsGame] = useState<LocationTacticsGame | null>(null);
  const [tacticsCollapsed, setTacticsCollapsed] = useState(false);
  const [tacticsEval, setTacticsEval] = useState<LocationAIEvaluation | null>(null);
  const [tacticsEvalLoading, setTacticsEvalLoading] = useState(false);
  const tacticsEvalKeyRef = useRef<string | null>(null);

  const sessionRef = useRef<SimSession | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const selectedPoliceRef = useRef<string | null>(null);
  const deployModeRef = useRef(false);

  const [roadsReady, setRoadsReady] = useState(false);
  const [roadsError, setRoadsError] = useState(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    selectedPoliceRef.current = selectedPoliceId;
  }, [selectedPoliceId]);

  useEffect(() => {
    deployModeRef.current = deployMode;
  }, [deployMode]);

  // Load OSM road network then start the shift (vehicles snap to real roads).
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

  // Local simulation tick (~30fps)
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

  // AI evaluation when an on-site tactics raid completes
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

  const vehicles = useMemo(() => session?.vehicles ?? [], [session]);
  const policeUnits = vehicles.filter((v) => v.role === 'police');
  const perpUnits = vehicles.filter((v) => v.role === 'perp' && v.status === 'fleeing');
  const selectedPolice = policeUnits.find((v) => v.id === selectedPoliceId) ?? null;
  const notices = session?.notices ?? [];

  // Drop a selection when its unit is gone.
  useEffect(() => {
    if (markedPerpId && !vehicles.some((v) => v.id === markedPerpId && v.status === 'fleeing')) {
      setMarkedPerpId(null);
    }
  }, [markedPerpId, vehicles]);

  const orderMetersLeft = useMemo(
    () => (selectedPolice ? Math.round(remainingRouteMeters(selectedPolice)) : 0),
    [selectedPolice]
  );

  const handleVehicleClick = useCallback((vehicle: PursuitMapVehicle) => {
    if (deployModeRef.current) return;
    if (vehicle.role === 'police') {
      setSelectedPoliceId(vehicle.id);
      setUnitCardCollapsed(false);
      return;
    }
    if (vehicle.status !== 'fleeing') return;
    setMarkedPerpId((cur) => (cur === vehicle.id ? null : vehicle.id));
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const cur = sessionRef.current;
      if (!cur) return;
      // Reject taps outside the locked Olathe play area.
      if (
        lat < OLATHE_BOUNDS.latMin ||
        lat > OLATHE_BOUNDS.latMax ||
        lng < OLATHE_BOUNDS.lngMin ||
        lng > OLATHE_BOUNDS.lngMax
      ) {
        return;
      }

      if (deployModeRef.current) {
        if (!canDeployReinforcement(cur)) return;
        const next = deployPoliceAt(cur, lat, lng);
        setSession(next);
        sessionRef.current = next;
        if (!canDeployReinforcement(next)) setDeployMode(false);
        return;
      }

      const policeId = selectedPoliceRef.current;
      if (!policeId) return;
      const { session: next } = orderPoliceTo(cur, policeId, lat, lng);
      setSession(next);
      sessionRef.current = next;
    },
    []
  );

  const handleToggleDeploy = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur || !canDeployReinforcement(cur)) return;
    setDeployMode((v) => !v);
    setSelectedPoliceId(null);
  }, []);

  const handleHold = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur || !selectedPoliceId) return;
    const next = holdPolice(cur, selectedPoliceId);
    setSession(next);
    sessionRef.current = next;
  }, [selectedPoliceId]);

  const handleLandmarkClick = useCallback((landmark: MapLandmark) => {
    setDeployMode(false);
    setSelectedPoliceId(null);
    setTacticsCollapsed(false);
    setTacticsEval(null);
    tacticsEvalKeyRef.current = null;

    setTacticsGame((current) => {
      // Keep an in-progress raid on another site; just bring its panel forward.
      if (current && current.phase !== 'completed' && current.landmarkId !== landmark.id) {
        return current;
      }
      // Re-open the same site if already loaded.
      if (current && current.landmarkId === landmark.id && current.phase !== 'completed') {
        return current;
      }
      // One tap: generate today's scenario and enter the raid immediately.
      return beginTacticsRaid(startLocationTactics(landmark));
    });
  }, []);

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
                  You drive <span className="text-serpico-blue font-semibold">one cruiser</span>. It stays
                  parked until you tell it to move.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-mono text-neon-cyan flex-shrink-0 w-4">2</span>
                <span>
                  <span className="text-serpico-blue font-semibold">Tap your cruiser</span>, then tap the{' '}
                  <span className="text-neon-cyan font-semibold">road just ahead</span> — inside the{' '}
                  {MAX_DRIVE_ORDER_M} m ring, on a street. It drives that one short hop and parks
                  again, so keep tapping to keep it rolling.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-mono text-neon-cyan flex-shrink-0 w-4">3</span>
                <span>
                  <span className="text-serpico-red font-semibold">{WAVE_PERP_COUNT} suspects</span> crawl
                  toward their own drop points. Pull alongside one to make the stop — tap a suspect to see
                  where it is headed and cut it off.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-mono text-neon-cyan flex-shrink-0 w-4">4</span>
                <span>
                  No rounds, no clock. Once a wave is caught or gone, dispatch calls in a new one. Tap{' '}
                  <span className="text-neon-amber font-semibold">bars / clubs / factories / projects</span>{' '}
                  for an on-foot turn-based raid.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const driving = selectedPolice?.status === 'driving';

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-display font-bold text-serpico-red tracking-wide">
              Patrol Shift
            </h1>
            <p className="text-[10px] sm:text-xs text-synth-muted mt-0.5 font-mono uppercase tracking-wider truncate">
              Wave {session.wave} · {perpUnits.length} at large
            </p>
          </div>
          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg sm:text-xl font-bold neon-text-green tabular-nums">
                {session.caughtTotal}
              </span>
              <span className="text-[10px] text-synth-muted uppercase tracking-wider">stops</span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setFollowUnit((v) => !v)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border transition-colors touch-manipulation min-h-0 min-w-0 ${
                  followUnit
                    ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                    : 'border-white/20 text-synth-muted'
                }`}
              >
                Follow
              </button>
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
                  {deployMode ? 'Cancel' : `+Car (${session.reinforcementsLeft})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {deployMode ? (
          <div className="mt-2 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-neon-amber/50 bg-neon-amber/10">
            <p className="text-[10px] sm:text-xs text-neon-amber font-display uppercase tracking-wide animate-pulse">
              Tap the map to park another cruiser ({session.reinforcementsLeft} left)
            </p>
            <button
              type="button"
              onClick={() => setDeployMode(false)}
              className="text-[10px] text-synth-muted hover:text-white px-2 py-0.5 min-h-0 min-w-0"
            >
              Cancel
            </button>
          </div>
        ) : selectedPolice ? (
          <div className="mt-2 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10">
            <p className="text-[10px] sm:text-xs text-neon-cyan font-display uppercase tracking-wide">
              Tap the road inside the ring · one {MAX_DRIVE_ORDER_M} m hop per tap
            </p>
            <button
              type="button"
              onClick={() => setSelectedPoliceId(null)}
              className="text-[10px] text-synth-muted hover:text-white px-2 py-0.5 min-h-0 min-w-0"
            >
              Done
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-synth-muted font-mono truncate">
            Tap your cruiser to take the wheel
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        <PursuitMapCanvas
          center={OLATHE_CENTER}
          zoom={16}
          vehicles={vehicles.map(toMapVehicle)}
          landmarks={session.landmarks ?? []}
          selectedId={selectedPoliceId}
          markedPerpId={markedPerpId}
          fitKey={session.id}
          deployMode={deployMode}
          driveOrderPoliceId={deployMode ? null : selectedPoliceId}
          driveOrderRangeM={MAX_DRIVE_ORDER_M}
          followId={followUnit ? selectedPoliceId ?? policeUnits[0]?.id ?? null : null}
          activeLandmarkId={tacticsGame?.landmarkId}
          onVehicleClick={handleVehicleClick}
          onMapClick={handleMapClick}
          onLandmarkClick={handleLandmarkClick}
        />

        {/* Radio notices — stops, escapes and refused orders. */}
        {notices.length > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1200] w-[min(320px,88vw)] space-y-1 pointer-events-none">
            {notices.slice(-3).map((n) => (
              <div
                key={n.id}
                className={`px-2.5 py-1.5 rounded-lg border text-[10px] sm:text-[11px] font-display uppercase tracking-wide text-center shadow-lg backdrop-blur-sm ${
                  noticeTone[n.kind]
                }`}
              >
                {n.text}
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
          <div className="absolute bottom-3 left-2 z-[1100] w-[min(220px,46vw)] pointer-events-auto">
            {unitCardCollapsed ? (
              <button
                type="button"
                onClick={() => setUnitCardCollapsed(false)}
                className="game-panel w-full px-2.5 py-1.5 border border-neon-cyan/40 text-left"
              >
                <p className="text-[9px] font-display uppercase tracking-wider text-neon-cyan">
                  {driving ? `Rolling · ${orderMetersLeft} m` : 'Holding'}
                </p>
                <p className="text-[11px] font-bold text-white truncate">{selectedPolice.officerName}</p>
              </button>
            ) : (
              <div className="game-panel p-2 border border-neon-cyan/40 shadow-lg">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-neon-cyan font-display uppercase tracking-wider">
                      {driving ? `Rolling · ${orderMetersLeft} m left` : 'Holding position'}
                    </p>
                    <h3 className="font-display font-bold text-xs truncate">{selectedPolice.officerName}</h3>
                    <p className="text-[9px] text-synth-muted truncate">{selectedPolice.officerRank}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setUnitCardCollapsed(true)}
                      className="text-[9px] text-synth-muted hover:text-white px-1 min-h-0 min-w-0"
                    >
                      Hide
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPoliceId(null)}
                      className="text-synth-muted hover:text-white text-[10px] px-1 min-h-0 min-w-0"
                      aria-label="Close panel"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] gap-1">
                  <span className="text-synth-muted truncate">{selectedPolice.vehicleModel}</span>
                  <span className="font-display font-bold text-neon-cyan flex-shrink-0">
                    {Math.round(cruiseSpeedMph(selectedPolice))} mph
                  </span>
                </div>
                {driving && (
                  <button
                    type="button"
                    onClick={handleHold}
                    className="mt-1.5 w-full px-2 py-1 rounded text-[9px] font-display uppercase tracking-wider border border-neon-amber/50 bg-neon-amber/15 text-neon-amber touch-manipulation min-h-0 min-w-0"
                  >
                    Hold here
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="game-header border-t border-neon-purple/20 p-2 sm:p-3 flex-shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-serpico-blue flex-shrink-0" />
            <span className="text-synth-muted">Cruisers</span>
            <span className="font-bold text-serpico-blue ml-auto">{policeUnits.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-serpico-red flex-shrink-0" />
            <span className="text-synth-muted">At large</span>
            <span className="font-bold text-serpico-red ml-auto">{perpUnits.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green flex-shrink-0" />
            <span className="text-synth-muted">Stops</span>
            <span className="font-bold text-neon-green ml-auto">{session.caughtTotal}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-magenta flex-shrink-0" />
            <span className="text-synth-muted">Lost</span>
            <span className="font-bold text-neon-magenta ml-auto">{session.escapedTotal}</span>
          </div>
        </div>
        <p className="text-[9px] text-synth-muted mt-1.5 font-mono truncate">
          Tap cruiser → tap the road just ahead, hop by hop · Tap landmarks for on-foot raids
        </p>
      </div>
    </div>
  );
};

export default InPursue;
