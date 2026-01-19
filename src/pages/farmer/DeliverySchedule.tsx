import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import { DatabaseService, Order, YamatoShipment } from '@/lib/database';
import { Loader2, MapPin, PackageCheck, Truck, Clock3, Check, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import resolveApiBaseUrl from '@/lib/api';
import { cn } from '@/lib/utils';

type DeliveryView = {
  id: string;
  orderId: string;
  status: string;
  deliveryStatus?: string;
  paymentMethod?: string;
  destination?: string;
  items: string[];
  createdAt?: number;
  order: Order;
};

type PickupForm = {
  customerName: string;
  contactName: string;
  contactTel: string;
  contactMobile: string;
  normalQuantity: string;
  coldQuantity: string;
  freezeQuantity: string;
};

type PickupMethod = 'courier' | 'dropoff';

type LabelInfo = {
  fileNo: string;
  obtNumbers: string[];
  printDateTime?: string;
};

const normalizeTaiwanPhoneDigits = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('886')) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith('9') && digits.length === 9) {
    return `0${digits}`;
  }
  return digits;
};

const normalizeTaiwanTelInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  let normalized = trimmed.replace(/[\s()]/g, '');
  if (normalized.startsWith('+886')) {
    normalized = `0${normalized.slice(4)}`;
  } else if (normalized.startsWith('886')) {
    normalized = `0${normalized.slice(3)}`;
  }
  normalized = normalized.replace(/[^0-9-]/g, '');
  if (!normalized.includes('-')) return normalized;
  const [area, ...rest] = normalized.split('-');
  return `${area}-${rest.join('')}`;
};

const formatTaiwanMobileInput = (value: string) => {
  const normalized = normalizeTaiwanPhoneDigits(value);
  if (!normalized) return '';
  if (!normalized.startsWith('09')) return normalized;
  const digits = normalized.slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
};

const parseHolidayList = (value: string | undefined) => {
  if (!value) return new Set<string>();
  const normalized = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const digits = entry.replace(/[^0-9]/g, '');
      if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      }
      return entry;
    })
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry));
  return new Set(normalized);
};

const YAMATO_HOLIDAYS = parseHolidayList(import.meta.env.VITE_YAMATO_HOLIDAYS as string | undefined);

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }
  return parsed;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isYamatoBlackoutDate = (date: Date) =>
  date.getDay() === 0 || YAMATO_HOLIDAYS.has(formatDateInput(date));

