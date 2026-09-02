import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlaceTagModal from '../../components/PlaceTagModal';
import FleetMapCanvas from '../../components/FleetMapCanvas';
import { useAuth } from '../../contexts/AuthContext';
import { fleetAPI } from '../../services/api';
import {
  cityLabel,
  fleetCitiesForNation,
  fleetCityById,
  loadFleetCityId,
  saveFleetCityId,
} from '../../utils/cities';
import { useT, useNation } from '../../i18n/useT';
import {
  createFleetMarker,
  FLEET_MARKER_KINDS,
  fleetKindMeta,
  fleetKindsForModal,
  fleetMarkerFromPayload,
  FleetMarker,
  FleetMarkerKind,
  isFleetKind,
  loadCachedFleetMarkers,
  mergeFleetMarkerLists,
  saveCachedFleetMarkers,
} from '../../utils/fleetMarkers';
import { autoMapTagLocation, isCoordsOnlyAddress, MapTag, mergePinLocation } from '../../utils/mapTags';

function toFleetMarker(tag: MapTag, cityId: string, existing?: FleetMarker): FleetMarker {
  const kind = isFleetKind(tag.kind) ? tag.kind : existing?.kind || 'police_station';
  return {
    ...tag,
    kind,
    cityId: existing?.cityId || cityId,
  };
}

const emptyCounts = (): Record<FleetMarkerKind, number> => ({
  police_station: 0,
  personnel: 0,
  police_vehicle: 0,
  investigation: 0,
});

