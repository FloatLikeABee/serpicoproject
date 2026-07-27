import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapLandmark,
  OLATHE_BOUNDS,
  OLATHE_CENTER,
  OLATHE_MAX_ZOOM,
  OLATHE_MIN_ZOOM,
} from '../utils/pursuitSim';

export interface PursuitMapVehicle {
  id: string;
  role: 'police' | 'perp';
  lat: number;
  lng: number;
  heading: number;
  status: string;
  route?: Array<{ lat: number; lng: number }>;
  routeIndex?: number;
  routeProgress?: number;
  destination?: { lat: number; lng: number };
}

interface PursuitMapCanvasProps {
  center?: [number, number];
  zoom?: number;
  vehicles: PursuitMapVehicle[];
  landmarks?: MapLandmark[];
  selectedId?: string | null;
  /** Suspect whose route and destination are pinned open for planning an intercept. */
  markedPerpId?: string | null;
  /** Re-fit the camera when this key changes. */
  fitKey?: string | number | null;
  deployMode?: boolean;
  /** Cruiser taking drive orders — draws its reachable ring and arms map taps. */
  driveOrderPoliceId?: string | null;
  driveOrderRangeM?: number;
  /** Keep this unit in view as it drives. */
  followId?: string | null;
  activeLandmarkId?: string | null;
  onVehicleClick?: (vehicle: PursuitMapVehicle) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onLandmarkClick?: (landmark: MapLandmark) => void;
}

const OLATHE_LATLNG_BOUNDS = L.latLngBounds(
  [OLATHE_BOUNDS.latMin, OLATHE_BOUNDS.lngMin],
  [OLATHE_BOUNDS.latMax, OLATHE_BOUNDS.lngMax]
);

/** Close enough that a block-long drive ring is a comfortable tap target. */
const DRIVE_ORDER_ZOOM = OLATHE_MAX_ZOOM;

/** Hard-lock pan/zoom so the camera cannot leave the Olathe city box. */
const OlatheMapLock: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    map.setMaxBounds(OLATHE_LATLNG_BOUNDS);
    map.setMinZoom(OLATHE_MIN_ZOOM);
    map.setMaxZoom(OLATHE_MAX_ZOOM);
    map.options.maxBoundsViscosity = 1.0;
    // Keep the view inside after any layout change.
    const keepInside = () => {
      map.panInsideBounds(OLATHE_LATLNG_BOUNDS, { animate: false });
    };
    map.on('drag', keepInside);
    map.on('zoomend', keepInside);
    keepInside();
    return () => {
      map.off('drag', keepInside);
      map.off('zoomend', keepInside);
    };
  }, [map]);

  return null;
};

