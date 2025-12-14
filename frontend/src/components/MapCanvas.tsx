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
    type: 'officer' | 'perp' | 'case' | 'emergency' | 'danger';
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
const getMarkerIcon = (type: string): L.DivIcon => {
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
