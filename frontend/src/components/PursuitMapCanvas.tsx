import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AMERICA_BOUNDS,
  AMERICA_CENTER,
  AMERICA_MAX_ZOOM,
  AMERICA_MIN_ZOOM,
  MapLandmark,
  OLATHE_BOUNDS,
  OLATHE_CENTER,
  OLATHE_MAX_ZOOM,
  OLATHE_MIN_ZOOM,
} from '../utils/pursuitSim';
import { MapTag, tagMeta } from '../utils/mapTags';

/** olathe = chase locked to city; america = nationwide map notes. */
export type PursuitMapScope = 'olathe' | 'america';

export interface PursuitMapVehicle {
  id: string;
  role: 'police' | 'perp';
  policeKind?: 'squad' | 'helper';
  lat: number;
  lng: number;
  heading: number;
  status: string;
  beingPursued?: boolean;
  pursuingPerpId?: string;
  route?: Array<{ lat: number; lng: number }>;
  routeIndex?: number;
  routeProgress?: number;
  destination?: { lat: number; lng: number };
  /** Suspect tint — never blue. */
  color?: string;
}

interface PursuitMapCanvasProps {
  center?: [number, number];
  zoom?: number;
  vehicles: PursuitMapVehicle[];
  landmarks?: MapLandmark[];
  /** User / intel map tags (officers, cases, suspects, etc.). */
  mapTags?: MapTag[];
  selectedId?: string | null;
  armedPoliceId?: string | null;
  pursueModePoliceId?: string | null;
  /** Re-fit the camera when this key changes (new round / session). */
  fitKey?: string | number | null;
  deployMode?: boolean;
  activeLandmarkId?: string | null;
  activeTagId?: string | null;
  /** Hide moving chase units for a quiet intel map. */
  hideVehicles?: boolean;
  /** Map notes use america; chase stays on olathe. */
  scope?: PursuitMapScope;
  onVehicleClick?: (vehicle: PursuitMapVehicle) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onLandmarkClick?: (landmark: MapLandmark) => void;
  onTagClick?: (tag: MapTag) => void;
}

function boundsForScope(scope: PursuitMapScope) {
  const b = scope === 'america' ? AMERICA_BOUNDS : OLATHE_BOUNDS;
  return L.latLngBounds([b.latMin, b.lngMin], [b.latMax, b.lngMax]);
}

function zoomLimitsForScope(scope: PursuitMapScope) {
  return scope === 'america'
    ? { min: AMERICA_MIN_ZOOM, max: AMERICA_MAX_ZOOM }
    : { min: OLATHE_MIN_ZOOM, max: OLATHE_MAX_ZOOM };
}

/** Hard-lock pan/zoom to the active map scope. */
const MapBoundsLock: React.FC<{ scope: PursuitMapScope }> = ({ scope }) => {
  const map = useMap();

  useEffect(() => {
    const bounds = boundsForScope(scope);
    const zoom = zoomLimitsForScope(scope);
    map.setMaxBounds(bounds);
    map.setMinZoom(zoom.min);
    map.setMaxZoom(zoom.max);
    map.options.maxBoundsViscosity = 1.0;
    const keepInside = () => {
      map.panInsideBounds(bounds, { animate: false });
    };
    map.on('drag', keepInside);
    map.on('zoomend', keepInside);
    keepInside();
    return () => {
      map.off('drag', keepInside);
      map.off('zoomend', keepInside);
    };
  }, [map, scope]);

  return null;
};

