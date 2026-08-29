import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlaceTagModal from '../../components/PlaceTagModal';
import FleetMapCanvas from '../../components/FleetMapCanvas';
import { useAuth } from '../../contexts/AuthContext';
import { fleetAPI, FleetMarkerPayload } from '../../services/api';
import {
  cityLabel,
  DEFAULT_FLEET_CITY_ID,
  FLEET_CITIES,
  fleetCityById,
  loadFleetCityId,
  saveFleetCityId,
} from '../../utils/cities';
import {
  createFleetMarker,
  FLEET_MARKER_KINDS,
  fleetKindMeta,
  fleetKindsForModal,
  FleetMarker,
  FleetMarkerKind,
  isFleetKind,
  loadCachedFleetMarkers,
  saveCachedFleetMarkers,
} from '../../utils/fleetMarkers';
import {
  FLEET_SYNC_COPY,
  FleetSyncStatus,
  fleetSyncBanner,
  mergeFleetMarkers,
  retryFleetList,
} from '../../utils/fleetSync';
import { autoMapTagLocation, isCoordsOnlyAddress, MapTag } from '../../utils/mapTags';

function toFleetMarker(tag: MapTag, cityId: string, existing?: FleetMarker): FleetMarker {
  const kind = isFleetKind(tag.kind) ? tag.kind : existing?.kind || 'police_station';
  return {
    ...tag,
    kind,
    cityId: existing?.cityId || cityId,
  };
}

