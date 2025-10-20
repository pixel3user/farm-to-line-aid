import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatabaseService, Store } from '@/lib/database';
import { Calendar, MapPin, RefreshCw, Truck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ScheduleEntry {
  id: string;
  storeName: string;
  status: Store['status'];
  location: string;
  nextContact: Date;
  lastOrder?: Date;
  totalOrders: number;
}

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const MarketSchedule: React.FC = () => {
  const { t } = useLanguage();
  const [stores, setStores] = useState<Store[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | Store['status']>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const storeItems = await DatabaseService.getAllStores(50);
        setStores(storeItems);
      } catch (error) {
        console.error('Failed to load store schedules:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const entries = useMemo<ScheduleEntry[]>(() => {
    return stores.map((store) => {
      const lastOrder = store.metadata?.lastOrder?.toDate();
      const firstContact = store.metadata?.firstContact?.toDate();
      const base = lastOrder || firstContact || new Date();
      const nextContact = addDays(base, 14);

      return {
        id: store.id,
        storeName: store.name,
        status: store.status,
        location: store.location,
        nextContact,
        lastOrder,
        totalOrders: store.metadata?.totalOrders || 0
      };
    });
  }, [stores]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => statusFilter === 'all' || entry.status === statusFilter)
      .sort((a, b) => a.nextContact.getTime() - b.nextContact.getTime());
  }, [entries, statusFilter]);

  const upcomingCount = filteredEntries.filter((entry) => entry.nextContact > new Date()).length;
  const overdueCount = filteredEntries.length - upcomingCount;
  const totalStores = stores.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('schedule.title')}</h1>
          <p className="text-gray-600">{t('schedule.description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" /> {t('schedule.refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('schedule.summary')}</CardTitle>
          <CardDescription>{t('schedule.summaryDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('schedule.totalStores')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalStores}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('schedule.upcoming')}</p>
              <p className="text-2xl font-bold text-green-600">{upcomingCount}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('schedule.overdue')}</p>
              <p className="text-2xl font-bold text-red-600">{Math.max(overdueCount, 0)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">{t('schedule.totalOrders')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {stores.reduce((sum, store) => sum + (store.metadata?.totalOrders || 0), 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('schedule.schedule')}</CardTitle>
          <CardDescription>
            {t('schedule.scheduleDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue placeholder={t('schedule.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('schedule.allStatuses')}</SelectItem>
                <SelectItem value="potential">{t('schedule.potential')}</SelectItem>
                <SelectItem value="contacted">{t('schedule.contacted')}</SelectItem>
                <SelectItem value="customer">{t('schedule.customer')}</SelectItem>
                <SelectItem value="former_customer">{t('schedule.formerCustomer')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {t('schedule.showingEntries').replace('{count}', filteredEntries.length.toString())}
            </p>
          </div>

          <div className="space-y-3">
            {filteredEntries.length === 0 ? (
              <p className="text-sm text-gray-500">{t('schedule.noEntries')}</p>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.storeName}</p>
                      <p className="text-xs text-gray-500">
                        {t('schedule.nextContact')}: {entry.nextContact.toLocaleDateString()} — {t('schedule.lastOrder')}:{' '}
                        {entry.lastOrder ? entry.lastOrder.toLocaleDateString() : 'n/a'}
                      </p>
                      <p className="text-xs text-gray-500">{entry.location || t('schedule.noLocation')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:w-64 md:justify-end">
                    <Badge variant="secondary" className="capitalize">
                      {entry.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline">{t('schedule.orders')}: {entry.totalOrders}</Badge>
                    <Button size="sm" variant="outline">
                      <MapPin className="w-4 h-4 mr-2" /> {t('schedule.route')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('schedule.logistics')}</CardTitle>
          <CardDescription>{t('schedule.logisticsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {t('schedule.confirmDelivery')}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {t('schedule.requestGeolocation')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketSchedule;