/** Fit once per round so all units are visible at initiation — do not chase moving markers. */
const FitVehiclesOnce: React.FC<{
  vehicles: PursuitMapVehicle[];
  fitKey?: string | number | null;
  fallbackCenter: [number, number];
  fallbackZoom: number;
}> = ({ vehicles, fitKey, fallbackCenter, fallbackZoom }) => {
  const map = useMap();
  const fittedKeyRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (fitKey == null) return;
    if (fittedKeyRef.current === fitKey) return;
    if (!vehicles.length) {
      map.setView(fallbackCenter, fallbackZoom, { animate: false });
      map.panInsideBounds(OLATHE_LATLNG_BOUNDS, { animate: false });
      fittedKeyRef.current = fitKey;
      return;
    }
    const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng] as [number, number]));
    if (!bounds.isValid()) {
      map.setView(fallbackCenter, fallbackZoom, { animate: false });
    } else {
      // Never zoom out past the city lock.
      map.fitBounds(bounds.pad(0.35), {
        animate: false,
        maxZoom: 16,
        padding: [28, 28],
      });
    }
    if (map.getZoom() < OLATHE_MIN_ZOOM) {
      map.setZoom(OLATHE_MIN_ZOOM, { animate: false });
    }
    map.panInsideBounds(OLATHE_LATLNG_BOUNDS, { animate: false });
    fittedKeyRef.current = fitKey;
  }, [map, vehicles, fitKey, fallbackCenter, fallbackZoom]);

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
    className: 'leaflet-div-icon pursuit-landmark-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;width:104px;height:44px;pointer-events:auto;cursor:pointer;">
        <div style="
          width:22px;height:22px;border-radius:5px;flex-shrink:0;
          background:${style.color};color:#0b0f1a;
          font:700 11px/22px ui-monospace,Menlo,monospace;
          text-align:center;border:1px solid ${active ? '#fff' : 'rgba(255,255,255,0.55)'};
          box-shadow:0 0 ${active ? '8px' : '4px'} ${style.color};
        ">${style.glyph}</div>
        <div style="
          margin-top:2px;max-width:100px;padding:2px 5px;border-radius:3px;
          background:rgba(8,12,20,0.85);color:#f8fafc;
          font:600 9px/1.2 'IBM Plex Sans',system-ui,sans-serif;
          text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          border:1px solid ${active ? '#fff' : `${style.color}66`};
        ">${landmark.name}</div>
      </div>
    `,
    iconSize: [104, 44],
    iconAnchor: [52, 12],
  });
}

const MapClickHandler: React.FC<{
  enabled: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}> = ({ enabled, onMapClick }) => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (enabled) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
    if (!enabled || !onMapClick) return;
    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
      container.style.cursor = '';
    };
  }, [map, enabled, onMapClick]);

  return null;
};

const policeVehicleSvg = (heading: number, glow: string, selected: boolean, size: number) => `
  <div style="
    transform: rotate(${heading}deg);
    transform-origin: center center;
    width: ${size}px;
    height: ${size}px;
    filter: drop-shadow(0 0 ${selected ? '6px' : '4px'} ${glow});
    pointer-events: auto;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
      <defs>
        <linearGradient id="polBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#00f5ff"/>
          <stop offset="100%" style="stop-color:#2563eb"/>
        </linearGradient>
      </defs>
      <ellipse cx="22" cy="22" rx="20" ry="20" fill="rgba(0,245,255,0.15)" stroke="#00f5ff" stroke-width="${selected ? 2.5 : 1.5}"/>
      <path d="M10 24h24l-2.5-8H12.5l-2.5 8z" fill="url(#polBody)" stroke="#fff" stroke-width="1"/>
      <rect x="13" y="14" width="18" height="6" rx="2" fill="#1e3a8a" stroke="#00f5ff" stroke-width="0.8"/>
      <rect x="15" y="10" width="5" height="3" rx="1" fill="#ef4444"/>
      <rect x="24" y="10" width="5" height="3" rx="1" fill="#3b82f6"/>
      <circle cx="14" cy="26" r="3" fill="#111" stroke="#00f5ff" stroke-width="1"/>
      <circle cx="30" cy="26" r="3" fill="#111" stroke="#00f5ff" stroke-width="1"/>
      <polygon points="22,6 24,10 20,10" fill="#00f5ff" opacity="0.9"/>
    </svg>
  </div>`;

const perpVehicleSvg = (heading: number, marked: boolean, size: number) => {
  const outer = marked ? size + 8 : size;
  return `
  <div style="
    transform: rotate(${heading}deg);
    transform-origin: center center;
    width: ${outer}px;
    height: ${outer}px;
    filter: drop-shadow(0 0 ${marked ? '8px #ff2bd6' : '4px rgba(255,43,214,0.6)'});
    pointer-events: auto;
    cursor: pointer;
  ">
    ${marked ? '<div style="position:absolute;inset:-3px;border:2px dashed #ff2bd6;border-radius:50%;"></div>' : ''}
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44" style="margin:${marked ? '4px' : '0'}">
      <defs>
        <linearGradient id="perpBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ff2bd6"/>
          <stop offset="100%" style="stop-color:#991b1b"/>
        </linearGradient>
      </defs>
      <ellipse cx="22" cy="22" rx="20" ry="20" fill="rgba(255,43,214,0.12)" stroke="#ff2bd6" stroke-width="${marked ? 2.5 : 1.5}"/>
      <path d="M10 24h24l-2.5-8H12.5l-2.5 8z" fill="url(#perpBody)" stroke="#fff" stroke-width="1"/>
      <rect x="13" y="14" width="18" height="6" rx="2" fill="#450a0a" stroke="#ff2bd6" stroke-width="0.8"/>
      <circle cx="14" cy="26" r="3" fill="#111" stroke="#ff2bd6" stroke-width="1"/>
      <circle cx="30" cy="26" r="3" fill="#111" stroke="#ff2bd6" stroke-width="1"/>
      ${marked ? '<text x="22" y="8" text-anchor="middle" fill="#ff2bd6" font-size="8" font-weight="bold">!</text>' : ''}
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
  return Math.round(Math.max(14, Math.min(26, 8 + zoom * 0.85)));
}

