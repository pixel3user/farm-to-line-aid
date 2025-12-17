import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { resolveApiBaseUrl } from '@/lib/api';
import { CheckCircle2, Loader2, AlertTriangle, XCircle, ShoppingBag } from 'lucide-react';

type OrderItem = {
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  imageUrl?: string;
};

type OrderRecord = {
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  items: OrderItem[];
  buyer?: {
    userId?: string;
    displayName?: string;
    email?: string;
  };
  shipping?: {
    fullName?: string;
    phone?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
    instructions?: string;
  };
  linePay?: {
    transactionId?: string;
    paymentUrl?: {
      web?: string;
      app?: string;
    };
    confirmedAt?: string;
  };
};

const LinePayResult: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [status, setStatus] = useState<'initial' | 'confirming' | 'paid' | 'cancelled' | 'failed'>('initial');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const orderId = searchParams.get('orderId') || '';
  const transactionId = searchParams.get('transactionId');
  const returnCode = searchParams.get('returnCode');
  const flowStatus = searchParams.get('status');

  const hasTransaction = Boolean(transactionId);

  const fetchOrder = useCallback(async (id: string) => {
    try {
      const apiBaseUrl = resolveApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/payments/line-pay/orders/${id}`);
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      if (payload?.order) {
        setOrder(payload.order);
      }
    } catch (err) {
      console.warn('Failed to fetch order snapshot', err);
    }
  }, []);

  const confirmPayment = useCallback(
    async (id: string, txnId: string) => {
      setStatus('confirming');
      setError(null);
      setIsLoading(true);
      try {
        const apiBaseUrl = resolveApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/payments/line-pay/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: id, transactionId: txnId }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'LINE Pay confirmation failed.');
        }
        if (!payload?.order) {
          throw new Error('Payment confirmed but order details were not returned.');
        }
        setOrder(payload.order);
        setStatus('paid');
        toast({ title: 'Payment confirmed', description: 'Thank you! Your order is now complete.' });
        try {
          localStorage.removeItem('f2m_cart');
        } catch {}
      } catch (err: any) {
        console.error('Line Pay confirm failed', err);
        setError(err?.message || 'Unable to confirm payment. Please contact support if you were charged.');
        setStatus('failed');
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!orderId) {
      setError('Missing order reference. Please return to your cart and try again.');
      setStatus('failed');
      setIsLoading(false);
      return;
    }

    if (hasTransaction) {
      confirmPayment(orderId, transactionId as string);
    } else {
      // No transactionId typically means the shopper cancelled before authorizing
      setStatus(flowStatus === 'cancelled' ? 'cancelled' : 'failed');
      setIsLoading(false);
      fetchOrder(orderId);
    }
  }, [confirmPayment, fetchOrder, flowStatus, hasTransaction, orderId, transactionId]);

  const statusDetails = useMemo(() => {
    switch (status) {
      case 'confirming':
        return {
          title: 'Verifying payment with LINE Pay…',
          description: 'Please wait while we confirm your transaction.',
          icon: <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />,
          tone: 'info',
        };
      case 'paid':
        return {
          title: 'Payment successful!',
          description: 'We have received your payment. Review the summary below.',
          icon: <CheckCircle2 className="h-10 w-10 text-green-600" />,
          tone: 'success',
        };
      case 'cancelled':
        return {
          title: 'Payment cancelled',
          description: 'You exited LINE Pay before completing the payment. Your cart is still available.',
          icon: <XCircle className="h-10 w-10 text-gray-500" />,
          tone: 'muted',
        };
      case 'failed':
        return {
          title: 'Unable to confirm payment',
          description: error || 'We could not verify this transaction. If you were charged, contact support with your order ID.',
          icon: <AlertTriangle className="h-10 w-10 text-red-600" />,
          tone: 'destructive',
        };
      default:
        return {
          title: 'Checking payment state…',
          description: 'Please wait while we synchronize with LINE Pay.',
          icon: <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />,
          tone: 'info',
        };
    }
  }, [error, status]);

  const formattedTotal = useMemo(() => {
    if (!order) return '';
    return `${order.currency || 'TWD'} ${order.amount?.toLocaleString?.() ?? order.amount}`;
  }, [order]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col items-center text-center space-y-4">
          {statusDetails.icon}
          <div>
            <CardTitle className="text-2xl font-bold mb-1">{statusDetails.title}</CardTitle>
            <p className="text-sm text-gray-600">{statusDetails.description}</p>
            {returnCode && (
              <p className="text-xs text-gray-400 mt-2">LINE Pay code: {returnCode}</p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-xs uppercase text-gray-500">Order ID</p>
              <p className="text-sm font-semibold break-all">{orderId || '—'}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-xs uppercase text-gray-500">Transaction ID</p>
              <p className="text-sm font-semibold break-all">{transactionId || order?.linePay?.transactionId || 'Pending'}</p>
            </div>
          </div>

          {order && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Buyer</p>
                  <p className="font-medium">{order.buyer?.displayName || 'Marketplace Buyer'}</p>
                </div>
                <Badge variant="outline">{order.status?.toUpperCase()}</Badge>
              </div>

              {order.shipping && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs uppercase text-gray-500 mb-1">Deliver To</p>
                    <p className="font-medium">{order.shipping.fullName}</p>
                    <p className="text-sm text-gray-600">{order.shipping.addressLine1}</p>
                    {order.shipping.addressLine2 && (
                      <p className="text-sm text-gray-600">{order.shipping.addressLine2}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      {order.shipping.city} {order.shipping.postalCode}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs uppercase text-gray-500 mb-1">Contact</p>
                    <p className="text-sm text-gray-700">{order.shipping.phone}</p>
                    {order.shipping.email && (
                      <p className="text-sm text-gray-600">{order.shipping.email}</p>
                    )}
                    {order.shipping.instructions && (
                      <p className="text-xs text-gray-500 mt-2">
                        Note: {order.shipping.instructions}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="border rounded-lg divide-y">
                {order.items.map((item, idx) => (
                  <div key={`${item.productId || idx}-${idx}`} className="flex items-center gap-4 p-4">
                    <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} × NT$ {item.price.toLocaleString()} {item.unit ? `(${item.unit})` : ''}
                      </p>
                    </div>
                    <div className="font-semibold text-sm">
                      NT$ {(item.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4 bg-gray-50">
                  <p className="text-sm font-medium text-gray-700">Total</p>
                  <p className="text-lg font-bold text-green-700">{formattedTotal}</p>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !order && (
            <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-600">
              We could not find a matching order record. If you just completed payment, please refresh this page in a few seconds or contact support.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="flex-1" onClick={() => navigate('/market/products')}>
              Continue Shopping
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => {
                if (status === 'paid') {
                  navigate('/market');
                } else {
                  navigate('/market/products?view=cart');
                }
              }}
            >
              {status === 'paid' ? 'Go to Dashboard' : 'Back to Cart'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LinePayResult;

