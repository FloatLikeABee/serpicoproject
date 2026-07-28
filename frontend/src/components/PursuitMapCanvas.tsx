import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet';
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
  selectedId?: string | null;
  armedPoliceId?: string | null;
  pursueModePoliceId?: string | null;
  /** Re-fit the camera when this key changes (new round / session). */
  fitKey?: string | number | null;
  deployMode?: boolean;
  activeLandmarkId?: string | null;
  onVehicleClick?: (vehicle: PursuitMapVehicle) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onLandmarkClick?: (landmark: MapLandmark) => void;
}

const OLATHE_LATLNG_BOUNDS = L.latLngBounds(
  [OLATHE_BOUNDS.latMin, OLATHE_BOUNDS.lngMin],
  [OLATHE_BOUNDS.latMax, OLATHE_BOUNDS.lngMax]
);

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

/** Squad and helper cruisers share the same blue look; helpers get a small H badge. */
const policeVehicleSvg = (
  heading: number,
  selected: boolean,
  size: number,
  helper: boolean,
  gradId: string
) => `
  <div style="
    transform: rotate(${heading}deg);
    transform-origin: center center;
    width: ${size}px;
    height: ${size}px;
    filter: drop-shadow(0 0 ${selected ? '9px' : '6px'} #3b82f6);
    pointer-events: auto;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#60a5fa"/>
          <stop offset="55%" style="stop-color:#2563eb"/>
          <stop offset="100%" style="stop-color:#1d4ed8"/>
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="24" rx="22" ry="22" fill="rgba(37,99,235,0.22)" stroke="#60a5fa" stroke-width="${selected ? 3 : 2}"/>
      <ellipse cx="24" cy="24" rx="17" ry="17" fill="rgba(14,165,233,0.12)" stroke="#93c5fd" stroke-width="1"/>
      <path d="M9 27h30l-3-10H12l-3 10z" fill="url(#${gradId})" stroke="#eff6ff" stroke-width="1.2"/>
      <rect x="13" y="15" width="22" height="7" rx="2" fill="#1e3a8a" stroke="#93c5fd" stroke-width="0.9"/>
      <rect x="15" y="10" width="6" height="3.5" rx="1" fill="#ef4444"/>
      <rect x="27" y="10" width="6" height="3.5" rx="1" fill="#38bdf8"/>
      <circle cx="15" cy="29" r="3.4" fill="#0f172a" stroke="#93c5fd" stroke-width="1.1"/>
      <circle cx="33" cy="29" r="3.4" fill="#0f172a" stroke="#93c5fd" stroke-width="1.1"/>
      <polygon points="24,5 27,11 21,11" fill="#93c5fd"/>
      ${
        helper
          ? `<circle cx="39" cy="10" r="6" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="1.2"/>
             <text x="39" y="13" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">H</text>`
          : ''
      }
    </svg>
  </div>`;

const perpVehicleSvg = (
  heading: number,
  pursued: boolean,
  lockOn: boolean,
  size: number,
  tint = '#ff2bd6',
  gradId = 'perpBody'
) => {
  const outer = lockOn ? size + 8 : size;
  return `
  <div style="
    transform: rotate(${heading}deg);
    transform-origin: center center;
    width: ${outer}px;
    height: ${outer}px;
    filter: drop-shadow(0 0 ${lockOn ? `8px ${tint}` : pursued ? `5px ${tint}` : `3px ${tint}99`});
    pointer-events: auto;
    cursor: ${lockOn ? 'crosshair' : 'pointer'};
  ">
    ${lockOn ? `<div style="position:absolute;inset:-3px;border:2px dashed ${tint};border-radius:50%;animation:pulse 1s infinite;"></div>` : ''}
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40" style="margin:${lockOn ? '4px' : '0'}">
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${tint}"/>
          <stop offset="100%" style="stop-color:#7f1d1d"/>
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="20" rx="17" ry="17" fill="${tint}18" stroke="${tint}" stroke-width="${lockOn || pursued ? 2 : 1.2}"/>
      <path d="M9 22h22l-2-7H11l-2 7z" fill="url(#${gradId})" stroke="#fff" stroke-width="0.8"/>
      <rect x="12" y="13" width="16" height="5" rx="1.5" fill="#292524" stroke="${tint}" stroke-width="0.7"/>
      <circle cx="13" cy="24" r="2.4" fill="#111" stroke="${tint}" stroke-width="0.8"/>
      <circle cx="27" cy="24" r="2.4" fill="#111" stroke="${tint}" stroke-width="0.8"/>
      ${pursued ? `<text x="20" y="8" text-anchor="middle" fill="${tint}" font-size="7" font-weight="bold">!</text>` : ''}
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
  return Math.round(Math.max(12, Math.min(22, 6 + zoom * 0.75)));
}

/** Police markers read larger and more special than suspect cars. */
function policeIconSize(base: number) {
  return Math.round(base * 1.65);
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

  const safeId = vehicle.id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (vehicle.role === 'police') {
    const size = policeIconSize(iconSize);
    const html = policeVehicleSvg(
      vehicle.heading,
      selected || armed,
      size,
      vehicle.policeKind === 'helper',
      `pol-${safeId}`
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
    vehicle.color,
    `perp-${safeId}`
  );
  const size = pursueTarget ? iconSize + 8 : iconSize;
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
  center = OLATHE_CENTER,
  zoom = 15,
  vehicles,
  landmarks = [],
  selectedId,
  armedPoliceId,
  pursueModePoliceId,
  fitKey,
  deployMode = false,
  activeLandmarkId = null,
  onVehicleClick,
  onMapClick,
  onLandmarkClick,
}) => {
  const selectedVehicle = vehicles.find((v) => v.id === selectedId);

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
    vehicles
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
  }, [vehicles, selectedVehicle]);

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

      {vehicles
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

      <ZoomAwareMarkers
        vehicles={vehicles}
        selectedId={selectedId}
        armedPoliceId={armedPoliceId}
        pursueModePoliceId={pursueModePoliceId}
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
