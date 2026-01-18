import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveApiBaseUrl } from '@/lib/api';
import { ShoppingCart, ArrowLeft, Loader2, Minus, Plus, X, AlertTriangle, Info, CheckCircle2, Sparkles, HandCoins, CreditCard, MapPin } from 'lucide-react';
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

type ShippingForm = {
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  instructions: string;
};

type SavedAddress = ShippingForm & { id: string; label: string };

type LinePayStatus = {
  configured: boolean;
  hasChannelId: boolean;
  hasChannelSecret: boolean;
  sandbox?: boolean;
  frontendBaseUrl?: string;
  sampleConfirmUrl?: string;
  apiBaseUrl?: string;
  issues?: string[];
};

const defaultForm: ShippingForm = {
  fullName: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  instructions: '',
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
  const [linePayStatus, setLinePayStatus] = useState<LinePayStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<'cod' | 'line_pay'>('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [mobileStep, setMobileStep] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
    const fetchStatus = async () => {
      try {
        setStatusError(null);
        const apiBaseUrl = resolveApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/payments/line-pay/status`);
        if (!response.ok) {
          throw new Error('Unable to read LINE Pay configuration.');
        }
        const payload = await response.json();
        setLinePayStatus(payload);
      } catch (error: any) {
        console.warn('LINE Pay status check failed', error);
        setStatusError(error?.message || 'Unable to verify LINE Pay configuration.');
      }
    };
    fetchStatus();
  }, []);


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

  const buyerLookupQuery = buildBuyerAddressQuery();
  const debouncedBuyerQuery = useDebouncedValue(buyerLookupQuery, 400);

  useEffect(() => {
    buyerQueryRef.current = buyerLookupQuery;
  }, [buyerLookupQuery]);

  useEffect(() => {
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
  }, [debouncedBuyerQuery, t]);

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

  const clearBuyerLookupState = () => {
    setBuyerSuggestions([]);
    setBuyerLookupError(null);
  };

  const clearBuyerVerification = () => {
    setBuyerPostNumber('');
    setBuyerYamatoZipCode('');
    setBuyerVerifyError(null);
  };

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
    setFormData({
      fullName: addr.fullName,
      phone: formatTaiwanPhoneInput(addr.phone),
      email: addr.email,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      city: addr.city,
      postalCode: addr.postalCode,
      instructions: addr.instructions,
    });
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
      if (!formData.addressLine1.trim() || !formData.city.trim() || !formData.postalCode.trim()) {
        toast({
          title: t('checkout.errors.missingInfoTitle'),
          description: t('checkout.errors.missingInfoDescription'),
          variant: 'destructive',
        });
        return;
      }
      if (!buyerYamatoZipCode) {
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
    if (!validateForm()) return;
    const label =
      prompt(t('checkout.addresses.promptLabel'))?.trim() ||
      t('checkout.addresses.defaultLabel');
    const newAddress: SavedAddress = {
      ...formData,
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

    if (!buyerYamatoZipCode) {
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
          shipping: {
            ...formData,
            phone: normalizeTaiwanPhoneDigits(formData.phone),
          },
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
                      {savedAddresses.length > 0 && (
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
                      <Button type="button" variant="outline" onClick={handleSaveAddress}>
                        {t('checkout.addresses.save')}
                      </Button>
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
                {savedAddresses.length > 0 && (
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
                    <Button
                      type="button"
                      variant="ghost"
                      className="sm:flex-none"
                      onClick={handleSaveAddress}
                    >
                      {t('checkout.addresses.save')}
                    </Button>
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
                <CardTitle>Payments & LINE Pay (optional)</CardTitle>
                <CardDescription>
                  Cash on delivery is ready now. Keep these notes handy if you want to re-enable LINE Pay.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                {linePayStatus && !linePayStatus.configured && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Missing configuration detected</AlertTitle>
                    <AlertDescription className="text-xs text-gray-700">
                      {linePayStatus.issues?.join(' ') || 'Add your LINE Pay channel credentials to the environment.'}
                    </AlertDescription>
                  </Alert>
                )}
                {statusError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Status check failed</AlertTitle>
                    <AlertDescription className="text-xs text-gray-700">{statusError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-1 text-green-700" />
                  <p>
                    Store your LINE Pay Channel ID and Channel Secret in
                    <code className="mx-1 text-xs bg-gray-100 px-1 rounded">LINE_PAY_CHANNEL_ID</code>
                    and
                    <code className="mx-1 text-xs bg-gray-100 px-1 rounded">LINE_PAY_CHANNEL_SECRET</code>
                    (or via <code className="text-xs bg-gray-100 px-1 rounded">firebase functions:config:set linepay.*</code>).
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-1 text-green-700" />
                  <p>
                    Confirm URL must point to
                    <code className="mx-1 text-xs bg-gray-100 px-1 rounded">{linePayStatus?.sampleConfirmUrl || 'https://{your-domain}/payments/line-pay/result'}</code>
                    . Use the same path with <code className="text-xs bg-gray-100 px-1 rounded">?status=cancelled</code> for cancellations.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-1 text-green-700" />
                  <p>
                    Register the domain hosting this site inside your LINE Pay console and LIFF app allowed domains list.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-1 text-green-700" />
                  <p>
                    Sandbox mode is currently
                    <span className="font-semibold ml-1">{linePayStatus?.sandbox === false ? 'disabled (production)' : 'enabled'}</span>.
                    Toggle with <code className="text-xs bg-gray-100 px-1 rounded">LINE_PAY_SANDBOX</code> when promoting to live.
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Need every step? Open <span className="font-medium">LINE_PAY_SETUP_GUIDE.md</span> in the repo for the full checklist.
                </p>
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