function buildIcon(
  vehicle: PursuitMapVehicle,
  selected: boolean,
  marked: boolean,
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
  const isPolice = vehicle.role === 'police';
  const html = isPolice
    ? policeVehicleSvg(
        vehicle.heading,
        vehicle.status === 'driving' ? '#00f5ff' : '#2563eb',
        selected,
        iconSize
      )
    : perpVehicleSvg(vehicle.heading, marked, iconSize);

  const size = !isPolice && marked ? iconSize + 8 : iconSize;
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
  marked: boolean;
  iconSize: number;
  onClick: () => void;
}> = ({ vehicle, selected, marked, iconSize, onClick }) => {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.setLatLng([vehicle.lat, vehicle.lng]);
    marker.setIcon(buildIcon(vehicle, selected, marked, iconSize));
    marker.setZIndexOffset(selected ? 2000 : marked ? 1000 : vehicle.role === 'police' ? 500 : 400);
  }, [vehicle.lat, vehicle.lng, vehicle.heading, vehicle.status, selected, marked, vehicle, iconSize]);

  return (
    <Marker
      ref={markerRef}
      position={[vehicle.lat, vehicle.lng]}
      icon={buildIcon(vehicle, selected, marked, iconSize)}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          onClick();
        },
      }}
      zIndexOffset={selected ? 2000 : marked ? 1000 : vehicle.role === 'police' ? 500 : 400}
    />
  );
};

const ZoomAwareMarkers: React.FC<{
  vehicles: PursuitMapVehicle[];
  selectedId?: string | null;
  markedPerpId?: string | null;
  onVehicleClick?: (vehicle: PursuitMapVehicle) => void;
}> = ({ vehicles, selectedId, markedPerpId, onVehicleClick }) => {
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
          marked={markedPerpId === vehicle.id}
          iconSize={iconSize}
          onClick={() => onVehicleClick?.(vehicle)}
        />
      ))}
    </>
  );
};

/**
 * Camera follow. A rolling unit stays centered so the street ahead is always tappable; a parked
 * one only pulls the camera back if it has drifted off screen, leaving the player free to look
 * around between orders.
 */
const FollowUnit: React.FC<{ target?: PursuitMapVehicle | null }> = ({ target }) => {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    if (target.status === 'driving') {
      map.panTo([target.lat, target.lng], { animate: false });
      return;
    }
    if (map.getBounds().pad(-0.2).contains([target.lat, target.lng])) return;
    map.panTo([target.lat, target.lng], { animate: false });
  }, [map, target, target?.lat, target?.lng, target?.status]);

  return null;
};

/**
 * Taking the wheel pulls the camera in close, once per selection. The drive ring is only a block
 * wide, so from the opening city-wide fit it would be too small to aim a tap at.
 */
const DriveOrderFocus: React.FC<{ unitId: string | null; lat?: number; lng?: number }> = ({
  unitId,
  lat,
  lng,
}) => {
  const map = useMap();
  const focusedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!unitId || lat === undefined || lng === undefined) {
      focusedRef.current = null;
      return;
    }
    if (focusedRef.current === unitId) return;
    focusedRef.current = unitId;
    if (map.getZoom() < DRIVE_ORDER_ZOOM) map.setView([lat, lng], DRIVE_ORDER_ZOOM, { animate: true });
  }, [map, unitId, lat, lng]);

  return null;
};