const findNextValidDate = (start: Date, maxLookahead = 14) => {
  let candidate = startOfDay(start);
  for (let i = 0; i <= maxLookahead; i += 1) {
    if (!isYamatoBlackoutDate(candidate)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return startOfDay(start);
};

const findNextValidDeliveryDate = (pickup: Date) => {
  let candidate = addDays(startOfDay(pickup), 1);
  for (let i = 0; i < 7; i += 1) {
    if (!isYamatoBlackoutDate(candidate)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return addDays(startOfDay(pickup), 1);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const toYamatoDate = (value: string) => value.replace(/-/g, '');

const decodeJwtPayload = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
};

const isJwtExpired = (token: string, leewayMs = 30_000) => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now() + leewayMs;
};

const FarmerDeliverySchedule: React.FC = () => {
  const { user, firebaseUser, liffUser, lineIdToken, isInLineApp, isLiffReady, setLineIdToken } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const deepLinkActionRef = useRef<string | null>(null);
  const labelDownloadRef = useRef<string | null>(null);
  const labelDialogRef = useRef<string | null>(null);
  const stepsPanelRef = useRef<HTMLDivElement | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [logisticsActions, setLogisticsActions] = useState<Record<string, { printing?: boolean; pickup?: boolean; status?: boolean; downloading?: boolean }>>({});
  const [pickupForms, setPickupForms] = useState<Record<string, PickupForm>>({});
  const [pickupMethods, setPickupMethods] = useState<Record<string, PickupMethod>>({});
  const [pickupMapUrl, setPickupMapUrl] = useState('');
  const [pickupDropoffEnabled, setPickupDropoffEnabled] = useState(false);
  const [pickupSelections, setPickupSelections] = useState<Record<string, {
    officeNo?: string;
    officeName?: string;
    officeAddress?: string;
    postCode?: string;
    status?: string;
    message?: string;
  }>>({});
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelDialogOrder, setLabelDialogOrder] = useState<Order | null>(null);
  const [labelPickupDate, setLabelPickupDate] = useState('');
  const [labelDeliveryDate, setLabelDeliveryDate] = useState('');
  const [labelDialogError, setLabelDialogError] = useState('');
  const [labelDialogStep, setLabelDialogStep] = useState<1 | 2>(1);
  const [labelDialogFileNo, setLabelDialogFileNo] = useState('');
  const [labelDialogObtNumbers, setLabelDialogObtNumbers] = useState<string[]>([]);
  const [labelDialogPrintedAt, setLabelDialogPrintedAt] = useState('');
  const [labelDialogExisting, setLabelDialogExisting] = useState(false);
  const { toast } = useToast();

  const sellerId = (user as any)?.lineUserId || user?.id;
  const sellerName = user?.displayName || t('schedule.sellerFallback');

  const getSellerShipments = (order: Order) => {
    const shipments = order.logistics?.shipments || [];
    return shipments.filter((shipment) => !shipment.sellerId || shipment.sellerId === sellerId);
  };

  const getLatestSellerShipment = (order: Order) => {
    const shipments = getSellerShipments(order);
    return shipments.length ? shipments[shipments.length - 1] : null;
  };

  const buildLabelInfoFromShipment = (shipment?: YamatoShipment | null): LabelInfo | null => {
    if (!shipment) return null;
    const fileNo = shipment.fileNo || '';
    const obtNumbers = (shipment.orders || [])
      .map((entry) => entry?.obtNumber)
      .filter(Boolean) as string[];
    const printDateTime = shipment.printDateTime || '';
    if (!fileNo && obtNumbers.length === 0) return null;
    return { fileNo, obtNumbers, printDateTime };
  };

  const buildLabelInfoFromPrintData = (data: any): LabelInfo | null => {
    if (!data || typeof data !== 'object') return null;
    const fileNo = typeof data.FileNo === 'string' ? data.FileNo : '';
    const orders = Array.isArray(data.Orders) ? data.Orders : [];
    const obtNumbers = orders.map((entry) => entry?.OBTNumber).filter(Boolean) as string[];
    const printDateTime = typeof data.PrintDateTime === 'string' ? data.PrintDateTime : '';
    if (!fileNo && obtNumbers.length === 0) return null;
    return { fileNo, obtNumbers, printDateTime };
  };

  const getLabelInfoFromPrintResponse = (payload: any): LabelInfo | null => {
    if (!payload || typeof payload !== 'object') return null;
    const splitResults = Array.isArray(payload.results) ? payload.results : [];
    if (payload.split && splitResults.length) {
      const match =
        splitResults.find((result: any) => result?.sellerId === sellerId) || splitResults[0];
      return buildLabelInfoFromPrintData(match?.response?.Data);
    }
    return buildLabelInfoFromPrintData(payload?.Data);
  };

  const applyLabelDialogInfo = (info: LabelInfo | null) => {
    setLabelDialogFileNo(info?.fileNo || '');
    setLabelDialogObtNumbers(info?.obtNumbers || []);
    setLabelDialogPrintedAt(info?.printDateTime || '');
  };

  const resolveLineAuthHeaders = async () => {
    if (firebaseUser) {
      try {
        const firebaseToken = await firebaseUser.getIdToken(true);
        if (firebaseToken) {
          return { Authorization: `Bearer ${firebaseToken}` };
        }
      } catch {}
    }

    let accessToken = '';
    let idToken = '';
    if (isInLineApp && isLiffReady) {
      try {
        const liff = (await import('@line/liff')).default;
        accessToken = typeof liff.getAccessToken === 'function' ? liff.getAccessToken() || '' : '';
        const candidateIdToken = typeof liff.getIDToken === 'function' ? liff.getIDToken() || '' : '';
        if (candidateIdToken && !isJwtExpired(candidateIdToken)) {
          idToken = candidateIdToken;
          setLineIdToken(candidateIdToken);
        }
      } catch {}
    }

    if (!idToken && lineIdToken && !isJwtExpired(lineIdToken)) {
      idToken = lineIdToken;
    }

    const headers: Record<string, string> = {};
    if (idToken) headers['X-Line-Id-Token'] = idToken;
    if (accessToken) headers['X-Line-Access-Token'] = accessToken;
    return headers;
  };

  const loadOrders = useCallback(async () => {
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
  }, [sellerId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const loadPickupMapConfig = async () => {
      try {
        const apiBaseUrl = resolveApiBaseUrl();
        const res = await fetch(`${apiBaseUrl}/api/logistics/yamato/config`);
        const payload = await res.json().catch(() => ({}));
        const hasMap = typeof payload?.map?.pickup === 'string' && payload.map.pickup.trim();
        const pickupAuth = payload?.pickupAuth || {};
        const pickupAuthReady =
          Boolean(String(pickupAuth?.uid || '').trim()) &&
          Boolean(String(pickupAuth?.custNo || '').trim()) &&
          Boolean(String(pickupAuth?.pkey || '').trim());
        const enabled = Boolean(hasMap && pickupAuthReady);
        setPickupDropoffEnabled(enabled);
        setPickupMapUrl(enabled ? `${apiBaseUrl}/api/logistics/yamato/map/pickup` : '');
      } catch (error) {
        console.warn('Failed to load Yamato pickup map config', error);
      }
    };
    loadPickupMapConfig();
  }, []);

  const handlePickupMapPayload = useCallback((data: any) => {
    if (!data || data.source !== 'yamato-map' || data.type !== 'pickup') return;
    const tradeId = typeof data.tradeId === 'string' ? data.tradeId : '';
    if (!tradeId) return;
    const payload = data.payload || {};
    setPickupSelections((prev) => ({
      ...prev,
      [tradeId]: {
        officeNo: payload.officeNo || payload.OFFICE_NO,
        officeName: payload.officeName || payload.OFFICE_NAME,
        officeAddress: payload.officeAddress || payload.OFFICE_ADDRESS,
        postCode: payload.postCode || payload.POSTCODE_NO,
        status: payload.status || payload.STATUS,
        message: payload.message || payload.MESSAGE,
      },
    }));
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      handlePickupMapPayload(event.data);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'yamato-map-selection' || !event.newValue) return;
      try {
        handlePickupMapPayload(JSON.parse(event.newValue));
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('yamato-map');
      channel.onmessage = (event) => handlePickupMapPayload(event.data);
    }
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (channel) channel.close();
    };
  }, [handlePickupMapPayload]);

  const openMapPopup = (url: string, name: string) => {
    if (!url || typeof window === 'undefined') return;
    const popup = window.open(url, name, 'width=1100,height=760');
    if (popup) {
      popup.focus();
      return;
    }
    toast({
      title: t('common.popupBlockedTitle'),
      description: t('common.popupBlockedDesc'),
      action: (
        <ToastAction altText={t('common.popupBlockedAction')} onClick={() => window.location.assign(url)}>
          {t('common.popupBlockedAction')}
        </ToastAction>
      ),
    });
  };

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
        order,
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

  const updateActionState = (orderId: string, updates: { printing?: boolean; pickup?: boolean; status?: boolean; downloading?: boolean }) => {
    setLogisticsActions((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], ...updates },
    }));
  };

  const ensurePickupForm = useCallback((orderId: string) => {
    setPickupForms((prev) => {
      if (prev[orderId]) return prev;
      return {
        ...prev,
        [orderId]: {
          customerName: sellerName,
          contactName: sellerName,
          contactTel: '',
          contactMobile: '',
          normalQuantity: '',
          coldQuantity: '',
          freezeQuantity: '',
        },
      };
    });
  }, [sellerName]);

  const selectOrderId = useCallback(
    (orderId: string | null) => {
      if (!orderId) {
        setExpandedId(null);
        return;
      }
      ensurePickupForm(orderId);
      setExpandedId(orderId);
    },
    [ensurePickupForm]
  );

  const openLabelDialog = (order: Order) => {
    const today = new Date();
    const pickupDate = findNextValidDate(today);
    const deliveryDate = findNextValidDeliveryDate(pickupDate);
    setLabelDialogOrder(order);
    setLabelPickupDate(formatDateInput(pickupDate));
    setLabelDeliveryDate(formatDateInput(deliveryDate));
    setLabelDialogError('');
    const latestShipment = getLatestSellerShipment(order);
    const existingLabel = buildLabelInfoFromShipment(latestShipment);
    if (existingLabel) {
      applyLabelDialogInfo(existingLabel);
      setLabelDialogStep(2);
      setLabelDialogExisting(true);
    } else {
      applyLabelDialogInfo(null);
      setLabelDialogStep(1);
      setLabelDialogExisting(false);
    }
    setLabelDialogOpen(true);
  };

  const handleLabelDialogOpen = (open: boolean) => {
    setLabelDialogOpen(open);
    if (!open) {
      setLabelDialogOrder(null);
      setLabelDialogError('');
      setLabelDialogStep(1);
      setLabelDialogExisting(false);
      applyLabelDialogInfo(null);
    }
  };

  const getLabelDateError = (pickupValue: string, deliveryValue: string) => {
    if (!pickupValue || !deliveryValue) {
      return t('schedule.logistics.labelDateRequired');
    }
    const pickupDate = parseDateInput(pickupValue);
    const deliveryDate = parseDateInput(deliveryValue);
    if (!pickupDate || !deliveryDate) {
      return t('schedule.logistics.labelDateRequired');
    }
    const today = startOfDay(new Date());
    const pickupDay = startOfDay(pickupDate);
    const deliveryDay = startOfDay(deliveryDate);
    if (pickupDay < today) {
      return t('schedule.logistics.labelPickupPast');
    }
    if (isYamatoBlackoutDate(pickupDay)) {
      return t('schedule.logistics.labelPickupHoliday');
    }
    if (deliveryDay < today) {
      return t('schedule.logistics.labelDeliveryPast');
    }
    if (isYamatoBlackoutDate(deliveryDay)) {
      return t('schedule.logistics.labelDeliveryHoliday');
    }
    const diffDays = Math.round((deliveryDay.getTime() - pickupDay.getTime()) / 86400000);
    if (diffDays < 1) {
      return t('schedule.logistics.labelDateOrderError');
    }
    if (diffDays > 7) {
      return t('schedule.logistics.labelDeliveryRange');
    }
    return '';
  };

  const submitLabelDialog = async () => {
    if (!labelDialogOrder) return;
    if (labelDialogStep === 2) return;
    const dateError = getLabelDateError(labelPickupDate, labelDeliveryDate);
    if (dateError) {
      setLabelDialogError(dateError);
      return;
    }
    setLabelDialogError('');
    const shipmentDate = toYamatoDate(labelPickupDate);
    const deliveryDate = toYamatoDate(labelDeliveryDate);
    const labelInfo = await handlePrintLabel(labelDialogOrder, { shipmentDate, deliveryDate });
    if (labelInfo) {
      applyLabelDialogInfo(labelInfo);
      setLabelDialogStep(2);
      setLabelDialogExisting(false);
    }
  };

  const parseTelephoneParts = (value: string) => {
    const raw = value.trim();
    if (!raw) return { area: '', number: '', ext: '' };
    if (raw.includes('-')) {
      const [area, rest] = raw.split('-', 2);
      return { area: area || '', number: (rest || '').replace(/[^0-9]/g, ''), ext: '' };
    }
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length >= 9) {
      return { area: digits.slice(0, 2), number: digits.slice(2), ext: '' };
    }
    return { area: '', number: digits, ext: '' };
  };

  const formatTimestamp = (value?: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const date = value?.toDate?.() || value;
    if (!date) return '';
    return new Date(date).toLocaleString();
  };

  const handlePrintLabel = async (
    order: Order,
    dates?: { shipmentDate?: string; deliveryDate?: string }
  ): Promise<LabelInfo | null> => {
    if (!sellerId) return null;
    const orderId = order.orderId;
    updateActionState(orderId, { printing: true });
    try {
      const existingLabel = buildLabelInfoFromShipment(getLatestSellerShipment(order));
      if (existingLabel) {
        return existingLabel;
      }
      const apiBaseUrl = resolveApiBaseUrl();
      const isB2s = order.shipping?.method === 'b2s';
      if (isB2s && !order.shipping?.storeId) {
        throw new Error(t('schedule.logistics.storeMissing'));
      }
      const endpoint = isB2s ? 'print-obt-b2s' : 'print-obt';
      const payload: Record<string, any> = {
        splitBySeller: true,
        sellerId,
        PrintType: '01',
        PrintOBTType: '01',
      };
      if (!isB2s) {
        if (dates?.shipmentDate) payload.ShipmentDate = dates.shipmentDate;
        if (dates?.deliveryDate) payload.DeliveryDate = dates.deliveryDate;
      }
      if (order.paymentMethod === 'cod') {
        payload.IsCollection = 'Y';
        payload.CollectionAmount = Math.max(0, Math.round(order.amount || 0));
      } else {
        payload.IsCollection = 'N';
      }
      if (isB2s && order.shipping?.storeId) {
        payload.receiveStoreId = order.shipping.storeId;
      }
      const res = await fetch(`${apiBaseUrl}/api/orders/${orderId}/logistics/yamato/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      const splitResults = Array.isArray(data?.results) ? data.results : [];
      const splitResponses = splitResults
        .map((result: any) => result?.response ?? result)
        .filter(Boolean);
      const splitOk =
        Boolean(data?.split) && splitResponses.some((response: any) => response?.IsOK === 'Y');
      const isOk = data?.IsOK === 'Y' || splitOk;
      if (!res.ok || !isOk) {
        const splitError = splitResponses.find(
          (response: any) => response?.IsOK && response?.IsOK !== 'Y'
        );
        throw new Error(
          splitError?.Message || data?.Message || data?.error || t('schedule.logistics.actionFailed')
        );
      }
      const labelInfo = getLabelInfoFromPrintResponse(data);
      toast({
        title: t('schedule.logistics.labelReadyTitle'),
        description: t('schedule.logistics.labelReadyDesc'),
      });
      await loadOrders();
      return labelInfo;
    } catch (error: any) {
      toast({
        title: t('schedule.logistics.actionFailed'),
        description: error?.message || t('schedule.logistics.actionFailed'),
        variant: 'destructive',
      });
      return null;
    } finally {
      updateActionState(orderId, { printing: false });
    }
  };

  const handleDownloadLabel = async (orderId: string, fileNo: string) => {
    if (!fileNo) return;
    updateActionState(orderId, { downloading: true });
    try {
      const apiBaseUrl = resolveApiBaseUrl();
      const authHeaders = await resolveLineAuthHeaders();
      const canSendLineMessage = Object.keys(authHeaders).length > 0 || Boolean(liffUser?.userId);
      if (canSendLineMessage) {
        const payload: Record<string, string> = { FileNo: fileNo };
        if (liffUser?.userId) payload.lineUserId = liffUser.userId;
        if (orderId && orderId !== fileNo) payload.orderId = orderId;
        try {
          const res = await fetch(`${apiBaseUrl}/api/logistics/yamato/download-obt-line`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data?.ok !== true) {
            throw new Error(data?.error || t('schedule.logistics.downloadFailed'));
          }
          toast({
            title: t('schedule.logistics.downloadSentTitle'),
            description: t('schedule.logistics.downloadSentDesc'),
          });
          if (isInLineApp) return;
        } catch (error) {
          console.warn('Failed to send label link via LINE; falling back to direct download', error);
        }
      }
      const res = await fetch(`${apiBaseUrl}/api/logistics/yamato/download-obt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ FileNo: fileNo }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.IsOK !== 'Y') {
          throw new Error(data?.Message || data?.error || t('schedule.logistics.downloadFailed'));
        }
        throw new Error(t('schedule.logistics.downloadFailed'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error: any) {
      toast({
        title: t('schedule.logistics.downloadFailed'),
        description: error?.message || t('schedule.logistics.downloadFailed'),
        variant: 'destructive',
      });
    } finally {
      updateActionState(orderId, { downloading: false });
    }
  };

  const handlePickupRequest = async (order: Order) => {
    if (!sellerId) return;
    const orderId = order.orderId;
    const form = pickupForms[orderId] || {
      customerName: sellerName,
      contactName: sellerName,
      contactTel: '',
      contactMobile: '',
      normalQuantity: '',
      coldQuantity: '',
      freezeQuantity: '',
    };
    const normalizeQuantity = (value: string) => {
      const digits = value.replace(/[^0-9]/g, '');
      if (!digits) return 0;
      const parsed = Number.parseInt(digits, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    const normalQuantity = normalizeQuantity(form.normalQuantity);
    const coldQuantity = normalizeQuantity(form.coldQuantity);
    const freezeQuantity = normalizeQuantity(form.freezeQuantity);
    const hasQuantity = normalQuantity + coldQuantity + freezeQuantity > 0;
    const contactTel = normalizeTaiwanTelInput(form.contactTel);
    const contactMobile = normalizeTaiwanPhoneDigits(form.contactMobile);
    if (!hasQuantity) {
      toast({
        title: t('schedule.logistics.pickupQuantityRequired'),
        description: t('schedule.logistics.pickupQuantityHint'),
        variant: 'destructive',
      });
      return;
    }
    if (!contactTel && !contactMobile) {
      toast({
        title: t('schedule.logistics.pickupMissingContact'),
        description: t('schedule.logistics.pickupMissingContactDesc'),
        variant: 'destructive',
      });
      return;
    }
    updateActionState(orderId, { pickup: true });
    try {
      const apiBaseUrl = resolveApiBaseUrl();
      const telParts = parseTelephoneParts(contactTel);
      const payload: Record<string, any> = {
        splitBySeller: true,
        sellerId,
        CustomerName: form.customerName.trim() || sellerName,
        ContactName: (form.contactName || form.customerName || sellerName).trim(),
        ContactTelArea: telParts.area,
        ContactTelNumber: telParts.number,
        ContactTelExt: telParts.ext,
        ContactMobile: contactMobile,
        NormalQuantity: normalQuantity,
        ColdQuantity: coldQuantity,
        FreezeQuantity: freezeQuantity,
      };
      const res = await fetch(`${apiBaseUrl}/api/orders/${orderId}/logistics/yamato/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      const splitResults = Array.isArray(data?.results) ? data.results : [];
      const splitResponses = splitResults
        .map((result: any) => result?.response ?? result)
        .filter(Boolean);
      const splitOk =
        Boolean(data?.split) && splitResponses.some((response: any) => response?.IsOK === 'Y');
      const isOk = data?.IsOK === 'Y' || splitOk;
      if (!res.ok || !isOk) {
        const splitError = splitResponses.find(
          (response: any) => response?.IsOK && response?.IsOK !== 'Y'
        );
        throw new Error(
          splitError?.Message || data?.Message || data?.error || t('schedule.logistics.actionFailed')
        );
      }
      toast({
        title: t('schedule.logistics.pickupReadyTitle'),
        description: t('schedule.logistics.pickupReadyDesc'),
      });
      await loadOrders();
    } catch (error: any) {
      toast({
        title: t('schedule.logistics.actionFailed'),
        description: error?.message || t('schedule.logistics.actionFailed'),
        variant: 'destructive',
      });
    } finally {
      updateActionState(orderId, { pickup: false });
    }
  };

  const handleRefreshStatus = async (order: Order) => {
    const orderId = order.orderId;
    updateActionState(orderId, { status: true });
    try {
      const apiBaseUrl = resolveApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/orders/${orderId}/logistics/yamato/obt-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.IsOK !== 'Y') {
        throw new Error(data?.Message || data?.error || t('schedule.logistics.actionFailed'));
      }
      toast({
        title: t('schedule.logistics.statusReadyTitle'),
        description: t('schedule.logistics.statusReadyDesc'),
      });
      await loadOrders();
    } catch (error: any) {
      toast({
        title: t('schedule.logistics.actionFailed'),
        description: error?.message || t('schedule.logistics.actionFailed'),
        variant: 'destructive',
      });
    } finally {
      updateActionState(orderId, { status: false });
    }
  };

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
      selectOrderId(orderParam);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      const nextSearch = next.toString();
      navigate(nextSearch ? `${location.pathname}?${nextSearch}` : location.pathname, { replace: true });
    };

    handleDeepLink();
  }, [searchParams, confirmOrder, declineOrder, navigate, location.pathname, selectOrderId]);

  useEffect(() => {
    const dialog = searchParams.get('dialog');
    const orderParam = searchParams.get('order');
    const action = searchParams.get('action');
    if (dialog !== 'label' || !orderParam) {
      labelDialogRef.current = null;
      return;
    }
    if (action) return;
    if (labelDialogRef.current === orderParam) return;
    if (isLoading) return;
    const targetOrder = orders.find(
      (order) => order.orderId === orderParam || order.id === orderParam
    );
    if (!targetOrder) return;
    labelDialogRef.current = orderParam;
    selectOrderId(orderParam);
    openLabelDialog(targetOrder);
    const next = new URLSearchParams(searchParams);
    next.delete('dialog');
    const nextSearch = next.toString();
    navigate(nextSearch ? `${location.pathname}?${nextSearch}` : location.pathname, { replace: true });
  }, [searchParams, isLoading, orders, navigate, location.pathname, selectOrderId]);

  useEffect(() => {
    const fileNo = searchParams.get('label');
    const orderParam = searchParams.get('order');
    if (!fileNo) {
      labelDownloadRef.current = null;
      return;
    }
    const key = `${orderParam || ''}:${fileNo}`;
    if (labelDownloadRef.current === key) return;
    labelDownloadRef.current = key;
    const matchedOrder =
      orderParam ||
      orders.find((order) => getSellerShipments(order).some((shipment) => shipment.fileNo === fileNo))?.orderId;
    if (matchedOrder) {
      selectOrderId(matchedOrder);
    }
    handleDownloadLabel(matchedOrder || fileNo, fileNo);
    const next = new URLSearchParams(searchParams);
    next.delete('label');
    const nextSearch = next.toString();
    navigate(nextSearch ? `${location.pathname}?${nextSearch}` : location.pathname, { replace: true });
  }, [searchParams, navigate, location.pathname, orders, selectOrderId]);

  useEffect(() => {
    if (!expandedId || !stepsPanelRef.current) return;
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) return;
    stepsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [expandedId]);

  const statusBadge = (status: string, deliveryStatus?: string) => {
    const displayStatus = deliveryStatus || status;
    const statusLabelKeyByStatus: Record<string, string> = {
      confirmed: 'schedule.status.confirmed',
      paid: 'schedule.status.readyToDrop',
      delivered: 'schedule.status.readyToDrop',
      awaiting_pickup: 'schedule.status.scheduled',
      reserved: 'schedule.status.awaitingConfirmation',
      pending: 'schedule.status.awaitingConfirmation',
      authorized: 'schedule.status.awaitingConfirmation',
      cancelled: 'schedule.status.cancelled',
      enroute: 'schedule.status.onTheWay',
    };
    const statusLabelKey = statusLabelKeyByStatus[displayStatus];
    const label = statusLabelKey ? t(statusLabelKey) : displayStatus ? displayStatus : t('schedule.status.pending');
    switch (displayStatus) {
      case 'confirmed':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" title={label}>
            {label}
          </Badge>
        );
      case 'paid':
      case 'delivered':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200" title={label}>
            {label}
          </Badge>
        );
      case 'awaiting_pickup':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100" title={label}>
            {label}
          </Badge>
        );
      case 'reserved':
      case 'pending':
      case 'authorized':
        return (
          <Badge variant="secondary" title={label}>
            {label}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200" title={label}>
            {label}
          </Badge>
        );
      case 'enroute':
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200" title={label}>
            {label}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="max-w-full text-gray-600" title={label}>
            <span className="block max-w-[220px] truncate sm:max-w-none">{label}</span>
          </Badge>
        );
    }
  };

  const renderOrderSteps = (delivery: DeliveryView) => {
    const order = delivery.order;
    const orderId = order.orderId;
    const actions = logisticsActions[orderId] || {};
    const shipments = getSellerShipments(order);
    const latestShipment = shipments[shipments.length - 1];
    const obtNumbers = (latestShipment?.orders || []).map((entry) => entry.obtNumber).filter(Boolean) as string[];
    const fileNo = latestShipment?.fileNo || '';
    const pickups = order.logistics?.pickups || (order.logistics?.pickup ? [order.logistics.pickup] : []);
    const sellerPickups = pickups.filter((pickup) => !pickup.sellerId || pickup.sellerId === sellerId);
    const latestPickup = sellerPickups[sellerPickups.length - 1];
    const tracking = order.logistics?.tracking?.latest;
    const storedPickupMethod = pickupMethods[orderId] || 'courier';
    const pickupMethod = pickupDropoffEnabled ? storedPickupMethod : 'courier';
    const pickupSelection = pickupSelections[orderId];
    const pickupMapCard = pickupMapUrl ? (
      <button
        type="button"
        onClick={() => {
          try {
            const url = new URL(pickupMapUrl);
            url.searchParams.set('tradeId', orderId);
            openMapPopup(url.toString(), 'yamato-pickup-map');
          } catch {
            openMapPopup(pickupMapUrl, 'yamato-pickup-map');
          }
        }}
        className="group relative flex min-h-28 w-full flex-col items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-4 py-3 text-left transition hover:border-emerald-300 sm:flex-row sm:items-center"
        aria-label={t('schedule.logistics.pickupMapCta')}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-800">{t('schedule.logistics.pickupMapTitle')}</p>
          <p className="text-xs text-gray-500">{t('schedule.logistics.pickupMapHint')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
          <MapPin className="h-4 w-4" />
          <span>{t('schedule.logistics.pickupMapCta')}</span>
        </div>
      </button>
    ) : (
      <div className="flex min-h-28 w-full flex-col items-start justify-between gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-left sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-700">{t('schedule.logistics.pickupMapTitle')}</p>
          <p className="text-xs text-gray-400">{t('schedule.logistics.pickupMapUnavailable')}</p>
        </div>
        <MapPin className="h-4 w-4 text-gray-400" />
      </div>
    );
    const form = pickupForms[orderId] || {
      customerName: sellerName,
      contactName: sellerName,
      contactTel: '',
      contactMobile: '',
      normalQuantity: '',
      coldQuantity: '',
      freezeQuantity: '',
    };
    const isPending = ['pending', 'reserved', 'authorized'].includes(order.status);
    const isCancelled = ['cancelled', 'failed'].includes(order.status) || order.deliveryStatus === 'cancelled';
    const canRunLogistics = !['pending', 'reserved', 'authorized', 'cancelled', 'failed'].includes(order.status);
    const hasLabel = Boolean(fileNo || obtNumbers.length);

    return (
      <div className="space-y-4 overflow-x-hidden">
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">#{orderId}</p>
              <p className="text-xs text-gray-500 break-words">{delivery.items.join(' • ')}</p>
            </div>
            <div className="shrink-0">{statusBadge(delivery.status, delivery.deliveryStatus)}</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span className="min-w-0 break-words">{delivery.destination || t('checkout.addresses.defaultLabel')}</span>
          </div>
          {delivery.createdAt ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock3 className="w-3 h-3" />
              <span>{formatTimestamp(delivery.createdAt)}</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
                1
              </span>
              <span>{t('schedule.stepConfirmTitle')}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">{t('schedule.stepConfirmDesc')}</p>
          {isPending ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => confirmOrder(orderId)}
                disabled={confirming === orderId}
              >
                {confirming === orderId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {t('schedule.confirmButton')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => declineOrder(orderId)}
                disabled={declining === orderId}
              >
                {declining === orderId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t('schedule.declineButton')}
              </Button>
            </div>
          ) : isCancelled ? (
            <p className="text-xs text-red-600">{t('schedule.stepConfirmDeclined')}</p>
          ) : (
            <p className="text-xs text-emerald-600">{t('schedule.stepConfirmDone')}</p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
                2
              </span>
              <span>{t('schedule.stepLabelTitle')}</span>
            </div>
            {hasLabel ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{t('schedule.stepLabelDone')}</Badge>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">{t('schedule.stepLabelDesc')}</p>
          {hasLabel ? (
            <div className="space-y-1 text-xs text-gray-600 break-words">
              {fileNo && (
                <p>
                  <span className="font-semibold text-gray-700">{t('schedule.logistics.fileNo')}:</span> {fileNo}
                </p>
              )}
              {obtNumbers.length > 0 && (
                <p>
                  <span className="font-semibold text-gray-700">{t('schedule.logistics.obtNumbers')}:</span> {obtNumbers.join(', ')}
                </p>
              )}
              {latestShipment?.printDateTime && (
                <p>
                  <span className="font-semibold text-gray-700">{t('schedule.logistics.printedAt')}:</span> {latestShipment.printDateTime}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('schedule.logistics.noLabel')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openLabelDialog(order)}
              disabled={!canRunLogistics || actions.printing}
            >
              {actions.printing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t('schedule.logistics.generateLabel')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDownloadLabel(orderId, fileNo)}
              disabled={!fileNo || actions.downloading}
            >
              {actions.downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {t('schedule.logistics.downloadLabel')}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
                3
              </span>
              <span>{t('schedule.stepPickupTitle')}</span>
            </div>
            {latestPickup ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{t('schedule.logistics.pickupReadyTitle')}</Badge>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">{t('schedule.stepPickupDesc')}</p>
          {latestPickup ? (
            <div className="text-xs text-gray-600">
              <p>
                <span className="font-semibold text-gray-700">{t('schedule.logistics.pickupMessage')}:</span> {latestPickup.message || t('schedule.logistics.pickupSuccessShort')}
              </p>
              {latestPickup.requestedAt && (
                <p>
                  <span className="font-semibold text-gray-700">{t('schedule.logistics.pickupRequestedAt')}:</span> {formatTimestamp(latestPickup.requestedAt)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('schedule.logistics.noPickup')}</p>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">{t('schedule.logistics.pickupMethodTitle')}</p>
            <RadioGroup
              value={pickupMethod}
              onValueChange={(value) => {
                if (value === 'dropoff' && !pickupDropoffEnabled) return;
                setPickupMethods((prev) => ({ ...prev, [orderId]: value as PickupMethod }));
              }}
              className="grid gap-2 md:grid-cols-2"
            >
              <Label
                htmlFor={`pickup-method-${orderId}-courier`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-left',
                  pickupMethod === 'courier' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'
                )}
              >
                <RadioGroupItem id={`pickup-method-${orderId}-courier`} value="courier" className="mt-1" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{t('schedule.logistics.pickupMethodCourier')}</p>
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupMethodCourierDesc')}</p>
                </div>
              </Label>
              <Label
                htmlFor={`pickup-method-${orderId}-dropoff`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-left',
                  pickupMethod === 'dropoff' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200',
                  !pickupDropoffEnabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                )}
              >
                <RadioGroupItem
                  id={`pickup-method-${orderId}-dropoff`}
                  value="dropoff"
                  className="mt-1"
                  disabled={!pickupDropoffEnabled}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-800">{t('schedule.logistics.pickupMethodDropoff')}</p>
                    {!pickupDropoffEnabled ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        {t('common.comingSoon')}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupMethodDropoffDesc')}</p>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {pickupMethod === 'courier' ? (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupCustomerName')}</p>
                  <Input
                    value={form.customerName}
                    onChange={(event) =>
                      setPickupForms((prev) => ({
                        ...prev,
                        [orderId]: { ...form, customerName: event.target.value },
                      }))
                    }
                    placeholder={t('schedule.logistics.pickupCustomerName')}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupContactName')}</p>
                  <Input
                    value={form.contactName}
                    onChange={(event) =>
                      setPickupForms((prev) => ({
                        ...prev,
                        [orderId]: { ...form, contactName: event.target.value },
                      }))
                    }
                    placeholder={t('schedule.logistics.pickupContactName')}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupTel')}</p>
                  <Input
                    value={form.contactTel}
                    onChange={(event) =>
                      setPickupForms((prev) => ({
                        ...prev,
                        [orderId]: { ...form, contactTel: normalizeTaiwanTelInput(event.target.value) },
                      }))
                    }
                    placeholder="02-12345678"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupMobile')}</p>
                  <Input
                    value={form.contactMobile}
                    onChange={(event) =>
                      setPickupForms((prev) => ({
                        ...prev,
                        [orderId]: { ...form, contactMobile: formatTaiwanMobileInput(event.target.value) },
                      }))
                    }
                    placeholder="0912-345-678"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupNormalQuantity')}</p>
                  <Input
                    value={form.normalQuantity}
                    onChange={(event) =>
                      setPickupForms((prev) => ({
                        ...prev,
                        [orderId]: { ...form, normalQuantity: event.target.value.replace(/[^0-9]/g, '') },
                      }))
                    }
                    placeholder="0"
                    className="h-9"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupColdQuantity')}</p>
                  <Input
                    value={form.coldQuantity}
                    onChange={(event) =>
                      setPickupForms((prev) => ({
                        ...prev,
                        [orderId]: { ...form, coldQuantity: event.target.value.replace(/[^0-9]/g, '') },
                      }))
                    }
                    placeholder="0"
                    className="h-9"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">{t('schedule.logistics.pickupFreezeQuantity')}</p>
                  <Input
                    value={form.freezeQuantity}
                    onChange={(event) =>
                      setPickupForms((prev) => ({
                        ...prev,
                        [orderId]: { ...form, freezeQuantity: event.target.value.replace(/[^0-9]/g, '') },
                      }))
                    }
                    placeholder="0"
                    className="h-9"
                    inputMode="numeric"
                  />
                </div>
                <div className="md:col-span-2 text-xs text-amber-600">
                  {t('schedule.logistics.pickupQuantityHint')}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handlePickupRequest(order)}
                disabled={!canRunLogistics || actions.pickup}
              >
                {actions.pickup ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t('schedule.logistics.requestPickup')}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              {pickupMapCard}
              {pickupSelection ? (
                <div className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs text-gray-600">
                  <p className="font-semibold text-emerald-700">{pickupSelection.officeName || t('schedule.logistics.pickupMapTitle')}</p>
                  {pickupSelection.officeNo ? <p>{t('schedule.logistics.pickupSelectionCode', { code: pickupSelection.officeNo })}</p> : null}
                  {pickupSelection.officeAddress ? <p>{pickupSelection.officeAddress}</p> : null}
                </div>
              ) : null}
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {t('schedule.logistics.pickupMethodDropoffNote')}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
                4
              </span>
              <span>{t('schedule.stepStatusTitle')}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">{t('schedule.stepStatusDesc')}</p>
          {tracking ? (
            <div className="text-xs text-gray-600 space-y-1 break-words">
              <p>
                <span className="font-semibold text-gray-700">{t('schedule.logistics.latestStatus')}:</span> {tracking.statusName || t('schedule.logistics.statusUnknown')}
              </p>
              {tracking.stationName && (
                <p>
                  <span className="font-semibold text-gray-700">{t('schedule.logistics.statusStation')}:</span> {tracking.stationName}
                </p>
              )}
              {tracking.createDateTime && (
                <p>
                  <span className="font-semibold text-gray-700">{t('schedule.logistics.statusUpdated')}:</span> {tracking.createDateTime}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('schedule.logistics.noTracking')}</p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRefreshStatus(order)}
            disabled={!hasLabel || actions.status}
          >
            {actions.status ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {t('schedule.logistics.refreshStatus')}
          </Button>
        </div>
      </div>
    );
  };

  const labelDialogActions = labelDialogOrder
    ? logisticsActions[labelDialogOrder.orderId] || {}
    : {};
  const labelDialogOrderId = labelDialogOrder?.orderId || '';
  const labelDialogHasLabel = Boolean(labelDialogFileNo || labelDialogObtNumbers.length);
  const labelDialogCanDownload = Boolean(labelDialogFileNo);
  const labelDialogLocked = labelDialogStep === 2;
  const labelDialogCanGenerate = labelDialogOrder
    ? !['pending', 'reserved', 'authorized', 'cancelled', 'failed'].includes(labelDialogOrder.status)
    : false;
  const labelDialogRequiresConfirm = Boolean(labelDialogOrder && !labelDialogCanGenerate);
  const pickupMin = formatDateInput(new Date());
  const pickupDateValue = parseDateInput(labelPickupDate);
  const deliveryMin = pickupDateValue ? formatDateInput(addDays(pickupDateValue, 1)) : undefined;
  const deliveryMax = pickupDateValue ? formatDateInput(addDays(pickupDateValue, 7)) : undefined;
  const selectedDelivery = useMemo(
    () =>
      expandedId
        ? deliveries.find(
            (delivery) => delivery.orderId === expandedId || delivery.id === expandedId
          ) || null
        : null,
    [deliveries, expandedId]
  );

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
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
                awaiting.map((delivery) => {
                  const isSelected = expandedId === delivery.orderId || expandedId === delivery.id;
                  return (
                    <div
                      key={delivery.id}
                      className={`border rounded-lg p-4 space-y-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50/40 shadow-sm'
                          : 'hover:border-green-200 hover:shadow-sm'
                      }`}
                      onClick={() => selectOrderId(isSelected ? null : delivery.orderId)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <PackageCheck className="w-5 h-5 text-green-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">#{delivery.orderId}</p>
                            <p className="text-sm text-gray-600 break-words">{delivery.items.join(' • ')}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="min-w-0 break-words">{delivery.destination || t('checkout.addresses.defaultLabel')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 md:w-80 md:justify-end w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            {statusBadge(delivery.status, delivery.deliveryStatus)}
                            {delivery.paymentMethod && (
                              <Badge variant="outline" className="max-w-full text-xs uppercase">
                                <span className="block max-w-[180px] truncate">{delivery.paymentMethod}</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
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
                active.map((delivery) => {
                  const isSelected = expandedId === delivery.orderId || expandedId === delivery.id;
                  return (
                    <div
                      key={delivery.id}
                      className={`border rounded-lg p-4 space-y-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50/40 shadow-sm'
                          : 'hover:border-green-200 hover:shadow-sm'
                      }`}
                      onClick={() => selectOrderId(isSelected ? null : delivery.orderId)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <PackageCheck className="w-5 h-5 text-green-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">#{delivery.orderId}</p>
                            <p className="text-sm text-gray-600 break-words">{delivery.items.join(' • ')}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="min-w-0 break-words">{delivery.destination || t('checkout.addresses.defaultLabel')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 md:w-80 md:justify-end w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            {statusBadge(delivery.status, delivery.deliveryStatus)}
                            {delivery.paymentMethod && (
                              <Badge variant="outline" className="max-w-full text-xs uppercase">
                                <span className="block max-w-[180px] truncate">{delivery.paymentMethod}</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div ref={stepsPanelRef} className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="lg:max-h-[calc(100vh-8rem)] lg:overflow-auto">
            <CardHeader>
              <CardTitle>{t('schedule.stepsTitle')}</CardTitle>
              <CardDescription>{t('schedule.stepsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDelivery ? (
                renderOrderSteps(selectedDelivery)
              ) : (
                <div className="text-sm text-gray-500 py-6 text-center">
                  {t('schedule.stepsEmpty')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={labelDialogOpen} onOpenChange={handleLabelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('schedule.logistics.labelDialogTitle')}</DialogTitle>
            <DialogDescription>{t('schedule.logistics.labelDialogDescription')}</DialogDescription>
          </DialogHeader>
          {labelDialogExisting && labelDialogHasLabel ? (
            <p className="text-xs text-emerald-600">{t('schedule.logistics.labelDialogExisting')}</p>
          ) : null}
          {labelDialogRequiresConfirm ? (
            <p className="text-xs text-amber-600">{t('schedule.stepConfirmDesc')}</p>
          ) : null}
          <div className="grid gap-3">
            <div className="rounded-md border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">{t('schedule.logistics.labelDialogStep1')}</p>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">{t('schedule.logistics.labelPickupDate')}</p>
                <Input
                  type="date"
                  value={labelPickupDate}
                  disabled={labelDialogLocked}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setLabelPickupDate(nextValue);
                    setLabelDialogError('');
                    const nextDate = parseDateInput(nextValue);
                    if (nextDate) {
                      const nextMin = formatDateInput(addDays(nextDate, 1));
                      const nextMax = formatDateInput(addDays(nextDate, 7));
                      if (!labelDeliveryDate || labelDeliveryDate < nextMin || labelDeliveryDate > nextMax) {
                        setLabelDeliveryDate(formatDateInput(findNextValidDeliveryDate(nextDate)));
                      }
                    }
                  }}
                  min={pickupMin}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">{t('schedule.logistics.labelDeliveryDate')}</p>
                <Input
                  type="date"
                  value={labelDeliveryDate}
                  min={deliveryMin}
                  max={deliveryMax}
                  disabled={labelDialogLocked}
                  onChange={(event) => {
                    setLabelDeliveryDate(event.target.value);
                    setLabelDialogError('');
                  }}
                  className="h-9"
                />
              </div>
              {labelDialogError ? (
                <p className="text-xs text-red-600">{labelDialogError}</p>
              ) : (
                <p className="text-xs text-gray-500">{t('schedule.logistics.labelDateHint')}</p>
              )}
            </div>
            <div className="rounded-md border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">{t('schedule.logistics.labelDialogStep2')}</p>
              {labelDialogHasLabel ? (
                <div className="space-y-1 text-xs text-gray-600 break-words">
                  <p className="text-xs text-gray-500">{t('schedule.logistics.labelDialogDownloadHint')}</p>
                  {labelDialogFileNo ? (
                    <p>
                      <span className="font-semibold text-gray-700">{t('schedule.logistics.fileNo')}:</span> {labelDialogFileNo}
                    </p>
                  ) : null}
                  {labelDialogObtNumbers.length > 0 ? (
                    <p>
                      <span className="font-semibold text-gray-700">{t('schedule.logistics.obtNumbers')}:</span> {labelDialogObtNumbers.join(', ')}
                    </p>
                  ) : null}
                  {labelDialogPrintedAt ? (
                    <p>
                      <span className="font-semibold text-gray-700">{t('schedule.logistics.printedAt')}:</span> {labelDialogPrintedAt}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-gray-500">{t('schedule.logistics.labelDialogStep2Hint')}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadLabel(labelDialogOrderId || labelDialogFileNo, labelDialogFileNo)}
                disabled={!labelDialogCanDownload || labelDialogActions.downloading}
              >
                {labelDialogActions.downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {t('schedule.logistics.downloadLabel')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleLabelDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={submitLabelDialog}
              disabled={!labelDialogOrder || labelDialogActions.printing || labelDialogLocked || !labelDialogCanGenerate}
            >
              {labelDialogActions.printing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {t('schedule.logistics.generateLabel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FarmerDeliverySchedule;
