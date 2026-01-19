import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatabaseService, Order } from '@/lib/database';
import { CheckCircle, Star, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface StoreFeedback {
  id: string;
  name: string;
  totalOrders: number;
  totalRevenue: number;
  statusCounts: Record<Order['status'], number>;
}

const MarketRatings: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const buyerId = (user as any)?.lineUserId || user?.id;
  const { data: orders = [], isFetching } = useQuery<Order[]>({
    queryKey: ['market-orders', buyerId],
    queryFn: () => (buyerId ? DatabaseService.getOrdersForBuyer(buyerId, 200) : Promise.resolve([])),
    staleTime: Infinity,
    cacheTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    enabled: Boolean(buyerId),
    initialData: () => queryClient.getQueryData(['market-orders', buyerId]) as Order[] | undefined,
  });
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const hasOrders = orders.length > 0;
  const isLoading = !hasOrders && isFetching;
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStatus, setDetailStatus] = useState<Order['status'] | null>(null);
  const [detailSellerId, setDetailSellerId] = useState<string | null>(null);
  const statusCounts = useMemo<Record<Order['status'], number>>(() => {
    const counts: Record<Order['status'], number> = {
      pending: 0,
      reserved: 0,
      authorized: 0,
      confirmed: 0,
      paid: 0,
      cancelled: 0,
      failed: 0,
    };
    orders.forEach((order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const openDetails = (status: Order['status'], sellerId?: string) => {
    setDetailStatus(status);
    setDetailSellerId(sellerId || null);
    setDetailOpen(true);
  };

  useEffect(() => {
    let cancelled = false;
    const loadSellers = async () => {
      const sellerIds = Array.from(
        new Set(
          orders.flatMap((order) => order.sellerIds || [])
        )
      ).filter(Boolean);
      const missing = sellerIds.filter((id) => !sellerNames[id]);
      if (!missing.length) return;

      try {
        const pairs = await Promise.all(
          missing.map(async (sellerId) => {
            const profile = await DatabaseService.getLineUser(sellerId);
            const name =
              profile?.displayName ||
              profile?.lineId ||
              profile?.lineUserId ||
              sellerId;
            return [sellerId, name] as const;
          })
        );
        if (!cancelled) {
          setSellerNames((prev) => {
            const next = { ...prev };
            pairs.forEach(([id, name]) => {
              next[id] = name;
            });
            return next;
          });
        }
      } catch (error) {
        console.error('Failed to load seller profiles', error);
      }
    };

    if (orders.length) {
      loadSellers();
    }

    return () => {
      cancelled = true;
    };
  }, [orders, sellerNames]);

  const entries = useMemo<StoreFeedback[]>(() => {
    const revenueStatuses = new Set(['confirmed', 'paid']);
    const stats = new Map<string, { orderIds: Set<string>; totalRevenue: number }>();

    orders.forEach((order, index) => {
      const orderKey = order.orderId || order.id || `order-${index}`;
      const items = Array.isArray(order.items) ? order.items : [];
      const sellerTotals = new Map<string, number>();

      items.forEach((item) => {
        const ownerId = item.ownerId;
        if (!ownerId) return;
        const amount = (item.price || 0) * (item.quantity || 0);
        if (!amount) return;
        sellerTotals.set(ownerId, (sellerTotals.get(ownerId) || 0) + amount);
      });

      if (sellerTotals.size === 0 && order.sellerIds?.length === 1) {
        const onlySeller = order.sellerIds[0];
        if (onlySeller) {
          sellerTotals.set(onlySeller, order.amount || 0);
        }
      }

      sellerTotals.forEach((amount, sellerId) => {
        if (!sellerId) return;
        const entry = stats.get(sellerId) || {
          orderIds: new Set<string>(),
          totalRevenue: 0,
          statusCounts: {
            pending: 0,
            reserved: 0,
            authorized: 0,
            confirmed: 0,
            paid: 0,
            cancelled: 0,
            failed: 0,
          },
        };
        entry.statusCounts[order.status] = (entry.statusCounts[order.status] || 0) + 1;
        if (revenueStatuses.has(order.status)) {
          entry.orderIds.add(orderKey);
          entry.totalRevenue += amount;
        }
        stats.set(sellerId, entry);
      });
    });

    return Array.from(stats.entries()).map(([sellerId, data]) => ({
      id: sellerId,
      name: sellerNames[sellerId] || sellerId,
      totalOrders: data.orderIds.size,
      totalRevenue: data.totalRevenue,
      statusCounts: data.statusCounts,
    }));
  }, [orders, sellerNames]);

  const detailOrders = useMemo(() => {
    if (!detailStatus) return [];
    return orders.filter((order) => {
      if (order.status !== detailStatus) return false;
      if (!detailSellerId) return true;
      const sellerIds = order.sellerIds || [];
      const hasSeller = sellerIds.includes(detailSellerId);
      if (!hasSeller) return false;
      return true;
    });
  }, [detailStatus, detailSellerId, orders]);

  const detailSellerName = detailSellerId ? (sellerNames[detailSellerId] || detailSellerId) : 'All sellers';

  const ClickableBadge = ({
    label,
    onClick,
    variant = 'outline',
  }: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(badgeVariants({ variant }), 'cursor-pointer')}
    >
      {label}
    </button>
  );

  const statusLabels: Record<Order['status'], string> = {
    pending: t('ratings.status.pending'),
    reserved: t('ratings.status.reserved'),
    authorized: t('ratings.status.authorized'),
    confirmed: t('ratings.status.confirmed'),
    paid: t('ratings.status.paid'),
    cancelled: t('ratings.status.cancelled'),
    failed: t('ratings.status.failed'),
  };

  const StatusCard = ({
    status,
    count,
  }: {
    status: Order['status'];
    count: number;
  }) => (
    <button
      type="button"
      onClick={() => openDetails(status)}
      className="border rounded-lg p-4 text-left hover:border-blue-200 hover:shadow-sm transition-colors"
    >
      <p className="text-sm text-gray-600">{statusLabels[status]}</p>
      <p className="text-2xl font-bold text-gray-900">{count}</p>
    </button>
  );

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
          <CardTitle>{t('ratings.status.title')}</CardTitle>
          <CardDescription>{t('ratings.status.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusCard status="confirmed" count={statusCounts.confirmed} />
            <StatusCard status="paid" count={statusCounts.paid} />
            <StatusCard status="pending" count={statusCounts.pending} />
            <StatusCard status="reserved" count={statusCounts.reserved} />
            <StatusCard status="authorized" count={statusCounts.authorized} />
            <StatusCard status="cancelled" count={statusCounts.cancelled} />
            <StatusCard status="failed" count={statusCounts.failed} />
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
                </div>
                <div className="flex flex-wrap items-center gap-3 md:w-80 md:justify-end">
                  <Badge variant="outline">{t('ratings.orders')}: {entry.totalOrders}</Badge>
                  <Badge variant="secondary">
                    {t('ratings.revenue')}: NT$ {entry.totalRevenue.toLocaleString()}
                  </Badge>
                  <ClickableBadge
                    label={`${statusLabels.confirmed}: ${entry.statusCounts.confirmed}`}
                    onClick={() => openDetails('confirmed', entry.id)}
                  />
                  <ClickableBadge
                    label={`${statusLabels.paid}: ${entry.statusCounts.paid}`}
                    onClick={() => openDetails('paid', entry.id)}
                  />
                  <ClickableBadge
                    label={`${statusLabels.cancelled}: ${entry.statusCounts.cancelled}`}
                    onClick={() => openDetails('cancelled', entry.id)}
                  />
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('ratings.details.title')}</DialogTitle>
            <DialogDescription>
              {detailStatus
                ? t('ratings.details.subtitle', {
                    status: statusLabels[detailStatus],
                    seller: detailSellerName,
                  })
                : t('ratings.details.fallback')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {detailOrders.length === 0 ? (
              <p className="text-sm text-gray-500">{t('ratings.details.empty')}</p>
            ) : (
              detailOrders.map((order, index) => {
                const orderKey = order.orderId || order.id || `order-${index}`;
                const items = Array.isArray(order.items) ? order.items : [];
                const filteredItems = detailSellerId
                  ? items.filter((item) => item.ownerId === detailSellerId)
                  : items;
                const orderTotal = filteredItems.reduce(
                  (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
                  0
                );
                return (
                  <div key={orderKey} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900">#{order.orderId}</p>
                      <Badge variant="outline">{statusLabels[order.status]}</Badge>
                    </div>
                    {filteredItems.length === 0 ? (
                      <p className="text-sm text-gray-500">{t('ratings.details.emptyProducts')}</p>
                    ) : (
                      <div className="space-y-2 text-sm text-gray-700">
                        {filteredItems.map((item, itemIndex) => (
                          <div key={`${orderKey}-${itemIndex}`} className="flex items-center justify-between">
                            <span>{item.name} x{item.quantity}</span>
                            <span>NT$ {(item.price || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-sm text-gray-600">
                      {t('ratings.details.total')}: NT$ {orderTotal.toLocaleString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketRatings;
