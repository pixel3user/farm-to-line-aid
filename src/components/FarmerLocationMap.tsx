import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const DEFAULT_CENTER: [number, number] = [25.033, 121.5654]; // Taipei

const FarmerLocationMap: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasLocation = !!user?.location;
  const center: [number, number] = hasLocation
    ? [user!.location!.lat, user!.location!.lng]
    : DEFAULT_CENTER;

  if (!hasLocation) {
    return (
      <Card className="w-full h-80">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('farmer.location.map.noLocationTitle')}
            </h3>
            <p className="text-gray-600 text-sm">
              {t('farmer.location.map.noLocationDescription')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-80 overflow-hidden">
      <CardContent className="p-0 h-full relative overflow-hidden">
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="absolute inset-0 z-20 flex items-center justify-center bg-white/20 backdrop-blur-[1px]"
          aria-label={t('farmer.location.map.openFullscreen')}
        >
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
            {t('farmer.location.map.openFullscreen')}
          </span>
        </button>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          className="rounded-lg z-0 pointer-events-none"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors, &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <Marker position={center}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-gray-900 mb-1">
                  {user?.displayName || t('farmer.location.map.you')}
                </p>
                <p className="text-gray-600">
                  {t('farmer.location.map.description')}
                </p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-white">
            <div className="absolute right-4 top-4 z-10">
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow-md"
                aria-label={t('farmer.location.map.closeFullscreen')}
              >
                {t('farmer.location.map.closeFullscreen')}
              </button>
            </div>
            <MapContainer
              center={center}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors, &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <Marker position={center}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900 mb-1">
                      {user?.displayName || t('farmer.location.map.you')}
                    </p>
                    <p className="text-gray-600">
                      {t('farmer.location.map.description')}
                    </p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FarmerLocationMap;



