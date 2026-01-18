import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatabaseService, LineUser, Product, Store } from '@/lib/database';
import { MapPin, MessageSquare, Users, Eye, Phone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import FarmersMap from '@/components/FarmersMap';
import { FarmerMapPreview, FarmerRelatedSection } from '@/components/FarmerDetailSections';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const MarketFarms: React.FC = () => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: farmers = [], isFetching } = useQuery<LineUser[]>({
    queryKey: ['market-farmers-all'],
    queryFn: () => DatabaseService.getFarmers(50),
    staleTime: Infinity,
    cacheTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    initialData: () => queryClient.getQueryData(['market-farmers-all']) as LineUser[] | undefined,
  });
  const hasFarmers = farmers.length > 0;
  const isLoading = !hasFarmers && isFetching;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<LineUser | null>(null);
  const [isFarmerModalOpen, setIsFarmerModalOpen] = useState(false);
  const [farmerProducts, setFarmerProducts] = useState<Product[]>([]);
  const [farmerStores, setFarmerStores] = useState<Store[]>([]);
  const [isFarmerDataLoading, setIsFarmerDataLoading] = useState(false);

  const filteredFarmers = useMemo(() => {
    return farmers.filter((farmer) =>
      farmer.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [farmers, searchTerm]);

  useEffect(() => {
    if (!selectedFarmer || !isFarmerModalOpen) {
      setFarmerProducts([]);
      setFarmerStores([]);
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      try {
        setIsFarmerDataLoading(true);
        const farmerId = selectedFarmer.lineUserId || selectedFarmer.id;
        const [productsByFarmer, storesByFarmer] = await Promise.all([
          farmerId ? DatabaseService.getProductsByUser(farmerId) : Promise.resolve([]),
          farmerId ? DatabaseService.getStoresByUser(farmerId) : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setFarmerProducts(productsByFarmer);
          setFarmerStores(storesByFarmer);
        }
      } catch (error) {
        console.error('Failed to load farmer detail for Farms page', error);
        if (!cancelled) {
          setFarmerProducts([]);
          setFarmerStores([]);
        }
      } finally {
        if (!cancelled) {
          setIsFarmerDataLoading(false);
        }
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedFarmer, isFarmerModalOpen]);

  const openFarmerModal = (farmer: LineUser) => {
    setSelectedFarmer(farmer);
    setIsFarmerModalOpen(true);
  };

  const handleModalChange = (open: boolean) => {
    setIsFarmerModalOpen(open);
    if (!open) {
      setSelectedFarmer(null);
    }
  };

  const formatDate = (value?: any) => {
    if (!value) return t('market.detail.notProvided');
    if (typeof value === 'string') {
      return new Date(value).toLocaleDateString();
    }
    if (typeof value.toDate === 'function') {
      return value.toDate().toLocaleDateString();
    }
    return t('market.detail.notProvided');
  };

  const formatLocation = (farmer: LineUser | null) => {
    if (!farmer?.location) return t('market.detail.notProvided');
    const { lat, lng } = farmer.location;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    }
    return t('market.detail.notProvided');
  };

  const contactEmail = selectedFarmer?.email;
  const contactPhone = selectedFarmer?.marketProfile?.contactPhone;
  const contactBusiness = selectedFarmer?.marketProfile?.businessName;
  const hasContactDetails = Boolean(contactEmail || contactPhone || contactBusiness);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-28 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" data-tour="market-farms-list">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('farms.title')}</h1>
          <p className="text-gray-600">{t('farms.description')}</p>
        </div>
        <Input
          placeholder={t('farms.search')}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('farms.farmers')}</CardTitle>
          <CardDescription>
            {t('farms.showingRecords')
              .replace('{filtered}', filteredFarmers.length.toString())
              .replace('{total}', farmers.length.toString())}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredFarmers.length === 0 ? (
            <p className="text-sm text-gray-500">{t('farms.noResults')}</p>
          ) : (
            filteredFarmers.map((farmer, index) => {
              const farmerKey = farmer.id || farmer.lineUserId || `farmer-${index}`;
              return (
              <div
                key={farmerKey}
                role="button"
                tabIndex={0}
                onClick={() => openFarmerModal(farmer)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') openFarmerModal(farmer);
                }}
                className="border rounded-lg p-4 cursor-pointer hover:border-green-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{farmer.displayName}</p>
                    <p className="text-sm text-gray-600">
                      {t('farms.lastInteraction')}:{' '}
                      {farmer.metadata?.lastInteraction
                        ? farmer.metadata.lastInteraction.toDate().toLocaleString()
                        : t('farms.notRecorded')}
                    </p>
                    {farmer.statusMessage && (
                      <p className="text-sm text-gray-500 mt-1">{farmer.statusMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t('market.active')}</Badge>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      {t('farms.contact')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        openFarmerModal(farmer);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {t('market.detailsButton')}
                    </Button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Large map below the list */}
      <Card data-tour="market-farms-map">
        <CardHeader>
          <CardTitle>{t('farms.map.title')}</CardTitle>
          <CardDescription>{t('farms.map.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[28rem]">
            <FarmersMap farmers={farmers} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('farms.summary')}</CardTitle>
          <CardDescription>{t('farms.summaryDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('farms.total')}</p>
              <p className="text-2xl font-bold text-gray-900">{farmers.length}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('farms.recentlyActive')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {farmers.filter((farmer) => farmer.metadata?.lastInteraction).length}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('farms.engagementTips')}</p>
              <div className="text-sm text-gray-500 mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('farms.prioritizeFarmers')}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t('farms.askLocationDetails')}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isFarmerModalOpen} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedFarmer?.displayName || t('market.certifiedFarmer')}</DialogTitle>
            <DialogDescription>{t('farms.description')}</DialogDescription>
          </DialogHeader>
          {selectedFarmer && (
            <div className="space-y-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.detail.location')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">{formatLocation(selectedFarmer)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.detail.lastInteraction')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {formatDate(selectedFarmer.metadata?.lastInteraction)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.detail.messages')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedFarmer.metadata?.totalMessages ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.detail.language')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedFarmer.preferences?.language?.toUpperCase() || t('market.detail.notProvided')}
                  </dd>
                </div>
              </dl>

              {selectedFarmer.location &&
                typeof selectedFarmer.location.lat === 'number' &&
                typeof selectedFarmer.location.lng === 'number' && (
                  <section className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{t('market.farmerMapTitle')}</p>
                    <div className="h-60 rounded-xl overflow-hidden border border-gray-100">
                      <FarmerMapPreview
                        lat={selectedFarmer.location.lat}
                        lng={selectedFarmer.location.lng}
                        label={selectedFarmer.displayName || t('market.certifiedFarmer')}
                      />
                    </div>
                  </section>
                )}

              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-100 rounded-xl space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {t('market.farmerContactTitle')}
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{contactPhone || t('market.detail.notProvided')}</span>
                    </div>
                    <p className="text-gray-700">
                      {t('market.farmerContactEmail')}: {contactEmail || t('market.detail.notProvided')}
                    </p>
                    {contactBusiness && (
                      <p className="text-gray-700">
                        {t('market.farmerBusinessName')}: {contactBusiness}
                      </p>
                    )}
                    {!hasContactDetails && (
                      <p className="text-xs text-gray-500">{t('market.farmerContactUnavailable')}</p>
                    )}
                  </div>
                </div>

                <div className="p-4 border border-gray-100 rounded-xl space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{t('market.farmerDetailsTitle')}</p>
                  <p className="text-sm text-gray-600">
                    {selectedFarmer.statusMessage || t('market.detail.notProvided')}
                  </p>
                </div>
              </section>

              <section className="space-y-4">
                <FarmerRelatedSection
                  title={t('market.farmerProductsTitle')}
                  emptyLabel={t('market.farmerProductsEmpty')}
                  isLoading={isFarmerDataLoading}
                >
                  {farmerProducts.length > 0 && (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {farmerProducts.slice(0, 5).map((product) => (
                        <li
                          key={product.id}
                          className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">
                              {product.category || 'general'} · {product.unit}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-green-600">
                              NT$ {(product.price || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">{product.stock ?? 0} {t('market.detail.units')}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </FarmerRelatedSection>

                <FarmerRelatedSection
                  title={t('market.farmerStoresTitle')}
                  emptyLabel={t('market.farmerStoresEmpty')}
                  isLoading={isFarmerDataLoading}
                >
                  {farmerStores.length > 0 && (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {farmerStores.slice(0, 5).map((store) => (
                        <li
                          key={store.id}
                          className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{store.name}</p>
                            <p className="text-xs text-gray-500">
                              {store.location || t('market.detail.notProvided')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{t('market.totalOrders')}</p>
                            <p className="text-sm font-semibold text-blue-600">
                              {(store.metadata?.totalOrders || 0).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </FarmerRelatedSection>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketFarms;
