import React, { useCallback, useEffect, useRef, useState } from 'react';
import PursuitMapCanvas from '../../components/PursuitMapCanvas';
import PlaceTagModal from '../../components/PlaceTagModal';
import { useAuth } from '../../contexts/AuthContext';
import { useT, useNation } from '../../i18n/useT';
import { pursueMapRegion } from '../../utils/mapRegions';
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

const InPursue: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || 'guest';
  const nation = useNation();
  const t = useT();
  const region = pursueMapRegion(nation);

  const [mapTags, setMapTags] = useState<MapTag[]>(() => loadMapTags(userId));
  const [placeKind, setPlaceKind] = useState<MapTagKind>('investigation');
  const [activeTag, setActiveTag] = useState<MapTag | null>(null);
  const [autoEnrichTagId, setAutoEnrichTagId] = useState<string | null>(null);
  const [placingBusy, setPlacingBusy] = useState(false);
  const placeKindRef = useRef<MapTagKind>('investigation');
  const placingBusyRef = useRef(false);
  const locationMappedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    placeKindRef.current = placeKind;
  }, [placeKind]);

  useEffect(() => {
    placingBusyRef.current = placingBusy;
  }, [placingBusy]);

  useEffect(() => {
    setMapTags(loadMapTags(userId));
  }, [userId]);

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
  }, [userId, mapTags]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
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
    },
    [syncTagLocation]
  );

  const handleTagClick = useCallback((tag: MapTag) => {
    setActiveTag(tag);
  }, []);

  const upsertTag = useCallback((tag: MapTag) => {
    setMapTags((prev) => {
      return prev.some((t) => t.id === tag.id)
        ? prev.map((t) => (t.id === tag.id ? tag : t))
        : [tag, ...prev];
    });
    setActiveTag(null);
  }, []);

  const deleteTag = useCallback((id: string) => {
    setMapTags((prev) => prev.filter((t) => t.id !== id));
    setActiveTag(null);
  }, []);

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3 flex-shrink-0 space-y-1.5">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-display font-bold text-serpico-red tracking-wide">
            {t('pursue.title')}
          </h1>
          <p className="text-[10px] sm:text-xs text-synth-muted mt-0.5 font-mono uppercase tracking-wider truncate">
            {t('pursue.subtitle', { count: mapTags.length })}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[8px] font-display uppercase tracking-wider text-neon-cyan/90 mr-0.5">
              {t('pursue.tagType')}
            </span>
            {MAP_TAG_KINDS.map((k) => {
              const active = placeKind === k.kind;
              return (
                <button
                  key={k.kind}
                  type="button"
                  title={t(`tag.kind.${k.kind}`)}
                  onClick={() => setPlaceKind(k.kind)}
                  className={`px-1.5 py-0.5 rounded border text-[8px] font-display font-bold uppercase tracking-wide touch-manipulation min-h-0 min-w-0 ${
                    active
                      ? 'border-white text-white'
                      : 'border-white/20 bg-black/30 text-gray-200 hover:border-white/40'
                  }`}
                  style={active ? { backgroundColor: `${k.color}55`, borderColor: k.color } : undefined}
                >
                  {k.glyph} {t(`tag.short.${k.kind}`)}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-neon-cyan px-0.5">
            {t('pursue.tap', { kind: t(`tag.kind.${placeKind}`) })}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <PursuitMapCanvas
          key={nation}
          center={region.center}
          zoom={nation === 'cn' ? 12 : 14}
          vehicles={[]}
          landmarks={[]}
          mapTags={mapTags}
          fitKey={`intel-${userId}-${nation}`}
          deployMode
          activeTagId={activeTag?.id}
          hideVehicles
          mapBounds={region.bounds}
          minZoom={region.minZoom}
          maxZoom={region.maxZoom}
          onMapClick={handleMapClick}
          onTagClick={handleTagClick}
        />

        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1200] w-[min(340px,90vw)] pointer-events-none">
          <div className="px-2.5 py-1.5 rounded-lg border border-neon-cyan/50 bg-black/70 backdrop-blur-sm shadow-lg text-center">
            <p className="text-[10px] text-neon-cyan font-display uppercase tracking-wide">
              {t('pursue.banner', { kind: t(`tag.kind.${placeKind}`) })}
            </p>
          </div>
        </div>

        {mapTags.length === 0 ? (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1100] w-[min(360px,92vw)] pointer-events-none">
            <div className="rounded-lg border border-neon-cyan/30 bg-black/70 px-3 py-2 text-[11px] text-gray-200 text-center">
              {t('pursue.empty')}
            </div>
          </div>
        ) : null}
      </div>

      <div className="game-header border-t border-neon-purple/20 p-2 sm:p-3 flex-shrink-0">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-synth-muted">
          <span>
            <span className="text-neon-cyan font-semibold">{mapTags.length}</span> tags saved on this device
          </span>
          <span>Zoom with scroll or +/−</span>
        </div>
      </div>

      {activeTag ? (
        <PlaceTagModal
          tag={activeTag}
          startInEditMode={autoEnrichTagId === activeTag.id}
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
            setActiveTag(null);
            setAutoEnrichTagId(null);
          }}
        />
      ) : null}
    </div>
  );
};

export default InPursue;
