import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatabaseService, Store } from '@/lib/database';
import { CheckCircle, MessageCircle, Star, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StoreFeedback {
  id: string;
  name: string;
  status: Store['status'];
  totalOrders: number;
  totalRevenue: number;
  notes: string[];
}

const MarketRatings: React.FC = () => {
  const { t } = useLanguage();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const storeItems = await DatabaseService.getAllStores(50);
        setStores(storeItems);
      } catch (error) {
        console.error('Failed to load store feedback data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const entries = useMemo<StoreFeedback[]>(() => {
    return stores.map((store) => ({
      id: store.id,
      name: store.name,
      status: store.status,
      totalOrders: store.metadata?.totalOrders || 0,
      totalRevenue: store.metadata?.totalRevenue || 0,
      notes: store.metadata?.notes || []
    }));
  }, [stores]);

  const averageOrders = entries.length
    ? (entries.reduce((sum, entry) => sum + entry.totalOrders, 0) / entries.length).toFixed(1)
    : '0';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-24 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('ratings.title')}</h1>
          <p className="text-gray-600">{t('ratings.description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          {t('ratings.refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('ratings.summary')}</CardTitle>
          <CardDescription>{t('ratings.summaryDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('ratings.storesMonitored')}</p>
              <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('ratings.averageOrders')}</p>
              <p className="text-2xl font-bold text-gray-900">{averageOrders}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('ratings.totalOrders')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {entries.reduce((sum, entry) => sum + entry.totalOrders, 0)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('ratings.totalRevenue')}</p>
              <p className="text-2xl font-bold text-gray-900">
                NT$ {entries.reduce((sum, entry) => sum + entry.totalRevenue, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ratings.storePerformance')}</CardTitle>
          <CardDescription>{t('ratings.storePerformanceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500">{t('ratings.noData')}</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{entry.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{t('ratings.status')}: {entry.status.replace('_', ' ')}</p>
                  {entry.notes.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      {entry.notes.slice(0, 2).map((note, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <MessageCircle className="w-3 h-3 mt-0.5" />
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 md:w-64 md:justify-end">
                  <Badge variant="outline">{t('ratings.orders')}: {entry.totalOrders}</Badge>
                  <Badge variant="secondary">
                    {t('ratings.revenue')}: NT$ {entry.totalRevenue.toLocaleString()}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ratings.actionItems')}</CardTitle>
          <CardDescription>{t('ratings.actionItemsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            {t('ratings.congratulateTopStores')}
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            {t('ratings.reengageLowStores')}
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            {t('ratings.captureFeedback')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketRatings;
