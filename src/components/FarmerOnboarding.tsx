import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { DatabaseService, Store } from '@/lib/database';
import { UserDataService } from '@/services/userDataService';
import { AddressCandidate, lookupAddress, reverseLookupAddress, resolveYamatoZip } from '@/lib/address';
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
import { CheckCircle2, Circle, CircleDot, Leaf, Loader2, Package, Store as StoreIcon, MapPin } from 'lucide-react';
import { storage } from '@/lib/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import {
  buildPostOnboardingRedirectPath,
  consumePostOnboardingRedirect,
  isRedirectAllowedForRole
} from '@/lib/postOnboardingRedirect';

type StepKey = 'profile' | 'store' | 'product' | 'done';

interface FarmerOnboardingProps {
  children: React.ReactNode;
}

const FarmerOnboarding: React.FC<FarmerOnboardingProps> = ({ children }) => {
  const {
    user,
    userStats,
    userProducts,
    refreshUserData,
    updateUserProfile,
    isLoading,
    isRefreshingData
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName || '',
    email: user?.email || ''
  });
  const [storeForm, setStoreForm] = useState({
    name: '',
    type: 'mixed' as Store['type'],
    location: '',
    pickupAddress: '',
    contactName: '',
    contactPhone: '',
    notes: '',
    pickupPostNumber: '',
    pickupYamatoZipCode: ''
  });
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'other',
    unit: 'kg',
    unitOther: '',
    price: '',
    stock: '',
    description: '',
    pickupAddress: '',
    pickupContactName: '',
    pickupContactTel: '',
    pickupContactMobile: '',
    pickupPostNumber: '',
    pickupYamatoZipCode: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [storeSaving, setStoreSaving] = useState(false);
  const [ownedStores, setOwnedStores] = useState<Store[]>([]);
  const [isStorePickupSearching, setIsStorePickupSearching] = useState(false);
  const [isStorePickupVerifying, setIsStorePickupVerifying] = useState(false);
  const [storePickupSuggestions, setStorePickupSuggestions] = useState<AddressCandidate[]>([]);
  const [storePickupLookupError, setStorePickupLookupError] = useState<string | null>(null);
  const [storePickupVerifyError, setStorePickupVerifyError] = useState<string | null>(null);
  const [productSaving, setProductSaving] = useState(false);
  const [isProductPickupSearching, setIsProductPickupSearching] = useState(false);
  const [isProductPickupVerifying, setIsProductPickupVerifying] = useState(false);
  const [productPickupSuggestions, setProductPickupSuggestions] = useState<AddressCandidate[]>([]);
  const [productPickupLookupError, setProductPickupLookupError] = useState<string | null>(null);
  const [productPickupVerifyError, setProductPickupVerifyError] = useState<string | null>(null);
  const [selectedProductPickupStoreId, setSelectedProductPickupStoreId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const storePickupAddressRef = useRef('');
  const productPickupAddressRef = useRef('');
  const storeAutoFillRef = useRef<string | null>(null);
  const productAutoFillRef = useRef<string | null>(null);
  const storeLookupIdRef = useRef(0);
  const productLookupIdRef = useRef(0);
  const initialLoadRequestedRef = useRef(false);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [viewStep, setViewStep] = useState<StepKey | null>(null);
  const debouncedStorePickupAddress = useDebouncedValue(storeForm.pickupAddress, 400);
  const debouncedProductPickupAddress = useDebouncedValue(productForm.pickupAddress, 400);

  useEffect(() => {
    setProfileForm({
      displayName: user?.displayName || '',
      email: user?.email || ''
    });
  }, [user?.displayName, user?.email]);

  useEffect(() => {
    storePickupAddressRef.current = storeForm.pickupAddress;
  }, [storeForm.pickupAddress]);

  useEffect(() => {
    productPickupAddressRef.current = productForm.pickupAddress;
  }, [productForm.pickupAddress]);

  useEffect(() => {
    if (user?.role === 'farmer' && user?.id && !initialLoadRequestedRef.current && !isRefreshingData) {
      initialLoadRequestedRef.current = true;
      refreshUserData().catch((error) => {
        console.error('FarmerOnboarding: failed to refresh user data', error);
      });
    }
  }, [user?.role, user?.id, isRefreshingData, refreshUserData]);

  const loadOwnedStores = React.useCallback(async () => {
    if (!user?.id || user.role !== 'farmer') {
      setOwnedStores([]);
      return;
    }

    try {
      const stores = await UserDataService.getUserStores(user.id);
      setOwnedStores(stores);
    } catch (error) {
      console.error('FarmerOnboarding: failed to load owned stores', error);
      setOwnedStores([]);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    loadOwnedStores();
  }, [loadOwnedStores]);

  const needsProfile = user?.role === 'farmer' && (!user?.displayName || !user?.email);
  const needsStore = user?.role === 'farmer' && ownedStores.length === 0;
  const needsProduct = user?.role === 'farmer' && ((userProducts?.length || 0) === 0);

  const steps = useMemo(
    () => [
      {
        key: 'profile' as const,
        title: t('onboarding.farmer.profile.title'),
        description: t('onboarding.farmer.profile.desc'),
        completed: !needsProfile,
        icon: Leaf
      },
      {
        key: 'store' as const,
        title: t('onboarding.farmer.store.title'),
        description: t('onboarding.farmer.store.desc'),
        completed: !needsStore,
        icon: StoreIcon
      },
      {
        key: 'product' as const,
        title: t('onboarding.farmer.product.title'),
        description: t('onboarding.farmer.product.desc'),
        completed: !needsProduct,
        icon: Package
      }
    ],
    [needsProfile, needsStore, needsProduct, t]
  );

  const verifiedStores = useMemo(() => {
    return ownedStores.filter(
      (store: Store) => Boolean(store?.pickup?.yamatoZipCode && store?.pickup?.address)
    ) as Store[];
  }, [ownedStores]);

  const currentStep = useMemo<StepKey>(() => {
    if (needsProfile) return 'profile';
    if (needsStore) return 'store';
    if (needsProduct) return 'product';
    return 'done';
  }, [needsProfile, needsStore, needsProduct]);

  useEffect(() => {
    if (!user || user.role !== 'farmer') return;
    if (currentStep !== 'done') return;
    const redirect = consumePostOnboardingRedirect();
    if (!redirect || !isRedirectAllowedForRole(redirect, 'farmer')) return;
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
  const progressText = t('onboarding.farmer.progress').replace('{count}', remainingSteps.toString());
  const waitingForData =
    user?.role === 'farmer' &&
    (isLoading || isRefreshingData || (!userStats && !initialLoadRequestedRef.current));

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!user?.id) return;

    if (!profileForm.displayName.trim() || !profileForm.email.trim()) {
      setFormError(t('onboarding.farmer.profile.required'));
      return;
    }

    setProfileSaving(true);
    try {
      await updateUserProfile({
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim()
      });
      setViewStep(null);
      toast({
        title: t('onboarding.farmer.profile.savedTitle'),
        description: t('onboarding.farmer.savedBackend')
      });
    } catch (error) {
      console.error('Failed to save profile', error);
      toast({
        variant: 'destructive',
        title: t('onboarding.farmer.error'),
        description: t('onboarding.farmer.tryAgain')
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleStoreSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!user?.id) return;

    if (!storeForm.name.trim() || !storeForm.location.trim()) {
      setFormError(t('onboarding.farmer.store.required'));
      return;
    }

    if (!storeForm.pickupAddress.trim()) {
      setFormError(t('onboarding.farmer.store.pickupAddressRequired'));
      return;
    }

    setStoreSaving(true);
    try {
      let pickupAddress = storeForm.pickupAddress.trim();
      let pickupPostNumber = storeForm.pickupPostNumber.trim();
      let pickupYamatoZipCode = storeForm.pickupYamatoZipCode.trim();
      let pickupLat: number | undefined;
      let pickupLng: number | undefined;
      let pickupPlaceId: string | undefined;

      if (!pickupYamatoZipCode) {
        setIsStorePickupVerifying(true);
        setStorePickupVerifyError(null);
        try {
          const result = await resolveYamatoZip(pickupAddress);
          pickupAddress = result.normalizedAddress || pickupAddress;
          pickupPostNumber = result.postNumber;
          pickupYamatoZipCode = result.yamatoZipCode;
          setStoreForm((prev) => ({
            ...prev,
            pickupAddress,
            pickupPostNumber,
            pickupYamatoZipCode
          }));
          setStorePickupSuggestions([]);
        } catch (error: any) {
          setStorePickupVerifyError(error?.message || t('onboarding.farmer.store.pickupVerifyFailed'));
          return;
        } finally {
          setIsStorePickupVerifying(false);
        }
      }

      if (!pickupYamatoZipCode) {
        setFormError(t('onboarding.farmer.store.pickupVerifyRequired'));
        return;
      }

      try {
        const geocodeResult = await lookupAddress(pickupAddress, 1);
        const candidate = geocodeResult.candidates[0];
        if (candidate?.address) {
          pickupAddress = candidate.address;
          pickupLat = candidate.lat;
          pickupLng = candidate.lng;
          pickupPlaceId = candidate.placeId;
          setStoreForm((prev) => ({
            ...prev,
            pickupAddress,
            pickupPostNumber,
            pickupYamatoZipCode
          }));
        }
      } catch (error) {
        console.warn('FarmerOnboarding: failed to geocode store address, using verified address', error);
      }

      const contact: any = {};
      if (storeForm.contactName.trim()) contact.name = storeForm.contactName.trim();
      if (storeForm.contactPhone.trim()) contact.phone = storeForm.contactPhone.trim();
      const pickup = pickupAddress
        ? {
          address: pickupAddress,
          yamatoZipCode: pickupYamatoZipCode,
          postNumber: pickupPostNumber,
          lat: pickupLat,
          lng: pickupLng,
          placeId: pickupPlaceId,
          contactName: storeForm.contactName.trim() || storeForm.name.trim(),
          contactTel: storeForm.contactPhone.trim(),
          verifiedAt: pickupYamatoZipCode ? Timestamp.now() : undefined
        }
        : undefined;

      await DatabaseService.createStore(user.id, {
        name: storeForm.name.trim(),
        type: storeForm.type,
        location: storeForm.location.trim(),
        contact: Object.keys(contact).length ? contact : undefined,
        pickup,
        metadata: {
          notes: storeForm.notes.trim() ? [storeForm.notes.trim()] : []
        }
      });

      await refreshUserData();
      await loadOwnedStores();
      setViewStep(null);
      toast({
        title: t('onboarding.farmer.store.savedTitle'),
        description: t('onboarding.farmer.savedBackend')
      });
      setStoreForm({
        name: '',
        type: 'farmers_market',
        location: '',
        pickupAddress: '',
        contactName: '',
        contactPhone: '',
        notes: '',
        pickupPostNumber: '',
        pickupYamatoZipCode: ''
      });
      setStorePickupSuggestions([]);
      setStorePickupLookupError(null);
      setStorePickupVerifyError(null);
    } catch (error) {
      console.error('Failed to save store', error);
      toast({
        variant: 'destructive',
        title: t('onboarding.farmer.error'),
        description: t('onboarding.farmer.tryAgain')
      });
    } finally {
      setStoreSaving(false);
    }
  };

  const requestCurrentLocation = () =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        reject(new Error(t('onboarding.farmer.store.pickupGeoUnavailable')));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => reject(new Error(t('onboarding.farmer.store.pickupGeoDenied')))
      );
    });

  const handleLookupStoreAddress = async () => {
    const query = storeForm.pickupAddress.trim();
    if (!query) {
      setStorePickupLookupError(t('onboarding.farmer.store.pickupLookupRequired'));
      return;
    }
    setIsStorePickupSearching(true);
    setStorePickupLookupError(null);
    try {
      const result = await lookupAddress(query);
      if (result.candidates.length === 0) {
        setStorePickupLookupError(t('onboarding.farmer.store.pickupLookupEmpty'));
      }
      setStorePickupSuggestions(result.candidates);
      const topCandidate = result.candidates[0];
      if (topCandidate?.address && topCandidate.address.startsWith(query)) {
        storeAutoFillRef.current = topCandidate.address;
        setStoreForm((prev) => ({
          ...prev,
          pickupAddress: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setStorePickupLookupError(error?.message || t('onboarding.farmer.store.pickupLookupFailed'));
    } finally {
      setIsStorePickupSearching(false);
    }
  };

  const handleUseLocationForStore = async () => {
    setIsStorePickupSearching(true);
    setStorePickupLookupError(null);
    try {
      const { lat, lng } = await requestCurrentLocation();
      const result = await reverseLookupAddress(lat, lng);
      if (result.candidates.length === 0) {
        setStorePickupLookupError(t('onboarding.farmer.store.pickupLookupEmpty'));
      }
      setStorePickupSuggestions(result.candidates);
      const topCandidate = result.candidates[0];
      if (topCandidate?.address) {
        storeAutoFillRef.current = topCandidate.address;
        setStoreForm((prev) => ({
          ...prev,
          pickupAddress: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setStorePickupLookupError(error?.message || t('onboarding.farmer.store.pickupLookupFailed'));
    } finally {
      setIsStorePickupSearching(false);
    }
  };

  const applyStoreSuggestion = (candidate: AddressCandidate) => {
    setStoreForm((prev) => ({
      ...prev,
      pickupAddress: candidate.address,
      pickupPostNumber: '',
      pickupYamatoZipCode: ''
    }));
    setStorePickupSuggestions([]);
    setStorePickupLookupError(null);
    setStorePickupVerifyError(null);
  };

  const handleVerifyStoreAddress = async () => {
    const address = storeForm.pickupAddress.trim();
    if (!address) {
      setStorePickupVerifyError(t('onboarding.farmer.store.pickupAddressRequired'));
      return;
    }
    setStorePickupVerifyError(null);
    setIsStorePickupVerifying(true);
    try {
      const result = await resolveYamatoZip(address);
      setStoreForm((prev) => ({
        ...prev,
        pickupAddress: result.normalizedAddress || prev.pickupAddress,
        pickupPostNumber: result.postNumber,
        pickupYamatoZipCode: result.yamatoZipCode
      }));
      setStorePickupSuggestions([]);
    } catch (error: any) {
      setStorePickupVerifyError(error?.message || t('onboarding.farmer.store.pickupVerifyFailed'));
    } finally {
      setIsStorePickupVerifying(false);
    }
  };

  const handleLookupProductPickupAddress = async () => {
    const query = productForm.pickupAddress.trim();
    if (!query) {
      setProductPickupLookupError(t('onboarding.farmer.product.pickupLookupRequired'));
      return;
    }
    setIsProductPickupSearching(true);
    setProductPickupLookupError(null);
    try {
      const result = await lookupAddress(query);
      if (result.candidates.length === 0) {
        setProductPickupLookupError(t('onboarding.farmer.product.pickupLookupEmpty'));
      }
      setProductPickupSuggestions(result.candidates);
      setSelectedProductPickupStoreId('');
      const topCandidate = result.candidates[0];
      if (topCandidate?.address && topCandidate.address.startsWith(query)) {
        productAutoFillRef.current = topCandidate.address;
        setProductForm((prev) => ({
          ...prev,
          pickupAddress: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setProductPickupLookupError(error?.message || t('onboarding.farmer.product.pickupLookupFailed'));
    } finally {
      setIsProductPickupSearching(false);
    }
  };

  const handleUseLocationForProductPickup = async () => {
    setIsProductPickupSearching(true);
    setProductPickupLookupError(null);
    try {
      const { lat, lng } = await requestCurrentLocation();
      const result = await reverseLookupAddress(lat, lng);
      if (result.candidates.length === 0) {
        setProductPickupLookupError(t('onboarding.farmer.product.pickupLookupEmpty'));
      }
      setProductPickupSuggestions(result.candidates);
      setSelectedProductPickupStoreId('');
      const topCandidate = result.candidates[0];
      if (topCandidate?.address) {
        productAutoFillRef.current = topCandidate.address;
        setProductForm((prev) => ({
          ...prev,
          pickupAddress: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setProductPickupLookupError(error?.message || t('onboarding.farmer.product.pickupLookupFailed'));
    } finally {
      setIsProductPickupSearching(false);
    }
  };

  useEffect(() => {
    const query = debouncedStorePickupAddress.trim();
    if (query.length < 3) {
      storeLookupIdRef.current += 1;
      setStorePickupSuggestions([]);
      setStorePickupLookupError(null);
      return;
    }
    if (storeAutoFillRef.current === query) {
      storeAutoFillRef.current = null;
      return;
    }
    const lookupId = (storeLookupIdRef.current += 1);
    setStorePickupLookupError(null);
    lookupAddress(query)
      .then((result) => {
        if (storeLookupIdRef.current !== lookupId) return;
        if (storePickupAddressRef.current.trim() !== query) return;
        setStorePickupSuggestions(result.candidates);
        if (result.candidates.length === 0) {
          setStorePickupLookupError(t('onboarding.farmer.store.pickupLookupEmpty'));
          return;
        }
        const topCandidate = result.candidates[0];
        if (
          topCandidate?.address &&
          topCandidate.address !== storePickupAddressRef.current.trim() &&
          topCandidate.address.startsWith(query)
        ) {
          storeAutoFillRef.current = topCandidate.address;
          setStoreForm((prev) => ({
            ...prev,
            pickupAddress: topCandidate.address,
            pickupPostNumber: '',
            pickupYamatoZipCode: ''
          }));
        }
      })
      .catch((error: any) => {
        if (storeLookupIdRef.current !== lookupId) return;
        if (storePickupAddressRef.current.trim() !== query) return;
        setStorePickupLookupError(error?.message || t('onboarding.farmer.store.pickupLookupFailed'));
      })
      .finally(() => {
        if (storeLookupIdRef.current !== lookupId) return;
      });
  }, [debouncedStorePickupAddress, t]);

  useEffect(() => {
    const query = debouncedProductPickupAddress.trim();
    if (query.length < 3) {
      productLookupIdRef.current += 1;
      setProductPickupSuggestions([]);
      setProductPickupLookupError(null);
      return;
    }
    if (productAutoFillRef.current === query) {
      productAutoFillRef.current = null;
      return;
    }
    const lookupId = (productLookupIdRef.current += 1);
    setProductPickupLookupError(null);
    lookupAddress(query)
      .then((result) => {
        if (productLookupIdRef.current !== lookupId) return;
        if (productPickupAddressRef.current.trim() !== query) return;
        setProductPickupSuggestions(result.candidates);
        if (result.candidates.length === 0) {
          setProductPickupLookupError(t('onboarding.farmer.product.pickupLookupEmpty'));
          return;
        }
        const topCandidate = result.candidates[0];
        if (
          topCandidate?.address &&
          topCandidate.address !== productPickupAddressRef.current.trim() &&
          topCandidate.address.startsWith(query)
        ) {
          productAutoFillRef.current = topCandidate.address;
          setProductForm((prev) => ({
            ...prev,
            pickupAddress: topCandidate.address,
            pickupPostNumber: '',
            pickupYamatoZipCode: ''
          }));
        }
      })
      .catch((error: any) => {
        if (productLookupIdRef.current !== lookupId) return;
        if (productPickupAddressRef.current.trim() !== query) return;
        setProductPickupLookupError(error?.message || t('onboarding.farmer.product.pickupLookupFailed'));
      })
      .finally(() => {
        if (productLookupIdRef.current !== lookupId) return;
      });
  }, [debouncedProductPickupAddress, t]);

  const applyProductPickupSuggestion = (candidate: AddressCandidate) => {
    setProductForm((prev) => ({
      ...prev,
      pickupAddress: candidate.address,
      pickupPostNumber: '',
      pickupYamatoZipCode: ''
    }));
    setProductPickupSuggestions([]);
    setProductPickupLookupError(null);
    setProductPickupVerifyError(null);
  };

  const handleVerifyProductPickup = async () => {
    const address = productForm.pickupAddress.trim();
    if (!address) {
      setProductPickupVerifyError(t('onboarding.farmer.product.pickupAddressRequired'));
      return;
    }
    setProductPickupVerifyError(null);
    setIsProductPickupVerifying(true);
    try {
      const result = await resolveYamatoZip(address);
      setProductForm((prev) => ({
        ...prev,
        pickupAddress: result.normalizedAddress || prev.pickupAddress,
        pickupPostNumber: result.postNumber,
        pickupYamatoZipCode: result.yamatoZipCode
      }));
      setProductPickupSuggestions([]);
    } catch (error: any) {
      setProductPickupVerifyError(error?.message || t('onboarding.farmer.product.pickupVerifyFailed'));
    } finally {
      setIsProductPickupVerifying(false);
    }
  };

  const handleSelectProductPickupStore = (storeId: string) => {
    const store = verifiedStores.find((item) => item.id === storeId);
    if (!store) return;
    setSelectedProductPickupStoreId(storeId);
    setProductForm((prev) => ({
      ...prev,
      pickupAddress: store.pickup?.address || store.location || '',
      pickupContactName: store.pickup?.contactName || store.contact?.name || store.name || '',
      pickupContactTel: store.pickup?.contactTel || store.contact?.phone || '',
      pickupContactMobile: store.pickup?.contactMobile || '',
      pickupPostNumber: store.pickup?.postNumber || '',
      pickupYamatoZipCode: store.pickup?.yamatoZipCode || ''
    }));
    setProductPickupSuggestions([]);
    setProductPickupLookupError(null);
    setProductPickupVerifyError(null);
  };

  const handleProductSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!user?.id) return;

    if (!productForm.name.trim() || !productForm.unit.trim()) {
      setFormError(t('onboarding.farmer.product.required'));
      return;
    }

    if (productForm.unit === 'other' && !productForm.unitOther.trim()) {
      setFormError(t('onboarding.farmer.product.unitOtherRequired'));
      return;
    }

    if (!productForm.pickupAddress.trim()) {
      setFormError(t('onboarding.farmer.product.pickupAddressRequired'));
      return;
    }

    if (
      !productForm.pickupContactName.trim() ||
      !productForm.pickupContactTel.trim() ||
      !productForm.pickupContactMobile.trim()
    ) {
      setFormError(t('onboarding.farmer.product.pickupContactRequired'));
      return;
    }

    let pickupAddress = productForm.pickupAddress.trim();
    let pickupPostNumber = productForm.pickupPostNumber.trim();
    let pickupYamatoZipCode = productForm.pickupYamatoZipCode.trim();

    if (!pickupYamatoZipCode) {
      setIsProductPickupVerifying(true);
      setProductPickupVerifyError(null);
      try {
        const result = await resolveYamatoZip(pickupAddress);
        pickupAddress = result.normalizedAddress || pickupAddress;
        pickupPostNumber = result.postNumber;
        pickupYamatoZipCode = result.yamatoZipCode;
        setProductForm((prev) => ({
          ...prev,
          pickupAddress,
          pickupPostNumber,
          pickupYamatoZipCode
        }));
        setProductPickupSuggestions([]);
      } catch (error: any) {
        setProductPickupVerifyError(error?.message || t('onboarding.farmer.product.pickupVerifyFailed'));
        return;
      } finally {
        setIsProductPickupVerifying(false);
      }
    }

    if (!pickupYamatoZipCode) {
      setFormError(t('onboarding.farmer.product.pickupVerifyRequired'));
      return;
    }

    const price = Number(productForm.price);
    const stock = Number(productForm.stock);

    if (Number.isNaN(price) || Number.isNaN(stock)) {
      setFormError(t('onboarding.farmer.product.numberRequired'));
      return;
    }

    const resolvedUnit = productForm.unit === 'other' ? productForm.unitOther.trim() : productForm.unit;

    setProductSaving(true);
    try {
      let imageUrl: string | undefined;
      if (productImageFile && storage) {
        const imageRef = ref(storage, `products/${user.id}/${Date.now()}-${productImageFile.name}`);
        await uploadBytes(imageRef, productImageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      const pickup = pickupAddress
        ? {
            address: pickupAddress,
            yamatoZipCode: pickupYamatoZipCode,
            postNumber: pickupPostNumber,
            contactName: productForm.pickupContactName.trim(),
            contactTel: productForm.pickupContactTel.trim(),
            contactMobile: productForm.pickupContactMobile.trim(),
            verifiedAt: pickupYamatoZipCode ? Timestamp.now() : undefined
          }
        : undefined;

      await DatabaseService.createProduct(user.id, {
        name: productForm.name.trim(),
        category: productForm.category,
        unit: resolvedUnit,
        price,
        stock,
        description: productForm.description.trim(),
        pickup,
        images: imageUrl ? [imageUrl] : [],
        tags: []
      });

      await refreshUserData();
      setViewStep(null);
      toast({
        title: t('onboarding.farmer.product.savedTitle'),
        description: t('onboarding.farmer.savedBackend')
      });
      setProductForm({
        name: '',
        category: 'other',
        unit: 'kg',
        unitOther: '',
        price: '',
        stock: '',
        description: '',
        pickupAddress: '',
        pickupContactName: '',
        pickupContactTel: '',
        pickupContactMobile: '',
        pickupPostNumber: '',
        pickupYamatoZipCode: ''
      });
      setProductPickupSuggestions([]);
      setProductPickupLookupError(null);
      setProductPickupVerifyError(null);
      setSelectedProductPickupStoreId('');
      setProductImageFile(null);
      setProductImagePreview(null);
    } catch (error) {
      console.error('Failed to save product', error);
      toast({
        variant: 'destructive',
        title: t('onboarding.farmer.error'),
        description: t('onboarding.farmer.tryAgain')
      });
    } finally {
      setProductSaving(false);
    }
  };

  const handleBackStep = () => {
    if (displayedStepIndex > 0) {
      setViewStep(steps[displayedStepIndex - 1].key);
    }
  };

  const renderStepContent = () => {
    switch (displayedStep) {
      case 'profile':
        return (
          <form className="space-y-5" onSubmit={handleProfileSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.profile.nameLabel')}
                </label>
                <Input
                  value={profileForm.displayName}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))
                  }
                  placeholder={t('onboarding.farmer.profile.namePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.profile.emailLabel')}
                </label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder={t('onboarding.farmer.profile.emailPlaceholder')}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">LINE ID</label>
              <Input
                value={user?.lineUserId || user?.id || ''}
                readOnly
                disabled
                placeholder="LINE user id"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {displayedStepIndex > 0 && (
                  <Button type="button" variant="ghost" onClick={handleBackStep}>
                    {t('common.back')}
                  </Button>
                )}
                <p className="text-sm text-gray-500">{t('onboarding.farmer.reminder')}</p>
              </div>
              <Button type="submit" disabled={profileSaving}>
                {profileSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('onboarding.farmer.profile.cta')}
              </Button>
            </div>
          </form>
        );
      case 'store':
        return (
          <form className="space-y-5" onSubmit={handleStoreSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.store.nameLabel')}
                </label>
                <Input
                  value={storeForm.name}
                  onChange={(event) => setStoreForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={t('onboarding.farmer.store.namePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.store.typeLabel')}
                </label>
                <Select
                  value={storeForm.type}
                  onValueChange={(value) => setStoreForm((prev) => ({ ...prev, type: value as Store['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('onboarding.farmer.store.typePlaceholder')} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.store.locationLabel')}
                </label>
                <Input
                  value={storeForm.location}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setStoreForm((prev) => ({
                      ...prev,
                      location: nextValue
                    }));
                  }}
                  placeholder={t('onboarding.farmer.store.locationPlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.store.contactLabel')}
                </label>
                <Input
                  value={storeForm.contactName}
                  onChange={(event) =>
                    setStoreForm((prev) => ({ ...prev, contactName: event.target.value }))
                  }
                  placeholder={t('onboarding.farmer.store.contactPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">
                    {t('onboarding.farmer.store.pickupSectionTitle')}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {t('onboarding.farmer.store.pickupSectionHint')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseLocationForStore}
                    disabled={isStorePickupSearching}
                    className="gap-2"
                  >
                    {isStorePickupSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('onboarding.farmer.store.pickupSearching')}
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        {t('onboarding.farmer.store.pickupUseLocation')}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLookupStoreAddress}
                    disabled={isStorePickupSearching || !storeForm.pickupAddress.trim()}
                  >
                    {t('onboarding.farmer.store.pickupSearch')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerifyStoreAddress}
                    disabled={isStorePickupVerifying || !storeForm.pickupAddress.trim()}
                    className="gap-2"
                  >
                    {isStorePickupVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('onboarding.farmer.store.pickupVerifying')}
                      </>
                    ) : (
                      t('onboarding.farmer.store.pickupVerify')
                    )}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.store.pickupAddress')}
                  </label>
                  <Input
                    value={storeForm.pickupAddress}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setStoreForm((prev) => ({
                        ...prev,
                        pickupAddress: nextValue,
                        pickupPostNumber: '',
                        pickupYamatoZipCode: ''
                      }));
                      setStorePickupLookupError(null);
                      setStorePickupVerifyError(null);
                      setStorePickupSuggestions([]);
                    }}
                    placeholder={t('onboarding.farmer.store.pickupAddressPlaceholder')}
                  />
                  {storePickupSuggestions.length > 0 && (
                    <div className="rounded-md border border-gray-200 bg-white p-2">
                      <p className="text-xs text-gray-500">
                        {t('onboarding.farmer.store.pickupSuggestions')}
                      </p>
                      <div className="flex flex-col gap-2 mt-2">
                        {storePickupSuggestions.map((candidate, index) => (
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
                  {storePickupLookupError && (
                    <div className="text-sm text-red-600">{storePickupLookupError}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.store.pickupPostNumber')}
                  </label>
                  <Input
                    value={storeForm.pickupPostNumber}
                    readOnly
                    placeholder={t('onboarding.farmer.store.pickupPostNumberPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.store.pickupYamatoZipCode')}
                  </label>
                  <Input
                    value={storeForm.pickupYamatoZipCode}
                    readOnly
                    placeholder={t('onboarding.farmer.store.pickupYamatoZipCodePlaceholder')}
                  />
                </div>
              </div>
              {storePickupVerifyError && (
                <div className="text-sm text-red-600">{storePickupVerifyError}</div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.store.phoneLabel')}
                </label>
                <Input
                  value={storeForm.contactPhone}
                  onChange={(event) =>
                    setStoreForm((prev) => ({ ...prev, contactPhone: event.target.value }))
                  }
                  placeholder={t('onboarding.farmer.store.phonePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.store.notesLabel')}
                </label>
                <Textarea
                  value={storeForm.notes}
                  onChange={(event) => setStoreForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder={t('onboarding.farmer.store.notesPlaceholder')}
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {displayedStepIndex > 0 && (
                  <Button type="button" variant="ghost" onClick={handleBackStep}>
                    {t('common.back')}
                  </Button>
                )}
                <p className="text-sm text-gray-500">{t('onboarding.farmer.reminder')}</p>
              </div>
              <Button type="submit" disabled={storeSaving || isStorePickupVerifying}>
                {storeSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('onboarding.farmer.store.cta')}
              </Button>
            </div>
          </form>
        );
      case 'product':
        return (
          <form className="space-y-5" onSubmit={handleProductSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.product.nameLabel')}
                </label>
                <Input
                  value={productForm.name}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={t('onboarding.farmer.product.namePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.product.categoryLabel')}
                </label>
                <Select
                  value={productForm.category}
                  onValueChange={(value) => setProductForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('onboarding.farmer.product.categoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eggs">{t('farmer.products.eggs')}</SelectItem>
                    <SelectItem value="poultry">{t('farmer.products.poultry')}</SelectItem>
                    <SelectItem value="vegetables">{t('farmer.products.vegetables')}</SelectItem>
                    <SelectItem value="fruits">{t('farmer.products.fruits')}</SelectItem>
                    <SelectItem value="dairy">{t('farmer.products.dairy')}</SelectItem>
                    <SelectItem value="other">{t('farmer.products.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.product.unitLabel')}
                </label>
                <Select
                  value={productForm.unit}
                  onValueChange={(value) => setProductForm((prev) => ({ ...prev, unit: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('onboarding.farmer.product.unitPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="ton">ton</SelectItem>
                    <SelectItem value="box">{t('onboarding.farmer.product.unitBox')}</SelectItem>
                    <SelectItem value="bag">{t('onboarding.farmer.product.unitBag')}</SelectItem>
                    <SelectItem value="piece">{t('onboarding.farmer.product.unitPiece')}</SelectItem>
                    <SelectItem value="bunch">{t('onboarding.farmer.product.unitBunch')}</SelectItem>
                    <SelectItem value="liter">liter</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="dozen">{t('onboarding.farmer.product.unitDozen')}</SelectItem>
                    <SelectItem value="other">{t('common.other')}</SelectItem>
                  </SelectContent>
                </Select>
                {productForm.unit === 'other' && (
                  <Input
                    className="mt-2"
                    value={productForm.unitOther}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, unitOther: event.target.value }))}
                    placeholder={t('onboarding.farmer.product.unitOtherPlaceholder')}
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.product.priceLabel')}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))}
                  placeholder={t('onboarding.farmer.product.pricePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  {t('onboarding.farmer.product.stockLabel')}
                </label>
                <Input
                  type="number"
                  min="0"
                  value={productForm.stock}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, stock: event.target.value }))}
                  placeholder={t('onboarding.farmer.product.stockPlaceholder')}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.farmer.product.descriptionLabel')}
              </label>
              <Textarea
                value={productForm.description}
                onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder={t('onboarding.farmer.product.descriptionPlaceholder')}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">
                    {t('onboarding.farmer.product.pickupSectionTitle')}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {t('onboarding.farmer.product.pickupSectionHint')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseLocationForProductPickup}
                    disabled={isProductPickupSearching}
                    className="gap-2"
                  >
                    {isProductPickupSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('onboarding.farmer.product.pickupSearching')}
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        {t('onboarding.farmer.product.pickupUseLocation')}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLookupProductPickupAddress}
                    disabled={isProductPickupSearching || !productForm.pickupAddress.trim()}
                  >
                    {t('onboarding.farmer.product.pickupSearch')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerifyProductPickup}
                    disabled={isProductPickupVerifying || !productForm.pickupAddress.trim()}
                    className="gap-2"
                  >
                    {isProductPickupVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('onboarding.farmer.product.pickupVerifying')}
                      </>
                    ) : (
                      t('onboarding.farmer.product.pickupVerify')
                    )}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {verifiedStores.length > 0 && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700">
                      {t('onboarding.farmer.product.pickupUseStore')}
                    </label>
                    <Select value={selectedProductPickupStoreId} onValueChange={handleSelectProductPickupStore}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('onboarding.farmer.product.pickupUseStorePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {verifiedStores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name} - {store.pickup?.address || store.location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.product.pickupAddress')}
                  </label>
                  <Input
                    value={productForm.pickupAddress}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setProductForm((prev) => ({
                        ...prev,
                        pickupAddress: nextValue,
                        pickupPostNumber: '',
                        pickupYamatoZipCode: ''
                      }));
                      setProductPickupLookupError(null);
                      setProductPickupVerifyError(null);
                      setProductPickupSuggestions([]);
                      setSelectedProductPickupStoreId('');
                    }}
                    placeholder={t('onboarding.farmer.product.pickupAddressPlaceholder')}
                  />
                  {productPickupSuggestions.length > 0 && (
                    <div className="rounded-md border border-gray-200 bg-white p-2">
                      <p className="text-xs text-gray-500">
                        {t('onboarding.farmer.product.pickupSuggestions')}
                      </p>
                      <div className="flex flex-col gap-2 mt-2">
                        {productPickupSuggestions.map((candidate, index) => (
                          <button
                            key={`${candidate.address}-${index}`}
                            type="button"
                            onClick={() => applyProductPickupSuggestion(candidate)}
                            className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-green-400 hover:bg-green-50"
                          >
                            {candidate.address}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {productPickupLookupError && (
                    <div className="text-sm text-red-600">{productPickupLookupError}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.product.pickupContactName')}
                  </label>
                  <Input
                    value={productForm.pickupContactName}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, pickupContactName: event.target.value }))}
                    placeholder={t('onboarding.farmer.product.pickupContactNamePlaceholder')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.product.pickupContactTel')}
                  </label>
                  <Input
                    value={productForm.pickupContactTel}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, pickupContactTel: event.target.value }))}
                    placeholder={t('onboarding.farmer.product.pickupContactTelPlaceholder')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.product.pickupContactMobile')}
                  </label>
                  <Input
                    value={productForm.pickupContactMobile}
                    onChange={(event) =>
                      setProductForm((prev) => ({ ...prev, pickupContactMobile: event.target.value }))
                    }
                    placeholder={t('onboarding.farmer.product.pickupContactMobilePlaceholder')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.product.pickupPostNumber')}
                  </label>
                  <Input
                    value={productForm.pickupPostNumber}
                    readOnly
                    placeholder={t('onboarding.farmer.product.pickupPostNumberPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {t('onboarding.farmer.product.pickupYamatoZipCode')}
                  </label>
                  <Input
                    value={productForm.pickupYamatoZipCode}
                    readOnly
                    placeholder={t('onboarding.farmer.product.pickupYamatoZipCodePlaceholder')}
                  />
                </div>
              </div>
              {productPickupVerifyError && (
                <div className="text-sm text-red-600">{productPickupVerifyError}</div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('onboarding.farmer.product.imageLabel')}{' '}
                <span className="text-gray-500">({t('common.optional') ?? 'Optional'})</span>
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setProductImageFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setProductImagePreview(reader.result as string);
                    reader.readAsDataURL(file);
                  } else {
                    setProductImageFile(null);
                    setProductImagePreview(null);
                  }
                }}
              />
              {productImagePreview && (
                <img
                  src={productImagePreview}
                  alt="Preview"
                  className="h-24 w-24 rounded-lg object-cover border border-gray-200"
                />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {displayedStepIndex > 0 && (
                  <Button type="button" variant="ghost" onClick={handleBackStep}>
                    {t('common.back')}
                  </Button>
                )}
                <p className="text-sm text-gray-500">{t('onboarding.farmer.reminder')}</p>
              </div>
              <Button type="submit" disabled={productSaving}>
                {productSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('onboarding.farmer.product.cta')}
              </Button>
            </div>
          </form>
        );
      default:
        return null;
    }
  };

  if (!user || user.role !== 'farmer') {
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
      <Card className="border-2 border-green-100 bg-green-50">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Leaf className="w-5 h-5" />
            {t('onboarding.farmer.title')}
          </CardTitle>
          <CardDescription className="text-green-700">
            {t('onboarding.farmer.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          <Alert className="border-green-200 bg-white hidden sm:flex">
            <AlertTitle className="text-green-800">
              {t('onboarding.farmer.locked')}
            </AlertTitle>
            <AlertDescription className="text-green-700">
              {progressText}
            </AlertDescription>
          </Alert>
          <div className="sm:hidden flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {displayedStepItem && DisplayedIcon && (
                <Badge
                  variant="secondary"
                  className="whitespace-nowrap flex items-center gap-1 ring-2 ring-green-500 ring-offset-1"
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
                      ? 'border-green-500 ring-1 ring-green-100'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={step.completed ? 'default' : 'outline'}>
                      {step.completed ? t('onboarding.status.done') : t('onboarding.status.pending')}
                    </Badge>
                    {step.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : index === steps.findIndex((s) => !s.completed) ? (
                      <CircleDot className="w-5 h-5 text-orange-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-green-700" />
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
              <AlertTitle>{t('onboarding.farmer.error')}</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {t('common.step')} {(displayedStepIndex >= 0 ? displayedStepIndex : activeStepIndex) + 1} /{' '}
                  {steps.length}
                </p>
                <h3 className="text-xl font-semibold text-gray-900">
                  {steps.find((step) => step.key === displayedStep)?.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {steps.find((step) => step.key === displayedStep)?.description}
                </p>
              </div>
              <Badge variant="secondary" className="text-green-700 bg-green-100 border-green-200">
                {t('onboarding.status.required')}
              </Badge>
            </div>
            {renderStepContent()}
          </div>

          <p className="text-sm text-gray-500 text-center">
            {t('onboarding.farmer.returnNotice')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmerOnboarding;
