import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DatabaseService, Store } from '@/lib/database';
import { AddressCandidate, lookupAddress, reverseLookupAddress, resolveYamatoZip } from '@/lib/address';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useIsMobile } from '@/hooks/use-mobile';
import { MapPin, Phone, RefreshCw, Users, Search, Plus, TrendingUp, Target, CheckCircle, Clock, XCircle, Mail, Globe } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Timestamp } from 'firebase/firestore';
import StoresMap from '@/components/StoresMap';

const storeStatuses: Store['status'][] = ['potential', 'contacted', 'customer', 'former_customer'];

const formatDate = (timestamp?: Timestamp) => {
  if (!timestamp) return '';
  try {
    return timestamp.toDate().toLocaleDateString();
  } catch (error) {
    console.error('Failed to format date:', error);
    return '';
  }
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

const normalizeTaiwanMobile = (value: string) => normalizeTaiwanPhoneDigits(value);

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
  if (digits.startsWith('09')) {
    return formatTaiwanMobileInput(digits);
  }
  return normalizeTaiwanTelInput(value);
};

const isValidTaiwanMobile = (value: string) => /^09\\d{8}$/.test(normalizeTaiwanMobile(value));

const isValidTaiwanTel = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return false;
  if (!digits.startsWith('0') || digits.startsWith('09')) return false;
  return digits.length >= 9 && digits.length <= 10;
};

  const FarmerStores: React.FC = () => {
    const { t } = useLanguage();
    const isMobile = useIsMobile();
  const { user, userStores, refreshUserData, isLoading, isRefreshingData } = useAuth();
  const queryClient = useQueryClient();
  const showAddStore = user?.role !== 'farmer';
  const [searchTerm, setSearchTerm] = useState('');
  const [addressFilter, setAddressFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Store['status']>('all');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const storeLocationRef = useRef('');
  const storeAutoFillRef = useRef<string | null>(null);
  const storeLookupIdRef = useRef(0);
  const [formData, setFormData] = useState({
    name: '',
    type: 'mixed' as Store['type'],
    location: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    contactWebsite: '',
    notes: '',
    pickupPostNumber: '',
    pickupYamatoZipCode: ''
  });
  const [isVerifyingPickup, setIsVerifyingPickup] = useState(false);
  const [pickupVerifyError, setPickupVerifyError] = useState<string | null>(null);
  const [pickupLookupError, setPickupLookupError] = useState<string | null>(null);
  const [pickupSuggestions, setPickupSuggestions] = useState<AddressCandidate[]>([]);
  const [isPickupSearching, setIsPickupSearching] = useState(false);
  const debouncedStoreLocation = useDebouncedValue(formData.location, 400);
  const [mobileStoreStep, setMobileStoreStep] = useState(0);

  const storesKey = useMemo(() => ['farmer-stores', user?.id], [user?.id]);
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: storesKey,
    enabled: Boolean(user?.id),
    queryFn: async () => (queryClient.getQueryData(storesKey) as Store[]) || [],
    staleTime: Infinity,
    cacheTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    initialData: () => (userStores as Store[]) || undefined,
    keepPreviousData: true,
  });
  const hasStores = (stores?.length ?? 0) > 0;
  const previousUserIdRef = useRef<string | null>(null);

  const handleRefresh = async () => {
    if (!user?.id || isRefreshingData) {
      return;
    }

    try {
      await refreshUserData();
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to refresh stores:', error);
    }
  };

  // Auto-fetch data on page load and when user changes
  React.useEffect(() => {
    if (!user?.id) {
      previousUserIdRef.current = null;
      return;
    }

    if (previousUserIdRef.current === user.id) {
      return;
    }

    previousUserIdRef.current = user.id;

    refreshUserData()
      .then(() => setLastRefreshTime(new Date()))
      .catch((error) => {
        console.error('Failed to load stores data:', error);
      });
  }, [user?.id, refreshUserData]);

  useEffect(() => {
    if (stores?.length) {
      setLastRefreshTime(new Date());
    }
  }, [stores]);

  React.useEffect(() => {
    storeLocationRef.current = formData.location;
  }, [formData.location]);

  React.useEffect(() => {
    if (isDialogOpen) {
      setMobileStoreStep(0);
    }
  }, [isDialogOpen]);

  const storeStepTotal = 4;
  const stepLabel = (current: number, total: number) =>
    t('common.stepOf')
      .replace('{current}', String(current))
      .replace('{total}', String(total));
  const resolveContactPhoneError = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isValidTaiwanMobile(trimmed) || isValidTaiwanTel(trimmed)) {
      return null;
    }
    return t('farmer.stores.validation.invalidPhone');
  };
  const updateContactPhoneError = (value: string) => {
    const error = resolveContactPhoneError(value);
    setFormErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next.contactPhone = error;
      } else {
        delete next.contactPhone;
      }
      return next;
    });
  };

  const handleStoreNextStep = () => {
    const errors: Record<string, string> = {};
    if (mobileStoreStep === 0 && !formData.name.trim()) {
      errors.name = t('farmer.stores.validation.nameRequired');
    }
    if (mobileStoreStep === 1) {
      if (!formData.location.trim()) {
        errors.location = t('farmer.stores.validation.locationRequired');
      }
      if (formData.location.trim() && !formData.pickupYamatoZipCode.trim()) {
        errors.pickup = t('farmer.stores.validation.pickupVerifyRequired');
      }
    }
    if (mobileStoreStep === 2) {
      const contactError = resolveContactPhoneError(formData.contactPhone);
      if (contactError) {
        errors.contactPhone = contactError;
      }
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setMobileStoreStep((prev) => Math.min(prev + 1, storeStepTotal - 1));
  };

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || store.status === statusFilter;
      const addressBlob = `${store.location} ${store.pickup?.address || ''}`.toLowerCase();
      const matchesAddress = !addressFilter.trim() || addressBlob.includes(addressFilter.toLowerCase());
      return matchesSearch && matchesStatus && matchesAddress;
    });
  }, [stores, searchTerm, statusFilter, addressFilter]);

  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    storeStatuses.forEach((status) => {
      summary[status] = stores.filter((store) => store.status === status).length;
    });
    return summary;
  }, [stores]);

  const handleStatusUpdate = async (store: Store, newStatus: Store['status']) => {
    if (store.status === newStatus) return;
    setIsUpdating(true);
    try {
      await DatabaseService.updateStore(store.id, {
        status: newStatus,
        metadata: {
          ...store.metadata,
          notes: store.metadata?.notes || []
        }
      });
      await refreshUserData();
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to update store status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = t('farmer.stores.validation.nameRequired');
    }
    
    if (!formData.location.trim()) {
      errors.location = t('farmer.stores.validation.locationRequired');
    }

    if (formData.location.trim() && !formData.pickupYamatoZipCode.trim()) {
      errors.pickup = t('farmer.stores.validation.pickupVerifyRequired');
    }

    const contactPhoneError = resolveContactPhoneError(formData.contactPhone);
    if (contactPhoneError) {
      errors.contactPhone = contactPhoneError;
    }
    
    // Email validation if provided
    if (formData.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
      errors.contactEmail = t('farmer.stores.validation.invalidEmail');
    }
    
    // Website validation if provided
    if (formData.contactWebsite.trim() && !/^https?:\/\/.+/.test(formData.contactWebsite.trim())) {
      errors.contactWebsite = t('farmer.stores.validation.invalidWebsite');
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const requestCurrentLocation = () =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        reject(new Error(t('farmer.stores.pickupGeoUnavailable')));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => reject(new Error(t('farmer.stores.pickupGeoDenied')))
      );
    });

  const handleLookupStoreAddress = async () => {
    const query = formData.location.trim();
    if (!query) {
      setPickupLookupError(t('farmer.stores.pickupLookupRequired'));
      return;
    }
    setIsPickupSearching(true);
    setPickupLookupError(null);
    try {
      const result = await lookupAddress(query);
      if (result.candidates.length === 0) {
        setPickupLookupError(t('farmer.stores.pickupLookupEmpty'));
      }
      setPickupSuggestions(result.candidates);
      const topCandidate = result.candidates[0];
      if (topCandidate?.address && topCandidate.address.startsWith(query)) {
        storeAutoFillRef.current = topCandidate.address;
        setFormData((prev) => ({
          ...prev,
          location: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setPickupLookupError(error?.message || t('farmer.stores.pickupLookupFailed'));
    } finally {
      setIsPickupSearching(false);
    }
  };

  const handleUseLocationForStore = async () => {
    setIsPickupSearching(true);
    setPickupLookupError(null);
    try {
      const { lat, lng } = await requestCurrentLocation();
      const result = await reverseLookupAddress(lat, lng);
      if (result.candidates.length === 0) {
        setPickupLookupError(t('farmer.stores.pickupLookupEmpty'));
      }
      setPickupSuggestions(result.candidates);
      const topCandidate = result.candidates[0];
      if (topCandidate?.address) {
        storeAutoFillRef.current = topCandidate.address;
        setFormData((prev) => ({
          ...prev,
          location: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setPickupLookupError(error?.message || t('farmer.stores.pickupLookupFailed'));
    } finally {
      setIsPickupSearching(false);
    }
  };

  React.useEffect(() => {
    const query = debouncedStoreLocation.trim();
    if (query.length < 3) {
      storeLookupIdRef.current += 1;
      setPickupSuggestions([]);
      setPickupLookupError(null);
      return;
    }
    if (storeAutoFillRef.current === query) {
      storeAutoFillRef.current = null;
      return;
    }
    const lookupId = (storeLookupIdRef.current += 1);
    setPickupLookupError(null);
    lookupAddress(query)
      .then((result) => {
        if (storeLookupIdRef.current !== lookupId) return;
        if (storeLocationRef.current.trim() !== query) return;
        setPickupSuggestions(result.candidates);
        if (result.candidates.length === 0) {
          setPickupLookupError(t('farmer.stores.pickupLookupEmpty'));
          return;
        }
        const topCandidate = result.candidates[0];
        if (
          topCandidate?.address &&
          topCandidate.address !== storeLocationRef.current.trim() &&
          topCandidate.address.startsWith(query)
        ) {
          storeAutoFillRef.current = topCandidate.address;
          setFormData((prev) => ({
            ...prev,
            location: topCandidate.address,
            pickupPostNumber: '',
            pickupYamatoZipCode: ''
          }));
        }
      })
      .catch((error: any) => {
        if (storeLookupIdRef.current !== lookupId) return;
        if (storeLocationRef.current.trim() !== query) return;
        setPickupLookupError(error?.message || t('farmer.stores.pickupLookupFailed'));
      })
      .finally(() => {
        if (storeLookupIdRef.current !== lookupId) return;
      });
  }, [debouncedStoreLocation, t]);

  const applyStoreSuggestion = (candidate: AddressCandidate) => {
    setFormData((prev) => ({
      ...prev,
      location: candidate.address,
      pickupPostNumber: '',
      pickupYamatoZipCode: ''
    }));
    setPickupSuggestions([]);
    setPickupLookupError(null);
    setPickupVerifyError(null);
  };

  const handleVerifyStoreAddress = async () => {
    const address = formData.location.trim();
    if (!address) {
      setPickupVerifyError(t('farmer.stores.pickupAddressRequired'));
      return;
    }
    setPickupVerifyError(null);
    setIsVerifyingPickup(true);
    try {
      const result = await resolveYamatoZip(address);
      setFormData((prev) => ({
        ...prev,
        location: result.normalizedAddress || prev.location,
        pickupPostNumber: result.postNumber,
        pickupYamatoZipCode: result.yamatoZipCode
      }));
      setPickupSuggestions([]);
    } catch (error: any) {
      setPickupVerifyError(error?.message || t('farmer.stores.pickupVerifyFailed'));
    } finally {
      setIsVerifyingPickup(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Build contact object with only defined values
      const contact: any = {};
      const normalizedContactPhone = normalizeTaiwanPhoneDigits(formData.contactPhone);
      if (formData.contactName.trim()) contact.name = formData.contactName.trim();
      if (normalizedContactPhone) contact.phone = normalizedContactPhone;
      if (formData.contactEmail.trim()) contact.email = formData.contactEmail.trim();
      if (formData.contactWebsite.trim()) contact.website = formData.contactWebsite.trim();
      const pickup =
        formData.location.trim()
          ? {
              address: formData.location.trim(),
              yamatoZipCode: formData.pickupYamatoZipCode.trim(),
              postNumber: formData.pickupPostNumber.trim(),
              contactName: formData.contactName.trim() || formData.name.trim(),
              contactTel: normalizeTaiwanPhoneDigits(formData.contactPhone),
              verifiedAt: formData.pickupYamatoZipCode ? Timestamp.now() : undefined
            }
          : undefined;

      console.log('Creating store for user:', user.id, 'with data:', formData);
      const result = await DatabaseService.createStore(user.id, {
        name: formData.name.trim(),
        type: formData.type,
        location: formData.location.trim(),
        contact: Object.keys(contact).length > 0 ? contact : undefined,
        pickup,
        metadata: {
          notes: formData.notes.trim() ? [formData.notes.trim()] : []
        }
      });
      console.log('Store created successfully:', result);
      await refreshUserData();
      setLastRefreshTime(new Date());
      setIsDialogOpen(false);
      setFormData({
        name: '',
        type: 'other',
        location: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        contactWebsite: '',
        notes: '',
        pickupPostNumber: '',
        pickupYamatoZipCode: ''
      });
      setFormErrors({});
      setPickupSuggestions([]);
      setPickupLookupError(null);
      setPickupVerifyError(null);
    } catch (error) {
      console.error('Failed to create store:', error);
      alert('Failed to create store. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="hidden md:block bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">{t('farmer.stores.title')}</h1>
            <p className="text-purple-100 text-lg">{t('farmer.stores.subtitle')}</p>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-purple-300 rounded-full mr-2"></div>
                <span>{filteredStores.length} {t('farmer.stores.stores')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-2"></div>
                <span>{statusSummary.customer || 0} {t('farmer.stores.customers')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-300 rounded-full mr-2"></div>
                <span>{statusSummary.potential || 0} {t('farmer.stores.prospects')}</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <MapPin className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">{t('farmer.stores.directory')}</h2>
            <p className="text-xs text-gray-500 md:text-gray-600">{t('farmer.stores.directoryDescription')}</p>
            {lastRefreshTime && (
              <p className="hidden md:block text-sm text-gray-500 mt-1">
                Last updated: {lastRefreshTime.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 md:hidden">
            {showAddStore && (
              <Button
                size="sm"
                className="h-9 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                onClick={() => setIsDialogOpen(true)}
                data-tour="stores-add"
              >
                <Plus className="w-4 h-4 mr-1" /> {t('farmer.stores.addStore')}
              </Button>
            )}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshingData}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${(isLoading || isRefreshingData) ? 'animate-spin' : ''}`} /> 
            {isLoading || isRefreshingData ? 'Refreshing...' : t('farmer.stores.refresh')}
          </Button>
          {showAddStore && (
            <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (open) {
                setPickupVerifyError(null);
                setPickupLookupError(null);
                setPickupSuggestions([]);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                data-tour="stores-add"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('farmer.stores.addStore')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('farmer.stores.createNew')}</DialogTitle>
                <DialogDescription>{t('farmer.stores.createDescription')}</DialogDescription>
              </DialogHeader>
              <form className="space-y-6" onSubmit={handleSubmit}>
                {isMobile ? (
                  <div className="space-y-6">
                    <div className="text-xs font-semibold text-gray-500">
                      {stepLabel(mobileStoreStep + 1, storeStepTotal)}
                    </div>
                    <div key={`store-step-${mobileStoreStep}`} className="space-y-6 animate-in fade-in-0 slide-in-from-right-2 duration-300">
                      {mobileStoreStep === 0 && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.storeName')} *</label>
                            <Input
                              value={formData.name}
                              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                              placeholder={t('farmer.stores.storeNamePlaceholder')}
                              className={`h-11 ${formErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                              required
                            />
                            {formErrors.name && (
                              <p className="text-sm text-red-600 flex items-center">
                                <span className="w-4 h-4 mr-1">⚠️</span>
                                {formErrors.name}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.storeType')}</label>
                            <Select value={formData.type} onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as Store['type'] }))}>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder={t('farmer.stores.selectType')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="vegetable">{t('farmer.stores.type.vegetable')}</SelectItem>
                                <SelectItem value="fruit">{t('farmer.stores.type.fruit')}</SelectItem>
                                <SelectItem value="poultry">{t('farmer.stores.type.poultry')}</SelectItem>
                                <SelectItem value="livestock">{t('farmer.stores.type.livestock')}</SelectItem>
                                <SelectItem value="dairy">{t('farmer.stores.type.dairy')}</SelectItem>
                                <SelectItem value="aquaculture">{t('farmer.stores.type.aquaculture')}</SelectItem>
                                <SelectItem value="grains">{t('farmer.stores.type.grains')}</SelectItem>
                                <SelectItem value="flowers">{t('farmer.stores.type.flowers')}</SelectItem>
                                <SelectItem value="mixed">{t('farmer.stores.type.mixed')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      {mobileStoreStep === 1 && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.location')} *</label>
                            <Input
                              value={formData.location}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setFormData((prev) => ({
                                  ...prev,
                                  location: nextValue,
                                  pickupPostNumber: '',
                                  pickupYamatoZipCode: ''
                                }));
                                setPickupVerifyError(null);
                                setPickupLookupError(null);
                                setPickupSuggestions([]);
                              }}
                              placeholder={t('farmer.stores.locationPlaceholder')}
                              className={`h-11 ${formErrors.location ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                              required
                            />
                            {formErrors.location && (
                              <p className="text-sm text-red-600 flex items-center">
                                <span className="w-4 h-4 mr-1">⚠️</span>
                                {formErrors.location}
                              </p>
                            )}
                          </div>

                          <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                            <div className="flex flex-col gap-3">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-800">{t('farmer.stores.pickupSectionTitle')}</h3>
                                <p className="text-xs text-gray-500">{t('farmer.stores.pickupSectionHint')}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleUseLocationForStore}
                                  disabled={isPickupSearching}
                                  className="gap-2"
                                >
                                  {isPickupSearching ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      {t('farmer.stores.pickupSearching')}
                                    </>
                                  ) : (
                                    <>
                                      <MapPin className="w-4 h-4" />
                                      {t('farmer.stores.pickupUseLocation')}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleLookupStoreAddress}
                                  disabled={isPickupSearching || !formData.location.trim()}
                                >
                                  {t('farmer.stores.pickupSearch')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleVerifyStoreAddress}
                                  disabled={isVerifyingPickup || !formData.location.trim()}
                                  className="gap-2"
                                >
                                  {isVerifyingPickup ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      {t('farmer.stores.pickupVerifying')}
                                    </>
                                  ) : (
                                    t('farmer.stores.pickupVerify')
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.pickupPostNumber')}</label>
                                <Input
                                  value={formData.pickupPostNumber}
                                  readOnly
                                  placeholder={t('farmer.stores.pickupPostNumberPlaceholder')}
                                  className="h-11 bg-gray-50"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.pickupYamatoZipCode')}</label>
                                <Input
                                  value={formData.pickupYamatoZipCode}
                                  readOnly
                                  placeholder={t('farmer.stores.pickupYamatoZipCodePlaceholder')}
                                  className="h-11 bg-gray-50"
                                />
                              </div>
                            </div>
                            {pickupSuggestions.length > 0 && (
                              <div className="rounded-md border border-gray-200 bg-white p-2">
                                <p className="text-xs text-gray-500">{t('farmer.stores.pickupSuggestions')}</p>
                                <div className="flex flex-col gap-2 mt-2">
                                  {pickupSuggestions.map((candidate, index) => (
                                    <button
                                      key={`${candidate.address}-${index}`}
                                      type="button"
                                      onClick={() => applyStoreSuggestion(candidate)}
                                      className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-purple-400 hover:bg-purple-50"
                                    >
                                      {candidate.address}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {pickupLookupError && (
                              <div className="text-sm text-red-600">{pickupLookupError}</div>
                            )}
                            {pickupVerifyError && (
                              <div className="text-sm text-red-600">{pickupVerifyError}</div>
                            )}
                            {formErrors.pickup && (
                              <div className="text-sm text-red-600">{formErrors.pickup}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {mobileStoreStep === 2 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-800">{t('farmer.stores.contactInfo')}</h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.contactName')}</label>
                              <Input
                                value={formData.contactName}
                                onChange={(event) => setFormData((prev) => ({ ...prev, contactName: event.target.value }))}
                                placeholder={t('farmer.stores.contactNamePlaceholder')}
                                className="h-11"
                              />
                            </div>
                            <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.contactPhone')}</label>
                            <Input
                              value={formData.contactPhone}
                              onChange={(event) => {
                                const nextValue = formatTaiwanPhoneInput(event.target.value);
                                setFormData((prev) => ({ ...prev, contactPhone: nextValue }));
                                updateContactPhoneError(nextValue);
                              }}
                              placeholder={t('farmer.stores.contactPhonePlaceholder')}
                              className="h-11"
                            />
                            {formErrors.contactPhone && (
                              <p className="text-sm text-red-600 flex items-center">
                                <span className="w-4 h-4 mr-1">⚠️</span>
                                {formErrors.contactPhone}
                              </p>
                            )}
                          </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.contactEmail')}</label>
                              <Input
                                type="email"
                                value={formData.contactEmail}
                                onChange={(event) => setFormData((prev) => ({ ...prev, contactEmail: event.target.value }))}
                                placeholder={t('farmer.stores.contactEmailPlaceholder')}
                                className={`h-11 ${formErrors.contactEmail ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                              />
                              {formErrors.contactEmail && (
                                <p className="text-sm text-red-600 flex items-center">
                                  <span className="w-4 h-4 mr-1">⚠️</span>
                                  {formErrors.contactEmail}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.contactWebsite')}</label>
                              <Input
                                value={formData.contactWebsite}
                                onChange={(event) => setFormData((prev) => ({ ...prev, contactWebsite: event.target.value }))}
                                placeholder={t('farmer.stores.contactWebsitePlaceholder')}
                                className={`h-11 ${formErrors.contactWebsite ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                              />
                              {formErrors.contactWebsite && (
                                <p className="text-sm text-red-600 flex items-center">
                                  <span className="w-4 h-4 mr-1">⚠️</span>
                                  {formErrors.contactWebsite}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {mobileStoreStep === 3 && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.notes')}</label>
                            <textarea
                              value={formData.notes}
                              onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                              placeholder={t('farmer.stores.notesPlaceholder')}
                              className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t pt-4">
                      {mobileStoreStep === 0 ? (
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="px-5">
                          {t('common.cancel')}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setFormErrors({});
                            setMobileStoreStep((prev) => Math.max(prev - 1, 0));
                          }}
                          className="px-5"
                        >
                          {t('common.back')}
                        </Button>
                      )}
                      {mobileStoreStep < storeStepTotal - 1 ? (
                        <Button type="button" onClick={handleStoreNextStep} className="px-6">
                          {t('common.next')}
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          disabled={isSubmitting || isLoading || isRefreshingData}
                          className="px-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                        >
                          {isSubmitting ? (
                            <div className="flex items-center">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              {t('farmer.stores.saving')}
                            </div>
                          ) : (
                            t('farmer.stores.saveStore')
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.storeName')} *</label>
                        <Input
                          value={formData.name}
                          onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder={t('farmer.stores.storeNamePlaceholder')}
                          className={`h-11 ${formErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                          required
                        />
                        {formErrors.name && (
                          <p className="text-sm text-red-600 flex items-center">
                            <span className="w-4 h-4 mr-1">⚠️</span>
                            {formErrors.name}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.storeType')}</label>
                      <Select value={formData.type} onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as Store['type'] }))}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={t('farmer.stores.selectType')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vegetable">{t('farmer.stores.type.vegetable')}</SelectItem>
                          <SelectItem value="fruit">{t('farmer.stores.type.fruit')}</SelectItem>
                          <SelectItem value="poultry">{t('farmer.stores.type.poultry')}</SelectItem>
                          <SelectItem value="livestock">{t('farmer.stores.type.livestock')}</SelectItem>
                          <SelectItem value="dairy">{t('farmer.stores.type.dairy')}</SelectItem>
                          <SelectItem value="aquaculture">{t('farmer.stores.type.aquaculture')}</SelectItem>
                          <SelectItem value="grains">{t('farmer.stores.type.grains')}</SelectItem>
                          <SelectItem value="flowers">{t('farmer.stores.type.flowers')}</SelectItem>
                          <SelectItem value="mixed">{t('farmer.stores.type.mixed')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.location')} *</label>
                      <Input
                        value={formData.location}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            location: nextValue,
                            pickupPostNumber: '',
                            pickupYamatoZipCode: ''
                          }));
                          setPickupVerifyError(null);
                          setPickupLookupError(null);
                          setPickupSuggestions([]);
                        }}
                        placeholder={t('farmer.stores.locationPlaceholder')}
                        className={`h-11 ${formErrors.location ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        required
                      />
                      {formErrors.location && (
                        <p className="text-sm text-red-600 flex items-center">
                          <span className="w-4 h-4 mr-1">⚠️</span>
                          {formErrors.location}
                        </p>
                      )}
                    </div>

                    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">{t('farmer.stores.pickupSectionTitle')}</h3>
                          <p className="text-xs text-gray-500">{t('farmer.stores.pickupSectionHint')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleUseLocationForStore}
                            disabled={isPickupSearching}
                            className="gap-2"
                          >
                            {isPickupSearching ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                {t('farmer.stores.pickupSearching')}
                              </>
                            ) : (
                              <>
                                <MapPin className="w-4 h-4" />
                                {t('farmer.stores.pickupUseLocation')}
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleLookupStoreAddress}
                            disabled={isPickupSearching || !formData.location.trim()}
                          >
                            {t('farmer.stores.pickupSearch')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleVerifyStoreAddress}
                            disabled={isVerifyingPickup || !formData.location.trim()}
                            className="gap-2"
                          >
                            {isVerifyingPickup ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                {t('farmer.stores.pickupVerifying')}
                              </>
                            ) : (
                              t('farmer.stores.pickupVerify')
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.pickupPostNumber')}</label>
                          <Input
                            value={formData.pickupPostNumber}
                            readOnly
                            placeholder={t('farmer.stores.pickupPostNumberPlaceholder')}
                            className="h-11 bg-gray-50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.pickupYamatoZipCode')}</label>
                          <Input
                            value={formData.pickupYamatoZipCode}
                            readOnly
                            placeholder={t('farmer.stores.pickupYamatoZipCodePlaceholder')}
                            className="h-11 bg-gray-50"
                          />
                        </div>
                      </div>
                      {pickupSuggestions.length > 0 && (
                        <div className="rounded-md border border-gray-200 bg-white p-2">
                          <p className="text-xs text-gray-500">{t('farmer.stores.pickupSuggestions')}</p>
                          <div className="flex flex-col gap-2 mt-2">
                            {pickupSuggestions.map((candidate, index) => (
                              <button
                                key={`${candidate.address}-${index}`}
                                type="button"
                                onClick={() => applyStoreSuggestion(candidate)}
                                className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-purple-400 hover:bg-purple-50"
                              >
                                {candidate.address}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {pickupLookupError && (
                        <div className="text-sm text-red-600">{pickupLookupError}</div>
                      )}
                      {pickupVerifyError && (
                        <div className="text-sm text-red-600">{pickupVerifyError}</div>
                      )}
                      {formErrors.pickup && (
                        <div className="text-sm text-red-600">{formErrors.pickup}</div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">{t('farmer.stores.contactInfo')}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.contactName')}</label>
                          <Input
                            value={formData.contactName}
                            onChange={(event) => setFormData((prev) => ({ ...prev, contactName: event.target.value }))}
                            placeholder={t('farmer.stores.contactNamePlaceholder')}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.contactPhone')}</label>
                          <Input
                            value={formData.contactPhone}
                            onChange={(event) => {
                              const nextValue = formatTaiwanPhoneInput(event.target.value);
                              setFormData((prev) => ({ ...prev, contactPhone: nextValue }));
                              updateContactPhoneError(nextValue);
                            }}
                            placeholder={t('farmer.stores.contactPhonePlaceholder')}
                            className="h-11"
                          />
                          {formErrors.contactPhone && (
                            <p className="text-sm text-red-600 flex items-center">
                              <span className="w-4 h-4 mr-1">⚠️</span>
                              {formErrors.contactPhone}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.contactEmail')}</label>
                          <Input
                            type="email"
                            value={formData.contactEmail}
                            onChange={(event) => setFormData((prev) => ({ ...prev, contactEmail: event.target.value }))}
                            placeholder={t('farmer.stores.contactEmailPlaceholder')}
                            className={`h-11 ${formErrors.contactEmail ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {formErrors.contactEmail && (
                            <p className="text-sm text-red-600 flex items-center">
                              <span className="w-4 h-4 mr-1">⚠️</span>
                              {formErrors.contactEmail}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.contactWebsite')}</label>
                          <Input
                            value={formData.contactWebsite}
                            onChange={(event) => setFormData((prev) => ({ ...prev, contactWebsite: event.target.value }))}
                            placeholder={t('farmer.stores.contactWebsitePlaceholder')}
                            className={`h-11 ${formErrors.contactWebsite ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {formErrors.contactWebsite && (
                            <p className="text-sm text-red-600 flex items-center">
                              <span className="w-4 h-4 mr-1">⚠️</span>
                              {formErrors.contactWebsite}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">{t('farmer.stores.notes')}</label>
                      <textarea
                        value={formData.notes}
                        onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder={t('farmer.stores.notesPlaceholder')}
                        className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="px-6">
                        {t('farmer.stores.cancel')}
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting || isLoading || isRefreshingData}
                        className="px-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            {t('farmer.stores.saving')}
                          </div>
                        ) : (
                          t('farmer.stores.saveStore')
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="md:hidden flex items-center justify-between rounded-xl border border-purple-100 bg-white/90 px-3 py-2 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-gray-900">{t('farmer.stores.leadPipeline')}</span>
          <span className="text-[11px] text-gray-500">{t('farmer.stores.map.title')}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshingData}
          aria-label={t('farmer.stores.refresh')}
        >
          <RefreshCw className={`w-4 h-4 ${(isLoading || isRefreshingData) ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className="md:hidden shadow-lg border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            {t('farmer.stores.leadPipeline')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[
              { status: 'potential', label: t('farmer.stores.prospectsTitle'), icon: Target, textColor: 'text-blue-600', bgColor: 'bg-blue-50' },
              { status: 'contacted', label: t('farmer.stores.contactedTitle'), icon: Clock, textColor: 'text-yellow-600', bgColor: 'bg-yellow-50' },
              { status: 'customer', label: t('farmer.stores.customersTitle'), icon: CheckCircle, textColor: 'text-green-600', bgColor: 'bg-green-50' },
              { status: 'former_customer', label: t('farmer.stores.formerTitle'), icon: XCircle, textColor: 'text-gray-600', bgColor: 'bg-gray-50' }
            ].map(({ status, label, icon: Icon, textColor, bgColor }) => (
              <div key={status} className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 ${bgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${textColor}`} />
                  </div>
                  <span className="text-lg font-semibold text-gray-900">{statusSummary[status] || 0}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-gray-600">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="hidden md:block shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            {t('farmer.stores.leadPipeline')}
          </CardTitle>
          <CardDescription className="text-base">{t('farmer.stores.pipelineDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasStores && (isLoading || isRefreshingData) ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Loading stores...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg mb-2">{t('farmer.stores.noStoresRecorded')}</p>
              <p className="text-sm text-gray-400">{t('farmer.stores.startAdding')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { status: 'potential', label: t('farmer.stores.prospectsTitle'), icon: Target, color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
                { status: 'contacted', label: t('farmer.stores.contactedTitle'), icon: Clock, color: 'from-yellow-500 to-yellow-600', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' },
                { status: 'customer', label: t('farmer.stores.customersTitle'), icon: CheckCircle, color: 'from-green-500 to-green-600', bgColor: 'bg-green-50', textColor: 'text-green-600' },
                { status: 'former_customer', label: t('farmer.stores.formerTitle'), icon: XCircle, color: 'from-gray-500 to-gray-600', bgColor: 'bg-gray-50', textColor: 'text-gray-600' }
              ].map(({ status, label, icon: Icon, color, bgColor, textColor }) => (
                <div key={status} className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 rounded-xl p-6 hover:border-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${textColor}`} />
                    </div>
                    <span className="text-3xl font-bold text-gray-900">{statusSummary[status] || 0}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">{label}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                    <div 
                      className={`bg-gradient-to-r ${color} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${stores.length > 0 ? ((statusSummary[status] || 0) / stores.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stores Map Section */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            {t('farmer.stores.map.title')}
          </CardTitle>
          <CardDescription className="text-base">{t('farmer.stores.map.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <StoresMap stores={stores} isLoading={!hasStores && (isLoading || isRefreshingData)} />
        </CardContent>
      </Card>

      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            {t('farmer.stores.directory')}
          </CardTitle>
          <CardDescription className="text-base">All stores linked to your account with real-time updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col gap-3 w-full lg:w-auto lg:flex-row">
              <div className="relative w-full lg:w-72">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder={t('farmer.stores.searchPlaceholder')}
                  className="pl-10 h-11"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="relative w-full lg:w-64">
                <MapPin className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder={t('farmer.stores.filterByAddress')}
                  className="pl-10 h-11"
                  value={addressFilter}
                  onChange={(event) => setAddressFilter(event.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-48 h-11">
                <SelectValue placeholder={t('farmer.stores.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('farmer.stores.allStatus')}</SelectItem>
                {storeStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

      <div className="space-y-6" data-tour="stores-list">
            <div className="text-sm text-gray-500">
              {t('farmer.stores.searchResults').replace('{count}', String(filteredStores.length))}
            </div>
          {!hasStores && (isLoading || isRefreshingData) ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Loading stores...</p>
            </div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">{t('farmer.stores.noStoresMatch')}</p>
                <p className="text-sm text-gray-400 mt-2">{t('farmer.stores.tryAdjusting')}</p>
              </div>
            ) : (
              filteredStores.map((store) => (
                <div key={store.id} className="bg-gradient-to-r from-white to-gray-50 border-2 border-gray-100 rounded-xl p-6 hover:border-gray-200 transition-all duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900">{store.name}</h3>
                          <p className="text-gray-600 mt-1">{store.location}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            {store.contact?.phone && (
                              <div className="flex items-center">
                                <Phone className="w-4 h-4 mr-2" />
                                {store.contact.phone}
                              </div>
                            )}
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-2" />
                              {store.type.replace('_', ' ').charAt(0).toUpperCase() + store.type.replace('_', ' ').slice(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">{t('farmer.stores.firstContact')}</span>
                            <span className="font-medium">{formatDate(store.metadata?.firstContact)}</span>
                          </div>
                          {store.metadata?.lastOrder && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">{t('farmer.stores.lastOrder')}</span>
                              <span className="font-medium">{formatDate(store.metadata.lastOrder)}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">{t('farmer.stores.totalOrders')}</span>
                            <span className="font-semibold text-blue-600">{store.metadata?.totalOrders || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">{t('farmer.stores.revenue')}</span>
                            <span className="font-semibold text-green-600">NT$ {(store.metadata?.totalRevenue || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-4">
                      <Badge 
                        variant="secondary" 
                        className={`capitalize px-3 py-1 ${
                          store.status === 'customer' ? 'bg-green-100 text-green-700' :
                          store.status === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                          store.status === 'potential' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {store.status.replace('_', ' ')}
                      </Badge>
                      
                      <Select
                        value={store.status}
                        onValueChange={(value) => handleStatusUpdate(store, value as Store['status'])}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className="w-48 h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {storeStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {store.metadata?.notes && store.metadata.notes.length > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg">
                      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        {t('farmer.stores.notes')}
                      </p>
                      <ul className="text-sm text-gray-600 space-y-2">
                        {store.metadata.notes.map((note, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmerStores;