function fromRemotePayload(m: FleetMarkerPayload): FleetMarker | null {
  if (!isFleetKind(m.kind)) return null;
  return {
    id: m.id,
    kind: m.kind,
    name: m.name,
    lat: m.lat,
    lng: m.lng,
    address: m.address || '',
    notes: m.notes || '',
    cityId: m.cityId || DEFAULT_FLEET_CITY_ID,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
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

  const [cityId, setCityId] = useState(() => loadFleetCityId(userId));
  const [markers, setMarkers] = useState<FleetMarker[]>(() => loadCachedFleetMarkers(userId));
  const [placeKind, setPlaceKind] = useState<FleetMarkerKind>('police_station');
  const [activeTag, setActiveTag] = useState<FleetMarker | null>(null);
  const [autoEnrichTagId, setAutoEnrichTagId] = useState<string | null>(null);
  const [placingBusy, setPlacingBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<FleetSyncStatus>('idle');
  const [writeError, setWriteError] = useState('');

  const placeKindRef = useRef(placeKind);
  const placingBusyRef = useRef(false);
  const cityIdRef = useRef(cityId);
  const syncedIdsRef = useRef<Set<string>>(new Set());
  const locationMappedRef = useRef<Set<string>>(new Set());
  const syncStatusRef = useRef<FleetSyncStatus>('idle');
  const loadingListRef = useRef(false);
  const loadGenRef = useRef(0);

  const city = useMemo(() => fleetCityById(cityId), [cityId]);
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
    setCityId(loadFleetCityId(userId));
    setMarkers(loadCachedFleetMarkers(userId));
  }, [userId]);

  useEffect(() => {
    saveFleetCityId(userId, cityId);
  }, [userId, cityId]);

  useEffect(() => {
    syncStatusRef.current = syncStatus;
  }, [syncStatus]);

  useEffect(() => {
    saveCachedFleetMarkers(userId, markers);
  }, [userId, markers]);

  const flushLocalOnly = useCallback(
    async (merged: FleetMarker[], remoteIds: Set<string>) => {
      for (const marker of merged) {
        if (remoteIds.has(marker.id) || syncedIdsRef.current.has(marker.id)) continue;
        try {
          await fleetAPI.createMarker(userId, {
            id: marker.id,
            cityId: marker.cityId,
            kind: marker.kind,
            name: marker.name,
            lat: marker.lat,
            lng: marker.lng,
            address: marker.address,
            notes: marker.notes,
          });
          syncedIdsRef.current.add(marker.id);
        } catch (err) {
          console.warn('fleet local-only flush failed', err);
        }
      }
    },
    [userId]
  );

  const loadFromServer = useCallback(async () => {
    if (loadingListRef.current) return;
    const gen = ++loadGenRef.current;
    const stale = () => gen !== loadGenRef.current;
    loadingListRef.current = true;
    try {
      const { markers: remote } = await retryFleetList(() => fleetAPI.listMarkers(userId), {
        isCancelled: stale,
        onRetry: () => {
          if (!stale()) setSyncStatus('connecting');
        },
      });
      if (stale()) return;
      const mapped = (remote || [])
        .map(fromRemotePayload)
        .filter((m): m is FleetMarker => m != null);
      const remoteIds = new Set(mapped.map((m) => m.id));
      let merged: FleetMarker[] = mapped;
      setMarkers((prev) => {
        merged = mergeFleetMarkers(prev, mapped);
        saveCachedFleetMarkers(userId, merged);
        return merged;
      });
      syncedIdsRef.current = new Set(remoteIds);
      setSyncStatus('idle');
      setWriteError('');
      void flushLocalOnly(merged, remoteIds);
    } catch (err) {
      if (stale()) return;
      console.warn('fleet markers load failed', err);
      setSyncStatus('offline');
    } finally {
      if (!stale()) loadingListRef.current = false;
    }
  }, [flushLocalOnly, userId]);

  useEffect(() => {
    setWriteError('');
    setSyncStatus('idle');
    void loadFromServer();
    return () => {
      loadGenRef.current += 1;
      loadingListRef.current = false;
    };
  }, [loadFromServer]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (syncStatusRef.current !== 'offline') return;
      void loadFromServer();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadFromServer]);

  const upsertLocal = useCallback((marker: FleetMarker) => {
    setMarkers((prev) => {
      const exists = prev.some((m) => m.id === marker.id);
      return exists ? prev.map((m) => (m.id === marker.id ? marker : m)) : [marker, ...prev];
    });
    setActiveTag((cur) => (cur?.id === marker.id ? marker : cur));
  }, []);

  const persistCreate = useCallback(
    async (marker: FleetMarker) => {
      try {
        await fleetAPI.createMarker(userId, {
          id: marker.id,
          cityId: marker.cityId,
          kind: marker.kind,
          name: marker.name,
          lat: marker.lat,
          lng: marker.lng,
          address: marker.address,
          notes: marker.notes,
        });
        syncedIdsRef.current.add(marker.id);
        setWriteError('');
        setSyncStatus('idle');
      } catch (err) {
        console.warn('fleet create failed', err);
        setWriteError(FLEET_SYNC_COPY.writeFailed);
      }
    },
    [userId]
  );

  const persistUpdate = useCallback(
    async (marker: FleetMarker) => {
      const payload = {
        cityId: marker.cityId,
        kind: marker.kind,
        name: marker.name,
        lat: marker.lat,
        lng: marker.lng,
        address: marker.address,
        notes: marker.notes,
      };
      try {
        if (syncedIdsRef.current.has(marker.id)) {
          await fleetAPI.updateMarker(userId, marker.id, payload);
        } else {
          await fleetAPI.createMarker(userId, { id: marker.id, ...payload });
          syncedIdsRef.current.add(marker.id);
        }
        setWriteError('');
        setSyncStatus('idle');
      } catch (err) {
        console.warn('fleet update failed', err);
        setWriteError(FLEET_SYNC_COPY.writeFailed);
      }
    },
    [userId]
  );

  const syncTagLocation = useCallback(
    (updated: MapTag) => {
      setMarkers((prev) => {
        const existing = prev.find((m) => m.id === updated.id);
        if (!existing) return prev;
        const next = toFleetMarker(updated, existing.cityId, existing);
        void persistUpdate(next);
        return prev.map((m) => (m.id === updated.id ? next : m));
      });
      setActiveTag((cur) => {
        if (cur?.id !== updated.id) return cur;
        return toFleetMarker(updated, cur.cityId, cur);
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

  const saveMarker = useCallback(
    (tag: MapTag) => {
      const next = toFleetMarker(tag, cityIdRef.current, activeTag || undefined);
      upsertLocal(next);
      void persistUpdate(next);
      setAutoEnrichTagId(null);
      setActiveTag(null);
    },
    [activeTag, persistUpdate, upsertLocal]
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
        setWriteError(FLEET_SYNC_COPY.deleteFailed);
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
            City
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
            {FLEET_CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {cityLabel(c)}
              </option>
            ))}
          </select>
          <span className="flex-shrink-0 text-[10px] text-synth-muted tabular-nums">
            {cityMarkers.length} pin{cityMarkers.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {FLEET_MARKER_KINDS.map((k) => {
            const active = placeKind === k.kind;
            return (
              <button
                key={k.kind}
                type="button"
                title={k.label}
                onClick={() => setPlaceKind(k.kind)}
                className={`px-2 py-1 rounded-md border text-[10px] font-display font-bold uppercase tracking-wide touch-manipulation min-h-0 min-w-0 ${
                  active
                    ? 'border-white text-white'
                    : 'border-white/20 bg-black/30 text-gray-200 hover:border-white/40'
                }`}
                style={active ? { backgroundColor: `${k.color}55`, borderColor: k.color } : undefined}
              >
                {k.glyph} {k.short}
                <span className="ml-1 opacity-70 font-normal tabular-nums">{counts[k.kind]}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-neon-cyan px-0.5">
          Tap the map in {city.name} to drop a{' '}
          <span className="font-semibold">{fleetKindMeta(placeKind).label.toLowerCase()}</span> pin
          {placingBusy ? '…' : '.'}
        </p>
        {writeError || fleetSyncBanner(syncStatus) ? (
          <p
            className={`text-[10px] px-0.5 ${
              writeError || syncStatus === 'offline' ? 'text-serpico-red' : 'text-neon-cyan'
            }`}
          >
            {writeError || fleetSyncBanner(syncStatus)}
          </p>
        ) : null}
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
              {cityLabel(city)} · {fleetKindMeta(placeKind).label}
            </p>
          </div>
        </div>
        {cityMarkers.length === 0 ? (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1100] w-[min(360px,92vw)] pointer-events-none">
            <div className="rounded-lg border border-neon-cyan/30 bg-black/70 px-3 py-2 text-[11px] text-gray-200 text-center">
              Tap the map to mark a station, personnel, vehicle, or crime scene. Switch cities from the list above.
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
          onChange={saveMarker}
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
