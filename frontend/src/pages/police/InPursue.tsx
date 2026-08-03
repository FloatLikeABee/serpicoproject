import React, { useCallback, useEffect, useRef, useState } from 'react';
import PursuitMapCanvas, { PursuitMapVehicle } from '../../components/PursuitMapCanvas';
import LocationTacticsPanel from '../../components/LocationTacticsPanel';
import PlaceTagModal from '../../components/PlaceTagModal';
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
import {
  autoMapTagLocation,
  createMapTag,
  isCoordsOnlyAddress,
  loadMapTags,
  MAP_TAG_KINDS,
  MapTag,
  MapTagKind,
  saveMapTags,
  tagMeta,
} from '../../utils/mapTags';
import {
  syncMapTagsFromServer,
  pushMapTagsToServer,
} from '../../utils/userSync';

type PursueView = 'intel' | 'chase';

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

  const [view, setView] = useState<PursueView>('intel');
  const [session, setSession] = useState<SimSession | null>(null);
  const [selectedPoliceId, setSelectedPoliceId] = useState<string | null>(null);
  const [redirectPoliceId, setRedirectPoliceId] = useState<string | null>(null);
  const [weaponMode, setWeaponMode] = useState<WeaponKind | null>(null);
  const [roadsReady, setRoadsReady] = useState(false);
  const [roadsError, setRoadsError] = useState(false);

  const [mapTags, setMapTags] = useState<MapTag[]>(() => loadMapTags(userId));
  // Default selected so a map tap always drops a pin (user can change type anytime).
  const [placeKind, setPlaceKind] = useState<MapTagKind>('investigation');
  const [activeTag, setActiveTag] = useState<MapTag | null>(null);
  const [autoEnrichTagId, setAutoEnrichTagId] = useState<string | null>(null);
  const [placingBusy, setPlacingBusy] = useState(false);
  const placeKindRef = useRef<MapTagKind>('investigation');
  const placingBusyRef = useRef(false);

  const [tacticsGame, setTacticsGame] = useState<LocationTacticsGame | null>(null);
  const [tacticsCollapsed, setTacticsCollapsed] = useState(false);
  const [tacticsEval, setTacticsEval] = useState<LocationAIEvaluation | null>(null);
  const [tacticsEvalLoading, setTacticsEvalLoading] = useState(false);

  const sessionRef = useRef<SimSession | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const redirectPoliceRef = useRef<string | null>(null);
  const weaponModeRef = useRef<WeaponKind | null>(null);
  const tacticsEvalKeyRef = useRef<string | null>(null);
  const viewRef = useRef<PursueView>('intel');

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
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    placeKindRef.current = placeKind;
  }, [placeKind]);

  useEffect(() => {
    placingBusyRef.current = placingBusy;
  }, [placingBusy]);

  useEffect(() => {
    let cancelled = false;
    const local = loadMapTags(userId);
    void syncMapTagsFromServer(userId, local).then((tags) => {
      if (!cancelled) setMapTags(tags);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const locationMappedRef = useRef<Set<string>>(new Set());

  const syncTagLocation = useCallback((updated: MapTag) => {
    setMapTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setActiveTag((cur) => (cur?.id === updated.id ? updated : cur));
  }, []);

  useEffect(() => {
    mapTags.forEach((tag) => {
      if (!isCoordsOnlyAddress(tag.address)) return;
      if (locationMappedRef.current.has(tag.id)) return;
      locationMappedRef.current.add(tag.id);
      void autoMapTagLocation(tag).then((mapped) => {
        if (mapped.address !== tag.address) {
          syncTagLocation(mapped);
        }
      });
    });
  }, [mapTags, syncTagLocation]);

  useEffect(() => {
    saveMapTags(userId, mapTags);
    pushMapTagsToServer(userId, mapTags);
  }, [userId, mapTags]);

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
      // Only tick the chase sim while chase view is active (keeps intel map calm).
      if (viewRef.current === 'chase') {
        const cur = sessionRef.current;
        if (cur) {
          const next = tickSimSession(cur, elapsed);
          setSession(next);
          sessionRef.current = next;
        }
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
    void runEval();
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

  const cancelTargeting = useCallback(() => {
    setRedirectPoliceId(null);
    redirectPoliceRef.current = null;
    setWeaponMode(null);
    weaponModeRef.current = null;
  }, []);

  const handleVehicleClick = useCallback((vehicle: PursuitMapVehicle) => {
    if (viewRef.current !== 'chase') return;
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

  const handleLandmarkClick = useCallback(
    (landmark: MapLandmark) => {
      // While tagging on the intel map, ignore raid landmarks.
      if (viewRef.current === 'intel') return;
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
    },
    [cancelTargeting]
  );

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (viewRef.current !== 'intel') return;
    if (placingBusyRef.current) return;
    placingBusyRef.current = true;
    setPlacingBusy(true);

    const kind = placeKindRef.current || 'other';
    const meta = tagMeta(kind);
    const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const tag = createMapTag(kind, lat, lng, {
      name: meta.short,
      address: coords,
      notes: '',
    });
    locationMappedRef.current.add(tag.id);
    setMapTags((prev) => [tag, ...prev]);
    setAutoEnrichTagId(tag.id);
    setActiveTag(tag);

    void autoMapTagLocation(tag)
      .then((mapped) => syncTagLocation(mapped))
      .finally(() => {
        placingBusyRef.current = false;
        setPlacingBusy(false);
      });
  }, [syncTagLocation]);

  const handleTagClick = useCallback(
    (tag: MapTag) => {
      if (viewRef.current !== 'intel') return;
      cancelTargeting();
      setActiveTag(tag);
    },
    [cancelTargeting]
  );

  const upsertTag = useCallback((tag: MapTag) => {
    setMapTags((prev) => {
      const next = prev.some((t) => t.id === tag.id)
        ? prev.map((t) => (t.id === tag.id ? tag : t))
        : [tag, ...prev];
      return next;
    });
    setActiveTag(null);
  }, []);

  const deleteTag = useCallback((id: string) => {
    setMapTags((prev) => prev.filter((t) => t.id !== id));
    setActiveTag(null);
  }, []);

  const vehicles = session?.vehicles ?? [];
  const policeUnits = vehicles.filter((v) => v.role === 'police');
  const helperUnits = policeUnits.filter((v) => v.policeKind === 'helper');
  const squadUnits = policeUnits.filter((v) => v.policeKind !== 'helper');
  const perpUnits = vehicles.filter((v) => v.role === 'perp');
  const fleeingPerps = perpUnits.filter((v) => v.status === 'fleeing');
  const selectedPolice = policeUnits.find((v) => v.id === selectedPoliceId) ?? null;
  const helperSeconds = session ? helpersCountdownSec(session) : 0;
  const helperCopy =
    session && helpersActive(session)
      ? `Helpers leave in ${formatTime(helperSeconds)}`
      : `Next helpers in ${formatTime(helperSeconds)}`;

  if (!session || !roadsReady) {
    return (
      <div className="page-fill items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-neon-cyan font-display text-sm animate-pulse tracking-wide">
            {roadsError ? 'Loading map fallback…' : 'Loading Olathe map…'}
          </p>
          <div className="game-panel p-4 text-left space-y-2">
            <h2 className="font-display text-xs uppercase tracking-widest text-serpico-red text-center">
              Pursue intel map
            </h2>
            <p className="text-[12px] text-synth-muted leading-snug">
              Zoom the city map, drop tags (officers, vehicles, stations, perps, cases…), and open each pin for
              notes. AI can look up the tagged place once it is set.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const chaseActive = view === 'chase';

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3 flex-shrink-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-display font-bold text-serpico-red tracking-wide">
              Pursue
            </h1>
            <p className="text-[10px] sm:text-xs text-synth-muted mt-0.5 font-mono uppercase tracking-wider truncate">
              {chaseActive
                ? `${INITIAL_SQUAD_COUNT} cops · ${fleeingPerps.length} at large · ${helperCopy}`
                : `${mapTags.length} map tags · zoom & pin intel`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setView('intel');
                cancelTargeting();
              }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border touch-manipulation min-h-0 min-w-0 ${
                view === 'intel'
                  ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                  : 'border-white/15 text-synth-muted'
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => {
                setView('chase');
                setActiveTag(null);
              }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border touch-manipulation min-h-0 min-w-0 ${
                view === 'chase'
                  ? 'border-serpico-red bg-serpico-red/20 text-serpico-red'
                  : 'border-white/15 text-synth-muted'
              }`}
            >
              Chase
            </button>
            {chaseActive && (
              <button
                type="button"
                onClick={resetGame}
                className="px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border border-white/15 text-synth-muted hover:text-white touch-manipulation min-h-0 min-w-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {view === 'intel' ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[8px] font-display uppercase tracking-wider text-neon-cyan/90 mr-0.5">
                Tag type
              </span>
              {MAP_TAG_KINDS.map((k) => {
                const active = placeKind === k.kind;
                return (
                  <button
                    key={k.kind}
                    type="button"
                    title={k.label}
                    onClick={() => {
                      cancelTargeting();
                      setPlaceKind(k.kind);
                    }}
                    className={`px-1.5 py-0.5 rounded border text-[8px] font-display font-bold uppercase tracking-wide touch-manipulation min-h-0 min-w-0 ${
                      active
                        ? 'border-white text-white'
                        : 'border-white/20 bg-black/30 text-gray-200 hover:border-white/40'
                    }`}
                    style={active ? { backgroundColor: `${k.color}55`, borderColor: k.color } : undefined}
                  >
                    {k.glyph} {k.short}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-neon-cyan px-0.5">
              Tap anywhere on the map to drop a{' '}
              <span className="font-semibold">{tagMeta(placeKind).label.toLowerCase()}</span> pin
              {placingBusy ? '…' : '.'}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[8px] font-display uppercase tracking-wider text-neon-amber/90 mr-0.5">
              Tactics
            </span>
            {weaponKinds.map((kind) => {
              const affordable = canAffordWeapon(session, kind);
              const active = weaponMode === kind;
              const glyph = kind === 'drone' ? 'DR' : kind === 'robocop' ? 'RC' : 'SL';
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={!affordable && !active}
                  title={`${WEAPON_LABELS[kind]} (−${WEAPON_COSTS[kind]} pts)`}
                  onClick={() => {
                    setWeaponMode((cur) => (cur === kind ? null : kind));
                    weaponModeRef.current = weaponMode === kind ? null : kind;
                    setRedirectPoliceId(null);
                    redirectPoliceRef.current = null;
                  }}
                  className={`px-1.5 py-0.5 rounded border text-[8px] font-display font-bold uppercase tracking-wide touch-manipulation min-h-0 min-w-0 ${
                    active
                      ? 'border-neon-amber bg-neon-amber/30 text-neon-amber'
                      : affordable
                      ? 'border-neon-amber/35 bg-black/30 text-neon-amber/90 hover:bg-neon-amber/15'
                      : 'border-white/10 bg-black/20 text-synth-muted opacity-50'
                  }`}
                >
                  {glyph} −{WEAPON_COSTS[kind]}
                </button>
              );
            })}
            <span className="text-[8px] text-synth-muted ml-1 truncate">
              {weaponMode ? `Tap suspect · ${WEAPON_SHORT_LABELS[weaponMode]}` : 'Arm → tap suspect'}
            </span>
            {session.score != null && (
              <span className="ml-auto font-display text-sm font-bold neon-text-cyan tabular-nums">
                {session.score}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        <PursuitMapCanvas
          center={OLATHE_CENTER}
          zoom={14}
          vehicles={vehicles.map(toMapVehicle)}
          landmarks={chaseActive ? session.landmarks ?? [] : []}
          mapTags={mapTags}
          selectedId={selectedPoliceId}
          armedPoliceId={redirectPoliceId}
          pursueModePoliceId={redirectPoliceId || (weaponMode ? 'weapon' : null)}
          fitKey={chaseActive ? session.id : `intel-${userId}`}
          deployMode={view === 'intel'}
          activeLandmarkId={tacticsGame?.landmarkId}
          activeTagId={activeTag?.id}
          hideVehicles={!chaseActive}
          onVehicleClick={handleVehicleClick}
          onMapClick={handleMapClick}
          onLandmarkClick={handleLandmarkClick}
          onTagClick={handleTagClick}
        />

        {(redirectPoliceId || weaponMode) && chaseActive && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1200] w-[min(320px,88vw)] pointer-events-auto">
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-neon-magenta/60 bg-black/75 backdrop-blur-sm shadow-lg">
              <p className="text-[10px] sm:text-xs text-neon-magenta font-display uppercase tracking-wide animate-pulse">
                {weaponMode
                  ? `${WEAPON_LABELS[weaponMode]} armed — tap a suspect`
                  : 'Redirect armed — tap a suspect'}
              </p>
              <button
                type="button"
                onClick={cancelTargeting}
                className="text-[10px] text-synth-muted hover:text-white px-2 py-0.5 min-h-0 min-w-0"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {view === 'intel' && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1200] w-[min(340px,90vw)] pointer-events-none">
            <div className="px-2.5 py-1.5 rounded-lg border border-neon-cyan/50 bg-black/70 backdrop-blur-sm shadow-lg text-center">
              <p className="text-[10px] text-neon-cyan font-display uppercase tracking-wide">
                Tap map to pin · {tagMeta(placeKind).label}
              </p>
            </div>
          </div>
        )}

        {chaseActive && session.notices.length > 0 && (
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

        {selectedPolice && chaseActive && (!tacticsGame || tacticsCollapsed) && (
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

        {view === 'intel' && mapTags.length === 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1100] w-[min(360px,92vw)] pointer-events-none">
            <div className="rounded-lg border border-neon-cyan/30 bg-black/70 px-3 py-2 text-[11px] text-gray-200 text-center">
              Tap the map to drop a pin. Change tag type in the header anytime.
            </div>
          </div>
        )}
      </div>

      {chaseActive ? (
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
              <span className="text-synth-muted">Perps</span>
              <span className="font-bold text-serpico-red ml-auto">{fleeingPerps.length}</span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2 sm:col-span-3">
              <span className="text-synth-muted truncate">
                {HELPER_COUNT} helpers rotate · {PERP_COUNT} suspects · tap landmark for on-site tactics
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="game-header border-t border-neon-purple/20 p-2 sm:p-3 flex-shrink-0">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-synth-muted">
            <span>
              <span className="text-neon-cyan font-semibold">{mapTags.length}</span> tags saved
            </span>
            <span>Zoom with scroll or +/−</span>
            <span>Switch to Chase for live pursuit</span>
          </div>
        </div>
      )}

      {activeTag ? (
        <PlaceTagModal
          tag={activeTag}
          startInEditMode={autoEnrichTagId === activeTag.id}
          autoEnrich={autoEnrichTagId === activeTag.id && !activeTag.enrichment}
          onLocationUpdate={syncTagLocation}
          onChange={(tag) => {
            upsertTag(tag);
            setAutoEnrichTagId(null);
          }}
          onDelete={(id) => {
            deleteTag(id);
            setAutoEnrichTagId(null);
          }}
          onClose={() => {
            // Discard unsaved modal draft (Cancel / backdrop). Saved edits go through onChange.
            setActiveTag(null);
            setAutoEnrichTagId(null);
          }}
        />
      ) : null}
    </div>
  );
};

export default InPursue;
