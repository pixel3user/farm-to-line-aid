import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DatabaseService, Order } from '@/lib/database';
import { Loader2, MapPin, PackageCheck, Truck, Clock3, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import resolveApiBaseUrl from '@/lib/api';

type DeliveryView = {
  id: string;
  orderId: string;
  status: string;
  deliveryStatus?: string;
  paymentMethod?: string;
  destination?: string;
  items: string[];
  createdAt?: number;
};

const FarmerDeliverySchedule: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const deepLinkActionRef = useRef<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);

  const sellerId = (user as any)?.lineUserId || user?.id;

  useEffect(() => {
    const load = async () => {
      if (!sellerId) return;
      try {
        setIsLoading(true);
        const data = await DatabaseService.getOrdersForSeller(sellerId, 100);
        setOrders(data);
      } catch (error) {
        console.error('Failed to load delivery schedule', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [sellerId]);

  const deliveries = useMemo<DeliveryView[]>(() => {
    return orders.map((order) => {
      const relevantItems = order.items?.filter(
        (item) => !item.ownerId || item.ownerId === sellerId
      );
      const summaryItems = (relevantItems?.length ? relevantItems : order.items || []).map(
        (item) => `${item.name} x${item.quantity}`
      );
      return {
        id: order.id || order.orderId,
        orderId: order.orderId,
        status: order.status,
        deliveryStatus: order.deliveryStatus,
        paymentMethod: order.paymentMethod,
        destination: [order.shipping?.city, order.shipping?.addressLine1].filter(Boolean).join(' '),
        items: summaryItems,
        createdAt: order.createdAt?.toMillis?.(),
      };
    });
  }, [orders, sellerId]);

  const awaiting = deliveries.filter((d) => ['pending', 'reserved', 'authorized'].includes(d.status));
  const active = deliveries.filter(
    (d) => !['pending', 'reserved', 'authorized', 'cancelled', 'failed'].includes(d.status)
  );

  const summary = useMemo(() => {
    const total = deliveries.length;
    const awaitingCount = deliveries.filter((d) => ['pending', 'reserved', 'authorized'].includes(d.status)).length;
    const enroute = deliveries.filter(
      (d) => d.status === 'enroute' || d.deliveryStatus === 'enroute'
    ).length;
    const ready = deliveries.filter((d) => ['confirmed', 'paid', 'delivered'].includes(d.status)).length;
    return { total, awaiting: awaitingCount, enroute, ready };
  }, [deliveries]);

  const confirmOrder = useCallback(async (orderId: string) => {
    try {
      setConfirming(orderId);
      const apiBaseUrl = resolveApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/orders/${orderId}/confirm`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Unable to confirm order');
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId ? { ...o, status: 'confirmed', deliveryStatus: 'awaiting_pickup' } : o
        )
      );
    } catch (error) {
      console.error('Confirm order failed', error);
    } finally {
      setConfirming(null);
    }
  }, []);

  const declineOrder = useCallback(async (orderId: string) => {
    try {
      setDeclining(orderId);
      const apiBaseUrl = resolveApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/orders/${orderId}/decline`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Unable to decline order');
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId ? { ...o, status: 'cancelled', deliveryStatus: 'cancelled' } : o
        )
      );
    } catch (error) {
      console.error('Decline order failed', error);
    } finally {
      setDeclining(null);
    }
  }, []);

  useEffect(() => {
    const action = searchParams.get('action');
    const orderParam = searchParams.get('order');
    const key = action && orderParam ? `${action}:${orderParam}` : null;

    if (!action || !orderParam) {
      deepLinkActionRef.current = null;
      return;
    }

    if (deepLinkActionRef.current === key) return;
    deepLinkActionRef.current = key;

    const handleDeepLink = async () => {
      if (action === 'confirm') {
        await confirmOrder(orderParam);
      } else if (action === 'decline') {
        await declineOrder(orderParam);
      }
      setExpandedId(orderParam);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      const nextSearch = next.toString();
      navigate(nextSearch ? `${location.pathname}?${nextSearch}` : location.pathname, { replace: true });
    };

    handleDeepLink();
  }, [searchParams, confirmOrder, declineOrder, navigate, location.pathname]);

  const statusBadge = (status: string, deliveryStatus?: string) => {
    const displayStatus = deliveryStatus || status;
    switch (displayStatus) {
      case 'confirmed':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Confirmed</Badge>;
      case 'paid':
      case 'delivered':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Ready to drop</Badge>;
      case 'awaiting_pickup':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">Scheduled</Badge>;
      case 'reserved':
      case 'pending':
      case 'authorized':
        return <Badge variant="secondary">Awaiting confirmation</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelled</Badge>;
      case 'enroute':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">On the way</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-600 capitalize">{displayStatus || 'pending'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('schedule.title')}</h1>
          <p className="text-gray-600">{t('schedule.description')}</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Truck className="w-4 h-4" />
          {t('schedule.summary')}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-green-100 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">{t('schedule.totalOrders')}</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-100 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">{t('schedule.awaiting')}</p>
            <p className="text-2xl font-bold text-amber-600">{summary.awaiting}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-100 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">{t('schedule.enroute')}</p>
            <p className="text-2xl font-bold text-blue-600">{summary.enroute}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">{t('schedule.paid')}</p>
            <p className="text-2xl font-bold text-emerald-600">{summary.ready}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('schedule.awaitingHeader')}</CardTitle>
          <CardDescription>{t('schedule.awaitingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('schedule.refresh')}
            </div>
          ) : awaiting.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              {t('schedule.noEntries')}
            </div>
          ) : (
            awaiting.map((delivery) => (
              <div
                key={delivery.id}
                className="border rounded-lg p-4 space-y-2 transition-all duration-200 hover:border-green-200 hover:shadow-sm cursor-pointer"
                onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <PackageCheck className="w-5 h-5 text-green-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">#{delivery.orderId}</p>
                      <p className="text-sm text-gray-600">{delivery.items.join(' • ')}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span>{delivery.destination || t('checkout.addresses.defaultLabel')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 md:w-80 md:justify-end w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      {statusBadge(delivery.status, delivery.deliveryStatus)}
                      {delivery.paymentMethod && (
                        <Badge variant="outline" className="text-xs uppercase">{delivery.paymentMethod}</Badge>
                      )}
                    </div>
                    {['pending', 'reserved', 'authorized'].includes(delivery.status) && (
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); confirmOrder(delivery.orderId); }} disabled={confirming === delivery.orderId}>
                          {confirming === delivery.orderId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                          {t('schedule.confirmButton')}
                        </Button>
                        <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); declineOrder(delivery.orderId); }} disabled={declining === delivery.orderId}>
                          {declining === delivery.orderId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          {t('schedule.declineButton')}
                        </Button>
                      </div>
                    )}
                    <Button size="sm" variant="ghost" className="w-full sm:w-auto">
                      {expandedId === delivery.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {expandedId === delivery.id && (
                  <div className="border-t pt-3 space-y-2 text-sm text-gray-700">
                    <p className="font-semibold">{t('schedule.nextContact')}: {delivery.destination || t('checkout.addresses.defaultLabel')}</p>
                    <p className="text-xs text-gray-600">{delivery.items.join(' • ')}</p>
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-green-600" />
                      <a href="/farmer/delivery" className="text-green-700 underline">
                        {t('schedule.route')}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('schedule.schedule')}</CardTitle>
          <CardDescription>{t('schedule.scheduleDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('schedule.refresh')}
            </div>
          ) : active.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              {t('schedule.noEntries')}
            </div>
          ) : (
            active.map((delivery) => (
              <div
                key={delivery.id}
                className="border rounded-lg p-4 space-y-2 transition-all duration-200 hover:border-green-200 hover:shadow-sm cursor-pointer"
                onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <PackageCheck className="w-5 h-5 text-green-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">#{delivery.orderId}</p>
                      <p className="text-sm text-gray-600">{delivery.items.join(' • ')}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span>{delivery.destination || t('checkout.addresses.defaultLabel')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 md:w-80 md:justify-end w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      {statusBadge(delivery.status, delivery.deliveryStatus)}
                      {delivery.paymentMethod && (
                        <Badge variant="outline" className="text-xs uppercase">{delivery.paymentMethod}</Badge>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="w-full sm:w-auto">
                      {expandedId === delivery.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {expandedId === delivery.id && (
                  <div className="border-t pt-3 space-y-2 text-sm text-gray-700">
                    <p className="font-semibold">{t('schedule.nextContact')}: {delivery.destination || t('checkout.addresses.defaultLabel')}</p>
                    <p className="text-xs text-gray-600">{delivery.items.join(' • ')}</p>
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-green-600" />
                      <a href="/farmer/delivery" className="text-green-700 underline">
                        {t('schedule.route')}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmerDeliverySchedule;
