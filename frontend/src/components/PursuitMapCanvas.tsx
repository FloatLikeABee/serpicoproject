import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface PursuitMapVehicle {
  id: string;
  role: 'police' | 'perp';
  lat: number;
  lng: number;
  heading: number;
  status: string;
  beingPursued?: boolean;
  pursuingPerpId?: string;
  route?: Array<{ lat: number; lng: number }>;
  destination?: { lat: number; lng: number };
}

interface PursuitMapCanvasProps {
  center?: [number, number];
  zoom?: number;
  vehicles: PursuitMapVehicle[];
  selectedId?: string | null;
  armedPoliceId?: string | null;
  pursueModePoliceId?: string | null;
  onVehicleClick?: (vehicle: PursuitMapVehicle) => void;
}

const MapUpdater: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [map, center, zoom]);
  return null;
};

const policeDownSvg = (heading: number) => `
  <div style="
    transform: rotate(${heading}deg);
    transform-origin: center center;
    width: 44px;
    height: 44px;
    filter: drop-shadow(0 0 6px rgba(100,100,100,0.5));
    opacity: 0.65;
    pointer-events: auto;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <ellipse cx="22" cy="22" rx="20" ry="20" fill="rgba(80,80,80,0.2)" stroke="#666" stroke-width="1.5" stroke-dasharray="4 3"/>
      <path d="M10 24h24l-2.5-8H12.5l-2.5 8z" fill="#444" stroke="#888" stroke-width="1"/>
      <text x="22" y="20" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">✕</text>
    </svg>
  </div>`;