/** Fit once per round so all units are visible at initiation — do not chase moving markers. */
const FitVehiclesOnce: React.FC<{
  vehicles: PursuitMapVehicle[];
  fitKey?: string | number | null;
  fallbackCenter: [number, number];
  fallbackZoom: number;
  scope: PursuitMapScope;
}> = ({ vehicles, fitKey, fallbackCenter, fallbackZoom, scope }) => {
  const map = useMap();
  const fittedKeyRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (fitKey == null) return;
    if (fittedKeyRef.current === fitKey) return;
    const lockBounds = boundsForScope(scope);
    const zoom = zoomLimitsForScope(scope);
    if (!vehicles.length) {
      map.setView(fallbackCenter, fallbackZoom, { animate: false });
      map.panInsideBounds(lockBounds, { animate: false });
      fittedKeyRef.current = fitKey;
      return;
    }
    const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng] as [number, number]));
    if (!bounds.isValid()) {
      map.setView(fallbackCenter, fallbackZoom, { animate: false });
    } else {
      map.fitBounds(bounds.pad(0.35), {
        animate: false,
        maxZoom: Math.min(16, zoom.max),
        padding: [28, 28],
      });
    }
    if (map.getZoom() < zoom.min) {
      map.setZoom(zoom.min, { animate: false });
    }
    map.panInsideBounds(lockBounds, { animate: false });
    fittedKeyRef.current = fitKey;
  }, [map, vehicles, fitKey, fallbackCenter, fallbackZoom, scope]);

  return null;
};

const landmarkStyle: Record<
  MapLandmark['kind'],
  { color: string; label: string; glyph: string }
> = {
  bar: { color: '#f59e0b', label: 'Bar', glyph: 'B' },
  club: { color: '#e879f9', label: 'Club', glyph: 'C' },
  factory: { color: '#94a3b8', label: 'Factory', glyph: 'F' },
  projects: { color: '#fb7185', label: 'Projects', glyph: 'P' },
};

