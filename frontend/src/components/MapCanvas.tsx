import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Note: We use custom divIcon markers, so default marker icons are not needed

interface MapCanvasProps {
  center?: [number, number]; // [lat, lng]
  zoom?: number;
  markers?: Array<{
    id: string;
    position: [number, number]; // [lat, lng]
    type: 'officer' | 'perp' | 'case' | 'emergency' | 'danger' | 'police-vehicle' | 'suspect-vehicle' | 'vehicle';
    title?: string;
    description?: string;
  }>;
}

// Component to update map center when props change
const MapUpdater: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
};

// Custom marker icon based on type
const vehicleSvg = (fill: string, accent: string, siren = false) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="17" fill="white" opacity="0.95"/>
    <circle cx="18" cy="18" r="16" fill="${fill}" stroke="white" stroke-width="2"/>
    <path d="M8 20h20l-2-6H10l-2 6z" fill="${accent}" stroke="white" stroke-width="0.8"/>
    <rect x="11" y="12" width="14" height="5" rx="1.5" fill="${accent}" stroke="white" stroke-width="0.8"/>
    <circle cx="12" cy="21" r="2.5" fill="#1f2937" stroke="white" stroke-width="0.8"/>
    <circle cx="24" cy="21" r="2.5" fill="#1f2937" stroke="white" stroke-width="0.8"/>
    ${siren ? '<rect x="14" y="9" width="8" height="2.5" rx="1" fill="#ef4444"/><rect x="16" y="7" width="4" height="2" rx="0.5" fill="#3b82f6"/>' : ''}
  </svg>`;

const getMarkerIcon = (type: string): L.DivIcon => {
  const isVehicleType = ['police-vehicle', 'suspect-vehicle', 'vehicle', 'case'].includes(type);

  if (isVehicleType) {
    const isPolice = type === 'police-vehicle' || type === 'case' || type === 'vehicle';
    const isSuspect = type === 'suspect-vehicle';

    let fill = '#2563EB';
    let accent = '#1e40af';
    let siren = true;

    if (isSuspect) {
      fill = '#DC2626';
      accent = '#991b1b';
      siren = false;
    } else if (type === 'vehicle') {
      fill = '#F59E0B';
      accent = '#d97706';
      siren = false;
    }

    return L.divIcon({
      className: 'custom-marker vehicle-marker',
      html: `<div style="width:36px;height:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">${vehicleSvg(fill, accent, isPolice && siren)}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  }

  const getColor = () => {
    switch (type) {
      case 'officer':
        return '#2563EB';
      case 'perp':
        return '#DC2626';
      case 'case':
        return '#F59E0B';
      case 'emergency':
        return '#EF4444';
      case 'danger':
        return '#991B1B';
      default:
        return '#6B7280';
    }
  };

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: ${getColor()};
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

const MapCanvas: React.FC<MapCanvasProps> = ({
  center = [38.8814, -94.8191], // Default to Olathe, Kansas [lat, lng]
  zoom = 12,
  markers = [],
}) => {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%', minHeight: '400px' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} zoom={zoom} />
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.position}
          icon={getMarkerIcon(marker.type)}
        >
          <Popup>
            <div>
              <strong>{marker.title || marker.type}</strong>
              {marker.description && <p style={{ margin: '4px 0 0 0' }}>{marker.description}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapCanvas;
