import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DatabaseService, Order } from '@/lib/database';
import { Loader2, PackageCheck, Truck, MapPin, CreditCard, Clock3, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import resolveApiBaseUrl from '@/lib/api';

const MarketSchedule: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const buyerId = (user as any)?.lineUserId || user?.id;
  const awaiting = orders.filter((o) => o.status === 'pending' || o.status === 'reserved');
  const active = orders.filter((o) => o.status !== 'pending' && o.status !== 'reserved' && o.status !== 'cancelled');

  useEffect(() => {
    const load = async () => {
      if (!buyerId) return;
      try {
        setIsLoading(true);
        const data = await DatabaseService.getOrdersForBuyer(buyerId, 100);
        setOrders(data);
      } catch (error) {
        console.error('Failed to load buyer orders', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [buyerId]);

  const confirmOrder = async (orderId: string) => {
    try {
      setConfirming(orderId);
      const apiBaseUrl = resolveApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/orders/${orderId}/confirm`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Unable to confirm order');
      setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status: 'confirmed' } : o)));
    } catch (error) {
      console.error('Confirm order failed', error);
    } finally {
      setConfirming(null);
    }
  };

  const declineOrder = async (orderId: string) => {
    try {
      setDeclining(orderId);
      const apiBaseUrl = resolveApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/orders/${orderId}/decline`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Unable to decline order');
      setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status: 'cancelled' } : o)));
    } catch (error) {
      console.error('Decline order failed', error);
    } finally {
      setDeclining(null);
    }
  };

  const summary = useMemo(() => {
    const total = orders.length;
    const awaiting = orders.filter((o) => o.status === 'pending' || o.status === 'reserved').length;
    const paid = orders.filter((o) => o.status === 'paid').length;
    const cod = orders.filter((o) => o.paymentMethod === 'cod').length;
    return { total, awaiting, paid, cod };
  }, [orders]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Paid</Badge>;
      case 'reserved':
      case 'pending':
        return <Badge variant="secondary">Booked</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{status || 'pending'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('schedule.title')}</h1>
          <p className="text-gray-600">{t('schedule.description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/market/products')}>
          {t('cart.continueShopping')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-green-100 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">{t('schedule.totalOrders')}</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">{t('schedule.awaiting')}</p>
            <p className="text-2xl font-bold text-amber-600">{summary.awaiting}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">{t('schedule.paid')}</p>
            <p className="text-2xl font-bold text-emerald-600">{summary.paid}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-100 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">{t('schedule.cod')}</p>
            <p className="text-2xl font-bold text-blue-600">{summary.cod}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('schedule.awaiting')}</CardTitle>
          <CardDescription>{t('schedule.confirmDelivery')}</CardDescription>
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
            awaiting.map((order) => {
              const expanded = expandedId === (order.id || order.orderId);
              return (
                <div
                  key={order.id || order.orderId}
                  className="border rounded-lg p-4 space-y-2 transition-all duration-200 hover:border-blue-200 hover:shadow-sm cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : (order.id || order.orderId))}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <PackageCheck className="w-5 h-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{t('schedule.orders')}: #{order.orderId}</p>
                        <p className="text-sm text-gray-600">{order.items?.map((item) => `${item.name} x${item.quantity}`).join(' • ')}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{[order.shipping?.city, order.shipping?.addressLine1].filter(Boolean).join(' ') || t('checkout.addresses.defaultLabel')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:w-80 md:justify-end">
                      {statusBadge(order.status)}
                      {order.paymentMethod && (
                        <Badge variant="outline" className="text-xs uppercase flex items-center gap-1">
                          {order.paymentMethod === 'cod' ? <Truck className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          {order.paymentMethod}
                        </Badge>
                      )}
                      {(order.status === 'pending' || order.status === 'reserved') && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); confirmOrder(order.orderId); }} disabled={confirming === order.orderId}>
                            {confirming === order.orderId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            {t('schedule.confirmButton')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); declineOrder(order.orderId); }} disabled={declining === order.orderId}>
                            {declining === order.orderId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {t('schedule.declineButton')}
                          </Button>
                        </div>
                      )}
                      <Button size="sm" variant="ghost">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="border-t pt-3 space-y-2 text-sm text-gray-700">
                      <p className="font-semibold">{t('schedule.nextContact')}: {order.shipping?.city || t('checkout.addresses.defaultLabel')}</p>
                      <p className="text-xs text-gray-600">{order.items?.map((item) => `${item.name} x${item.quantity}`).join(' • ')}</p>
                      <div className="flex items-center gap-2">
                        <Clock3 className="w-4 h-4 text-blue-600" />
                        <a href="/market/schedule" className="text-blue-700 underline">
                          {t('schedule.route')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
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
            active.map((order) => {
              const expanded = expandedId === (order.id || order.orderId);
              return (
                <div
                  key={order.id || order.orderId}
                  className="border rounded-lg p-4 space-y-2 transition-all duration-200 hover:border-blue-200 hover:shadow-sm cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : (order.id || order.orderId))}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <PackageCheck className="w-5 h-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{t('schedule.orders')}: #{order.orderId}</p>
                        <p className="text-sm text-gray-600">{order.items?.map((item) => `${item.name} x${item.quantity}`).join(' • ')}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{[order.shipping?.city, order.shipping?.addressLine1].filter(Boolean).join(' ') || t('checkout.addresses.defaultLabel')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:w-80 md:justify-end">
                      {statusBadge(order.status)}
                      {order.paymentMethod && (
                        <Badge variant="outline" className="text-xs uppercase flex items-center gap-1">
                          {order.paymentMethod === 'cod' ? <Truck className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          {order.paymentMethod}
                        </Badge>
                      )}
                      <Button size="sm" variant="ghost">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="border-t pt-3 space-y-2 text-sm text-gray-700">
                      <p className="font-semibold">{t('schedule.nextContact')}: {order.shipping?.city || t('checkout.addresses.defaultLabel')}</p>
                      <p className="text-xs text-gray-600">{order.items?.map((item) => `${item.name} x${item.quantity}`).join(' • ')}</p>
                      <div className="flex items-center gap-2">
                        <Clock3 className="w-4 h-4 text-blue-600" />
                        <a href="/market/schedule" className="text-blue-700 underline">
                          {t('schedule.route')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketSchedule;