const policeVehicleSvg = (heading: number, glow: string, selected: boolean) => `
  <div style="
    transform: rotate(${heading}deg);
    transform-origin: center center;
    width: 44px;
    height: 44px;
    filter: drop-shadow(0 0 ${selected ? '10px' : '6px'} ${glow});
    pointer-events: auto;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
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

const perpVehicleSvg = (heading: number, pursued: boolean, lockOn: boolean) => `
  <div style="
    transform: rotate(${heading}deg);
    transform-origin: center center;
    width: ${lockOn ? '52px' : '44px'};
    height: ${lockOn ? '52px' : '44px'};
    filter: drop-shadow(0 0 ${lockOn ? '14px #ff2bd6' : pursued ? '12px #ff2bd6' : '6px rgba(255,43,214,0.6)'});
    pointer-events: auto;
    cursor: ${lockOn ? 'crosshair' : 'pointer'};
  ">
    ${lockOn ? '<div style="position:absolute;inset:-4px;border:2px dashed #ff2bd6;border-radius:50%;animation:pulse 1s infinite;"></div>' : ''}
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" style="margin:${lockOn ? '4px' : '0'}">
      <defs>
        <linearGradient id="perpBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ff2bd6"/>
          <stop offset="100%" style="stop-color:#991b1b"/>
        </linearGradient>
      </defs>
      <ellipse cx="22" cy="22" rx="20" ry="20" fill="rgba(255,43,214,0.12)" stroke="#ff2bd6" stroke-width="${lockOn || pursued ? 2.5 : 1.5}"/>
      <path d="M10 24h24l-2.5-8H12.5l-2.5 8z" fill="url(#perpBody)" stroke="#fff" stroke-width="1"/>
      <rect x="13" y="14" width="18" height="6" rx="2" fill="#450a0a" stroke="#ff2bd6" stroke-width="0.8"/>
      <circle cx="14" cy="26" r="3" fill="#111" stroke="#ff2bd6" stroke-width="1"/>
      <circle cx="30" cy="26" r="3" fill="#111" stroke="#ff2bd6" stroke-width="1"/>
      ${pursued ? '<text x="22" y="8" text-anchor="middle" fill="#ff2bd6" font-size="8" font-weight="bold">!</text>' : ''}
    </svg>
  </div>`;

const caughtOverlay = `
  <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);border-radius:50%;border:2px solid #39ff14;pointer-events:auto;">
    <span style="color:#39ff14;font-size:18px;font-weight:bold;">✓</span>
  </div>`;

const escapedOverlay = `
  <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);border-radius:50%;border:2px solid #888;pointer-events:auto;">
    <span style="color:#888;font-size:14px;font-weight:bold;">—</span>
  </div>`;

function buildIcon(
  vehicle: PursuitMapVehicle,
  selected: boolean,
  armed: boolean,
  pursueTarget: boolean
): L.DivIcon {
  if (vehicle.status === 'caught') {
    return L.divIcon({
      className: 'custom-marker pursuit-vehicle-marker',
      html: caughtOverlay,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }
  if (vehicle.status === 'escaped') {
    return L.divIcon({
      className: 'custom-marker pursuit-vehicle-marker',
      html: escapedOverlay,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }
  if (vehicle.role === 'police' && vehicle.status === 'down') {
    return L.divIcon({
      className: 'custom-marker pursuit-vehicle-marker',
      html: policeDownSvg(vehicle.heading),
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }
  const isPolice = vehicle.role === 'police';
  const html = isPolice
    ? policeVehicleSvg(vehicle.heading, armed ? '#00f5ff' : '#2563eb', selected || armed)
    : perpVehicleSvg(vehicle.heading, vehicle.beingPursued || false, pursueTarget);

  const size = !isPolice && pursueTarget ? 52 : 44;
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
  onClick: () => void;
}> = ({ vehicle, selected, armed, pursueTarget, onClick }) => {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.setLatLng([vehicle.lat, vehicle.lng]);
    marker.setIcon(buildIcon(vehicle, selected, armed, pursueTarget));
    marker.setZIndexOffset(pursueTarget ? 2000 : selected || armed ? 1000 : vehicle.role === 'police' ? 500 : 400);
  }, [vehicle.lat, vehicle.lng, vehicle.heading, vehicle.status, vehicle.beingPursued, selected, armed, pursueTarget, vehicle]);

  return (
    <Marker
      ref={markerRef}
      position={[vehicle.lat, vehicle.lng]}
      icon={buildIcon(vehicle, selected, armed, pursueTarget)}
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

const PursuitMapCanvas: React.FC<PursuitMapCanvasProps> = ({
  center = [38.8814, -94.8191],
  zoom = 13,
  vehicles,
  selectedId,
  armedPoliceId,
  pursueModePoliceId,
  onVehicleClick,
}) => {
  const selectedVehicle = vehicles.find((v) => v.id === selectedId);

  const routeLines = useMemo(() => {
    const lines: Array<{ id: string; positions: [number, number][]; color: string; dashed?: boolean }> = [];
    if (selectedVehicle?.route && selectedVehicle.route.length > 1) {
      lines.push({
        id: selectedVehicle.id,
        positions: selectedVehicle.route.map((p) => [p.lat, p.lng]),
        color: '#00f5ff',
      });
    }
    vehicles
      .filter((v) => v.route && v.route.length > 1 && v.status !== 'caught')
      .forEach((v) => {
        const isPursuit = v.role === 'police' && v.status === 'pursuing';
        const isPerp = v.role === 'perp';
        if (!isPursuit && !isPerp) return;
        lines.push({
          id: `${v.id}-route`,
          positions: v.route!.map((p) => [p.lat, p.lng]),
          color: isPursuit ? '#00f5ff' : v.beingPursued ? '#ff6b6b' : '#ff2bd6',
          dashed: isPerp && !v.beingPursued,
        });
      });
    return lines;
  }, [vehicles, selectedVehicle]);

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} zoom={zoom} />

      {routeLines.map((r) => (
        <Polyline
          key={r.id}
          positions={r.positions}
          pathOptions={{
            color: r.color,
            weight: r.dashed ? 2 : 3,
            opacity: r.dashed ? 0.35 : 0.55,
            dashArray: r.dashed ? '4 8' : undefined,
          }}
        />
      ))}

      {vehicles
        .filter((v) => v.role === 'perp' && v.destination && v.status !== 'caught')
        .map((v) => (
          <CircleMarker
            key={`${v.id}-dest-dot`}
            center={[v.destination!.lat, v.destination!.lng]}
            radius={5}
            pathOptions={{ color: '#ff2bd6', fillColor: '#ff2bd6', fillOpacity: 0.5, weight: 1 }}
          />
        ))}

      {vehicles.map((vehicle) => (
        <MovingVehicleMarker
          key={vehicle.id}
          vehicle={vehicle}
          selected={selectedId === vehicle.id}
          armed={armedPoliceId === vehicle.id}
          pursueTarget={!!pursueModePoliceId && vehicle.role === 'perp' && vehicle.status !== 'caught' && vehicle.status !== 'escaped'}
          onClick={() => onVehicleClick?.(vehicle)}
        />
      ))}
    </MapContainer>
  );
};

export default PursuitMapCanvas;
