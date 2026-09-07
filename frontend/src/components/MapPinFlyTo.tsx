import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface MapPinFlyToProps {
  pinId?: string | null;
  lat?: number;
  lng?: number;
}

/** Fly the map to a selected pin. Skip city-center fly while this is active. */
const MapPinFlyTo: React.FC<MapPinFlyToProps> = ({ pinId, lat, lng }) => {
  const map = useMap();
  const lastKey = useRef('');

  useEffect(() => {
    if (!pinId || lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return;
    const key = `${pinId}:${lat}:${lng}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    const zoom = Math.max(map.getZoom(), 15);
    map.flyTo([lat, lng], zoom, { duration: 0.7 });
  }, [map, pinId, lat, lng]);

  return null;
};

export default MapPinFlyTo;
