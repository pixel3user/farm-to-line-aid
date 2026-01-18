import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { Store } from '@/lib/database';
import { MapPin, Phone, Mail, Globe, Users, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface StoresMapProps {
  stores: Store[];
  isLoading?: boolean;
}

interface StoreLocation {
  store: Store;
  coordinates: [number, number];
  geocoded: boolean;
  addressUsed: string;
  usedFallback: boolean;
}

// Simple geocoding function using OpenStreetMap Nominatim API
const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=tw`
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Custom hook to fit map bounds to markers
const FitBounds: React.FC<{ storeLocations: StoreLocation[] }> = ({ storeLocations }) => {
  const map = useMap();
  
  useEffect(() => {
    if (storeLocations.length > 0) {
      const validLocations = storeLocations.filter(loc => loc.geocoded);
      
      if (validLocations.length > 0) {
        const bounds = validLocations.map(loc => loc.coordinates);
        if (bounds.length > 0) {
          map.fitBounds(bounds as any, { padding: [20, 20] });
        }
      }
    }
  }, [storeLocations, map]);
  
  return null;
};

const getStatusColor = (status: Store['status']) => {
  switch (status) {
    case 'potential':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'contacted':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'customer':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'former_customer':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusText = (status: Store['status']) => {
  switch (status) {
    case 'potential':
      return '潛在客戶';
    case 'contacted':
      return '已聯絡';
    case 'customer':
      return '客戶';
    case 'former_customer':
      return '前客戶';
    default:
      return '未知';
  }
};

const getTypeIcon = (type: Store['type']) => {
  switch (type) {
    case 'restaurant':
      return '🍽️';
    case 'supermarket':
      return '🏪';
    case 'farmers_market':
      return '🥬';
    case 'online_store':
      return '💻';
    default:
      return '🏢';
  }
};

const getStoreAddresses = (store: Store) => {
  const written = store.location?.trim() || '';
  const gps = store.pickup?.address?.trim() || '';
  return {
    primary: written || gps,
    fallback: written && gps ? gps : ''
  };
};

const getPreferredDisplayAddress = (store: Store) => {
  return store.location?.trim() || store.pickup?.address?.trim() || '';
};

const StoresMap: React.FC<StoresMapProps> = ({ stores, isLoading = false }) => {
  const { t } = useLanguage();
  const [mapCenter] = useState<[number, number]>([25.0330, 121.5654]); // Taipei coordinates
  const [mapZoom] = useState(11);
  const [storeLocations, setStoreLocations] = useState<StoreLocation[]>([]);
  const [geocodingInProgress, setGeocodingInProgress] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter stores that have location data (memoized to reduce re-computations)
  const storesWithLocation = useMemo(() => {
    return stores.filter((store) => {
      const written = store.location?.trim() || '';
      const gps = store.pickup?.address?.trim() || '';
      return Boolean(written || gps);
    });
  }, [stores]);

  // Geocode store addresses
  const geocodeStores = useCallback(async () => {
    if (storesWithLocation.length === 0) {
      setStoreLocations([]);
      return;
    }

    setGeocodingInProgress(true);
    const locations: StoreLocation[] = [];

    for (const store of storesWithLocation) {
      try {
        const preferredAddress = getPreferredDisplayAddress(store);
        const storedLat = store.pickup?.lat;
        const storedLng = store.pickup?.lng;
        if (Number.isFinite(storedLat) && Number.isFinite(storedLng)) {
          locations.push({
            store,
            coordinates: [storedLat as number, storedLng as number],
            geocoded: true,
            addressUsed: preferredAddress,
            usedFallback: false
          });
          continue;
        }

        const { primary, fallback } = getStoreAddresses(store);
        let addressUsed = primary;
        let usedFallback = false;
        let coordinates = primary ? await geocodeAddress(primary) : null;

        if (!coordinates && fallback) {
          coordinates = await geocodeAddress(fallback);
          if (coordinates) {
            addressUsed = fallback;
            usedFallback = true;
          }
        }

        if (coordinates) {
          locations.push({
            store,
            coordinates,
            geocoded: true,
            addressUsed,
            usedFallback
          });
        } else {
          // Fallback to default location if geocoding fails
          locations.push({
            store,
            coordinates: mapCenter,
            geocoded: false,
            addressUsed: addressUsed || store.location || store.pickup?.address || '',
            usedFallback
          });
        }
      } catch (error) {
        console.error(`Failed to geocode ${store.name}:`, error);
        const { primary, fallback } = getStoreAddresses(store);
        locations.push({
          store,
          coordinates: mapCenter,
          geocoded: false,
          addressUsed: primary || fallback || store.location || store.pickup?.address || '',
          usedFallback: false
        });
      }
    }

    setStoreLocations(locations);
    setGeocodingInProgress(false);
  }, [storesWithLocation, mapCenter]);

  useEffect(() => {
    geocodeStores();
  }, [geocodeStores]);

  // Keep map mounted to avoid flicker; show overlay loader instead of unmounting

  if (storesWithLocation.length === 0) {
    return (
      <Card className="w-full h-96">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('farmer.stores.map.noLocationTitle')}</h3>
            <p className="text-gray-600">{t('farmer.stores.map.noLocationDescription')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-96 overflow-hidden">
      <CardContent className="p-0 h-full relative overflow-hidden">
        {(isLoading || geocodingInProgress) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-700 text-sm">
                {isLoading ? t('farmer.stores.map.loading') : t('farmer.stores.map.geocoding')}
              </p>
            </div>
          </div>
        )}
        {!isInteractive && (
          <button
            type="button"
            onClick={() => {
              setIsInteractive(true);
              setIsFullscreen(true);
            }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-white/20 backdrop-blur-[1px]"
            aria-label={t('farmer.stores.map.openFullscreen')}
          >
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
              {t('farmer.stores.map.openFullscreen')}
            </span>
          </button>
        )}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-white">
            <div className="absolute right-4 top-4 z-10">
              <button
                type="button"
                onClick={() => {
                  setIsFullscreen(false);
                  setIsInteractive(false);
                }}
                className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow-md"
                aria-label={t('farmer.stores.map.closeFullscreen')}
              >
                {t('farmer.stores.map.closeFullscreen')}
              </button>
            </div>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors, &copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <FitBounds storeLocations={storeLocations} />
              {storeLocations.map((location) => (
                <Marker key={`${location.store.id}-fullscreen`} position={location.coordinates}>
                  <Popup>
                    <div className="p-2 min-w-[250px]">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="text-2xl">{getTypeIcon(location.store.type)}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{location.store.name}</h3>
                          <Badge className={`text-xs ${getStatusColor(location.store.status)}`}>
                            {getStatusText(location.store.status)}
                          </Badge>
                          {!location.geocoded && (
                            <Badge variant="outline" className="text-xs ml-2 text-orange-600 border-orange-200">
                              <Navigation className="w-3 h-3 mr-1" />
                              {t('farmer.stores.map.defaultLocation')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{location.addressUsed || getPreferredDisplayAddress(location.store)}</span>
                        </div>

                        {location.store.contact?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{location.store.contact?.phone}</span>
                          </div>
                        )}

                        {location.store.contact?.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span>{location.store.contact?.email}</span>
                          </div>
                        )}

                        {location.store.contact?.website && (
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            <a
                              href={location.store.contact?.website || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {t('farmer.stores.map.website')}
                            </a>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>
                            {t('farmer.stores.map.totalOrders')}: {location.store.metadata?.totalOrders ?? 0}
                          </span>
                        </div>
                      </div>

                      {location.store.metadata?.notes && location.store.metadata.notes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            {t('farmer.stores.map.note')}: {location.store.metadata.notes[0]}
                          </p>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          className={`rounded-lg ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'} z-0`}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors, &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          
          <FitBounds storeLocations={storeLocations} />
          
          {storeLocations.map((location) => (
            <Marker
              key={location.store.id}
              position={location.coordinates}
            >
              <Popup>
                <div className="p-2 min-w-[250px]">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-2xl">{getTypeIcon(location.store.type)}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{location.store.name}</h3>
                      <Badge className={`text-xs ${getStatusColor(location.store.status)}`}>
                        {getStatusText(location.store.status)}
                      </Badge>
                      {!location.geocoded && (
                        <Badge variant="outline" className="text-xs ml-2 text-orange-600 border-orange-200">
                          <Navigation className="w-3 h-3 mr-1" />
                          {t('farmer.stores.map.defaultLocation')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{location.addressUsed || getPreferredDisplayAddress(location.store)}</span>
                    </div>
                    
                    {location.store.contact?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{location.store.contact?.phone}</span>
                      </div>
                    )}
                    
                    {location.store.contact?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{location.store.contact?.email}</span>
                      </div>
                    )}
                    
                    {location.store.contact?.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <a 
                          href={location.store.contact?.website || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {t('farmer.stores.map.website')}
                        </a>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>
                        {t('farmer.stores.map.totalOrders')}: {location.store.metadata?.totalOrders ?? 0}
                      </span>
                    </div>
                  </div>
                  
                  {location.store.metadata?.notes && location.store.metadata.notes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        {t('farmer.stores.map.note')}: {location.store.metadata.notes[0]}
                      </p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </CardContent>
    </Card>
  );
};

export default StoresMap;
