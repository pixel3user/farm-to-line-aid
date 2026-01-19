import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveApiBaseUrl } from '@/lib/api';
import { ShoppingCart, ArrowLeft, Loader2, Minus, Plus, X, AlertTriangle, CheckCircle2, Sparkles, HandCoins, CreditCard, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AddressCandidate, lookupAddress, reverseLookupAddress, resolveYamatoZip } from '@/lib/address';
import { useIsMobile } from '@/hooks/use-mobile';
import useDebouncedValue from '@/hooks/useDebouncedValue';

type CartProduct = {
  id: string;
  name: string;
  unit?: string;
  price?: number;
  images?: string[];
};

type CartItem = {
  product: CartProduct;
  quantity: number;
};

type ShippingMethod = 'home' | 'b2s' | 'pickup_station';

type ShippingForm = {
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  instructions: string;
  storeId: string;
  storeName: string;
  pickupOfficeNo: string;
  pickupOfficeName: string;
};

type SavedAddress = ShippingForm & { id: string; label: string };

const defaultForm: ShippingForm = {
  fullName: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  instructions: '',
  storeId: '',
  storeName: '',
  pickupOfficeNo: '',
  pickupOfficeName: '',
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

const formatTaiwanPhoneInput = (value: string) => {
  const digits = normalizeTaiwanPhoneDigits(value);
  if (digits.startsWith('09') || (digits.startsWith('9') && digits.length === 9)) {
    return formatTaiwanMobileInput(digits);
  }
  return normalizeTaiwanTelInput(value);
};

const CheckoutPage: React.FC = () => {
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ShippingForm>(defaultForm);
  const [deliveryMethod, setDeliveryMethod] = useState<ShippingMethod>('home');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [buyerSuggestions, setBuyerSuggestions] = useState<AddressCandidate[]>([]);
  const [buyerLookupError, setBuyerLookupError] = useState<string | null>(null);
  const [buyerVerifyError, setBuyerVerifyError] = useState<string | null>(null);
  const [isBuyerSearching, setIsBuyerSearching] = useState(false);
  const [isBuyerVerifying, setIsBuyerVerifying] = useState(false);
  const [buyerPostNumber, setBuyerPostNumber] = useState('');
  const [buyerYamatoZipCode, setBuyerYamatoZipCode] = useState('');
  const buyerLookupIdRef = useRef(0);
  const buyerAutoFillRef = useRef<string | null>(null);
  const buyerQueryRef = useRef('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<'cod' | 'line_pay'>('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [mobileStep, setMobileStep] = useState(0);
  const [mapLinks, setMapLinks] = useState<{ pickup: string; b2s: string }>({ pickup: '', b2s: '' });
  const [pickupStationEnabled, setPickupStationEnabled] = useState(false);
  const [mapSelections, setMapSelections] = useState<{
    b2s?: { storeId?: string; storeName?: string; storeAddress?: string };
    pickup?: { officeNo?: string; officeName?: string; officeAddress?: string; postCode?: string };
  }>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isHomeDelivery = deliveryMethod === 'home';
  const isB2s = deliveryMethod === 'b2s';
  const isPickupStation = deliveryMethod === 'pickup_station';
  const hasB2sSelection = Boolean(mapSelections.b2s?.storeId || mapSelections.b2s?.storeName);
  const hasPickupSelection = Boolean(mapSelections.pickup?.officeNo || mapSelections.pickup?.officeName);
  const paymentOptions = [
    {
      id: 'cod' as const,
      title: t('checkout.payment.codTitle'),
      description: t('checkout.payment.codDescription'),
      icon: HandCoins,
      available: true,
      badge: t('checkout.payment.codBadge'),
    },
    {
      id: 'line_pay' as const,
      title: t('checkout.payment.lineTitle'),
      description: t('checkout.payment.lineDescription'),
      icon: CreditCard,
      available: false,
      badge: t('checkout.payment.lineBadge'),
    },
  ];

  const deliveryOptions = [
    {
      value: 'home' as const,
      title: t('checkout.deliveryOptions.home'),
      description: t('checkout.deliveryOptions.homeDesc'),
    },
    {
      value: 'b2s' as const,
      title: t('checkout.deliveryOptions.b2s'),
      description: t('checkout.deliveryOptions.b2sDesc'),
    },
    {
      value: 'pickup_station' as const,
      title: t('checkout.deliveryOptions.pickupStation'),
      description: t('checkout.deliveryOptions.pickupStationDesc'),
      disabled: !pickupStationEnabled,
      badge: t('common.comingSoon'),
    },
  ];

  const handleDeliveryMethodChange = (value: string) => {
    if (value === 'pickup_station' && !pickupStationEnabled) return;
    const nextMethod = value as ShippingMethod;
    setDeliveryMethod(nextMethod);
    if (nextMethod !== 'home') {
      setSelectedSavedAddressId('');
    }
  };

  const renderDeliveryMethodSelector = (idPrefix: string) => (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">{t('checkout.deliveryOptions.title')}</p>
      <RadioGroup
        value={deliveryMethod}
        onValueChange={handleDeliveryMethodChange}
        className="grid gap-2"
      >
        {deliveryOptions.map((option) => {
          const selected = deliveryMethod === option.value;
          const disabled = Boolean((option as { disabled?: boolean }).disabled);
          return (
            <Label
              key={option.value}
              htmlFor={`${idPrefix}-${option.value}`}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left',
                selected ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              )}
            >
              <RadioGroupItem
                id={`${idPrefix}-${option.value}`}
                value={option.value}
                className="mt-1"
                disabled={disabled}
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{option.title}</p>
                  {disabled && (option as { badge?: string }).badge ? (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                      {(option as { badge?: string }).badge}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem('f2m_cart');
      if (raw) {
        setCart(JSON.parse(raw));
      }
      const saved = localStorage.getItem('f2m_saved_addresses');
      if (saved) {
        setSavedAddresses(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to parse saved cart', error);
    }
  }, []);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      fullName: prev.fullName || user?.displayName || '',
      email: prev.email || (user as any)?.email || '',
    }));
  }, [user]);


  useEffect(() => {
    try {
      localStorage.setItem('f2m_cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const persistAddresses = (next: SavedAddress[]) => {
    setSavedAddresses(next);
    try {
      localStorage.setItem('f2m_saved_addresses', JSON.stringify(next));
    } catch {}
  };

  const syncAddressesFromServer = async () => {
    if (!user?.id && !(user as any)?.lineUserId) return;
    try {
      const apiBaseUrl = resolveApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/user/${(user as any)?.lineUserId || user?.id}/addresses`);
      const payload = await res.json();
      if (res.ok && Array.isArray(payload.addresses)) {
        persistAddresses(payload.addresses);
      }
    } catch (error) {
      console.warn('Failed to sync addresses', error);
    }
  };

  useEffect(() => {
    syncAddressesFromServer();
  }, [user]);

  useEffect(() => {
    const loadMapLinks = async () => {
      try {
        const apiBaseUrl = resolveApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/logistics/yamato/config`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const hasPickup = typeof payload?.map?.pickup === 'string' && payload.map.pickup.trim();
        const hasB2s = typeof payload?.map?.b2s === 'string' && payload.map.b2s.trim();
        const pickupAuth = payload?.pickupAuth || {};
        const pickupAuthReady =
          Boolean(String(pickupAuth?.uid || '').trim()) &&
          Boolean(String(pickupAuth?.custNo || '').trim()) &&
          Boolean(String(pickupAuth?.pkey || '').trim());
        setPickupStationEnabled(hasPickup && pickupAuthReady);
        setMapLinks({
          pickup: hasPickup && pickupAuthReady ? `${apiBaseUrl}/api/logistics/yamato/map/pickup` : '',
          b2s: hasB2s
            ? `${apiBaseUrl}/api/logistics/yamato/map/b2s${isMobile ? '?mobile=1' : ''}`
            : '',
        });
      } catch (error) {
        console.warn('Failed to load Yamato map config', error);
      }
    };
    loadMapLinks();
  }, [isMobile]);

  useEffect(() => {
    if (!pickupStationEnabled && deliveryMethod === 'pickup_station') {
      setDeliveryMethod('home');
    }
  }, [pickupStationEnabled, deliveryMethod]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0),
    [cartItems]
  );
  const mobileStepTotal = 4;
  const stepLabel = (current: number, total: number) =>
    t('common.stepOf')
      .replace('{current}', String(current))
      .replace('{total}', String(total));
  const selectedSavedAddress = savedAddresses.find((addr) => addr.id === selectedSavedAddressId) || null;

  const normalizeAddressKey = (value: string) => value.replace(/\s+/g, '');

  const splitStreetAndNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return { street: '', number: '' };
    const spaceIndex = trimmed.search(/\s/);
    if (spaceIndex > 0) {
      return {
        street: trimmed.slice(0, spaceIndex).trim(),
        number: trimmed.slice(spaceIndex + 1).trim(),
      };
    }
    const digitIndex = trimmed.search(/\d/);
    if (digitIndex > 0) {
      return {
        street: trimmed.slice(0, digitIndex).trim(),
        number: trimmed.slice(digitIndex).trim(),
      };
    }
    return { street: trimmed, number: '' };
  };

  const splitCityAndRest = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return { city: '', rest: '' };
    const match = trimmed.match(/^(.+?[\u5e02\u7e23])(.*)$/);
    if (!match) return { city: '', rest: trimmed };
    return { city: match[1].trim(), rest: match[2].trim() };
  };

  const buildAddressLine1 = (street: string, number: string) => {
    const trimmedStreet = street.trim();
    const trimmedNumber = number.trim();
    if (!trimmedStreet && !trimmedNumber) return '';
    const joiner = /[A-Za-z]/.test(trimmedStreet) ? ' ' : '';
    return [trimmedStreet, trimmedNumber].filter(Boolean).join(joiner).trim();
  };

  const buildBuyerAddressQuery = (line1Override?: string) => {
    const line1 = typeof line1Override === 'string' ? line1Override : buildAddressLine1(addressStreet, addressNumber);
    return [formData.city.trim(), line1].filter(Boolean).join(' ');
  };

  const buildBuyerFullAddress = (line1Override?: string) => {
    const line1 = typeof line1Override === 'string' ? line1Override : buildAddressLine1(addressStreet, addressNumber);
    return normalizeAddressKey([formData.city.trim(), line1].filter(Boolean).join(' '));
  };

  const buildAddressSummary = (city: string, line1: string, line2: string) =>
    [city, line1, line2].filter((value) => value && value.trim()).join(' ').trim();

  const clearBuyerLookupState = useCallback(() => {
    setBuyerSuggestions([]);
    setBuyerLookupError(null);
  }, []);

  const clearBuyerVerification = useCallback(() => {
    setBuyerPostNumber('');
    setBuyerYamatoZipCode('');
    setBuyerVerifyError(null);
  }, []);

  const applyMapAddress = useCallback((address: string, postalCode?: string) => {
    const normalized = address.trim();
    if (!normalized) return;
    const { city, rest } = splitCityAndRest(normalized);
    const line1Source = rest || normalized;
    const { street, number } = splitStreetAndNumber(line1Source);
    const composedLine1 = buildAddressLine1(street, number) || line1Source;
    setAddressStreet(street);
    setAddressNumber(number);
    setFormData((prev) => ({
      ...prev,
      city: city || prev.city,
      addressLine1: composedLine1,
      addressLine2: '',
      postalCode: postalCode || prev.postalCode,
    }));
    clearBuyerLookupState();
    clearBuyerVerification();
  }, [clearBuyerLookupState, clearBuyerVerification]);

  const handleYamatoMapPayload = useCallback((data: any) => {
    if (!data || data.source !== 'yamato-map') return;
    const payload = data.payload || {};
    if (data.type === 'b2s') {
      const storeId = String(payload.storeId || '').trim();
      const storeName = String(payload.storeName || '').trim();
      const storeAddress = String(payload.storeAddress || '').trim();
      setDeliveryMethod('b2s');
      setSelectedSavedAddressId('');
      if (storeId || storeName || storeAddress) {
        setFormData((prev) => ({
          ...prev,
          storeId: storeId || prev.storeId,
          storeName: storeName || prev.storeName,
        }));
      }
      if (storeAddress) {
        applyMapAddress(storeAddress);
      }
      setMapSelections((prev) => ({
        ...prev,
        b2s: { storeId, storeName, storeAddress },
      }));
      toast({
        title: t('checkout.deliveryOptions.b2sMapSelected'),
        description: storeName || storeId || t('checkout.deliveryOptions.b2sMapSelectedDesc'),
      });
      return;
    }
    if (data.type === 'pickup') {
      const officeNo = String(payload.officeNo || payload.OFFICE_NO || '').trim();
      const officeName = String(payload.officeName || payload.OFFICE_NAME || '').trim();
      const officeAddress = String(payload.officeAddress || payload.OFFICE_ADDRESS || '').trim();
      const postCode = String(payload.postCode || payload.POSTCODE_NO || '').trim();
      setDeliveryMethod('pickup_station');
      setSelectedSavedAddressId('');
      if (officeNo || officeName || officeAddress || postCode) {
        setFormData((prev) => ({
          ...prev,
          pickupOfficeNo: officeNo || prev.pickupOfficeNo,
          pickupOfficeName: officeName || prev.pickupOfficeName,
          postalCode: postCode || prev.postalCode,
        }));
      }
      if (officeAddress) {
        applyMapAddress(officeAddress, postCode || undefined);
      }
      setMapSelections((prev) => ({
        ...prev,
        pickup: { officeNo, officeName, officeAddress, postCode },
      }));
      toast({
        title: t('checkout.deliveryOptions.pickupMapSelected'),
        description: officeName || officeNo || t('checkout.deliveryOptions.pickupMapSelectedDesc'),
      });
    }
  }, [applyMapAddress, t, toast]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      handleYamatoMapPayload(event.data);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'yamato-map-selection' || !event.newValue) return;
      try {
        handleYamatoMapPayload(JSON.parse(event.newValue));
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('yamato-map');
      channel.onmessage = (event) => handleYamatoMapPayload(event.data);
    }
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (channel) channel.close();
    };
  }, [handleYamatoMapPayload]);

  const buyerLookupQuery = buildBuyerAddressQuery();
  const debouncedBuyerQuery = useDebouncedValue(buyerLookupQuery, 400);

  useEffect(() => {
    buyerQueryRef.current = buyerLookupQuery;
  }, [buyerLookupQuery]);

  useEffect(() => {
    if (!isHomeDelivery) {
      buyerLookupIdRef.current += 1;
      setBuyerSuggestions([]);
      setBuyerLookupError(null);
      return;
    }
    const query = debouncedBuyerQuery.trim();
    const normalizedQuery = normalizeAddressKey(query);
    if (normalizedQuery.length < 3) {
      buyerLookupIdRef.current += 1;
      setBuyerSuggestions([]);
      setBuyerLookupError(null);
      return;
    }
    if (buyerAutoFillRef.current === normalizedQuery) {
      buyerAutoFillRef.current = null;
      return;
    }
    const lookupId = (buyerLookupIdRef.current += 1);
    setBuyerLookupError(null);
    lookupAddress(query)
      .then((result) => {
        if (buyerLookupIdRef.current !== lookupId) return;
        if (normalizeAddressKey(buyerQueryRef.current) !== normalizedQuery) return;
        setBuyerSuggestions(result.candidates);
        if (result.candidates.length === 0) {
          setBuyerLookupError(t('checkout.address.lookupEmpty'));
          return;
        }
        const topCandidate = result.candidates[0];
        if (topCandidate?.address && normalizeAddressKey(topCandidate.address).startsWith(normalizedQuery)) {
          buyerAutoFillRef.current = normalizeAddressKey(topCandidate.address);
          applyBuyerCandidate(topCandidate, { preserveSuggestions: true });
        }
      })
      .catch((error: any) => {
        if (buyerLookupIdRef.current !== lookupId) return;
        if (normalizeAddressKey(buyerQueryRef.current) !== normalizedQuery) return;
        setBuyerLookupError(error?.message || t('checkout.address.lookupFailed'));
      });
  }, [debouncedBuyerQuery, isHomeDelivery, t]);

  const updateCartQty = useCallback((productId: string, quantity: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[productId];
      } else if (next[productId]) {
        next[productId] = { ...next[productId], quantity };
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const handleInputChange = (field: keyof ShippingForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    const nextValue = field === 'phone' ? formatTaiwanPhoneInput(value) : value;
    setFormData((prev) => ({ ...prev, [field]: nextValue }));
  };

  useEffect(() => {
    if (!isHomeDelivery) {
      clearBuyerLookupState();
      clearBuyerVerification();
    }
  }, [isHomeDelivery, clearBuyerLookupState, clearBuyerVerification]);

  const handleBuyerStreetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextStreet = event.target.value;
    const nextLine1 = buildAddressLine1(nextStreet, addressNumber);
    setAddressStreet(nextStreet);
    setFormData((prev) => ({ ...prev, addressLine1: nextLine1 }));
    clearBuyerLookupState();
    clearBuyerVerification();
  };

  const handleBuyerNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextNumber = event.target.value;
    const nextLine1 = buildAddressLine1(addressStreet, nextNumber);
    setAddressNumber(nextNumber);
    setFormData((prev) => ({ ...prev, addressLine1: nextLine1 }));
    clearBuyerLookupState();
    clearBuyerVerification();
  };

  const handleBuyerCityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextCity = event.target.value;
    setFormData((prev) => ({ ...prev, city: nextCity }));
    clearBuyerLookupState();
    clearBuyerVerification();
  };

  const handleBuyerAddressLine2Change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextLine2 = event.target.value;
    setFormData((prev) => ({ ...prev, addressLine2: nextLine2 }));
    clearBuyerLookupState();
    clearBuyerVerification();
  };

  const handleBuyerPostalCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextPostalCode = event.target.value;
    setFormData((prev) => ({ ...prev, postalCode: nextPostalCode }));
    clearBuyerVerification();
  };

  const applyBuyerCandidate = (
    candidate: AddressCandidate,
    options?: { preserveVerification?: boolean; preserveSuggestions?: boolean }
  ) => {
    const rawAddress = candidate.address || '';
    const { city, rest } = splitCityAndRest(rawAddress);
    const line1Source = rest || rawAddress;
    const { street, number } = splitStreetAndNumber(line1Source);
    const composedLine1 = buildAddressLine1(street, number) || line1Source;
    setAddressStreet(street);
    setAddressNumber(number);
    setFormData((prev) => ({
      ...prev,
      city: city || prev.city,
      addressLine1: composedLine1,
    }));
    if (!options?.preserveSuggestions) {
      clearBuyerLookupState();
    }
    if (!options?.preserveVerification) {
      clearBuyerVerification();
    }
  };

  const validateForm = (): boolean => {
    const requiredFields: Array<keyof ShippingForm> = [
      'fullName',
      'phone',
      'addressLine1',
      'city',
      'postalCode',
    ];
    if (isB2s) {
      requiredFields.push('storeId');
    }
    if (isPickupStation) {
      requiredFields.push('pickupOfficeNo');
    }

    for (const field of requiredFields) {
      if (!formData[field] || !formData[field].trim()) {
        toast({
          title: t('checkout.errors.missingInfoTitle'),
          description: t('checkout.errors.missingInfoDescription'),
          variant: 'destructive',
        });
        return false;
      }
    }
    return true;
  };

  const buildShippingPayload = () => {
    const addressLine1 = formData.addressLine1.trim();
    const addressLine2 = formData.addressLine2.trim();
    const city = formData.city.trim();
    const postalCode = formData.postalCode.trim();
    const base = {
      fullName: formData.fullName.trim(),
      phone: normalizeTaiwanPhoneDigits(formData.phone),
      email: formData.email.trim(),
      instructions: formData.instructions.trim(),
      method: deliveryMethod,
      addressLine1,
      addressLine2,
      city,
      postalCode,
    };
    if (isB2s) {
      return {
        ...base,
        storeId: formData.storeId.trim(),
        storeName: formData.storeName.trim(),
        storeAddress: buildAddressSummary(city, addressLine1, addressLine2),
      };
    }
    if (isPickupStation) {
      return {
        ...base,
        pickupOfficeNo: formData.pickupOfficeNo.trim(),
        pickupOfficeName: formData.pickupOfficeName.trim(),
        pickupOfficeAddress: buildAddressSummary(city, addressLine1, addressLine2),
      };
    }
    return base;
  };

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

  const renderMapCard = (options: {
    url: string;
    title: string;
    hint: string;
    cta: string;
    unavailable: string;
    name: string;
  }) =>
    options.url ? (
      <button
        type="button"
        onClick={() => openMapPopup(options.url, options.name)}
        className="group relative flex min-h-24 w-full flex-col items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-4 py-3 text-left transition hover:border-emerald-300 sm:flex-row sm:items-center"
        aria-label={options.cta}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-800">{options.title}</p>
          <p className="text-xs text-gray-500">{options.hint}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
          <MapPin className="h-4 w-4" />
          <span>{options.cta}</span>
        </div>
      </button>
    ) : (
      <div className="flex min-h-24 w-full flex-col items-start justify-between gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-left sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-700">{options.title}</p>
          <p className="text-xs text-gray-400">{options.unavailable}</p>
        </div>
        <MapPin className="h-4 w-4 text-gray-400" />
      </div>
    );

  const renderSelectionCard = (title: string, details: string[]) => (
    <div className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs text-gray-600 space-y-1">
      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          {t('checkout.deliveryOptions.selectedBadge')}
        </Badge>
        <span className="font-semibold text-emerald-700">{title}</span>
      </div>
      {details.filter(Boolean).map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>
  );

  const requestBuyerLocation = () =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        reject(new Error(t('checkout.address.geoUnavailable')));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => reject(new Error(t('checkout.address.geoDenied')))
      );
    });

  const handleLookupBuyerAddress = async () => {
    const query = buildBuyerAddressQuery();
    if (!query.trim()) {
      setBuyerLookupError(t('checkout.address.lookupRequired'));
      return;
    }
    setIsBuyerSearching(true);
    setBuyerLookupError(null);
    try {
      const result = await lookupAddress(query);
      if (result.candidates.length === 0) {
        setBuyerLookupError(t('checkout.address.lookupEmpty'));
      }
      setBuyerSuggestions(result.candidates);
      const topCandidate = result.candidates[0];
      if (topCandidate?.address) {
        buyerAutoFillRef.current = normalizeAddressKey(topCandidate.address);
        applyBuyerCandidate(topCandidate, { preserveSuggestions: true });
      }
    } catch (error: any) {
      setBuyerLookupError(error?.message || t('checkout.address.lookupFailed'));
    } finally {
      setIsBuyerSearching(false);
    }
  };

  const handleUseLocationForBuyer = async () => {
    setIsBuyerSearching(true);
    setBuyerLookupError(null);
    try {
      const { lat, lng } = await requestBuyerLocation();
      const result = await reverseLookupAddress(lat, lng);
      if (result.candidates.length === 0) {
        setBuyerLookupError(t('checkout.address.lookupEmpty'));
      }
      setBuyerSuggestions(result.candidates);
      const topCandidate = result.candidates[0];
      if (topCandidate?.address) {
        buyerAutoFillRef.current = normalizeAddressKey(topCandidate.address);
        applyBuyerCandidate(topCandidate, { preserveSuggestions: true });
      }
    } catch (error: any) {
      setBuyerLookupError(error?.message || t('checkout.address.lookupFailed'));
    } finally {
      setIsBuyerSearching(false);
    }
  };

  const handleVerifyBuyerAddress = async (): Promise<boolean> => {
    const fullAddress = buildBuyerFullAddress();
    if (!fullAddress.trim()) {
      setBuyerVerifyError(t('checkout.address.verifyRequired'));
      return false;
    }
    setIsBuyerVerifying(true);
    setBuyerVerifyError(null);
    try {
      const result = await resolveYamatoZip(fullAddress);
      setBuyerPostNumber(result.postNumber || '');
      setBuyerYamatoZipCode(result.yamatoZipCode || '');
      if (result.normalizedAddress) {
        buyerAutoFillRef.current = normalizeAddressKey(result.normalizedAddress);
        applyBuyerCandidate({ address: result.normalizedAddress, lat: 0, lng: 0 }, { preserveVerification: true });
      }
      if (result.yamatoZipCode) {
        setFormData((prev) => ({ ...prev, postalCode: result.yamatoZipCode }));
      }
      return true;
    } catch (error: any) {
      setBuyerVerifyError(error?.message || t('checkout.address.verifyFailed'));
      return false;
    } finally {
      setIsBuyerVerifying(false);
    }
  };

  const handleUseAddress = (addr: SavedAddress) => {
    const { street, number } = splitStreetAndNumber(addr.addressLine1 || '');
    setAddressStreet(street);
    setAddressNumber(number);
    setDeliveryMethod('home');
    setFormData((prev) => ({
      ...prev,
      fullName: addr.fullName,
      phone: formatTaiwanPhoneInput(addr.phone),
      email: addr.email,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      city: addr.city,
      postalCode: addr.postalCode,
      instructions: addr.instructions,
    }));
    clearBuyerLookupState();
    clearBuyerVerification();
    toast({
      title: t('checkout.addresses.appliedTitle'),
      description: t('checkout.addresses.appliedDesc'),
    });
  };

  const handleSavedAddressSelect = (value: string) => {
    setSelectedSavedAddressId(value);
    const selected = savedAddresses.find((addr) => addr.id === value);
    if (selected) {
      handleUseAddress(selected);
    }
  };

  const handleCheckoutNextStep = async () => {
    if (mobileStep === 0) {
      if (!formData.fullName.trim() || !formData.phone.trim()) {
        toast({
          title: t('checkout.errors.missingInfoTitle'),
          description: t('checkout.errors.missingInfoDescription'),
          variant: 'destructive',
        });
        return;
      }
    }
    if (mobileStep === 1) {
      if (isB2s && !formData.storeId.trim()) {
        toast({
          title: t('checkout.errors.missingInfoTitle'),
          description: t('checkout.errors.missingInfoDescription'),
          variant: 'destructive',
        });
        return;
      }
      if (isPickupStation && !formData.pickupOfficeNo.trim()) {
        toast({
          title: t('checkout.errors.missingInfoTitle'),
          description: t('checkout.errors.missingInfoDescription'),
          variant: 'destructive',
        });
        return;
      }
      if (!formData.addressLine1.trim() || !formData.city.trim() || !formData.postalCode.trim()) {
        toast({
          title: t('checkout.errors.missingInfoTitle'),
          description: t('checkout.errors.missingInfoDescription'),
          variant: 'destructive',
        });
        return;
      }
      if (isHomeDelivery && !buyerYamatoZipCode) {
        if (isBuyerVerifying) return;
        const verified = await handleVerifyBuyerAddress();
        if (!verified) {
          return;
        }
      }
    }
    setMobileStep((prev) => Math.min(prev + 1, mobileStepTotal - 1));
  };

  const handleDeleteAddress = (id: string) => {
    const next = savedAddresses.filter((a) => a.id !== id);
    persistAddresses(next);
    if (selectedSavedAddressId === id) {
      setSelectedSavedAddressId('');
    }
    const apiBaseUrl = resolveApiBaseUrl();
    const userId = (user as any)?.lineUserId || user?.id;
    if (userId) {
      fetch(`${apiBaseUrl}/api/user/${userId}/addresses/${id}`, { method: 'DELETE' }).catch(() => {});
    }
    toast({
      title: t('checkout.addresses.deletedTitle'),
      description: t('checkout.addresses.deletedDesc'),
    });
  };

  const handleSaveAddress = () => {
    if (!isHomeDelivery) return;
    if (!validateForm()) return;
    const label =
      prompt(t('checkout.addresses.promptLabel'))?.trim() ||
      t('checkout.addresses.defaultLabel');
    const newAddress: SavedAddress = {
      ...formData,
      storeId: '',
      storeName: '',
      pickupOfficeNo: '',
      pickupOfficeName: '',
      phone: normalizeTaiwanPhoneDigits(formData.phone),
      id: `${Date.now()}`,
      label,
    };
    persistAddresses([...savedAddresses, newAddress]);
    const apiBaseUrl = resolveApiBaseUrl();
    const userId = (user as any)?.lineUserId || user?.id;
    if (userId) {
      fetch(`${apiBaseUrl}/api/user/${userId}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAddress),
      }).catch(() => {});
    }
    toast({
      title: t('checkout.addresses.savedTitle'),
      description: t('checkout.addresses.savedDesc'),
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setOrderError(null);

    if (!cartItems.length) {
      toast({ title: t('cart.emptyTitle'), description: t('cart.emptyDescription') });
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (isHomeDelivery && !buyerYamatoZipCode) {
      if (isBuyerVerifying) return;
      const verified = await handleVerifyBuyerAddress();
      if (!verified) {
        return;
      }
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setShowPaymentModal(true);
      setIsSubmitting(false);
    }, 180);
  };

  const placeOrder = async () => {
    if (selectedPayment !== 'cod') return;
    if (!cartItems.length) {
      toast({ title: t('cart.emptyTitle'), description: t('cart.emptyDescription') });
      return;
    }

    try {
      console.log('[Checkout] Placing COD order', { items: cartItems.length, total: cartTotal, user: user?.id || (user as any)?.lineUserId });
      setIsPlacingOrder(true);
      setOrderError(null);
      const apiBaseUrl = resolveApiBaseUrl();
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 15000);

      const response = await fetch(`${apiBaseUrl}/api/orders/cod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          currency: 'TWD',
          items: cartItems.map(({ product, quantity }) => ({
            productId: product.id,
            name: product.name,
            price: Number(product.price || 0),
            quantity,
            imageUrl: product.images?.[0],
            unit: product.unit,
          })),
          buyer: {
            userId: (user as any)?.lineUserId || user?.id,
            displayName: user?.displayName,
            email: (user as any)?.email || formData.email,
            role: user?.role || 'market',
            source: 'web',
          },
          shipping: buildShippingPayload(),
          metadata: {
            totalAmount: cartTotal,
            items: cartItems.length,
            paymentMethod: 'cod',
          },
        }),
      });
      clearTimeout(timeout);

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || t('checkout.errors.failedDescription'));
      }

      console.log('[Checkout] COD order created', payload);
      setLastOrderId(payload?.orderId || null);
      setShowPaymentModal(false);
      setSelectedPayment('cod');
      setCart({});
      try {
        localStorage.removeItem('f2m_cart');
      } catch {}

      toast({
        title: t('checkout.successTitle'),
        description: t('checkout.successDesc', { orderId: payload?.orderId || '' }),
      });
    } catch (error: any) {
      console.error('Checkout failed', error);
      const isAbort = error?.name === 'AbortError';
      const message = isAbort
        ? 'Order request timed out. Please check your connection and try again.'
        : error?.message || t('checkout.errors.failedDescription');
      setOrderError(message);
      toast({
        title: t('checkout.errors.failed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          className="px-2"
          onClick={() => navigate('/market/products')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('checkout.backToProducts')}
        </Button>
        <div className="flex items-center gap-2 text-gray-600">
          <ShoppingCart className="h-4 w-4" />
          <span>{t('checkout.title')}</span>
        </div>
      </div>

      {lastOrderId && (
        <Alert className="bg-green-50 border-green-200 shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">{t('checkout.successTitle')}</AlertTitle>
          <AlertDescription className="text-sm text-green-700 flex items-center justify-between gap-3 flex-wrap">
            <span>
              {t('checkout.successDesc', { orderId: `#${lastOrderId}` })}
            </span>
            <Button size="sm" variant="outline" onClick={() => navigate('/market/schedule')}>
              {t('schedule.title')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isMobile ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('checkout.deliveryDetails')}</CardTitle>
              <CardDescription>{t('checkout.deliveryDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="text-xs font-semibold text-gray-500">
                  {stepLabel(mobileStep + 1, mobileStepTotal)}
                </div>
                <div key={`checkout-step-${mobileStep}`} className="space-y-4 animate-in fade-in-0 slide-in-from-right-2 duration-300">
                  {mobileStep === 0 && (
                    <div className="space-y-4">
                      {renderDeliveryMethodSelector('mobile')}
                      {isHomeDelivery && savedAddresses.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">{t('checkout.addresses.title')}</p>
                          <Select value={selectedSavedAddressId} onValueChange={handleSavedAddressSelect}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={t('checkout.addresses.use')} />
                            </SelectTrigger>
                            <SelectContent>
                              {savedAddresses.map((addr) => (
                                <SelectItem key={addr.id} value={addr.id}>
                                  {addr.label} · {[addr.city, addr.addressLine1].filter(Boolean).join(' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedSavedAddress && (
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{selectedSavedAddress.fullName} · {formatTaiwanPhoneInput(selectedSavedAddress.phone)}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteAddress(selectedSavedAddress.id)}
                              >
                                {t('checkout.addresses.delete')}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="fullName-mobile">{`${t('checkout.fullName')} *`}</Label>
                        <Input id="fullName-mobile" value={formData.fullName} onChange={handleInputChange('fullName')} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone-mobile">{`${t('checkout.phone')} *`}</Label>
                        <Input id="phone-mobile" value={formData.phone} onChange={handleInputChange('phone')} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email-mobile">{t('checkout.email')}</Label>
                        <Input
                          id="email-mobile"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange('email')}
                          placeholder={t('checkout.emailPlaceholder')}
                        />
                      </div>
                    </div>
                  )}
                  {mobileStep === 1 && (
                    <div className="space-y-4">
                      {isHomeDelivery ? (
                        <>
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-gray-700">{t('checkout.address.verifyTitle')}</p>
                            <p className="text-xs text-gray-500">{t('checkout.address.verifyHint')}</p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleUseLocationForBuyer}
                                disabled={isBuyerSearching}
                                className="gap-2"
                              >
                                {isBuyerSearching ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('checkout.address.searching')}
                                  </>
                                ) : (
                                  <>
                                    <MapPin className="w-4 h-4" />
                                    {t('checkout.address.useLocation')}
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleLookupBuyerAddress}
                                disabled={isBuyerSearching || !buyerLookupQuery.trim()}
                              >
                                {t('checkout.address.search')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleVerifyBuyerAddress}
                                disabled={isBuyerVerifying || !buyerLookupQuery.trim()}
                                className="gap-2"
                              >
                                {isBuyerVerifying ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('checkout.address.verifying')}
                                  </>
                                ) : (
                                  t('checkout.address.verify')
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-4 rounded-lg border border-gray-200 p-3">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="postalCode-mobile">{`${t('checkout.postalCode')} *`}</Label>
                                <Input
                                  id="postalCode-mobile"
                                  value={formData.postalCode}
                                  onChange={handleBuyerPostalCodeChange}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="city-mobile">{`${t('checkout.city')} *`}</Label>
                                <Input
                                  id="city-mobile"
                                  value={formData.city}
                                  onChange={handleBuyerCityChange}
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="addressStreet-mobile">{`${t('checkout.address.street')} *`}</Label>
                                <Input
                                  id="addressStreet-mobile"
                                  value={addressStreet}
                                  onChange={handleBuyerStreetChange}
                                  placeholder={t('checkout.address.streetPlaceholder')}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="addressNumber-mobile">{t('checkout.address.number')}</Label>
                                <Input
                                  id="addressNumber-mobile"
                                  value={addressNumber}
                                  onChange={handleBuyerNumberChange}
                                  placeholder={t('checkout.address.numberPlaceholder')}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="addressLine2-mobile">{t('checkout.addressLine2')}</Label>
                              <Input
                                id="addressLine2-mobile"
                                value={formData.addressLine2}
                                onChange={handleBuyerAddressLine2Change}
                                placeholder={t('checkout.addressLine2Placeholder')}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="buyer-post-number-mobile">{t('checkout.address.postNumber')}</Label>
                              <Input
                                id="buyer-post-number-mobile"
                                value={buyerPostNumber}
                                readOnly
                                placeholder={t('checkout.address.postNumberPlaceholder')}
                                className="bg-gray-50"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="buyer-yamato-zip-mobile">{t('checkout.address.yamatoZip')}</Label>
                              <Input
                                id="buyer-yamato-zip-mobile"
                                value={buyerYamatoZipCode}
                                readOnly
                                placeholder={t('checkout.address.yamatoZipPlaceholder')}
                                className="bg-gray-50"
                              />
                            </div>
                          </div>

                          {buyerSuggestions.length > 0 && (
                            <div className="rounded-md border border-gray-200 bg-white p-2">
                              <p className="text-xs text-gray-500">{t('checkout.address.suggestions')}</p>
                              <div className="flex flex-col gap-2 mt-2">
                                {buyerSuggestions.map((candidate, index) => (
                                  <button
                                    key={`${candidate.address}-${index}`}
                                    type="button"
                                    onClick={() => applyBuyerCandidate(candidate)}
                                    className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-green-400 hover:bg-green-50"
                                  >
                                    {candidate.address}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {buyerLookupError && (
                            <div className="text-sm text-red-600">{buyerLookupError}</div>
                          )}
                          {buyerVerifyError && (
                            <div className="text-sm text-red-600">{buyerVerifyError}</div>
                          )}
                        </>
                      ) : (
                        <>
                          {isB2s ? (
                            <>
                              {renderMapCard({
                                url: mapLinks.b2s,
                                title: t('checkout.deliveryOptions.b2sMapTitle'),
                                hint: t('checkout.deliveryOptions.b2sMapHint'),
                                cta: t('checkout.deliveryOptions.b2sMapCta'),
                                unavailable: t('checkout.deliveryOptions.b2sMapUnavailable'),
                                name: 'yamato-b2s-map',
                              })}
                              {hasB2sSelection ? (
                                renderSelectionCard(
                                  mapSelections.b2s?.storeName || mapSelections.b2s?.storeId || t('checkout.deliveryOptions.b2sMapTitle'),
                                  [
                                    mapSelections.b2s?.storeId
                                      ? t('checkout.deliveryOptions.storeIdLabel', { id: mapSelections.b2s.storeId })
                                      : '',
                                    mapSelections.b2s?.storeAddress || '',
                                  ]
                                )
                              ) : (
                                <>
                                  <div className="space-y-2">
                                    <Label htmlFor="storeId-mobile">{`${t('checkout.deliveryOptions.storeId')} *`}</Label>
                                    <Input
                                      id="storeId-mobile"
                                      value={formData.storeId}
                                      onChange={handleInputChange('storeId')}
                                      placeholder={t('checkout.deliveryOptions.storeIdPlaceholder')}
                                      required
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="storeName-mobile">{t('checkout.deliveryOptions.storeName')}</Label>
                                    <Input
                                      id="storeName-mobile"
                                      value={formData.storeName}
                                      onChange={handleInputChange('storeName')}
                                      placeholder={t('checkout.deliveryOptions.storeNamePlaceholder')}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500">{t('checkout.deliveryOptions.storeAddressHint')}</p>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {renderMapCard({
                                url: mapLinks.pickup,
                                title: t('checkout.deliveryOptions.pickupMapTitle'),
                                hint: t('checkout.deliveryOptions.pickupMapHint'),
                                cta: t('checkout.deliveryOptions.pickupMapCta'),
                                unavailable: t('checkout.deliveryOptions.pickupMapUnavailable'),
                                name: 'yamato-pickup-map',
                              })}
                              {hasPickupSelection ? (
                                renderSelectionCard(
                                  mapSelections.pickup?.officeName || mapSelections.pickup?.officeNo || t('checkout.deliveryOptions.pickupMapTitle'),
                                  [
                                    mapSelections.pickup?.officeNo
                                      ? t('checkout.deliveryOptions.stationCodeLabel', { code: mapSelections.pickup.officeNo })
                                      : '',
                                    mapSelections.pickup?.officeAddress || '',
                                  ]
                                )
                              ) : (
                                <>
                                  <div className="space-y-2">
                                    <Label htmlFor="pickupOfficeNo-mobile">{`${t('checkout.deliveryOptions.stationNo')} *`}</Label>
                                    <Input
                                      id="pickupOfficeNo-mobile"
                                      value={formData.pickupOfficeNo}
                                      onChange={handleInputChange('pickupOfficeNo')}
                                      placeholder={t('checkout.deliveryOptions.stationNoPlaceholder')}
                                      required
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="pickupOfficeName-mobile">{t('checkout.deliveryOptions.stationName')}</Label>
                                    <Input
                                      id="pickupOfficeName-mobile"
                                      value={formData.pickupOfficeName}
                                      onChange={handleInputChange('pickupOfficeName')}
                                      placeholder={t('checkout.deliveryOptions.stationNamePlaceholder')}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500">{t('checkout.deliveryOptions.stationAddressHint')}</p>
                                </>
                              )}
                            </>
                          )}

                          {((isB2s && !hasB2sSelection) || (isPickupStation && !hasPickupSelection)) ? (
                            <div className="space-y-4 rounded-lg border border-gray-200 p-3">
                              <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-2">
                                  <Label htmlFor="postalCode-mobile">{`${t('checkout.postalCode')} *`}</Label>
                                  <Input
                                    id="postalCode-mobile"
                                    value={formData.postalCode}
                                    onChange={handleBuyerPostalCodeChange}
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="city-mobile">{`${t('checkout.city')} *`}</Label>
                                  <Input
                                    id="city-mobile"
                                    value={formData.city}
                                    onChange={handleBuyerCityChange}
                                    required
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-2">
                                  <Label htmlFor="addressStreet-mobile">{`${t('checkout.address.street')} *`}</Label>
                                  <Input
                                    id="addressStreet-mobile"
                                    value={addressStreet}
                                    onChange={handleBuyerStreetChange}
                                    placeholder={t('checkout.address.streetPlaceholder')}
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="addressNumber-mobile">{t('checkout.address.number')}</Label>
                                  <Input
                                    id="addressNumber-mobile"
                                    value={addressNumber}
                                    onChange={handleBuyerNumberChange}
                                    placeholder={t('checkout.address.numberPlaceholder')}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="addressLine2-mobile">{t('checkout.addressLine2')}</Label>
                                <Input
                                  id="addressLine2-mobile"
                                  value={formData.addressLine2}
                                  onChange={handleBuyerAddressLine2Change}
                                  placeholder={t('checkout.addressLine2Placeholder')}
                                />
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                  {mobileStep === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="instructions-mobile">{t('checkout.deliveryNotes')}</Label>
                        <Textarea
                          id="instructions-mobile"
                          value={formData.instructions}
                          onChange={handleInputChange('instructions')}
                          placeholder={t('checkout.instructionsPlaceholder')}
                          rows={4}
                        />
                      </div>
                      {isHomeDelivery ? (
                        <Button type="button" variant="outline" onClick={handleSaveAddress}>
                          {t('checkout.addresses.save')}
                        </Button>
                      ) : null}
                    </div>
                  )}
                  {mobileStep === 3 && (
                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{t('checkout.summary.title')}</span>
                          <span className="text-lg font-bold text-green-700">NT$ {cartTotal.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-500">{cartItems.length} {t('cart.items')}</p>
                        {cartItems.slice(0, 2).map(({ product, quantity }) => (
                          <div key={product.id} className="flex items-center justify-between text-sm text-gray-600">
                            <span className="truncate">{product.name} × {quantity}</span>
                            <span>NT$ {((product.price || 0) * quantity).toLocaleString()}</span>
                          </div>
                        ))}
                        {cartItems.length > 2 && (
                          <p className="text-xs text-gray-500">+{cartItems.length - 2} {t('cart.items')}...</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  {mobileStep === 0 ? (
                    <Button type="button" variant="outline" onClick={() => navigate('/market/products')}>
                      {t('checkout.backToProducts')}
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => setMobileStep((prev) => Math.max(prev - 1, 0))}>
                      {t('common.back')}
                    </Button>
                  )}
                  {mobileStep < mobileStepTotal - 1 ? (
                    <Button type="button" onClick={handleCheckoutNextStep}>
                      {t('common.next')}
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting || !cartItems.length}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('checkout.payment.redirecting')}
                        </>
                      ) : (
                        t('checkout.proceedGeneric')
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.deliveryDetails')}</CardTitle>
                <CardDescription>{t('checkout.deliveryDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isHomeDelivery && savedAddresses.length > 0 && (
                  <div className="mb-4 border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{t('checkout.addresses.title')}</p>
                      <Badge variant="outline">{savedAddresses.length}</Badge>
                    </div>
                    <div className="flex flex-col gap-2">
                      {savedAddresses.map((addr) => (
                        <div
                          key={addr.id}
                          className={cn(
                            'flex items-start justify-between gap-2 border rounded-md p-2 bg-white',
                            'hover:border-green-200 transition-colors'
                          )}
                        >
                          <div className="text-xs text-gray-700">
                            <p className="font-semibold text-sm">{addr.label}</p>
                            <p>{addr.fullName} · {formatTaiwanPhoneInput(addr.phone)}</p>
                            <p>{[addr.city, addr.addressLine1].filter(Boolean).join(' ')}</p>
                            {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleUseAddress(addr)}>
                              {t('checkout.addresses.use')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteAddress(addr.id)}>
                              {t('checkout.addresses.delete')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {renderDeliveryMethodSelector('desktop')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">{`${t('checkout.fullName')} *`}</Label>
                      <Input id="fullName" value={formData.fullName} onChange={handleInputChange('fullName')} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">{`${t('checkout.phone')} *`}</Label>
                      <Input id="phone" value={formData.phone} onChange={handleInputChange('phone')} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">{t('checkout.email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange('email')}
                        placeholder={t('checkout.emailPlaceholder')}
                      />
                    </div>
                  </div>

                  {isHomeDelivery ? (
                    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-700">{t('checkout.address.verifyTitle')}</p>
                        <p className="text-xs text-gray-500">{t('checkout.address.verifyHint')}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleUseLocationForBuyer}
                            disabled={isBuyerSearching}
                            className="gap-2"
                          >
                            {isBuyerSearching ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('checkout.address.searching')}
                              </>
                            ) : (
                              <>
                                <MapPin className="w-4 h-4" />
                                {t('checkout.address.useLocation')}
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleLookupBuyerAddress}
                            disabled={isBuyerSearching || !buyerLookupQuery.trim()}
                          >
                            {t('checkout.address.search')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleVerifyBuyerAddress}
                            disabled={isBuyerVerifying || !buyerLookupQuery.trim()}
                            className="gap-2"
                          >
                            {isBuyerVerifying ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('checkout.address.verifying')}
                              </>
                            ) : (
                              t('checkout.address.verify')
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="postalCode">{`${t('checkout.postalCode')} *`}</Label>
                          <Input
                            id="postalCode"
                            value={formData.postalCode}
                            onChange={handleBuyerPostalCodeChange}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="city">{`${t('checkout.city')} *`}</Label>
                          <Input id="city" value={formData.city} onChange={handleBuyerCityChange} required />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="addressStreet">{`${t('checkout.address.street')} *`}</Label>
                          <Input
                            id="addressStreet"
                            value={addressStreet}
                            onChange={handleBuyerStreetChange}
                            placeholder={t('checkout.address.streetPlaceholder')}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="addressNumber">{t('checkout.address.number')}</Label>
                          <Input
                            id="addressNumber"
                            value={addressNumber}
                            onChange={handleBuyerNumberChange}
                            placeholder={t('checkout.address.numberPlaceholder')}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="addressLine2">{t('checkout.addressLine2')}</Label>
                        <Input
                          id="addressLine2"
                          value={formData.addressLine2}
                          onChange={handleBuyerAddressLine2Change}
                          placeholder={t('checkout.addressLine2Placeholder')}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="buyer-post-number">{t('checkout.address.postNumber')}</Label>
                          <Input
                            id="buyer-post-number"
                            value={buyerPostNumber}
                            readOnly
                            placeholder={t('checkout.address.postNumberPlaceholder')}
                            className="bg-gray-50"
                          />
                        </div>
                        <div>
                          <Label htmlFor="buyer-yamato-zip">{t('checkout.address.yamatoZip')}</Label>
                          <Input
                            id="buyer-yamato-zip"
                            value={buyerYamatoZipCode}
                            readOnly
                            placeholder={t('checkout.address.yamatoZipPlaceholder')}
                            className="bg-gray-50"
                          />
                        </div>
                      </div>

                      {buyerSuggestions.length > 0 && (
                        <div className="rounded-md border border-gray-200 bg-white p-2">
                          <p className="text-xs text-gray-500">{t('checkout.address.suggestions')}</p>
                          <div className="flex flex-col gap-2 mt-2">
                            {buyerSuggestions.map((candidate, index) => (
                              <button
                                key={`${candidate.address}-${index}`}
                                type="button"
                                onClick={() => applyBuyerCandidate(candidate)}
                                className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-green-400 hover:bg-green-50"
                              >
                                {candidate.address}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {buyerLookupError && (
                        <div className="text-sm text-red-600">{buyerLookupError}</div>
                      )}
                      {buyerVerifyError && (
                        <div className="text-sm text-red-600">{buyerVerifyError}</div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                      {isB2s ? (
                        <>
                          {renderMapCard({
                            url: mapLinks.b2s,
                            title: t('checkout.deliveryOptions.b2sMapTitle'),
                            hint: t('checkout.deliveryOptions.b2sMapHint'),
                            cta: t('checkout.deliveryOptions.b2sMapCta'),
                            unavailable: t('checkout.deliveryOptions.b2sMapUnavailable'),
                            name: 'yamato-b2s-map',
                          })}
                          {hasB2sSelection ? (
                            renderSelectionCard(
                              mapSelections.b2s?.storeName || mapSelections.b2s?.storeId || t('checkout.deliveryOptions.b2sMapTitle'),
                              [
                                mapSelections.b2s?.storeId
                                  ? t('checkout.deliveryOptions.storeIdLabel', { id: mapSelections.b2s.storeId })
                                  : '',
                                mapSelections.b2s?.storeAddress || '',
                              ]
                            )
                          ) : (
                            <>
                              <div>
                                <Label htmlFor="storeId">{`${t('checkout.deliveryOptions.storeId')} *`}</Label>
                                <Input
                                  id="storeId"
                                  value={formData.storeId}
                                  onChange={handleInputChange('storeId')}
                                  placeholder={t('checkout.deliveryOptions.storeIdPlaceholder')}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="storeName">{t('checkout.deliveryOptions.storeName')}</Label>
                                <Input
                                  id="storeName"
                                  value={formData.storeName}
                                  onChange={handleInputChange('storeName')}
                                  placeholder={t('checkout.deliveryOptions.storeNamePlaceholder')}
                                />
                              </div>
                              <p className="text-xs text-gray-500">{t('checkout.deliveryOptions.storeAddressHint')}</p>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {renderMapCard({
                            url: mapLinks.pickup,
                            title: t('checkout.deliveryOptions.pickupMapTitle'),
                            hint: t('checkout.deliveryOptions.pickupMapHint'),
                            cta: t('checkout.deliveryOptions.pickupMapCta'),
                            unavailable: t('checkout.deliveryOptions.pickupMapUnavailable'),
                            name: 'yamato-pickup-map',
                          })}
                          {hasPickupSelection ? (
                            renderSelectionCard(
                              mapSelections.pickup?.officeName || mapSelections.pickup?.officeNo || t('checkout.deliveryOptions.pickupMapTitle'),
                              [
                                mapSelections.pickup?.officeNo
                                  ? t('checkout.deliveryOptions.stationCodeLabel', { code: mapSelections.pickup.officeNo })
                                  : '',
                                mapSelections.pickup?.officeAddress || '',
                              ]
                            )
                          ) : (
                            <>
                              <div>
                                <Label htmlFor="pickupOfficeNo">{`${t('checkout.deliveryOptions.stationNo')} *`}</Label>
                                <Input
                                  id="pickupOfficeNo"
                                  value={formData.pickupOfficeNo}
                                  onChange={handleInputChange('pickupOfficeNo')}
                                  placeholder={t('checkout.deliveryOptions.stationNoPlaceholder')}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="pickupOfficeName">{t('checkout.deliveryOptions.stationName')}</Label>
                                <Input
                                  id="pickupOfficeName"
                                  value={formData.pickupOfficeName}
                                  onChange={handleInputChange('pickupOfficeName')}
                                  placeholder={t('checkout.deliveryOptions.stationNamePlaceholder')}
                                />
                              </div>
                              <p className="text-xs text-gray-500">{t('checkout.deliveryOptions.stationAddressHint')}</p>
                            </>
                          )}
                        </>
                      )}

                      {((isB2s && !hasB2sSelection) || (isPickupStation && !hasPickupSelection)) ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="postalCode">{`${t('checkout.postalCode')} *`}</Label>
                              <Input
                                id="postalCode"
                                value={formData.postalCode}
                                onChange={handleBuyerPostalCodeChange}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="city">{`${t('checkout.city')} *`}</Label>
                              <Input id="city" value={formData.city} onChange={handleBuyerCityChange} required />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="addressStreet">{`${t('checkout.address.street')} *`}</Label>
                              <Input
                                id="addressStreet"
                                value={addressStreet}
                                onChange={handleBuyerStreetChange}
                                placeholder={t('checkout.address.streetPlaceholder')}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="addressNumber">{t('checkout.address.number')}</Label>
                              <Input
                                id="addressNumber"
                                value={addressNumber}
                                onChange={handleBuyerNumberChange}
                                placeholder={t('checkout.address.numberPlaceholder')}
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="addressLine2">{t('checkout.addressLine2')}</Label>
                            <Input
                              id="addressLine2"
                              value={formData.addressLine2}
                              onChange={handleBuyerAddressLine2Change}
                              placeholder={t('checkout.addressLine2Placeholder')}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="instructions">{t('checkout.deliveryNotes')}</Label>
                    <Textarea
                      id="instructions"
                      value={formData.instructions}
                      onChange={handleInputChange('instructions')}
                      placeholder={t('checkout.instructionsPlaceholder')}
                      rows={3}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    {isHomeDelivery ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="sm:flex-none"
                        onClick={handleSaveAddress}
                      >
                        {t('checkout.addresses.save')}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:flex-1"
                      onClick={() => navigate('/market/products')}
                    >
                      {t('cart.continueShopping')}
                    </Button>
                    <Button
                      type="submit"
                      className="sm:flex-1"
                      disabled={isSubmitting || !cartItems.length}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('checkout.payment.redirecting')}
                        </>
                      ) : (
                        t('checkout.proceedGeneric')
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.summary.title')}</CardTitle>
                <CardDescription>
                  {t('checkout.summary.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('cart.empty')}</p>
                ) : (
                  <>
                    {cartItems.map(({ product, quantity }) => (
                      <div key={product.id} className="flex gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                          {product.images && product.images[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ShoppingCart className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{product.name}</p>
                          <p className="text-xs text-gray-500">NT$ {(product.price || 0).toLocaleString()}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateCartQty(product.id, quantity - 1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="text-sm w-6 text-center">{quantity}</span>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateCartQty(product.id, quantity + 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 ml-auto" onClick={() => removeItem(product.id)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-4 flex items-center justify-between">
                      <span className="text-sm text-gray-600">{t('cart.subtotal')}</span>
                      <span className="text-lg font-bold text-green-700">NT$ {cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="mt-3 flex items-start gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg p-3">
                      <HandCoins className="w-4 h-4 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-800">Cash on delivery selected</p>
                        <p className="text-green-700">Confirm the drop-off with your farmer and pay when goods arrive.</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.help.title')}</CardTitle>
                <CardDescription>{t('checkout.help.description')}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                <p>• {t('checkout.help.point1')}</p>
                <p>• {t('checkout.help.point2')}</p>
                <p>• {t('checkout.help.point3')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={showPaymentModal} onOpenChange={(open) => (!isPlacingOrder ? setShowPaymentModal(open) : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-600" />
              {t('checkout.payment.choose')}
            </DialogTitle>
            <DialogDescription>
              {t('checkout.payment.body')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedPayment === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => option.available && setSelectedPayment(option.id)}
                  className={`w-full text-left border rounded-xl p-4 transition-all duration-200 flex items-start gap-3 ${
                    isSelected
                      ? 'border-green-600 shadow-lg shadow-green-50 bg-green-50'
                      : 'border-gray-200 hover:border-green-200 hover:shadow-md'
                  } ${!option.available ? 'opacity-70 cursor-not-allowed bg-gray-50' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-green-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{option.title}</p>
                      <Badge variant={isSelected ? 'default' : 'secondary'}>{option.badge}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                    {!option.available && (
                      <p className="text-xs text-gray-400 mt-1">{t('checkout.payment.lineDisabledNote')}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {orderError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('checkout.errors.failed')}</AlertTitle>
              <AlertDescription>{orderError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentModal(false)} disabled={isPlacingOrder}>
              {t('checkout.payment.cancel')}
            </Button>
            <Button
              onClick={placeOrder}
              disabled={selectedPayment !== 'cod' || isPlacingOrder}
              className="flex-1"
            >
              {isPlacingOrder ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('checkout.payment.redirecting')}
                </>
              ) : (
                t('checkout.payment.confirmCod')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutPage;
