import React, { useEffect, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FleetCity } from '../utils/cities';
import type { FleetMarker } from '../utils/fleetMarkers';
import { fleetKindMeta } from '../utils/fleetMarkers';

interface FleetMapCanvasProps {
  city: FleetCity;
  markers: FleetMarker[];
  activeTagId?: string | null;
  placing?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: FleetMarker) => void;
}

function buildFleetIcon(marker: FleetMarker, active = false): L.DivIcon {
  const style = fleetKindMeta(marker.kind);
  const label = (marker.name || style.short).replace(/[<>&"]/g, '');
  return L.divIcon({
    className: 'fleet-tag-marker',
    html: `
      <div style="
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

const CityFlyTo: React.FC<{ city: FleetCity }> = ({ city }) => {
  const map = useMap();
  const first = useRef(true);

  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      map.setView([city.lat, city.lng], city.zoom, { animate: false });
      return;
    }
    map.flyTo([city.lat, city.lng], city.zoom, { duration: 0.85 });
  }, [map, city.id, city.lat, city.lng, city.zoom]);

  return null;
};

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
    container.style.cursor = enabled ? 'crosshair' : '';
    if (!enabled) return;

    const handler = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
      container.style.cursor = '';
    };
  }, [map, enabled]);

  return null;
};

const FleetMapCanvas: React.FC<FleetMapCanvasProps> = ({
  city,
  markers,
  activeTagId = null,
  placing = true,
  onMapClick,
  onMarkerClick,
}) => {
  return (
    <MapContainer
      center={[city.lat, city.lng]}
      zoom={city.zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CityFlyTo city={city} />
      <MapZoomControls />
      <MapClickHandler enabled={placing} onMapClick={onMapClick} />

      {markers.map((marker) => {
        const active = activeTagId === marker.id;
        return (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={buildFleetIcon(marker, active)}
            interactive
            keyboard
            zIndexOffset={active ? 4500 : 4000}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onMarkerClick?.(marker);
              },
            }}
          />
        );
      })}
    </MapContainer>
  );
};

export default FleetMapCanvas;
