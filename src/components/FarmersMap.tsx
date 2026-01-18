import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import { LineUser } from '@/lib/database';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { MapPin, Users } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

interface FarmersMapProps {
  farmers: LineUser[];
}

const DEFAULT_CENTER: [number, number] = [25.033, 121.5654]; // Taipei

const FarmersMap: React.FC<FarmersMapProps> = ({ farmers }) => {
  const { t } = useLanguage();

  const farmersWithLocation = useMemo(
    () =>
      farmers.filter(
        (f) => f.location && typeof f.location.lat === 'number' && typeof f.location.lng === 'number'
      ),
    [farmers]
  );

  if (farmersWithLocation.length === 0) {
    return (
      <Card className="w-full h-80">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('farms.map.noLocationTitle')}
            </h3>
            <p className="text-gray-600 text-sm">
              {t('farms.map.noLocationDescription')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const center = farmersWithLocation.length
    ? [farmersWithLocation[0].location!.lat, farmersWithLocation[0].location!.lng] as [number, number]
    : DEFAULT_CENTER;

  return (
    <Card className="w-full h-80">
      <CardContent className="p-0 h-full">
        <MapContainer
          center={center}
          zoom={9}
          style={{ height: '100%', width: '100%' }}
          className="rounded-lg"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors, &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {farmersWithLocation.map((farmer, index) => {
            const key = farmer.id || farmer.lineUserId || `farmer-marker-${index}`;
            return (
            <Marker
              key={key}
              position={[farmer.location!.lat, farmer.location!.lng]}
            >
              <Popup>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-gray-900">{farmer.displayName}</p>
                  {farmer.statusMessage && (
                    <p className="text-xs text-gray-600">{farmer.statusMessage}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                    <Users className="w-3 h-3" />
                    <span>{t('farms.map.farmerMarkerLabel')}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
            );
          })}
        </MapContainer>
      </CardContent>
    </Card>
  );
};

export default FarmersMap;





