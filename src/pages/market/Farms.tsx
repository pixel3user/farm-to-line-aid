import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatabaseService, LineUser } from '@/lib/database';
import { MapPin, MessageSquare, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const MarketFarms: React.FC = () => {
  const { t } = useLanguage();
  const [farmers, setFarmers] = useState<LineUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const items = await DatabaseService.getFarmers(50);
        setFarmers(items);
      } catch (error) {
        console.error('Failed to load farmers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const filteredFarmers = useMemo(() => {
    return farmers.filter((farmer) =>
      farmer.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [farmers, searchTerm]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
            {t('farms.showingRecords').replace('{filtered}', filteredFarmers.length.toString()).replace('{total}', farmers.length.toString())}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredFarmers.length === 0 ? (
            <p className="text-sm text-gray-500">{t('farms.noResults')}</p>
          ) : (
            filteredFarmers.map((farmer) => (
              <div key={farmer.id} className="border rounded-lg p-4">
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
                  </div>
                </div>
              </div>
            ))
          )}
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
    </div>
  );
};

export default MarketFarms;
