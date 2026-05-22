import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Coordinates } from '@/types';
import { useEffect, useState } from 'react';

// Custom icons to differentiate A and B
const iconA = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const iconB = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

interface DualMapProps {
  coordsA: Coordinates;
  coordsB: Coordinates;
  onSetA: (pos: Coordinates) => void;
  onSetB: (pos: Coordinates) => void;
}

function DualLocationMarker({ coordsA, coordsB, onSetA, onSetB }: DualMapProps) {
  const [clickCount, setClickCount] = useState(0);
  const map = useMapEvents({
    click(e) {
      if (clickCount % 2 === 0) {
        onSetA({ lat: e.latlng.lat, lon: e.latlng.lng });
      } else {
        onSetB({ lat: e.latlng.lat, lon: e.latlng.lng });
      }
      setClickCount(prev => prev + 1);
    },
  });

  // Fit bounds to show both markers if they exist
  useEffect(() => {
    if (coordsA && coordsB) {
      const bounds = L.latLngBounds([coordsA.lat, coordsA.lon], [coordsB.lat, coordsB.lon]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [coordsA, coordsB, map]);

  return (
    <>
      {coordsA && <Marker position={[coordsA.lat, coordsA.lon]} icon={iconA} />}
      {coordsB && <Marker position={[coordsB.lat, coordsB.lon]} icon={iconB} />}
      {coordsA && coordsB && (
        <Polyline positions={[[coordsA.lat, coordsA.lon], [coordsB.lat, coordsB.lon]]} color="#f97316" dashArray="5, 10" />
      )}
    </>
  );
}

export default function DualSiteMap({ coordsA, coordsB, onSetA, onSetB }: DualMapProps) {
  return (
    <div className="h-48 w-full rounded-xl overflow-hidden border border-slate-700 relative z-0 mb-6">
      <MapContainer key="dual-map" center={[coordsA.lat, coordsA.lon]} zoom={13} scrollWheelZoom={true} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DualLocationMarker coordsA={coordsA} coordsB={coordsB} onSetA={onSetA} onSetB={onSetB} />
      </MapContainer>
      <div className="absolute top-2 left-2 z-[400] bg-slate-900/80 backdrop-blur px-3 py-1 rounded border border-slate-700 text-xs font-medium">
        <span className="text-blue-400">Click 1: Set Location A</span> | <span className="text-purple-400">Click 2: Set Location B</span>
      </div>
    </div>
  );
}