const FleetMap: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || 'guest';
  const nation = useNation();
  const t = useT();

  const [cityId, setCityId] = useState(() => loadFleetCityId(userId, nation));
  const [markers, setMarkers] = useState<FleetMarker[]>(() => loadCachedFleetMarkers(userId));
  const [placeKind, setPlaceKind] = useState<FleetMarkerKind>('police_station');
  const [activeTag, setActiveTag] = useState<FleetMarker | null>(null);
  const [autoEnrichTagId, setAutoEnrichTagId] = useState<string | null>(null);
  const [placingBusy, setPlacingBusy] = useState(false);
  const [syncError, setSyncError] = useState('');

  const placeKindRef = useRef(placeKind);
  const placingBusyRef = useRef(false);
  const cityIdRef = useRef(cityId);
  const syncedIdsRef = useRef<Set<string>>(new Set());
  const locationMappedRef = useRef<Set<string>>(new Set());
  const activeTagRef = useRef<FleetMarker | null>(null);
  const writeChainRef = useRef<Map<string, Promise<void>>>(new Map());

  const city = useMemo(() => fleetCityById(cityId, nation), [cityId, nation]);
  const cities = useMemo(() => fleetCitiesForNation(nation), [nation]);
  const cityMarkers = useMemo(
    () => markers.filter((m) => m.cityId === cityId),
    [markers, cityId]
  );
  const kindOptions = useMemo(() => fleetKindsForModal(), []);

  useEffect(() => {
    placeKindRef.current = placeKind;
  }, [placeKind]);

  useEffect(() => {
    placingBusyRef.current = placingBusy;
  }, [placingBusy]);

  useEffect(() => {
    cityIdRef.current = cityId;
  }, [cityId]);

  useEffect(() => {
    activeTagRef.current = activeTag;
  }, [activeTag]);

  useEffect(() => {
    setCityId(loadFleetCityId(userId, nation));
    setMarkers(loadCachedFleetMarkers(userId));
  }, [userId, nation]);

  useEffect(() => {
    saveFleetCityId(userId, nation, cityId);
  }, [userId, nation, cityId]);

  useEffect(() => {
    saveCachedFleetMarkers(userId, markers);
  }, [userId, markers]);

  useEffect(() => {
    let cancelled = false;
    setSyncError('');
    fleetAPI
      .listMarkers(userId)
      .then(({ markers: remoteRows }) => {
        if (cancelled) return;
        const remote = (remoteRows || [])
          .map((m) => fleetMarkerFromPayload(m))
          .filter((m): m is FleetMarker => !!m);
        setMarkers((prev) => {
          const merged = mergeFleetMarkerLists(prev, remote);
          saveCachedFleetMarkers(userId, merged);
          return merged;
        });
        remote.forEach((m) => syncedIdsRef.current.add(m.id));
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('fleet markers load failed', err);
        setSyncError('Showing pins saved on this device — server sync unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const upsertLocal = useCallback((marker: FleetMarker) => {
    setMarkers((prev) => {
      const exists = prev.some((m) => m.id === marker.id);
      return exists ? prev.map((m) => (m.id === marker.id ? marker : m)) : [marker, ...prev];
    });
    setActiveTag((cur) => (cur?.id === marker.id ? marker : cur));
  }, []);

  const persistPayload = (marker: FleetMarker) => ({
    id: marker.id,
    cityId: marker.cityId,
    kind: marker.kind,
    name: marker.name,
    lat: marker.lat,
    lng: marker.lng,
    address: marker.address,
    notes: marker.notes,
    enrichment: marker.enrichment,
  });

  const enqueueWrite = useCallback((id: string, fn: () => Promise<void>) => {
    const prev = writeChainRef.current.get(id) || Promise.resolve();
    const next = prev.then(fn, fn);
    writeChainRef.current.set(id, next);
    return next;
  }, []);

  const persistCreate = useCallback(
    async (marker: FleetMarker) => {
      await enqueueWrite(marker.id, async () => {
        try {
          await fleetAPI.createMarker(userId, persistPayload(marker));
          syncedIdsRef.current.add(marker.id);
          setSyncError('');
        } catch (err) {
          console.warn('fleet create failed', err);
          setSyncError('Pin saved on this device. Server sync failed.');
        }
      });
    },
    [enqueueWrite, userId]
  );

  const persistUpdate = useCallback(
    async (marker: FleetMarker) => {
      const payload = persistPayload(marker);
      await enqueueWrite(marker.id, async () => {
        try {
          if (syncedIdsRef.current.has(marker.id)) {
            await fleetAPI.updateMarker(userId, marker.id, payload);
          } else {
            await fleetAPI.createMarker(userId, payload);
            syncedIdsRef.current.add(marker.id);
          }
          setSyncError('');
        } catch (err) {
          console.warn('fleet update failed', err);
          setSyncError('Pin saved on this device. Server sync failed.');
        }
      });
    },
    [enqueueWrite, userId]
  );

  const syncTagLocation = useCallback(
    (updated: MapTag) => {
      setMarkers((prev) => {
        const existing = prev.find((m) => m.id === updated.id);
        if (!existing) return prev;
        const next = mergePinLocation(existing, updated);
        void persistUpdate(next);
        return prev.map((m) => (m.id === updated.id ? next : m));
      });
      setActiveTag((cur) => {
        if (cur?.id !== updated.id) return cur;
        return mergePinLocation(cur, updated);
      });
    },
    [persistUpdate]
  );

  useEffect(() => {
    cityMarkers.forEach((tag) => {
      if (!isCoordsOnlyAddress(tag.address)) return;
      if (locationMappedRef.current.has(tag.id)) return;
      locationMappedRef.current.add(tag.id);
      void autoMapTagLocation(tag).then((mapped) => {
        if (mapped.address !== tag.address) {
          syncTagLocation(mapped);
        }
      });
    });
  }, [cityMarkers, syncTagLocation]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (placingBusyRef.current) return;
      placingBusyRef.current = true;
      setPlacingBusy(true);

      const kind = placeKindRef.current;
      const meta = fleetKindMeta(kind);
      const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const marker = createFleetMarker(kind, lat, lng, cityIdRef.current, {
        name: meta.short,
        address: coords,
        notes: '',
      });
      locationMappedRef.current.add(marker.id);
      upsertLocal(marker);
      setAutoEnrichTagId(marker.id);
      setActiveTag(marker);
      void persistCreate(marker);

      void autoMapTagLocation(marker)
        .then((mapped) => syncTagLocation(mapped))
        .finally(() => {
          placingBusyRef.current = false;
          setPlacingBusy(false);
        });
    },
    [persistCreate, syncTagLocation, upsertLocal]
  );

  const handleMarkerClick = useCallback((marker: FleetMarker) => {
    setActiveTag(marker);
  }, []);

  const persistMarker = useCallback(
    (tag: MapTag) => {
      const next = toFleetMarker(tag, cityIdRef.current, activeTagRef.current || undefined);
      upsertLocal(next);
      void persistUpdate(next);
    },
    [persistUpdate, upsertLocal]
  );

  const deleteMarker = useCallback(
    async (id: string) => {
      setMarkers((prev) => prev.filter((m) => m.id !== id));
      setActiveTag(null);
      setAutoEnrichTagId(null);
      try {
        if (syncedIdsRef.current.has(id)) {
          await fleetAPI.deleteMarker(userId, id);
        }
        syncedIdsRef.current.delete(id);
      } catch (err) {
        console.warn('fleet delete failed', err);
        setSyncError('Could not delete pin on the server.');
      }
    },
    [userId]
  );

  const counts = useMemo(() => {
    const byKind = emptyCounts();
    cityMarkers.forEach((m) => {
      if (isFleetKind(m.kind)) byKind[m.kind] += 1;
    });
    return byKind;
  }, [cityMarkers]);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-2.5 py-1.5 border-b border-white/10 space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="fleet-city">
            {t('fleet.city')}
          </label>
          <select
            id="fleet-city"
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              setActiveTag(null);
            }}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-white/15 bg-black/50 text-xs sm:text-sm text-white"
            style={{ colorScheme: 'dark' }}
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {cityLabel(c, nation)}
              </option>
            ))}
          </select>
          <span className="flex-shrink-0 text-[10px] text-synth-muted tabular-nums">
            {cityMarkers.length} {cityMarkers.length === 1 ? t('fleet.pin') : t('fleet.pins')}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {FLEET_MARKER_KINDS.map((k) => {
            const active = placeKind === k.kind;
            return (
              <button
                key={k.kind}
                type="button"
                title={t(`fleet.kind.${k.kind}`) || k.label}
                onClick={() => setPlaceKind(k.kind)}
                className={`px-2 py-1 rounded-md border text-[10px] font-display font-bold uppercase tracking-wide touch-manipulation min-h-0 min-w-0 ${
                  active
                    ? 'border-white text-white'
                    : 'border-white/20 bg-black/30 text-gray-200 hover:border-white/40'
                }`}
                style={active ? { backgroundColor: `${k.color}55`, borderColor: k.color } : undefined}
              >
                {k.glyph} {t(`fleet.short.${k.kind === 'police_station' ? 'station' : k.kind === 'personnel' ? 'staff' : k.kind === 'police_vehicle' ? 'vehicle' : 'scene'}`)}
                <span className="ml-1 opacity-70 font-normal tabular-nums">{counts[k.kind]}</span>
              </button>
            );
          })}
        </div>
          <p className="text-[10px] text-neon-cyan px-0.5">
            {t('fleet.tap', { city: city.name, kind: t(`fleet.kind.${placeKind}`) })}
            {placingBusy ? '…' : '.'}
          </p>
        {syncError ? <p className="text-[10px] text-serpico-red px-0.5">{syncError}</p> : null}
      </div>

      <div className="flex-1 min-h-0 relative">
        <FleetMapCanvas
          city={city}
          markers={cityMarkers}
          activeTagId={activeTag?.id}
          placing
          onMapClick={handleMapClick}
          onMarkerClick={handleMarkerClick}
        />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1200] w-[min(340px,90vw)] pointer-events-none">
          <div className="px-2.5 py-1.5 rounded-lg border border-neon-cyan/50 bg-black/70 backdrop-blur-sm shadow-lg text-center">
            <p className="text-[10px] text-neon-cyan font-display uppercase tracking-wide">
              {cityLabel(city, nation)} · {t(`fleet.kind.${placeKind}`)}
            </p>
          </div>
        </div>
        {cityMarkers.length === 0 ? (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1100] w-[min(360px,92vw)] pointer-events-none">
            <div className="rounded-lg border border-neon-cyan/30 bg-black/70 px-3 py-2 text-[11px] text-gray-200 text-center">
              {t('fleet.empty')}
            </div>
          </div>
        ) : null}
      </div>

      {activeTag ? (
        <PlaceTagModal
          tag={activeTag}
          kindOptions={kindOptions}
          startInEditMode={autoEnrichTagId === activeTag.id}
          onLocationUpdate={syncTagLocation}
          onChange={persistMarker}
          onDelete={deleteMarker}
          onClose={() => {
            setActiveTag(null);
            setAutoEnrichTagId(null);
          }}
        />
      ) : null}
    </div>
  );
};

export default FleetMap;
