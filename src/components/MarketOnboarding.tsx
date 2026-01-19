import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Building2, CheckCircle2, Circle, CircleDot, Leaf, Loader2, MapPin, ShoppingBag, Users } from 'lucide-react';
import { AddressCandidate, lookupAddress, reverseLookupAddress, resolveYamatoZip } from '@/lib/address';
import { DatabaseService, LineUser, Store } from '@/lib/database';
import { cn } from '@/lib/utils';
import {
  buildPostOnboardingRedirectPath,
  consumePostOnboardingRedirect,
  isRedirectAllowedForRole
} from '@/lib/postOnboardingRedirect';

type BusinessType = NonNullable<LineUser['marketProfile']>['businessType'] extends infer T
  ? T extends string
    ? T
    : 'retailer'
  : 'retailer';

type StepKey = 'profile' | 'business' | 'needs' | 'done';

interface MarketOnboardingProps {
  children: React.ReactNode;
}

const MarketOnboarding: React.FC<MarketOnboardingProps> = ({ children }) => {
  const {
    user,
    isLoading,
    isRefreshingData,
    userStats,
    userStores,
    refreshUserData,
    updateUserProfile
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    phone: user?.marketProfile?.contactPhone || ''
  });
  const [businessForm, setBusinessForm] = useState({
    businessName: user?.marketProfile?.businessName || '',
    businessType: (user?.marketProfile?.businessType as BusinessType) || 'retailer',
    deliveryRegions: user?.marketProfile?.deliveryRegions || '',
    deliveryNotes: user?.marketProfile?.deliveryNotes || ''
  });
  const [storeAddressForm, setStoreAddressForm] = useState({
    address: '',
    postNumber: '',
    yamatoZipCode: ''
  });
  const [needsForm, setNeedsForm] = useState({
    procurementNeeds: (user?.marketProfile?.procurementNeeds || []).join(', '),
    budgetNotes: user?.marketProfile?.budgetNotes || '',
    preferredDeliveryDays: user?.marketProfile?.preferredDeliveryDays || [],
    paymentTerms: user?.marketProfile?.paymentTerms || '',
    volumeRange: user?.marketProfile?.volumeRange || '',
    sourcingRegions: user?.marketProfile?.sourcingRegions || '',
    specialNotes: user?.marketProfile?.specialNotes || ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStoreAddressSearching, setIsStoreAddressSearching] = useState(false);
  const [isStoreAddressVerifying, setIsStoreAddressVerifying] = useState(false);
  const [storeAddressSuggestions, setStoreAddressSuggestions] = useState<AddressCandidate[]>([]);
  const [storeAddressLookupError, setStoreAddressLookupError] = useState<string | null>(null);
  const [storeAddressVerifyError, setStoreAddressVerifyError] = useState<string | null>(null);
  const [viewStep, setViewStep] = useState<StepKey | null>(null);
  const initialLoadRequestedRef = useRef(false);
  const storeAddressRef = useRef('');
  const storeAutoFillRef = useRef<string | null>(null);
  const storeLookupIdRef = useRef(0);
  const storeAddressInitializedRef = useRef(false);
  const debouncedStoreAddress = useDebouncedValue(storeAddressForm.address, 400);

  useEffect(() => {
    setProfileForm({
      displayName: user?.displayName || '',
      email: user?.email || '',
      phone: user?.marketProfile?.contactPhone || ''
    });
    setBusinessForm((prev) => ({
      ...prev,
      businessName: user?.marketProfile?.businessName || '',
      businessType: (user?.marketProfile?.businessType as any) || prev.businessType,
      deliveryRegions: user?.marketProfile?.deliveryRegions || '',
      deliveryNotes: user?.marketProfile?.deliveryNotes || ''
    }));
    setNeedsForm({
      procurementNeeds: (user?.marketProfile?.procurementNeeds || []).join(', '),
      budgetNotes: user?.marketProfile?.budgetNotes || '',
      preferredDeliveryDays: user?.marketProfile?.preferredDeliveryDays || [],
      paymentTerms: user?.marketProfile?.paymentTerms || '',
      volumeRange: user?.marketProfile?.volumeRange || '',
      sourcingRegions: user?.marketProfile?.sourcingRegions || '',
      specialNotes: user?.marketProfile?.specialNotes || ''
    });
  }, [user?.displayName, user?.email, user?.marketProfile]);

  useEffect(() => {
    storeAddressRef.current = storeAddressForm.address;
  }, [storeAddressForm.address]);

  useEffect(() => {
    if (storeAddressInitializedRef.current) return;
    const existingStore = (userStores || []).find((store) => store.userId === user?.id) ?? (userStores || [])[0];
    if (!existingStore) return;
    const address = existingStore.pickup?.address || existingStore.location || '';
    if (!address) return;
    setStoreAddressForm({
      address,
      postNumber: existingStore.pickup?.postNumber || '',
      yamatoZipCode: existingStore.pickup?.yamatoZipCode || ''
    });
    storeAddressInitializedRef.current = true;
  }, [user?.id, userStores]);

  useEffect(() => {
    if (user?.role === 'market' && user?.id && !initialLoadRequestedRef.current && !isRefreshingData) {
      initialLoadRequestedRef.current = true;
      refreshUserData().catch((error) => console.error('MarketOnboarding: refresh failed', error));
    }
  }, [user?.role, user?.id, isRefreshingData, refreshUserData]);

  const hasBuyerStoreLocation = useMemo(() => {
    return (userStores || []).some(
      (store: Store) => Boolean((store.pickup?.address || store.location || '').trim())
    );
  }, [userStores]);

  const needsProfile = user?.role === 'market' && (!user?.displayName || !user?.email);
  const needsBusiness =
    user?.role === 'market' &&
    (!user?.marketProfile?.businessName || !user?.marketProfile?.businessType || !hasBuyerStoreLocation);
  const needsIntent =
    user?.role === 'market' && (!user?.marketProfile?.procurementNeeds || user.marketProfile.procurementNeeds.length === 0);

  const steps = useMemo(
    () => [
      {
        key: 'profile' as const,
        title: t('onboarding.market.profile.title'),
        description: t('onboarding.market.profile.desc'),
        completed: !needsProfile,
        icon: Users
      },
      {
        key: 'business' as const,
        title: t('onboarding.market.business.title'),
        description: t('onboarding.market.business.desc'),
        completed: !needsBusiness,
        icon: Building2
      },
      {
        key: 'needs' as const,
        title: t('onboarding.market.needs.title'),
        description: t('onboarding.market.needs.desc'),
        completed: !needsIntent,
        icon: ShoppingBag
      }
    ],
    [needsProfile, needsBusiness, needsIntent, t]
  );

  const currentStep = useMemo<StepKey>(() => {
    if (needsProfile) return 'profile';
    if (needsBusiness) return 'business';
    if (needsIntent) return 'needs';
    return 'done';
  }, [needsProfile, needsBusiness, needsIntent]);

  useEffect(() => {
    if (!user || user.role !== 'market') return;
    if (currentStep !== 'done') return;
    const redirect = consumePostOnboardingRedirect();
    if (!redirect || !isRedirectAllowedForRole(redirect, 'market')) return;
    const currentPath = buildPostOnboardingRedirectPath(location);
    if (redirect === currentPath) return;
    navigate(redirect, { replace: true });
  }, [currentStep, location, navigate, user]);

  const activeStepIndex = steps.findIndex((step) => step.key === currentStep);
  const displayedStep = viewStep || currentStep;
  const displayedStepIndex = steps.findIndex((step) => step.key === displayedStep);
  const displayedStepItem = steps[displayedStepIndex] || steps[activeStepIndex] || steps[0];
  const DisplayedIcon = displayedStepItem?.icon;

  const pendingCount = steps.filter((step) => !step.completed).length;
  const remainingSteps = Math.max(pendingCount, 0);
  const progressText = t('onboarding.market.progress').replace('{count}', remainingSteps.toString());

  const waitingForData =
    user?.role === 'market' &&
    (isLoading || isRefreshingData || (!userStats && !initialLoadRequestedRef.current));

  const mapBusinessTypeToStoreType = (type: BusinessType): Store['type'] => {
    switch (type) {
      case 'restaurant':
        return 'restaurant';
      case 'retailer':
        return 'supermarket';
      case 'ecommerce':
        return 'online_store';
      default:
        return 'other';
    }
  };

  const requestCurrentLocation = () =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        reject(new Error(t('onboarding.market.store.geoUnavailable')));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => reject(new Error(t('onboarding.market.store.geoDenied')))
      );
    });

  const handleLookupStoreAddress = async () => {
    const query = storeAddressForm.address.trim();
    if (!query) {
      setStoreAddressLookupError(t('onboarding.market.store.lookupRequired'));
      return;
    }
    setIsStoreAddressSearching(true);
    setStoreAddressLookupError(null);
    try {
      const result = await lookupAddress(query);
      if (result.candidates.length === 0) {
        setStoreAddressLookupError(t('onboarding.market.store.lookupEmpty'));
      }
      setStoreAddressSuggestions(result.candidates);
      const topCandidate = result.candidates[0];
      if (topCandidate?.address && topCandidate.address.startsWith(query)) {
        storeAutoFillRef.current = topCandidate.address;
        setStoreAddressForm((prev) => ({
          ...prev,
          address: topCandidate.address,
          postNumber: '',
          yamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setStoreAddressLookupError(error?.message || t('onboarding.market.store.lookupFailed'));
    } finally {
      setIsStoreAddressSearching(false);
    }
  };

  const handleUseLocationForStore = async () => {
    setIsStoreAddressSearching(true);
    setStoreAddressLookupError(null);
    try {
      const { lat, lng } = await requestCurrentLocation();
      const result = await reverseLookupAddress(lat, lng);
      if (result.candidates.length === 0) {
        setStoreAddressLookupError(t('onboarding.market.store.lookupEmpty'));
      }
      setStoreAddressSuggestions(result.candidates);
      const topCandidate = result.candidates[0];
      if (topCandidate?.address) {
        storeAutoFillRef.current = topCandidate.address;
        setStoreAddressForm((prev) => ({
          ...prev,
          address: topCandidate.address,
          postNumber: '',
          yamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setStoreAddressLookupError(error?.message || t('onboarding.market.store.lookupFailed'));
    } finally {
      setIsStoreAddressSearching(false);
    }
  };

  const applyStoreSuggestion = (candidate: AddressCandidate) => {
    setStoreAddressForm((prev) => ({
      ...prev,
      address: candidate.address,
      postNumber: '',
      yamatoZipCode: ''
    }));
    setStoreAddressSuggestions([]);
    setStoreAddressLookupError(null);
    setStoreAddressVerifyError(null);
  };

  const handleVerifyStoreAddress = async () => {
    const address = storeAddressForm.address.trim();
    if (!address) {
      setStoreAddressVerifyError(t('onboarding.market.store.addressRequired'));
      return;
    }
    setStoreAddressVerifyError(null);
    setIsStoreAddressVerifying(true);
    try {
      const result = await resolveYamatoZip(address);
      setStoreAddressForm((prev) => ({
        ...prev,
        address: result.normalizedAddress || prev.address,
        postNumber: result.postNumber,
        yamatoZipCode: result.yamatoZipCode
      }));
      setStoreAddressSuggestions([]);
    } catch (error: any) {
      setStoreAddressVerifyError(error?.message || t('onboarding.market.store.verifyFailed'));
    } finally {
      setIsStoreAddressVerifying(false);
    }
  };

  useEffect(() => {
    const query = debouncedStoreAddress.trim();
    if (query.length < 3) {
      storeLookupIdRef.current += 1;
      setStoreAddressSuggestions([]);
      setStoreAddressLookupError(null);
      return;
    }
    if (storeAutoFillRef.current === query) {
      storeAutoFillRef.current = null;
      return;
    }
    const lookupId = (storeLookupIdRef.current += 1);
    setStoreAddressLookupError(null);
    lookupAddress(query)
      .then((result) => {
        if (storeLookupIdRef.current !== lookupId) return;
        if (storeAddressRef.current.trim() !== query) return;
        setStoreAddressSuggestions(result.candidates);
        if (result.candidates.length === 0) {
          setStoreAddressLookupError(t('onboarding.market.store.lookupEmpty'));
          return;
        }
        const topCandidate = result.candidates[0];
        if (
          topCandidate?.address &&
          topCandidate.address !== storeAddressRef.current.trim() &&
          topCandidate.address.startsWith(query)
        ) {
          storeAutoFillRef.current = topCandidate.address;
          setStoreAddressForm((prev) => ({
            ...prev,
            address: topCandidate.address,
            postNumber: '',
            yamatoZipCode: ''
          }));
        }
      })
      .catch((error: any) => {
        if (storeLookupIdRef.current !== lookupId) return;
        if (storeAddressRef.current.trim() !== query) return;
        setStoreAddressLookupError(error?.message || t('onboarding.market.store.lookupFailed'));
      });
  }, [debouncedStoreAddress, t]);

  const handleBackStep = () => {
    if (displayedStepIndex > 0) {
      setViewStep(steps[displayedStepIndex - 1].key);
    }
  };

  const applyNeedsTemplate = (template: 'leafy' | 'eggs' | 'fruit') => {
    if (template === 'leafy') {
      setNeedsForm((prev) => ({
        ...prev,
        procurementNeeds: 'leafy greens, broccoli, romaine, basil',
        budgetNotes: prev.budgetNotes || 'Weekly standing order, cold chain required',
        preferredDeliveryDays: prev.preferredDeliveryDays.length ? prev.preferredDeliveryDays : ['Mon', 'Thu'],
        volumeRange: prev.volumeRange || '100-200 kg/week'
      }));
    } else if (template === 'eggs') {
      setNeedsForm((prev) => ({
        ...prev,
        procurementNeeds: 'cage-free eggs, free-range eggs',
        budgetNotes: prev.budgetNotes || 'Daily AM delivery window',
        preferredDeliveryDays: prev.preferredDeliveryDays.length ? prev.preferredDeliveryDays : ['Daily'],
        volumeRange: prev.volumeRange || '50-80 dozen/day'
      }));
    } else if (template === 'fruit') {
      setNeedsForm((prev) => ({
        ...prev,
        procurementNeeds: 'guava, pineapple, seasonal citrus',
        budgetNotes: prev.budgetNotes || 'Seasonal program, prefer GAP',
        preferredDeliveryDays: prev.preferredDeliveryDays.length ? prev.preferredDeliveryDays : ['Tue', 'Fri'],
        volumeRange: prev.volumeRange || '150-300 kg/week'
      }));
    }
  };

  const toggleDeliveryDay = (day: string) => {
    setNeedsForm((prev) => {
      const exists = prev.preferredDeliveryDays.includes(day);
      return {
        ...prev,
        preferredDeliveryDays: exists
          ? prev.preferredDeliveryDays.filter((d) => d !== day)
          : [...prev.preferredDeliveryDays, day]
      };
    });
  };

  const saveProfile = async () => {
    if (!profileForm.displayName.trim() || !profileForm.email.trim()) {
      setFormError(t('onboarding.market.profile.required'));
      return;
    }

    await updateUserProfile({
      displayName: profileForm.displayName.trim(),
      email: profileForm.email.trim(),
      marketProfile: {
        ...(user?.marketProfile || {}),
        contactPhone: profileForm.phone.trim() || undefined
      }
    });
  };

  const upsertBuyerStore = async (
    address: string,
    postNumber: string,
    yamatoZipCode: string,
    lat?: number,
    lng?: number,
    placeId?: string
  ) => {
    if (!user?.id) return;

    const storeName = businessForm.businessName.trim() || profileForm.displayName.trim() || user.displayName || 'Buyer';
    const storeType = mapBusinessTypeToStoreType(businessForm.businessType);
    const contact: Store['contact'] = {};
    if (profileForm.displayName.trim()) contact.name = profileForm.displayName.trim();
    if (profileForm.phone.trim()) contact.phone = profileForm.phone.trim();
    if (profileForm.email.trim()) contact.email = profileForm.email.trim();
    const hasContact = Object.keys(contact).length > 0;

    const pickup: Store['pickup'] = {
      address,
      yamatoZipCode,
      postNumber,
      contactName: contact.name || storeName,
      lat,
      lng,
      placeId
    };
    if (contact.phone) {
      pickup.contactTel = contact.phone;
    }
    if (yamatoZipCode) {
      pickup.verifiedAt = new Date().toISOString();
    }

    const existingStore =
      (userStores || []).find((store) => store.userId === user.id) ?? (userStores || [])[0];

    if (existingStore?.id) {
      const updates: Partial<Store> = {
        name: storeName,
        type: storeType,
        location: address
      };
      if (hasContact) {
        updates.contact = contact;
      }
      if (pickup) {
        updates.pickup = pickup;
      }
      await DatabaseService.updateStore(existingStore.id, updates);
    } else {
      await DatabaseService.createStore(user.id, {
        name: storeName,
        type: storeType,
        location: address,
        contact: hasContact ? contact : undefined,
        pickup,
        metadata: {
          notes: []
        }
      });
    }
  };

  const saveBusiness = async () => {
    if (!businessForm.businessName.trim()) {
      setFormError(t('onboarding.market.business.required'));
      return;
    }

    if (!storeAddressForm.address.trim()) {
      setFormError(t('onboarding.market.store.addressRequired'));
      return;
    }

    let address = storeAddressForm.address.trim();
    let postNumber = storeAddressForm.postNumber.trim();
    let yamatoZipCode = storeAddressForm.yamatoZipCode.trim();
    let geoLat: number | undefined;
    let geoLng: number | undefined;
    let geoPlaceId: string | undefined;

    if (!yamatoZipCode) {
      setIsStoreAddressVerifying(true);
      setStoreAddressVerifyError(null);
      try {
        const result = await resolveYamatoZip(address);
        address = result.normalizedAddress || address;
        postNumber = result.postNumber;
        yamatoZipCode = result.yamatoZipCode;
        setStoreAddressForm((prev) => ({
          ...prev,
          address,
          postNumber,
          yamatoZipCode
        }));
        setStoreAddressSuggestions([]);
      } catch (error: any) {
        setStoreAddressVerifyError(error?.message || t('onboarding.market.store.verifyFailed'));
        return;
      } finally {
        setIsStoreAddressVerifying(false);
      }
    }

    if (!yamatoZipCode) {
      setFormError(t('onboarding.market.store.verifyRequired'));
      return;
    }

    try {
      const geocodeResult = await lookupAddress(address, 1);
      const candidate = geocodeResult.candidates[0];
      if (candidate?.address) {
        address = candidate.address;
        geoLat = candidate.lat;
        geoLng = candidate.lng;
        geoPlaceId = candidate.placeId;
        setStoreAddressForm((prev) => ({
          ...prev,
          address,
          postNumber,
          yamatoZipCode
        }));
      }
    } catch (error) {
      console.warn('MarketOnboarding: failed to geocode store address, using verified address', error);
    }

    await upsertBuyerStore(address, postNumber, yamatoZipCode, geoLat, geoLng, geoPlaceId);

    await updateUserProfile({
      marketProfile: {
        ...(user?.marketProfile || {}),
        businessName: businessForm.businessName.trim(),
        businessType: businessForm.businessType,
        deliveryRegions: businessForm.deliveryRegions.trim(),
        deliveryNotes: businessForm.deliveryNotes.trim()
      }
    });
  };

  const saveNeeds = async () => {
    const needs = needsForm.procurementNeeds
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (needs.length === 0) {
      setFormError(t('onboarding.market.needs.required'));
      return;
    }

    await updateUserProfile({
      marketProfile: {
        ...(user?.marketProfile || {}),
        procurementNeeds: needs,
        budgetNotes: needsForm.budgetNotes.trim(),
        preferredDeliveryDays: needsForm.preferredDeliveryDays,
        paymentTerms: needsForm.paymentTerms,
        volumeRange: needsForm.volumeRange,
        sourcingRegions: needsForm.sourcingRegions.trim(),
        specialNotes: needsForm.specialNotes.trim()
      }
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!user?.id) return;

    setIsSaving(true);
    try {
      if (displayedStep === 'profile') {
        await saveProfile();
      } else if (displayedStep === 'business') {
        await saveBusiness();
      } else if (displayedStep === 'needs') {
        await saveNeeds();
      }

      await refreshUserData();
      setViewStep(null);
    } catch (error) {
      console.error('MarketOnboarding: failed to save step', error);
      setFormError(t('onboarding.market.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (displayedStep) {
      case 'profile':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.market.profile.nameLabel')}
                </label>
                <Input
                  value={profileForm.displayName}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))
                  }
                  placeholder={t('onboarding.market.profile.namePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.market.profile.emailLabel')}
                </label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder={t('onboarding.market.profile.emailPlaceholder')}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.profile.phoneLabel')}
              </label>
              <Input
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder={t('onboarding.market.profile.phonePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">LINE ID</label>
              <Input value={user?.lineUserId || user?.id || ''} readOnly disabled />
            </div>
          </div>
        );
      case 'business':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.business.nameLabel')}
              </label>
              <Input
                value={businessForm.businessName}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, businessName: event.target.value }))
                }
                placeholder={t('onboarding.market.business.namePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.business.typeLabel')}
              </label>
              <Select
                value={businessForm.businessType as string}
                onValueChange={(value) => setBusinessForm((prev) => ({ ...prev, businessType: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.market.business.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retailer">{t('onboarding.market.business.type.retailer')}</SelectItem>
                  <SelectItem value="restaurant">{t('onboarding.market.business.type.restaurant')}</SelectItem>
                  <SelectItem value="wholesaler">{t('onboarding.market.business.type.wholesaler')}</SelectItem>
                  <SelectItem value="distributor">{t('onboarding.market.business.type.distributor')}</SelectItem>
                  <SelectItem value="hotel">{t('onboarding.market.business.type.hotel')}</SelectItem>
                  <SelectItem value="ecommerce">{t('onboarding.market.business.type.ecommerce')}</SelectItem>
                  <SelectItem value="processor">{t('onboarding.market.business.type.processor')}</SelectItem>
                  <SelectItem value="other">{t('common.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">
                    {t('onboarding.market.store.verifyTitle')}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {t('onboarding.market.store.verifyHint')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseLocationForStore}
                    disabled={isStoreAddressSearching}
                    className="gap-2"
                  >
                    {isStoreAddressSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('onboarding.market.store.searching')}
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        {t('onboarding.market.store.useLocation')}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLookupStoreAddress}
                    disabled={isStoreAddressSearching || !storeAddressForm.address.trim()}
                  >
                    {t('onboarding.market.store.search')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerifyStoreAddress}
                    disabled={isStoreAddressVerifying || !storeAddressForm.address.trim()}
                    className="gap-2"
                  >
                    {isStoreAddressVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('onboarding.market.store.verifying')}
                      </>
                    ) : (
                      t('onboarding.market.store.verify')
                    )}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.market.store.addressLabel')}
                  </label>
                  <Input
                    value={storeAddressForm.address}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      storeAddressInitializedRef.current = true;
                      setStoreAddressForm((prev) => ({
                        ...prev,
                        address: nextValue,
                        postNumber: '',
                        yamatoZipCode: ''
                      }));
                      setStoreAddressLookupError(null);
                      setStoreAddressVerifyError(null);
                      setStoreAddressSuggestions([]);
                    }}
                    placeholder={t('onboarding.market.store.addressPlaceholder')}
                  />
                  {storeAddressSuggestions.length > 0 && (
                    <div className="rounded-md border border-gray-200 bg-white p-2">
                      <p className="text-xs text-gray-500">
                        {t('onboarding.market.store.suggestions')}
                      </p>
                      <div className="flex flex-col gap-2 mt-2">
                        {storeAddressSuggestions.map((candidate, index) => (
                          <button
                            key={`${candidate.address}-${index}`}
                            type="button"
                            onClick={() => applyStoreSuggestion(candidate)}
                            className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                          >
                            {candidate.address}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {storeAddressLookupError && (
                    <div className="text-sm text-red-600">{storeAddressLookupError}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.market.store.postNumber')}
                  </label>
                  <Input
                    value={storeAddressForm.postNumber}
                    readOnly
                    placeholder={t('onboarding.market.store.postNumberPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.market.store.yamatoZip')}
                  </label>
                  <Input
                    value={storeAddressForm.yamatoZipCode}
                    readOnly
                    placeholder={t('onboarding.market.store.yamatoZipPlaceholder')}
                  />
                </div>
              </div>
              {storeAddressVerifyError && (
                <div className="text-sm text-red-600">{storeAddressVerifyError}</div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.business.regionLabel')}
              </label>
              <Input
                value={businessForm.deliveryRegions}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, deliveryRegions: event.target.value }))
                }
                placeholder={t('onboarding.market.business.regionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.business.notesLabel')}
              </label>
              <Textarea
                value={businessForm.deliveryNotes}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, deliveryNotes: event.target.value }))
                }
                placeholder={t('onboarding.market.business.notesPlaceholder')}
                className="min-h-[90px]"
              />
            </div>
          </div>
        );
      case 'needs':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button type="button" variant="secondary" className="justify-start" onClick={() => applyNeedsTemplate('leafy')}>
                {t('onboarding.market.needs.template.leafy')}
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => applyNeedsTemplate('eggs')}>
                {t('onboarding.market.needs.template.eggs')}
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => applyNeedsTemplate('fruit')}>
                {t('onboarding.market.needs.template.fruit')}
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.needs.label')}
              </label>
              <Textarea
                value={needsForm.procurementNeeds}
                onChange={(event) =>
                  setNeedsForm((prev) => ({ ...prev, procurementNeeds: event.target.value }))
                }
                placeholder={t('onboarding.market.needs.placeholder')}
                className="min-h-[100px]"
              />
              <p className="text-xs text-gray-500">{t('onboarding.market.needs.helper')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.market.needs.volumeLabel')}
                </label>
                <Input
                  value={needsForm.volumeRange}
                  onChange={(event) => setNeedsForm((prev) => ({ ...prev, volumeRange: event.target.value }))}
                  placeholder={t('onboarding.market.needs.volumePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.market.needs.paymentLabel')}
                </label>
                <Select
                  value={needsForm.paymentTerms || 'net30'}
                  onValueChange={(value) => setNeedsForm((prev) => ({ ...prev, paymentTerms: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('onboarding.market.needs.paymentPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cod">{t('onboarding.market.needs.payment.cod')}</SelectItem>
                    <SelectItem value="net7">{t('onboarding.market.needs.payment.net7')}</SelectItem>
                    <SelectItem value="net15">{t('onboarding.market.needs.payment.net15')}</SelectItem>
                    <SelectItem value="net30">{t('onboarding.market.needs.payment.net30')}</SelectItem>
                    <SelectItem value="net45">{t('onboarding.market.needs.payment.net45')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.needs.deliveryLabel')}
              </label>
              <div className="flex flex-wrap gap-2">
                {['Daily', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={needsForm.preferredDeliveryDays.includes(day) ? 'default' : 'outline'}
                    className={cn('text-xs', needsForm.preferredDeliveryDays.includes(day) ? 'bg-blue-600' : '')}
                    onClick={() => toggleDeliveryDay(day)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{t('onboarding.market.needs.deliveryHelper')}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.needs.regionLabel')}
              </label>
              <Input
                value={needsForm.sourcingRegions}
                onChange={(event) =>
                  setNeedsForm((prev) => ({ ...prev, sourcingRegions: event.target.value }))
                }
                placeholder={t('onboarding.market.needs.regionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.needs.budgetLabel')}
              </label>
              <Textarea
                value={needsForm.budgetNotes}
                onChange={(event) => setNeedsForm((prev) => ({ ...prev, budgetNotes: event.target.value }))}
                placeholder={t('onboarding.market.needs.budgetPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.market.needs.specialLabel')}
              </label>
              <Textarea
                value={needsForm.specialNotes}
                onChange={(event) => setNeedsForm((prev) => ({ ...prev, specialNotes: event.target.value }))}
                placeholder={t('onboarding.market.needs.specialPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!user || user.role !== 'market') {
    return <>{children}</>;
  }

  const shouldShowOnboarding = currentStep !== 'done';

  if (!shouldShowOnboarding) {
    return <>{children}</>;
  }

  if (waitingForData) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex items-center space-x-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-2 border-blue-100 bg-blue-50">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Leaf className="w-5 h-5" />
            {t('onboarding.market.title')}
          </CardTitle>
          <CardDescription className="text-blue-700">
            {t('onboarding.market.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          <Alert className="border-blue-200 bg-white hidden sm:flex">
            <AlertTitle className="text-blue-800">
              {t('onboarding.market.locked')}
            </AlertTitle>
            <AlertDescription className="text-blue-700">
              {progressText}
            </AlertDescription>
          </Alert>

          <div className="sm:hidden flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {displayedStepItem && DisplayedIcon && (
                <Badge
                  variant="secondary"
                  className="whitespace-nowrap flex items-center gap-1 ring-2 ring-blue-500 ring-offset-1"
                >
                  <DisplayedIcon className="w-3.5 h-3.5" />
                  <span className="text-sm">{displayedStepItem.title}</span>
                </Badge>
              )}
              <span className="text-xs uppercase text-gray-500">
                {t('common.step')} {(displayedStepIndex >= 0 ? displayedStepIndex : activeStepIndex) + 1}/{steps.length}
              </span>
            </div>
          </div>

          <div className="hidden sm:grid grid-cols-1 md:grid-cols-3 gap-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.key}
                  className={`rounded-xl border p-4 bg-white shadow-sm ${
                    !step.completed && index === steps.findIndex((s) => !s.completed)
                      ? 'border-blue-500 ring-1 ring-blue-100'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={step.completed ? 'default' : 'outline'}>
                      {step.completed ? t('onboarding.status.done') : t('onboarding.status.pending')}
                    </Badge>
                    {step.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    ) : index === steps.findIndex((s) => !s.completed) ? (
                      <CircleDot className="w-5 h-5 text-orange-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-blue-700" />
                    <div>
                      <p className="font-semibold text-gray-900">{step.title}</p>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertTitle>{t('onboarding.market.error')}</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {t('common.step')} {(displayedStepIndex >= 0 ? displayedStepIndex : activeStepIndex) + 1} / {steps.length}
                </p>
                <h3 className="text-xl font-semibold text-gray-900">
                  {steps.find((step) => step.key === displayedStep)?.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {steps.find((step) => step.key === displayedStep)?.description}
                </p>
              </div>
              <Badge variant="secondary" className="text-blue-700 bg-blue-100 border-blue-200">
                {t('onboarding.status.required')}
              </Badge>
            </div>

            {renderStepContent()}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {displayedStepIndex > 0 && (
                  <Button type="button" variant="ghost" onClick={handleBackStep}>
                    {t('common.back')}
                  </Button>
                )}
                <p className="text-sm text-gray-500">{t('onboarding.market.reminder')}</p>
              </div>
              <Button type="submit" disabled={isSaving || isStoreAddressVerifying}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('onboarding.market.save')}
              </Button>
            </div>
          </form>

          <p className="text-sm text-gray-500 text-center">{t('onboarding.market.returnNotice')}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketOnboarding;