function buildLandmarkIcon(landmark: MapLandmark, active = false): L.DivIcon {
  const style = landmarkStyle[landmark.kind];
  return L.divIcon({
    className: 'pursuit-landmark-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;width:72px;pointer-events:auto;cursor:pointer;">
        <div style="
          width:20px;height:20px;border-radius:5px;flex-shrink:0;
          background:${style.color};color:#07050f;
          font:700 10px/20px ui-monospace,Menlo,monospace;
          text-align:center;border:1px solid ${active ? '#fff' : 'rgba(0,0,0,0.45)'};
          box-shadow:0 0 ${active ? '8px' : '4px'} ${style.color};
        ">${style.glyph}</div>
        <div style="
          margin-top:2px;max-width:72px;padding:1px 4px;border-radius:3px;
          background:${style.color}dd;color:#07050f;
          font:700 8px/1.15 'IBM Plex Sans',system-ui,sans-serif;
          text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          border:1px solid rgba(0,0,0,0.35);
        ">${landmark.name}</div>
      </div>
    `,
    iconSize: [72, 34],
    iconAnchor: [36, 10],
  });
}

function buildTagIcon(tag: MapTag, active = false): L.DivIcon {
  const style = tagMeta(tag.kind);
  const label = (tag.name || style.short).replace(/[<>&"]/g, '');
  // Compact colored pin + thin caption — no large white Leaflet plate.
  return L.divIcon({
    className: 'pursuit-tag-marker',
    html: `
      <div class="pursuit-tag-pin" style="
        display:flex;flex-direction:column;align-items:center;
        width:56px;pointer-events:auto;cursor:pointer;
      ">
        <div style="
          width:22px;height:22px;border-radius:999px;flex-shrink:0;
          background:${style.color};
          color:#07050f;
          font:800 10px/22px ui-monospace,Menlo,monospace;
          text-align:center;
          border:2px solid ${active ? '#ffffff' : 'rgba(7,5,15,0.85)'};
          box-shadow:0 0 0 1px ${style.color}, 0 0 ${active ? '10px' : '6px'} ${style.color}aa;
        ">${style.glyph}</div>
        <div style="
          margin-top:3px;max-width:56px;padding:1px 4px;border-radius:3px;
          background:${style.color}e6;color:#07050f;
          font:700 8px/1.15 'IBM Plex Sans',system-ui,sans-serif;
          text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          border:1px solid rgba(0,0,0,0.35);
        ">${label}</div>
      </div>
    `,
    iconSize: [56, 36],
    iconAnchor: [28, 12],
  });
}

/** Explicit +/- zoom buttons for touch / desktop. */
const MapZoomControls: React.FC = () => {
  const map = useMap();
  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: 12, marginRight: 12, zIndex: 1000 }}>
      <div className="flex flex-col gap-1 pointer-events-auto">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={(e) => {
            e.stopPropagation();
            map.zoomIn();
          }}
          className="w-9 h-9 rounded-md border border-white/25 bg-black/75 text-white text-lg font-bold shadow-lg hover:bg-black/90"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={(e) => {
            e.stopPropagation();
            map.zoomOut();
          }}
          className="w-9 h-9 rounded-md border border-white/25 bg-black/75 text-white text-lg font-bold shadow-lg hover:bg-black/90"
        >
          −
        </button>
      </div>
    </div>
  );
};

const MapClickHandler: React.FC<{
  enabled: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}> = ({ enabled, onMapClick }) => {
  const map = useMap();
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    const container = map.getContainer();
    if (enabled) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
    if (!enabled) return;

    const handler = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    };
    // Prefer click; also listen to tap-friendly dblclick prevention path.
    map.on('click', handler);
    return () => {
      map.off('click', handler);
      container.style.cursor = '';
    };
  }, [map, enabled]);

  return null;
};

/**
 * Cop markers: big solid blue discs so they read instantly against multicolor suspects.
 * Helpers keep the same blue look with an H pip.
 */
const policeVehicleSvg = (
  heading: number,
  selected: boolean,
  size: number,
  helper: boolean
) => `
  <div style="
    width: ${size}px;
    height: ${size}px;
    filter: drop-shadow(0 0 ${selected ? '10px' : '7px'} #1d4ed8);
    pointer-events: auto;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="26" fill="#1d4ed8" stroke="${selected ? '#93c5fd' : '#60a5fa'}" stroke-width="${selected ? 4 : 3}"/>
      <circle cx="28" cy="28" r="20" fill="#2563eb"/>
      <g transform="rotate(${heading} 28 28)">
        <path d="M14 32h28l-3.5-10H17.5L14 32z" fill="#dbeafe" stroke="#eff6ff" stroke-width="1"/>
        <rect x="18" y="20" width="20" height="6" rx="2" fill="#1e3a8a"/>
        <rect x="19" y="16" width="6" height="3" rx="1" fill="#ef4444"/>
        <rect x="31" y="16" width="6" height="3" rx="1" fill="#38bdf8"/>
        <circle cx="19" cy="34" r="3.2" fill="#0f172a"/>
        <circle cx="37" cy="34" r="3.2" fill="#0f172a"/>
        <polygon points="28,12 31,18 25,18" fill="#eff6ff"/>
      </g>
      ${
        helper
          ? `<circle cx="44" cy="12" r="9" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="2"/>
             <text x="44" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="800" font-family="Arial,sans-serif">H</text>`
          : `<text x="28" y="50" text-anchor="middle" fill="#dbeafe" font-size="8" font-weight="800" font-family="Arial,sans-serif">COP</text>`
      }
    </svg>
  </div>`;

/** Suspect markers: smaller discs tinted with each perp's own color. */
const perpVehicleSvg = (
  heading: number,
  pursued: boolean,
  lockOn: boolean,
  size: number,
  tint = '#ff2bd6'
) => {
  const outer = lockOn ? size + 10 : size;
  return `
  <div style="
    width: ${outer}px;
    height: ${outer}px;
    filter: drop-shadow(0 0 ${lockOn || pursued ? '8px' : '4px'} ${tint});
    pointer-events: auto;
    cursor: ${lockOn ? 'crosshair' : 'pointer'};
  ">
    ${lockOn ? `<div style="position:absolute;inset:0;border:2px dashed ${tint};border-radius:50%;animation:pulse 1s infinite;"></div>` : ''}
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40" style="margin:${lockOn ? '5px' : '0'}">
      <circle cx="20" cy="20" r="18" fill="${tint}" stroke="#fff" stroke-width="${pursued || lockOn ? 2.5 : 1.5}" opacity="0.95"/>
      <g transform="rotate(${heading} 20 20)">
        <path d="M9 23h22l-2.2-7H11.2L9 23z" fill="#111827" opacity="0.85"/>
        <rect x="12" y="14" width="16" height="4.5" rx="1.2" fill="#0f172a"/>
        <circle cx="13" cy="25" r="2.2" fill="#020617"/>
        <circle cx="27" cy="25" r="2.2" fill="#020617"/>
      </g>
      ${pursued ? `<text x="20" y="11" text-anchor="middle" fill="#fff" font-size="8" font-weight="800">!</text>` : ''}
    </svg>
  </div>`;
};

const caughtOverlay = (size: number) => `
  <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);border-radius:50%;border:2px solid #39ff14;pointer-events:auto;">
    <span style="color:#39ff14;font-size:${Math.round(size * 0.4)}px;font-weight:bold;">✓</span>
  </div>`;

const escapedOverlay = (size: number) => `
  <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);border-radius:50%;border:2px solid #888;pointer-events:auto;">
    <span style="color:#888;font-size:${Math.round(size * 0.32)}px;font-weight:bold;">—</span>
  </div>`;

function iconSizeForZoom(zoom: number) {
  return Math.round(Math.max(14, Math.min(24, 8 + zoom * 0.85)));
}

/** Police markers are deliberately much larger than suspects. */
function policeIconSize(base: number) {
  return Math.round(base * 2.15);
}

function buildIcon(
  vehicle: PursuitMapVehicle,
  selected: boolean,
  armed: boolean,
  pursueTarget: boolean,
  iconSize: number
): L.DivIcon {
  if (vehicle.status === 'caught') {
    return L.divIcon({
      className: 'custom-marker pursuit-vehicle-marker',
      html: caughtOverlay(iconSize),
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
    });
  }
  if (vehicle.status === 'escaped') {
    return L.divIcon({
      className: 'custom-marker pursuit-vehicle-marker',
      html: escapedOverlay(iconSize),
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
    });
  }

  if (vehicle.role === 'police') {
    const size = policeIconSize(iconSize);
    const html = policeVehicleSvg(
      vehicle.heading,
      selected || armed,
      size,
      vehicle.policeKind === 'helper'
    );
    return L.divIcon({
      className: 'custom-marker pursuit-vehicle-marker',
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  const html = perpVehicleSvg(
    vehicle.heading,
    vehicle.beingPursued || false,
    pursueTarget,
    iconSize,
    vehicle.color
  );
  const size = pursueTarget ? iconSize + 10 : iconSize;
  return L.divIcon({
    className: 'custom-marker pursuit-vehicle-marker',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Leaflet markers don't auto-update position — sync lat/lng via ref. */
const MovingVehicleMarker: React.FC<{
  vehicle: PursuitMapVehicle;
  selected: boolean;
  armed: boolean;
  pursueTarget: boolean;
  iconSize: number;
  onClick: () => void;
}> = ({ vehicle, selected, armed, pursueTarget, iconSize, onClick }) => {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.setLatLng([vehicle.lat, vehicle.lng]);
    marker.setIcon(buildIcon(vehicle, selected, armed, pursueTarget, iconSize));
    marker.setZIndexOffset(pursueTarget ? 2000 : selected || armed ? 1000 : vehicle.role === 'police' ? 500 : 400);
  }, [vehicle.lat, vehicle.lng, vehicle.heading, vehicle.status, vehicle.beingPursued, vehicle.color, vehicle.policeKind, selected, armed, pursueTarget, vehicle, iconSize]);

  return (
    <Marker
      ref={markerRef}
      position={[vehicle.lat, vehicle.lng]}
      icon={buildIcon(vehicle, selected, armed, pursueTarget, iconSize)}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          onClick();
        },
      }}
      zIndexOffset={pursueTarget ? 2000 : selected ? 1000 : vehicle.role === 'police' ? 500 : 400}
    />
  );
};

const ZoomAwareMarkers: React.FC<{
  vehicles: PursuitMapVehicle[];
  selectedId?: string | null;
  armedPoliceId?: string | null;
  pursueModePoliceId?: string | null;
  onVehicleClick?: (vehicle: PursuitMapVehicle) => void;
}> = ({ vehicles, selectedId, armedPoliceId, pursueModePoliceId, onVehicleClick }) => {
  const map = useMap();
  const [iconSize, setIconSize] = React.useState(() => iconSizeForZoom(map.getZoom()));

  useEffect(() => {
    const update = () => setIconSize(iconSizeForZoom(map.getZoom()));
    map.on('zoomend', update);
    update();
    return () => {
      map.off('zoomend', update);
    };
  }, [map]);

  return (
    <>
      {vehicles.map((vehicle) => (
        <MovingVehicleMarker
          key={vehicle.id}
          vehicle={vehicle}
          selected={selectedId === vehicle.id}
          armed={armedPoliceId === vehicle.id}
          pursueTarget={!!pursueModePoliceId && vehicle.role === 'perp' && vehicle.status !== 'caught' && vehicle.status !== 'escaped'}
          iconSize={iconSize}
          onClick={() => onVehicleClick?.(vehicle)}
        />
      ))}
    </>
  );
};

const PursuitMapCanvas: React.FC<PursuitMapCanvasProps> = ({
  center,
  zoom,
  vehicles,
  landmarks = [],
  mapTags = [],
  selectedId,
  armedPoliceId,
  pursueModePoliceId,
  fitKey,
  deployMode = false,
  activeLandmarkId = null,
  activeTagId = null,
  hideVehicles = false,
  scope = 'olathe',
  onVehicleClick,
  onMapClick,
  onLandmarkClick,
  onTagClick,
}) => {
  const mapBounds = useMemo(() => boundsForScope(scope), [scope]);
  const zoomLimits = zoomLimitsForScope(scope);
  const mapCenter = center ?? (scope === 'america' ? AMERICA_CENTER : OLATHE_CENTER);
  const mapZoom = zoom ?? (scope === 'america' ? 4 : 15);
  const visibleVehicles = useMemo(() => (hideVehicles ? [] : vehicles), [hideVehicles, vehicles]);
  const selectedVehicle = visibleVehicles.find((v) => v.id === selectedId);

  const routeLines = useMemo(() => {
    if (hideVehicles) return [];
    const lines: Array<{ id: string; positions: [number, number][]; color: string; dashed?: boolean }> = [];
    const remainingRoute = (v: PursuitMapVehicle): [number, number][] => {
      if (!v.route || v.route.length < 2) return [];
      const startIdx = Math.min(Math.max(v.routeIndex ?? 0, 0), v.route.length - 1);
      const pts: [number, number][] = [[v.lat, v.lng]];
      for (let i = startIdx + ((v.routeProgress ?? 0) > 0.05 ? 1 : 0); i < v.route.length; i++) {
        const p = v.route[i];
        pts.push([p.lat, p.lng]);
      }
      return pts.length >= 2 ? pts : [];
    };

    if (selectedVehicle?.route && selectedVehicle.route.length > 1) {
      const positions = remainingRoute(selectedVehicle);
      if (positions.length >= 2) {
        lines.push({
          id: selectedVehicle.id,
          positions,
          color: '#00f5ff',
        });
      }
    }
    visibleVehicles
      .filter((v) => v.route && v.route.length > 1 && v.status !== 'caught')
      .forEach((v) => {
        const isPursuit = v.role === 'police' && v.status === 'chasing';
        const isPerp = v.role === 'perp';
        if (!isPursuit && !isPerp) return;
        const positions = remainingRoute(v);
        if (positions.length < 2) return;
        lines.push({
          id: `${v.id}-route`,
          positions,
          color: isPursuit ? '#00f5ff' : v.beingPursued ? '#ff6b6b' : v.color ?? '#ff2bd6',
          dashed: isPerp && !v.beingPursued,
        });
      });
    return lines;
  }, [visibleVehicles, selectedVehicle, hideVehicles]);

  return (
    <MapContainer
      key={scope}
      center={mapCenter}
      zoom={mapZoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
      maxBounds={mapBounds}
      maxBoundsViscosity={1}
      minZoom={zoomLimits.min}
      maxZoom={zoomLimits.max}
      worldCopyJump={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsLock scope={scope} />
      <MapZoomControls />
      <FitVehiclesOnce
        vehicles={visibleVehicles}
        fitKey={fitKey}
        fallbackCenter={mapCenter}
        fallbackZoom={mapZoom}
        scope={scope}
      />
      <MapClickHandler enabled={deployMode} onMapClick={onMapClick} />

      {routeLines.map((r) => (
        <Polyline
          key={r.id}
          positions={r.positions}
          pathOptions={{
            color: r.color,
            weight: r.dashed ? 2 : 3,
            opacity: r.dashed ? 0.35 : 0.55,
            dashArray: r.dashed ? '4 8' : undefined,
            interactive: false,
          }}
        />
      ))}

      {visibleVehicles
        .filter((v) => v.role === 'perp' && v.destination && v.status !== 'caught' && v.status !== 'escaped')
        .map((v) => (
          <CircleMarker
            key={`${v.id}-dest-dot`}
            center={[v.destination!.lat, v.destination!.lng]}
            radius={5}
            pathOptions={{
              color: '#ff2bd6',
              fillColor: '#ff2bd6',
              fillOpacity: 0.5,
              weight: 1,
              interactive: false,
            }}
          />
        ))}

      {!hideVehicles && (
        <ZoomAwareMarkers
          vehicles={visibleVehicles}
          selectedId={selectedId}
          armedPoliceId={armedPoliceId}
          pursueModePoliceId={pursueModePoliceId}
          onVehicleClick={onVehicleClick}
        />
      )}

      {/* Raid landmarks (bars/clubs/etc.) */}
      {landmarks.map((lm) => {
        const style = landmarkStyle[lm.kind];
        const active = activeLandmarkId === lm.id;
        return (
          <React.Fragment key={lm.id}>
            <CircleMarker
              center={[lm.lat, lm.lng]}
              radius={14}
              interactive={!deployMode}
              pathOptions={{
                color: style.color,
                fillColor: style.color,
                fillOpacity: active ? 0.35 : 0.2,
                weight: active ? 2 : 1,
                opacity: 0.9,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onLandmarkClick?.(lm);
                },
              }}
            />
            <Marker
              position={[lm.lat, lm.lng]}
              icon={buildLandmarkIcon(lm, active)}
              interactive={!deployMode}
              keyboard
              zIndexOffset={active ? 3500 : 3000}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onLandmarkClick?.(lm);
                },
              }}
            />
          </React.Fragment>
        );
      })}

      {/* User intel tags — always tappable to open notes (map empty-space still places). */}
      {mapTags.map((tag) => {
        const active = activeTagId === tag.id;
        return (
          <Marker
            key={tag.id}
            position={[tag.lat, tag.lng]}
            icon={buildTagIcon(tag, active)}
            interactive
            keyboard
            zIndexOffset={active ? 4500 : 4000}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onTagClick?.(tag);
              },
            }}
          />
        );
      })}
    </MapContainer>
  );
};

export default PursuitMapCanvas;
