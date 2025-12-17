import React from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure Leaflet default icons load correctly in Vite
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface FarmerMapPreviewProps {
  lat: number;
  lng: number;
  label: string;
  height?: number | string;
}

export const FarmerMapPreview: React.FC<FarmerMapPreviewProps> = ({ lat, lng, label, height = '100%' }) => (
  <MapContainer
    center={[lat, lng]}
    zoom={13}
    scrollWheelZoom={false}
    style={{ height, width: '100%' }}
  >
    <TileLayer
      attribution="&copy; OpenStreetMap contributors, &copy; CARTO"
      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    />
    <Marker position={[lat, lng]}>
      <Popup>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
      </Popup>
    </Marker>
  </MapContainer>
);

export interface FarmerRelatedSectionProps {
  title: string;
  emptyLabel: string;
  isLoading: boolean;
  children?: React.ReactNode;
}

export const FarmerRelatedSection: React.FC<FarmerRelatedSectionProps> = ({
  title,
  emptyLabel,
  isLoading,
  children,
}) => {
  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, index) => (
            <div
              key={index}
              className="h-12 rounded-lg bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      ) : children ? (
        children
      ) : (
        <p className="text-sm text-gray-500">{emptyLabel}</p>
      )}
    </section>
  );
};