const PursuitMapCanvas: React.FC<PursuitMapCanvasProps> = ({
  center = OLATHE_CENTER,
  zoom = 15,
  vehicles,
  landmarks = [],
  selectedId,
  markedPerpId,
  fitKey,
  deployMode = false,
  driveOrderPoliceId = null,
  driveOrderRangeM = 0,
  followId = null,
  activeLandmarkId = null,
  onVehicleClick,
  onMapClick,
  onLandmarkClick,
}) => {
  const driveOrderUnit = vehicles.find((v) => v.id === driveOrderPoliceId) ?? null;
  const followUnit = vehicles.find((v) => v.id === followId) ?? null;

  const routeLines = useMemo(() => {
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

    // The player's own drive order, plus the one suspect line they asked to see.
    vehicles.forEach((v) => {
      const isOrder = v.role === 'police' && v.status === 'driving';
      const isMarked = v.role === 'perp' && v.id === markedPerpId && v.status === 'fleeing';
      if (!isOrder && !isMarked) return;
      const positions = remainingRoute(v);
      if (positions.length < 2) return;
      lines.push({
        id: `${v.id}-route`,
        positions,
        color: isOrder ? '#00f5ff' : '#ff6b6b',
        dashed: isMarked,
      });
    });
    return lines;
  }, [vehicles, markedPerpId]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
      maxBounds={OLATHE_LATLNG_BOUNDS}
      maxBoundsViscosity={1}
      minZoom={OLATHE_MIN_ZOOM}
      maxZoom={OLATHE_MAX_ZOOM}
      worldCopyJump={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <OlatheMapLock />
      <FitVehiclesOnce
        vehicles={vehicles}
        fitKey={fitKey}
        fallbackCenter={center}
        fallbackZoom={zoom}
      />
      <MapClickHandler enabled={deployMode || !!driveOrderUnit} onMapClick={onMapClick} />
      <FollowUnit target={followUnit} />
      <DriveOrderFocus
        unitId={driveOrderUnit?.id ?? null}
        lat={driveOrderUnit?.lat}
        lng={driveOrderUnit?.lng}
      />

      {/* How far ahead the selected cruiser may be sent with one tap. */}
      {driveOrderUnit && driveOrderRangeM > 0 && (
        <Circle
          center={[driveOrderUnit.lat, driveOrderUnit.lng]}
          radius={driveOrderRangeM}
          pathOptions={{
            color: '#00f5ff',
            weight: 1,
            opacity: 0.5,
            dashArray: '5 7',
            fillColor: '#00f5ff',
            fillOpacity: 0.05,
            interactive: false,
          }}
        />
      )}

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

      {/* Where each suspect is headed — the player cuts them off rather than tailing them. */}
      {vehicles
        .filter((v) => v.role === 'perp' && v.status === 'fleeing' && v.destination)
        .map((v) => (
          <CircleMarker
            key={`${v.id}-dest-dot`}
            center={[v.destination!.lat, v.destination!.lng]}
            radius={v.id === markedPerpId ? 6 : 4}
            pathOptions={{
              color: '#ff2bd6',
              fillColor: '#ff2bd6',
              fillOpacity: v.id === markedPerpId ? 0.6 : 0.25,
              weight: 1,
              opacity: v.id === markedPerpId ? 0.9 : 0.45,
              interactive: false,
            }}
          />
        ))}

      <ZoomAwareMarkers
        vehicles={vehicles}
        selectedId={selectedId}
        markedPerpId={markedPerpId}
        onVehicleClick={onVehicleClick}
      />

      {/* Landmarks above vehicles so site raids stay tappable. */}
      {landmarks.map((lm) => {
        const style = landmarkStyle[lm.kind];
        const active = activeLandmarkId === lm.id;
        return (
          <React.Fragment key={lm.id}>
            <CircleMarker
              center={[lm.lat, lm.lng]}
              radius={14}
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
                  if (!deployMode) onLandmarkClick?.(lm);
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
                  if (!deployMode) onLandmarkClick?.(lm);
                },
              }}
            />
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
};

export default PursuitMapCanvas;
