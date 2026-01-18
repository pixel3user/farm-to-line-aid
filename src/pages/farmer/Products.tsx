import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Clipboard, Download, Eye, EyeOff, Filter, Loader2, Plus, RefreshCw, Search, Sparkles, Edit, Trash2, Upload, X, Image as ImageIcon, MapPin } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Timestamp, collection, onSnapshot, orderBy, query as fsQuery, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { DatabaseService, Product, Store } from '@/lib/database';
import { UserDataService } from '@/services/userDataService';
import resolveApiBaseUrl from '@/lib/api';
import { AddressCandidate, lookupAddress, reverseLookupAddress, resolveYamatoZip } from '@/lib/address';
import { getMarketingCopy, languageLabel } from '@/lib/marketingCopy';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const formatDate = (timestamp?: Timestamp) => {
  if (!timestamp) return '';
  try {
    return timestamp.toDate().toLocaleDateString();
  } catch (error) {
    console.error('Failed to format date:', error);
    return '';
  }
};

const getStockVariant = (stock: number) =>
  stock <= 10 ? 'destructive' : stock <= 50 ? 'secondary' : 'default';

type MarketingProduct = Partial<Product> & { id: string; name: string; photos?: string[] };

const readImageFile = (file: File) =>
  new Promise<{ previewUrl: string; base64: string; mimeType: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read image file.'));
        return;
      }
      const previewUrl = reader.result;
      const base64 = previewUrl.split(',')[1] ?? '';
      if (!base64) {
        reject(new Error('Unable to extract image data.'));
        return;
      }
      resolve({ previewUrl, base64, mimeType: file.type || 'image/png' });
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });

const base64ToUint8Array = (base64: string) => {
  const normalized = base64.replace(/^data:.+;base64,/, '');
  const binaryString = atob(normalized);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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

const isValidTaiwanMobile = (value: string) => /^09\d{8}$/.test(normalizeTaiwanMobile(value));

const isValidTaiwanTel = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return false;
  if (!digits.startsWith('0') || digits.startsWith('09')) return false;
  return digits.length >= 9 && digits.length <= 10;
};

const FarmerProducts: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user, userProducts, userStores, refreshUserData, isLoading, isRefreshingData } = useAuth();
  const queryClient = useQueryClient();
  const copy = useMemo(() => getMarketingCopy(language), [language]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isEnhancementDialogOpen, setIsEnhancementDialogOpen] = useState(false);
  const [createdProductForMarketing, setCreatedProductForMarketing] = useState<MarketingProduct | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const previousUserIdRef = useRef<string | null>(null);
  const createImageInputRef = useRef<HTMLInputElement | null>(null);
  const createCameraInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const editCameraInputRef = useRef<HTMLInputElement | null>(null);
  const editStepOverrideRef = useRef<number | null>(null);
  const autoImagePickerRef = useRef<'upload' | 'camera' | null>(null);
  const enhanceAfterImageRef = useRef(false);
  const enhancementFileInputRef = useRef<HTMLInputElement | null>(null);
  const enhancementAbortRef = useRef<AbortController | null>(null);
  const pickupAddressRef = useRef('');
  const editPickupAddressRef = useRef('');
  const pickupAutoFillRef = useRef<string | null>(null);
  const editPickupAutoFillRef = useRef<string | null>(null);
  const pickupLookupIdRef = useRef(0);
  const editPickupLookupIdRef = useRef(0);
  const [formData, setFormData] = useState({
    name: '',
    category: 'general',
    unit: '',
    price: 0,
    stock: 0,
    description: '',
    pickupAddress: '',
    pickupContactName: '',
    pickupContactTel: '',
    pickupContactMobile: '',
    pickupPostNumber: '',
    pickupYamatoZipCode: ''
  });
  const [createImages, setCreateImages] = useState<File[]>([]);
  const [isVerifyingPickup, setIsVerifyingPickup] = useState(false);
  const [pickupVerifyError, setPickupVerifyError] = useState<string | null>(null);
  const [pickupContactError, setPickupContactError] = useState<string | null>(null);
  const [editPickupContactError, setEditPickupContactError] = useState<string | null>(null);
  const [pickupLookupError, setPickupLookupError] = useState<string | null>(null);
  const [pickupSuggestions, setPickupSuggestions] = useState<AddressCandidate[]>([]);
  const [isPickupSearching, setIsPickupSearching] = useState(false);
  const [selectedPickupStoreId, setSelectedPickupStoreId] = useState<string>('');
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: 'general',
    unit: '',
    price: 0,
    stock: 0,
    description: '',
    images: [] as string[],
    pickupAddress: '',
    pickupContactName: '',
    pickupContactTel: '',
    pickupContactMobile: '',
    pickupPostNumber: '',
    pickupYamatoZipCode: ''
  });
  const createImagePreviews = useMemo(
    () => createImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [createImages]
  );
  const [editPickupSuggestions, setEditPickupSuggestions] = useState<AddressCandidate[]>([]);
  const [editPickupLookupError, setEditPickupLookupError] = useState<string | null>(null);
  const [isEditPickupSearching, setIsEditPickupSearching] = useState(false);
  const [selectedEditPickupStoreId, setSelectedEditPickupStoreId] = useState<string>('');
  const [enhancementPrompt, setEnhancementPrompt] = useState('');
  const [enhancementUploadedImage, setEnhancementUploadedImage] = useState<{
    name: string;
    previewUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementOutputText, setEnhancementOutputText] = useState('');
  const [enhancementOutputImages, setEnhancementOutputImages] = useState<Array<{ base64: string; mimeType: string }>>([]);
  const [enhancementError, setEnhancementError] = useState<string | null>(null);
  const [enhancementCopied, setEnhancementCopied] = useState(false);
  const [isApplyingAssets, setIsApplyingAssets] = useState(false);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [showPostApplySummary, setShowPostApplySummary] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const debouncedPickupAddress = useDebouncedValue(formData.pickupAddress, 400);
  const debouncedEditPickupAddress = useDebouncedValue(editFormData.pickupAddress, 400);
  const [mobileCreateStep, setMobileCreateStep] = useState(0);
  const [mobileEditStep, setMobileEditStep] = useState(0);
  const storedProductImageUrl =
    createdProductForMarketing?.images?.[0] || createdProductForMarketing?.photos?.[0] || '';
  const enhancementErrorBlock = enhancementError ? (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
      {enhancementError}
    </div>
  ) : null;
  const selectedProductIsActive = selectedProduct?.isActive ?? true;
  const selectedProductStockVariant = selectedProduct ? getStockVariant(selectedProduct.stock) : 'default';

  const productsKey = useMemo(() => ['farmer-products', user?.id], [user?.id]);
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: productsKey,
    enabled: Boolean(user?.id),
    // Use live Firestore subscription for updates; reuse cache instantly on tab revisits.
    queryFn: async () => (queryClient.getQueryData(productsKey) as Product[]) || [],
    staleTime: Infinity,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    initialData: () => (userProducts as Product[]) || undefined,
    keepPreviousData: true,
  });
  const [verifiedStores, setVerifiedStores] = useState<Store[]>([]);
  const loadVerifiedStores = React.useCallback(async () => {
    if (!user?.id) {
      setVerifiedStores([]);
      return;
    }

    try {
      const stores = await UserDataService.getUserStores(user.id);
      const pickupStores = stores.filter((store) =>
        Boolean((store.pickup?.address || store.location || '').trim())
      );
      console.log('FarmerProducts: loaded pickup stores', pickupStores.length, pickupStores);
      setVerifiedStores(pickupStores);
    } catch (error) {
      console.error('FarmerProducts: failed to load verified stores', error);
      setVerifiedStores([]);
    }
  }, [user?.id, userStores]);

  React.useEffect(() => {
    loadVerifiedStores();
  }, [loadVerifiedStores]);

  // Live Firestore subscription keeps products up to date and cached between tab visits.
  useEffect(() => {
    if (!user?.id || !db) return;
    const q = fsQuery(collection(db, 'products'), where('userId', '==', user.id), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ ...(doc.data() as Product), id: doc.id }));
        queryClient.setQueryData(productsKey, docs);
        setLastRefreshTime(new Date());
      },
      (error) => {
        console.error('FarmerProducts: live subscription failed', error);
      }
    );
    return () => unsubscribe();
  }, [user?.id, queryClient, productsKey]);

  const handleRefresh = async () => {
    if (!user?.id || isRefreshingData) {
      return;
    }

    try {
      await refreshUserData();
      await loadVerifiedStores();
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to refresh products:', error);
    }
  };

  React.useEffect(() => {
    if (!user?.id) {
      previousUserIdRef.current = null;
      return;
    }

    if (previousUserIdRef.current === user.id) {
      return;
    }

    // Avoid triggering a refresh if one is already in progress
    previousUserIdRef.current = user.id;
    if (isRefreshingData) {
      return;
    }

    refreshUserData()
      .then(() => setLastRefreshTime(new Date()))
      .catch((error) => {
        console.error('Failed to refresh products:', error);
      });
  }, [user?.id, refreshUserData, isRefreshingData]);

  React.useEffect(() => {
    if (products) {
      setLastRefreshTime(new Date());
    }
  }, [products]);

  React.useEffect(() => {
    return () => {
      createImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [createImagePreviews]);

  // Prefetch and cache product images so revisits load instantly.
  useEffect(() => {
    if (!products?.length || typeof window === 'undefined' || !('caches' in window)) return;
    const cacheName = 'f2m-product-images-v1';
    const urls: string[] = [];
    products.forEach((product) => {
      product.images?.forEach((img) => {
        if (img && !cachedImageSetRef.current.has(img)) {
          urls.push(img);
          cachedImageSetRef.current.add(img);
        }
      });
    });
    if (!urls.length) return;
    caches
      .open(cacheName)
      .then((cache) => {
        urls.forEach((url) => {
          cache.match(url).then((res) => {
            if (res) return;
            fetch(url, { mode: 'cors' })
              .then((response) => {
                if (!response.ok) return;
                cache.put(url, response.clone()).catch(() => {});
              })
              .catch(() => {});
          });
        });
      })
      .catch(() => {});
  }, [products]);

  React.useEffect(() => {
    pickupAddressRef.current = formData.pickupAddress;
  }, [formData.pickupAddress]);

  React.useEffect(() => {
    editPickupAddressRef.current = editFormData.pickupAddress;
  }, [editFormData.pickupAddress]);

  React.useEffect(() => {
    if (!createdProductForMarketing?.id || !products?.length) return;
    const match = (products as Product[]).find((product) => product.id === createdProductForMarketing.id);
    if (match) {
      setCreatedProductForMarketing((prev) => (prev ? { ...prev, ...match } : match));
    }
  }, [products, createdProductForMarketing?.id]);

  React.useEffect(() => {
    if (isDialogOpen) {
      setMobileCreateStep(0);
      // Reload verified stores when dialog opens to ensure fresh data
      loadVerifiedStores();
    }
  }, [isDialogOpen, loadVerifiedStores]);

  // Auto-suggest nearby addresses when entering step 2 (address step)
  const previousCreateStepRef = useRef<number>(0);
  const hasAutoSuggestedRef = useRef<boolean>(false);
  React.useEffect(() => {
    // Reset auto-suggest flag when dialog closes
    if (!isDialogOpen) {
      hasAutoSuggestedRef.current = false;
      previousCreateStepRef.current = 0;
      return;
    }

    if (
      isDialogOpen &&
      isMobile &&
      mobileCreateStep === 2 &&
      previousCreateStepRef.current !== 2 &&
      !formData.pickupAddress.trim() &&
      pickupSuggestions.length === 0 &&
      !isPickupSearching &&
      !hasAutoSuggestedRef.current
    ) {
      // Automatically try to get location and suggest nearby addresses
      hasAutoSuggestedRef.current = true;
      handleUseLocationForPickup().catch((error) => {
        // Log error for debugging but don't show to user
        console.log('Auto location lookup failed:', error);
        hasAutoSuggestedRef.current = false; // Allow retry if failed
      });
    }
    previousCreateStepRef.current = mobileCreateStep;
  }, [isDialogOpen, isMobile, mobileCreateStep, formData.pickupAddress, pickupSuggestions.length, isPickupSearching]);

  const createStepTotal = 4;
  const editStepTotal = 5;

  React.useEffect(() => {
    if (isEditDialogOpen) {
      const override = editStepOverrideRef.current;
      if (override !== null) {
        const clamped = Math.max(0, Math.min(override, editStepTotal - 1));
        setMobileEditStep(clamped);
      } else {
        setMobileEditStep(0);
      }
      editStepOverrideRef.current = null;
    }
  }, [editStepTotal, isEditDialogOpen]);

  React.useEffect(() => {
    if (!isEditDialogOpen) return;
    const media = autoImagePickerRef.current;
    if (!media) return;
    if (isMobile && mobileEditStep !== 4) return;
    const input = media === 'camera' ? editCameraInputRef.current : editImageInputRef.current;
    if (!input || input.disabled) return;
    autoImagePickerRef.current = null;
    if (typeof window !== 'undefined') {
      window.setTimeout(() => input.click(), 0);
    } else {
      input.click();
    }
  }, [isEditDialogOpen, isMobile, mobileEditStep, isUploadingImages]);

  const stepLabel = (current: number, total: number) =>
    t('common.stepOf')
      .replace('{current}', String(current))
      .replace('{total}', String(total));
  const showStepError = () =>
    toast({
      title: t('common.error'),
      description: t('common.missingRequired'),
      variant: 'destructive'
    });
  const handleNumberFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    if (event.target.value === '0') {
      event.target.select();
    }
  };
  const resolvePickupContactError = (contactTel: string, contactMobile: string) => {
    const telValue = contactTel.trim();
    const mobileValue = contactMobile.trim();
    if (!telValue && !mobileValue) {
      return t('farmer.products.pickupContactRequired');
    }
    if (mobileValue && !isValidTaiwanMobile(mobileValue)) {
      return t('farmer.products.pickupContactMobileInvalid');
    }
    if (telValue) {
      const telDigits = telValue.replace(/[^0-9]/g, '');
      if (/^09\d{8}$/.test(normalizeTaiwanMobile(telValue)) || /^09\d{8}$/.test(telDigits)) {
        return t('farmer.products.pickupContactTelUseMobile');
      }
      if (!isValidTaiwanTel(telValue)) {
        return t('farmer.products.pickupContactTelInvalid');
      }
    }
    return null;
  };
  const handlePickupContactTelChange = (value: string) => {
    const normalized = normalizeTaiwanTelInput(value);
    setFormData((prev) => {
      const next = { ...prev, pickupContactTel: normalized };
      setPickupContactError(resolvePickupContactError(next.pickupContactTel, next.pickupContactMobile));
      return next;
    });
  };
  const handlePickupContactMobileChange = (value: string) => {
    const normalized = formatTaiwanMobileInput(value);
    setFormData((prev) => {
      const next = { ...prev, pickupContactMobile: normalized };
      setPickupContactError(resolvePickupContactError(next.pickupContactTel, next.pickupContactMobile));
      return next;
    });
  };
  const handleEditPickupContactTelChange = (value: string) => {
    const normalized = normalizeTaiwanTelInput(value);
    setEditFormData((prev) => {
      const next = { ...prev, pickupContactTel: normalized };
      setEditPickupContactError(resolvePickupContactError(next.pickupContactTel, next.pickupContactMobile));
      return next;
    });
  };
  const handleEditPickupContactMobileChange = (value: string) => {
    const normalized = formatTaiwanMobileInput(value);
    setEditFormData((prev) => {
      const next = { ...prev, pickupContactMobile: normalized };
      setEditPickupContactError(resolvePickupContactError(next.pickupContactTel, next.pickupContactMobile));
      return next;
    });
  };
  const handlePickupAddressChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      pickupAddress: value,
      pickupPostNumber: '',
      pickupYamatoZipCode: ''
    }));
    setPickupVerifyError(null);
    setPickupLookupError(null);
    setPickupSuggestions([]);
    setSelectedPickupStoreId('');
  };

  const handleCreateNextStep = async () => {
    const nameValue = formData.name?.trim() ?? '';
    const priceValue = Number(formData.price);
    const stockValue = Number(formData.stock);
    const pickupAddressValue = formData.pickupAddress?.trim() ?? '';
    const pickupZipValue = formData.pickupYamatoZipCode?.trim() ?? '';
    if (mobileCreateStep === 0 && !nameValue) {
      showStepError();
      return;
    }
    if (mobileCreateStep === 1) {
      if (!Number.isFinite(priceValue) || priceValue <= 0) {
        showStepError();
        return;
      }
      if (!Number.isFinite(stockValue) || stockValue < 0) {
        showStepError();
        return;
      }
    }
    if (mobileCreateStep === 2) {
      if (!pickupAddressValue) {
        setPickupVerifyError(t('farmer.products.pickupAddressRequired'));
        showStepError();
        return;
      }
      if (selectedPickupStoreId || !pickupZipValue) {
        const verified = await handleVerifyCreatePickup();
        if (!verified) {
          showStepError();
          return;
        }
      }
      const contactError = resolvePickupContactError(
        formData.pickupContactTel,
        formData.pickupContactMobile
      );
      if (contactError) {
        setPickupContactError(contactError);
        showStepError();
        return;
      }
    }
    setPickupVerifyError(null);
    setPickupContactError(null);
    setMobileCreateStep((prev) => Math.min(prev + 1, createStepTotal - 1));
  };

  const handleEditNextStep = async () => {
    const nameValue = editFormData.name?.trim() ?? '';
    const pickupAddressValue = editFormData.pickupAddress?.trim() ?? '';
    const pickupZipValue = editFormData.pickupYamatoZipCode?.trim() ?? '';
    if (mobileEditStep === 0 && !nameValue) {
      showStepError();
      return;
    }
    if (mobileEditStep === 2) {
      if (!pickupAddressValue) {
        setPickupVerifyError(t('farmer.products.pickupAddressRequired'));
        showStepError();
        return;
      }
      if (selectedEditPickupStoreId || !pickupZipValue) {
        const verified = await handleVerifyEditPickup();
        if (!verified) {
          showStepError();
          return;
        }
      }
    }
    if (mobileEditStep === 3) {
      const contactError = resolvePickupContactError(
        editFormData.pickupContactTel,
        editFormData.pickupContactMobile
      );
      if (contactError) {
        setEditPickupContactError(contactError);
        showStepError();
        return;
      }
    }
    setPickupVerifyError(null);
    setEditPickupContactError(null);
    setMobileEditStep((prev) => Math.min(prev + 1, editStepTotal - 1));
  };

  const resolveCreateSubmitStep = () => {
    const nameValue = formData.name?.trim() ?? '';
    if (!nameValue) {
      return 0;
    }
    const priceValue = Number(formData.price);
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      return 1;
    }
    const stockValue = Number(formData.stock);
    if (!Number.isFinite(stockValue) || stockValue < 0) {
      return 1;
    }
    const pickupAddressValue = formData.pickupAddress?.trim() ?? '';
    const pickupZipValue = formData.pickupYamatoZipCode?.trim() ?? '';
    if (!pickupAddressValue) {
      setPickupVerifyError(t('farmer.products.pickupAddressRequired'));
      return 2;
    }
    if (!pickupZipValue) {
      setPickupVerifyError(t('farmer.products.pickupVerifyRequired'));
      return 2;
    }
    const contactError = resolvePickupContactError(
      formData.pickupContactTel,
      formData.pickupContactMobile
    );
    if (contactError) {
      setPickupContactError(contactError);
      return 2;
    }
    return null;
  };

  const resolveEditSubmitStep = () => {
    const nameValue = editFormData.name?.trim() ?? '';
    if (!nameValue) {
      return 0;
    }
    const priceValue = Number(editFormData.price);
    if (!Number.isFinite(priceValue)) {
      return 1;
    }
    const stockValue = Number(editFormData.stock);
    if (!Number.isFinite(stockValue)) {
      return 1;
    }
    const pickupAddressValue = editFormData.pickupAddress?.trim() ?? '';
    const pickupZipValue = editFormData.pickupYamatoZipCode?.trim() ?? '';
    if (!pickupAddressValue) {
      setPickupVerifyError(t('farmer.products.pickupAddressRequired'));
      return 2;
    }
    if (!pickupZipValue) {
      setPickupVerifyError(t('farmer.products.pickupVerifyRequired'));
      return 2;
    }
    const contactError = resolvePickupContactError(
      editFormData.pickupContactTel,
      editFormData.pickupContactMobile
    );
    if (contactError) {
      setEditPickupContactError(contactError);
      return 3;
    }
    return null;
  };

  const categories = ['eggs', 'poultry', 'vegetables', 'fruits', 'dairy', 'other', 'general'];

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.isActive !== false) ||
        (statusFilter === 'inactive' && product.isActive === false);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, categoryFilter, statusFilter]);
  const hasProducts = (products?.length ?? 0) > 0;
  const showLoadingState = (isLoading || isRefreshingData) && !hasProducts;
  const totalProductsCount = filteredProducts.length;
  const activeProductsCount = filteredProducts.filter((product) => product.isActive !== false).length;
  const lowStockProductsCount = filteredProducts.filter((product) => product.stock <= 10).length;
  const inactiveProductsCount = Math.max(totalProductsCount - activeProductsCount, 0);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const cachedImageSetRef = useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add') {
      editStepOverrideRef.current = null;
      autoImagePickerRef.current = null;
      enhanceAfterImageRef.current = false;
      setIsDialogOpen(true);
      setSearchParams({});
      return;
    }
    if (action === 'edit') {
      const productId = searchParams.get('product');
      if (!productId) return;
    const target = (products || []).find((product) => product.id === productId);
      if (!target) return;
      const stepParam = searchParams.get('step');
      let overrideStep: number | null = null;
      if (stepParam === 'images') {
        overrideStep = 4;
      } else if (stepParam === 'pickup') {
        overrideStep = 2;
      } else if (stepParam) {
        const parsed = Number(stepParam);
        if (!Number.isNaN(parsed)) {
          overrideStep = Math.max(0, Math.min(parsed - 1, editStepTotal - 1));
        }
      }
      editStepOverrideRef.current = overrideStep;
      const media = searchParams.get('media');
      autoImagePickerRef.current = media === 'camera' || media === 'upload' ? media : null;
      enhanceAfterImageRef.current = searchParams.get('enhance') === '1';
      handleModifyClick(target);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, products, handleModifyClick]);

  const uploadProductImages = async (files: File[], userId: string, productId: string) => {
    const uploadPromises = files.map(async (file) => {
      const timestamp = Date.now();
      const fileName = `products/${userId}/${productId}/${timestamp}-${file.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    });

    return Promise.all(uploadPromises);
  };

  const handleCreateImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextFiles = Array.from(files);
    setCreateImages((prev) => [...prev, ...nextFiles].slice(0, 10));
    if (createImageInputRef.current) {
      createImageInputRef.current.value = '';
    }
    if (createCameraInputRef.current) {
      createCameraInputRef.current.value = '';
    }
  };

  const handleRemoveCreateImage = (index: number) => {
    setCreateImages((prev) => prev.filter((_, i) => i !== index));
  };

  const requestCurrentLocation = () =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        reject(new Error(t('farmer.products.pickupGeoUnavailable')));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => reject(new Error(t('farmer.products.pickupGeoDenied')))
      );
    });

  const handleLookupPickupAddress = async () => {
    const query = formData.pickupAddress.trim();
    if (!query) {
      setPickupLookupError(t('farmer.products.pickupLookupRequired'));
      return;
    }
    setIsPickupSearching(true);
    setPickupLookupError(null);
    try {
      const result = await lookupAddress(query);
      if (result.candidates.length === 0) {
        setPickupLookupError(t('farmer.products.pickupLookupEmpty'));
      }
      setPickupSuggestions(result.candidates);
      setSelectedPickupStoreId('');
      const topCandidate = result.candidates[0];
      if (topCandidate?.address && topCandidate.address.startsWith(query)) {
        pickupAutoFillRef.current = topCandidate.address;
        setFormData((prev) => ({
          ...prev,
          pickupAddress: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setPickupLookupError(error?.message || t('farmer.products.pickupLookupFailed'));
    } finally {
      setIsPickupSearching(false);
    }
  };

  const handleUseLocationForPickup = async () => {
    setIsPickupSearching(true);
    setPickupLookupError(null);
    try {
      const { lat, lng } = await requestCurrentLocation();
      const result = await reverseLookupAddress(lat, lng);
      if (result.candidates.length === 0) {
        setPickupLookupError(t('farmer.products.pickupLookupEmpty'));
      }
      setPickupSuggestions(result.candidates);
      setSelectedPickupStoreId('');
      const topCandidate = result.candidates[0];
      if (topCandidate?.address) {
        pickupAutoFillRef.current = topCandidate.address;
        setFormData((prev) => ({
          ...prev,
          pickupAddress: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setPickupLookupError(error?.message || t('farmer.products.pickupLookupFailed'));
    } finally {
      setIsPickupSearching(false);
    }
  };

  const applyPickupSuggestion = (candidate: AddressCandidate) => {
    setFormData((prev) => ({
      ...prev,
      pickupAddress: candidate.address,
      pickupPostNumber: '',
      pickupYamatoZipCode: ''
    }));
    setPickupSuggestions([]);
    setPickupLookupError(null);
    setPickupVerifyError(null);
  };

  const applyEditPickupSuggestion = (candidate: AddressCandidate) => {
    setEditFormData((prev) => ({
      ...prev,
      pickupAddress: candidate.address,
      pickupPostNumber: '',
      pickupYamatoZipCode: ''
    }));
    setEditPickupSuggestions([]);
    setEditPickupLookupError(null);
    setPickupVerifyError(null);
  };

  const handleLookupEditPickupAddress = async () => {
    const query = editFormData.pickupAddress.trim();
    if (!query) {
      setEditPickupLookupError(t('farmer.products.pickupLookupRequired'));
      return;
    }
    setIsEditPickupSearching(true);
    setEditPickupLookupError(null);
    try {
      const result = await lookupAddress(query);
      if (result.candidates.length === 0) {
        setEditPickupLookupError(t('farmer.products.pickupLookupEmpty'));
      }
      setEditPickupSuggestions(result.candidates);
      setSelectedEditPickupStoreId('');
      const topCandidate = result.candidates[0];
      if (topCandidate?.address && topCandidate.address.startsWith(query)) {
        editPickupAutoFillRef.current = topCandidate.address;
        setEditFormData((prev) => ({
          ...prev,
          pickupAddress: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setEditPickupLookupError(error?.message || t('farmer.products.pickupLookupFailed'));
    } finally {
      setIsEditPickupSearching(false);
    }
  };

  const handleUseLocationForEditPickup = async () => {
    setIsEditPickupSearching(true);
    setEditPickupLookupError(null);
    try {
      const { lat, lng } = await requestCurrentLocation();
      const result = await reverseLookupAddress(lat, lng);
      if (result.candidates.length === 0) {
        setEditPickupLookupError(t('farmer.products.pickupLookupEmpty'));
      }
      setEditPickupSuggestions(result.candidates);
      setSelectedEditPickupStoreId('');
      const topCandidate = result.candidates[0];
      if (topCandidate?.address) {
        editPickupAutoFillRef.current = topCandidate.address;
        setEditFormData((prev) => ({
          ...prev,
          pickupAddress: topCandidate.address,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
      }
    } catch (error: any) {
      setEditPickupLookupError(error?.message || t('farmer.products.pickupLookupFailed'));
    } finally {
      setIsEditPickupSearching(false);
    }
  };

  React.useEffect(() => {
    const query = debouncedPickupAddress.trim();
    if (query.length < 3) {
      pickupLookupIdRef.current += 1;
      setPickupSuggestions([]);
      setPickupLookupError(null);
      return;
    }
    if (pickupAutoFillRef.current === query) {
      pickupAutoFillRef.current = null;
      return;
    }
    const lookupId = (pickupLookupIdRef.current += 1);
    setPickupLookupError(null);
    lookupAddress(query)
      .then((result) => {
        if (pickupLookupIdRef.current !== lookupId) return;
        if (pickupAddressRef.current.trim() !== query) return;
        setPickupSuggestions(result.candidates);
        if (result.candidates.length === 0) {
          setPickupLookupError(t('farmer.products.pickupLookupEmpty'));
          return;
        }
        const topCandidate = result.candidates[0];
        if (
          topCandidate?.address &&
          topCandidate.address !== pickupAddressRef.current.trim() &&
          topCandidate.address.startsWith(query)
        ) {
          pickupAutoFillRef.current = topCandidate.address;
          setFormData((prev) => ({
            ...prev,
            pickupAddress: topCandidate.address,
            pickupPostNumber: '',
            pickupYamatoZipCode: ''
          }));
        }
      })
      .catch((error: any) => {
        if (pickupLookupIdRef.current !== lookupId) return;
        if (pickupAddressRef.current.trim() !== query) return;
        setPickupLookupError(error?.message || t('farmer.products.pickupLookupFailed'));
      })
      .finally(() => {
        if (pickupLookupIdRef.current !== lookupId) return;
      });
  }, [debouncedPickupAddress, t]);

  React.useEffect(() => {
    const query = debouncedEditPickupAddress.trim();
    if (query.length < 3) {
      editPickupLookupIdRef.current += 1;
      setEditPickupSuggestions([]);
      setEditPickupLookupError(null);
      return;
    }
    if (editPickupAutoFillRef.current === query) {
      editPickupAutoFillRef.current = null;
      return;
    }
    const lookupId = (editPickupLookupIdRef.current += 1);
    setEditPickupLookupError(null);
    lookupAddress(query)
      .then((result) => {
        if (editPickupLookupIdRef.current !== lookupId) return;
        if (editPickupAddressRef.current.trim() !== query) return;
        setEditPickupSuggestions(result.candidates);
        if (result.candidates.length === 0) {
          setEditPickupLookupError(t('farmer.products.pickupLookupEmpty'));
          return;
        }
        const topCandidate = result.candidates[0];
        if (
          topCandidate?.address &&
          topCandidate.address !== editPickupAddressRef.current.trim() &&
          topCandidate.address.startsWith(query)
        ) {
          editPickupAutoFillRef.current = topCandidate.address;
          setEditFormData((prev) => ({
            ...prev,
            pickupAddress: topCandidate.address,
            pickupPostNumber: '',
            pickupYamatoZipCode: ''
          }));
        }
      })
      .catch((error: any) => {
        if (editPickupLookupIdRef.current !== lookupId) return;
        if (editPickupAddressRef.current.trim() !== query) return;
        setEditPickupLookupError(error?.message || t('farmer.products.pickupLookupFailed'));
      })
      .finally(() => {
        if (editPickupLookupIdRef.current !== lookupId) return;
      });
  }, [debouncedEditPickupAddress, t]);

  const handleSelectPickupStore = (storeId: string) => {
    const store = verifiedStores.find((item) => item.id === storeId);
    if (!store) return;
    setSelectedPickupStoreId(storeId);
    setFormData((prev) => ({
      ...prev,
      pickupAddress: store.pickup?.address || store.location || '',
      pickupContactName: store.pickup?.contactName || store.contact?.name || store.name || '',
      pickupContactTel: store.pickup?.contactTel || store.contact?.phone || '',
      pickupContactMobile: store.pickup?.contactMobile || '',
      pickupPostNumber: store.pickup?.postNumber || '',
      pickupYamatoZipCode: store.pickup?.yamatoZipCode || ''
    }));
    setPickupSuggestions([]);
    setPickupLookupError(null);
    setPickupVerifyError(null);
    setPickupContactError(null);
  };

  const handleSelectEditPickupStore = (storeId: string) => {
    const store = verifiedStores.find((item) => item.id === storeId);
    if (!store) return;
    setSelectedEditPickupStoreId(storeId);
    setEditFormData((prev) => ({
      ...prev,
      pickupAddress: store.pickup?.address || store.location || '',
      pickupContactName: store.pickup?.contactName || store.contact?.name || store.name || '',
      pickupContactTel: store.pickup?.contactTel || store.contact?.phone || '',
      pickupContactMobile: store.pickup?.contactMobile || '',
      pickupPostNumber: store.pickup?.postNumber || '',
      pickupYamatoZipCode: store.pickup?.yamatoZipCode || ''
    }));
    setEditPickupSuggestions([]);
    setEditPickupLookupError(null);
    setPickupVerifyError(null);
  };

  const handleVerifyCreatePickup = async (): Promise<boolean> => {
    const address = formData.pickupAddress.trim();
    if (!address) {
      setPickupVerifyError(t('farmer.products.pickupAddressRequired'));
      return false;
    }
    setPickupVerifyError(null);
    setIsVerifyingPickup(true);
    try {
      const result = await resolveYamatoZip(address);
      if (!result.postNumber || !result.yamatoZipCode) {
        setFormData((prev) => ({
          ...prev,
          pickupAddress: result.normalizedAddress || prev.pickupAddress,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
        setPickupVerifyError(t('farmer.products.pickupVerifyFailed'));
        return false;
      }
      setFormData((prev) => ({
        ...prev,
        pickupAddress: result.normalizedAddress || prev.pickupAddress,
        pickupPostNumber: result.postNumber || '',
        pickupYamatoZipCode: result.yamatoZipCode || ''
      }));
      setPickupSuggestions([]);
      return true;
    } catch (error: any) {
      setPickupVerifyError(error?.message || t('farmer.products.pickupVerifyFailed'));
      return false;
    } finally {
      setIsVerifyingPickup(false);
    }
  };

  const handleVerifyEditPickup = async (): Promise<boolean> => {
    const address = editFormData.pickupAddress.trim();
    if (!address) {
      setPickupVerifyError(t('farmer.products.pickupAddressRequired'));
      return false;
    }
    setPickupVerifyError(null);
    setIsVerifyingPickup(true);
    try {
      const result = await resolveYamatoZip(address);
      if (!result.postNumber || !result.yamatoZipCode) {
        setEditFormData((prev) => ({
          ...prev,
          pickupAddress: result.normalizedAddress || prev.pickupAddress,
          pickupPostNumber: '',
          pickupYamatoZipCode: ''
        }));
        setPickupVerifyError(t('farmer.products.pickupVerifyFailed'));
        return false;
      }
      setEditFormData((prev) => ({
        ...prev,
        pickupAddress: result.normalizedAddress || prev.pickupAddress,
        pickupPostNumber: result.postNumber || '',
        pickupYamatoZipCode: result.yamatoZipCode || ''
      }));
      setEditPickupSuggestions([]);
      return true;
    } catch (error: any) {
      setPickupVerifyError(error?.message || t('farmer.products.pickupVerifyFailed'));
      return false;
    } finally {
      setIsVerifyingPickup(false);
    }
  };

  const resetEnhancementState = () => {
    enhancementAbortRef.current?.abort();
    setEnhancementPrompt('');
    setEnhancementUploadedImage(null);
    setEnhancementOutputText('');
    setEnhancementOutputImages([]);
    setEnhancementError(null);
    setEnhancementCopied(false);
    setIsEnhancing(false);
    setIsApplyingAssets(false);
    setShowResultScreen(false);
    setShowPostApplySummary(false);
    if (enhancementFileInputRef.current) {
      enhancementFileInputRef.current.value = '';
    }
  };

  const closeEnhancementDialog = () => {
    resetEnhancementState();
    setCreatedProductForMarketing(null);
    setIsEnhancementDialogOpen(false);
  };

  const handleEnhancementSkip = () => {
    closeEnhancementDialog();
  };

  const handleEnhancementViewProducts = () => {
    closeEnhancementDialog();
    if (createdProductForMarketing) {
      navigate(`/market/products?product=${createdProductForMarketing.id}`);
    }
  };

  const handleEnhancementAddAnother = () => {
    closeEnhancementDialog();
    setIsDialogOpen(true);
  };

  const handleEnhancementVideoProduct = () => {
    closeEnhancementDialog();
    if (createdProductForMarketing) {
      navigate(`/market/products?product=${createdProductForMarketing.id}`);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    const missingStep = resolveCreateSubmitStep();
    if (missingStep !== null) {
      setMobileCreateStep(missingStep);
      showStepError();
      return;
    }
    const pickupAddressValue = formData.pickupAddress?.trim() ?? '';
    const pickupZipValue = formData.pickupYamatoZipCode?.trim() ?? '';
    if (!pickupAddressValue) {
      setPickupVerifyError(t('farmer.products.pickupAddressRequired'));
      return;
    }
    if (selectedPickupStoreId || !pickupZipValue) {
      const verified = await handleVerifyCreatePickup();
      if (!verified) {
        return;
      }
    }
    const contactError = resolvePickupContactError(
      formData.pickupContactTel,
      formData.pickupContactMobile
    );
    if (contactError) {
      setPickupContactError(contactError);
      return;
    }
    setIsSubmitting(true);
    try {

      console.log('Creating product for user:', user.id, 'with data:', formData);
      const pickup =
        formData.pickupAddress.trim()
          ? {
              address: formData.pickupAddress.trim(),
              yamatoZipCode: formData.pickupYamatoZipCode.trim(),
              contactName: formData.pickupContactName.trim(),
              contactTel: normalizeTaiwanPhoneDigits(formData.pickupContactTel),
              contactMobile: normalizeTaiwanPhoneDigits(formData.pickupContactMobile),
              postNumber: formData.pickupPostNumber.trim(),
              verifiedAt: formData.pickupYamatoZipCode ? Timestamp.now() : undefined
            }
          : undefined;
      const result = await DatabaseService.createProduct(user.id, {
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        price: Number(formData.price),
        stock: Number(formData.stock),
        description: formData.description,
        pickup,
        images: [],
        tags: []
      });
      let uploadedImageUrls: string[] = [];
      if (createImages.length > 0) {
        setIsUploadingImages(true);
        try {
          const imageUrls = await uploadProductImages(createImages, user.id, result.id);
          uploadedImageUrls = imageUrls;
          await DatabaseService.updateProduct(result.id, { images: imageUrls });
        } catch (error) {
          console.error('Failed to upload images for new product:', error);
          alert(t('farmer.products.imageUploadFailed'));
        } finally {
          setIsUploadingImages(false);
        }
      }
      console.log('Product created successfully:', result);
      await refreshUserData();
      setLastRefreshTime(new Date());

      setIsDialogOpen(false);
      setFormData({
        name: '',
        category: 'general',
        unit: '',
        price: 0,
        stock: 0,
        description: '',
        pickupAddress: '',
        pickupContactName: '',
        pickupContactTel: '',
        pickupContactMobile: '',
        pickupPostNumber: '',
        pickupYamatoZipCode: ''
      });
      setPickupVerifyError(null);
      setPickupContactError(null);
      setPickupSuggestions([]);
      setPickupLookupError(null);
      setSelectedPickupStoreId('');
      setCreateImages([]);
      setCreatedProductForMarketing({
        id: result.id,
        name: formData.name,
        category: formData.category,
        description: formData.description,
        unit: formData.unit,
        price: Number(formData.price),
        stock: Number(formData.stock),
        images: uploadedImageUrls
      });
      resetEnhancementState();
      setIsEnhancementDialogOpen(true);
    } catch (error) {
      console.error('Failed to create product:', error);
      alert(t('farmer.products.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      await DatabaseService.updateProduct(product.id, { isActive: !(product.isActive ?? true) });
      await refreshUserData();
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to update product status:', error);
    }
  };

  const handleOpenActions = (product: Product) => {
    setSelectedProduct(product);
    setIsActionDialogOpen(true);
  };

  function handleModifyClick(product: Product) {
    setSelectedProduct(product);
    setPickupVerifyError(null);
    setSelectedEditPickupStoreId('');
    setEditPickupLookupError(null);
    setEditPickupSuggestions([]);
    setEditFormData({
      name: product.name,
      category: product.category || 'general',
      unit: product.unit || '',
      price: product.price || 0,
      stock: product.stock || 0,
      description: product.description || '',
      images: product.images || [],
      pickupAddress: product.pickup?.address || '',
      pickupContactName: product.pickup?.contactName || '',
      pickupContactTel: product.pickup?.contactTel || '',
      pickupContactMobile: product.pickup?.contactMobile || '',
      pickupPostNumber: product.pickup?.postNumber || '',
      pickupYamatoZipCode: product.pickup?.yamatoZipCode || ''
    });
    setIsEditDialogOpen(true);
  }

  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;
    setIsDeleting(true);
    try {
      await DatabaseService.deleteProduct(selectedProduct.id);
      await refreshUserData();
      setLastRefreshTime(new Date());
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert(t('farmer.products.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id || !selectedProduct) return;
    
    setIsUploadingImages(true);
    try {
      const newImageUrls = await uploadProductImages(Array.from(files), user.id, selectedProduct.id);
      const updatedImages = [...editFormData.images, ...newImageUrls].slice(0, 10); // Limit to 10 images
      setEditFormData(prev => ({ ...prev, images: updatedImages }));
    } catch (error) {
      console.error('Failed to upload images:', error);
      alert(t('farmer.products.uploadError'));
    } finally {
      setIsUploadingImages(false);
      if (editImageInputRef.current) {
        editImageInputRef.current.value = '';
      }
      if (editCameraInputRef.current) {
        editCameraInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isMobile && mobileEditStep < editStepTotal - 1) {
      return;
    }
    if (isMobile) {
      const missingStep = resolveEditSubmitStep();
      if (missingStep !== null) {
        setMobileEditStep(missingStep);
        showStepError();
        return;
      }
    }
    if (!selectedProduct) return;
    const pickupAddressValue = editFormData.pickupAddress?.trim() ?? '';
    const pickupZipValue = editFormData.pickupYamatoZipCode?.trim() ?? '';
    if (!pickupAddressValue) {
      setPickupVerifyError(t('farmer.products.pickupAddressRequired'));
      return;
    }
    if (selectedEditPickupStoreId || !pickupZipValue) {
      const verified = await handleVerifyEditPickup();
      if (!verified) {
        return;
      }
    }
    const contactError = resolvePickupContactError(
      editFormData.pickupContactTel,
      editFormData.pickupContactMobile
    );
    if (contactError) {
      setEditPickupContactError(contactError);
      return;
    }
    setIsSubmitting(true);
    try {

      const pickup =
        editFormData.pickupAddress.trim()
          ? {
              address: editFormData.pickupAddress.trim(),
              yamatoZipCode: editFormData.pickupYamatoZipCode.trim(),
              contactName: editFormData.pickupContactName.trim(),
              contactTel: normalizeTaiwanPhoneDigits(editFormData.pickupContactTel),
              contactMobile: normalizeTaiwanPhoneDigits(editFormData.pickupContactMobile),
              postNumber: editFormData.pickupPostNumber.trim(),
              verifiedAt: editFormData.pickupYamatoZipCode
                ? selectedProduct.pickup?.verifiedAt || Timestamp.now()
                : undefined
            }
          : undefined;
      const updates: Partial<Product> = {
        name: editFormData.name,
        category: editFormData.category,
        unit: editFormData.unit,
        price: Number(editFormData.price),
        stock: Number(editFormData.stock),
        description: editFormData.description,
        images: editFormData.images
      };
      if (pickup) {
        updates.pickup = pickup;
      }
      await DatabaseService.updateProduct(selectedProduct.id, updates);
      await refreshUserData();
      setLastRefreshTime(new Date());
      const shouldOpenEnhancement = enhanceAfterImageRef.current;
      const marketingTarget: MarketingProduct = {
        id: selectedProduct.id,
        name: updates.name || selectedProduct.name,
        category: updates.category || selectedProduct.category,
        description: updates.description || selectedProduct.description,
        unit: updates.unit || selectedProduct.unit,
        price: updates.price ?? selectedProduct.price,
        stock: updates.stock ?? selectedProduct.stock,
        images: updates.images || selectedProduct.images || [],
        photos: updates.images || selectedProduct.images || []
      };
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      setPickupVerifyError(null);
      setEditPickupContactError(null);
      if (shouldOpenEnhancement) {
        resetEnhancementState();
        setCreatedProductForMarketing(marketingTarget);
        setIsEnhancementDialogOpen(true);
        enhanceAfterImageRef.current = false;
      }
    } catch (error) {
      console.error('Failed to update product:', error);
      alert(t('farmer.products.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnhancementUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast({
        title: copy.imageTooLargeTitle,
        description: copy.imageTooLargeDesc,
        variant: 'destructive'
      });
      event.target.value = '';
      return;
    }

    try {
      const data = await readImageFile(file);
      setEnhancementUploadedImage({ name: file.name, ...data });
    } catch (err) {
      toast({
        title: copy.uploadFailedTitle,
        description: (err as Error).message,
        variant: 'destructive'
      });
      event.target.value = '';
    }
  };

  const clearEnhancementUpload = () => {
    setEnhancementUploadedImage(null);
    if (enhancementFileInputRef.current) {
      enhancementFileInputRef.current.value = '';
    }
  };

  const stopEnhancement = () => {
    enhancementAbortRef.current?.abort();
  };

  const generateEnhancement = async () => {
    if (!createdProductForMarketing) {
      toast({
        title: copy.selectProductToastTitle,
        description: copy.selectProductToastDesc
      });
      return;
    }

    const fallbackImageUrl = storedProductImageUrl || undefined;
    if (!enhancementUploadedImage && !fallbackImageUrl && !createdProductForMarketing.description?.trim()) {
      toast({
        title: copy.requireDescriptionTitle,
        description: copy.requireDescriptionDesc,
        variant: 'destructive'
      });
      return;
    }

    setEnhancementOutputText('');
    setEnhancementOutputImages([]);
    setEnhancementError(null);
    setEnhancementCopied(false);
    setShowPostApplySummary(false);
    setShowResultScreen(true);
    setIsEnhancing(true);

    enhancementAbortRef.current?.abort();
    const controller = new AbortController();
    enhancementAbortRef.current = controller;

    try {
      let imagePayload:
        | {
            base64: string;
            mimeType: string;
          }
        | undefined = enhancementUploadedImage
        ? {
            base64: enhancementUploadedImage.base64,
            mimeType: enhancementUploadedImage.mimeType
          }
        : undefined;
      const imageUrlPayload = !imagePayload && fallbackImageUrl ? fallbackImageUrl : undefined;

      if (!imagePayload && !fallbackImageUrl && !createdProductForMarketing.description?.trim()) {
        toast({
          title: copy.requireDescriptionTitle,
          description: copy.requireDescriptionDesc,
          variant: 'destructive'
        });
        return;
      }

      const apiBaseUrl = resolveApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/marketing/generate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: enhancementPrompt,
          language,
          product: {
            name: createdProductForMarketing.name,
            category: createdProductForMarketing.category,
            description: createdProductForMarketing.description
          },
          image: imagePayload
            ? {
                base64: imagePayload.base64,
                mimeType: imagePayload.mimeType
              }
            : undefined,
          imageUrl: imageUrlPayload
        })
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let event: { type: string; text?: string; mimeType?: string; base64?: string; message?: string };
          try {
            event = JSON.parse(trimmed) as { type: string; text?: string; mimeType?: string; base64?: string; message?: string };
          } catch {
            continue;
          }

          if (event.type === 'text' && event.text) {
            setEnhancementOutputText((prev) => prev + event.text);
          } else if (event.type === 'image' && event.base64 && event.mimeType) {
            setEnhancementOutputImages((prev) => [...prev, { base64: event.base64!, mimeType: event.mimeType! }]);
          } else if (event.type === 'error' && event.message) {
            setEnhancementError(event.message);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setEnhancementError((err as Error).message);
      }
    } finally {
      setIsEnhancing(false);
    }

    const hasImagePayload = Boolean(enhancementUploadedImage || fallbackImageUrl);
    if (!hasImagePayload && !createdProductForMarketing.description?.trim()) {
      toast({
        title: copy.requireDescriptionTitle,
        description: copy.requireDescriptionDesc,
        variant: 'destructive'
      });
    }
  };

  const handleEnhancementCopy = async () => {
    if (!enhancementOutputText.trim()) return;
    try {
      await navigator.clipboard.writeText(enhancementOutputText);
      setEnhancementCopied(true);
      toast({
        title: copy.copyToastTitle,
        description: copy.copyToastDesc
      });
      setTimeout(() => setEnhancementCopied(false), 1500);
    } catch (err) {
      toast({
        title: copy.copyToastErrorTitle,
        description: (err as Error).message,
        variant: 'destructive'
      });
    }
  };

  const handleDownloadEnhancementImage = (image: { base64: string; mimeType: string }, index: number) => {
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `marketing-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResultBack = () => {
    setShowResultScreen(false);
    setShowPostApplySummary(false);
  };

  const handleApplyEnhancementAssets = async () => {
    if (!createdProductForMarketing) {
      toast({
        title: copy.selectProductToastTitle,
        description: copy.selectProductToastDesc
      });
      return;
    }

    const trimmed = enhancementOutputText.trim();
    if (!trimmed && enhancementOutputImages.length === 0) {
      toast({
        title: copy.applyAssetsButton,
        description: copy.applyTextMissing,
        variant: 'destructive'
      });
      return;
    }

    setIsApplyingAssets(true);
    let uploadedImageUrl: string | null = null;
    let imagePayload = enhancementOutputImages.length > 0 ? enhancementOutputImages[0] : null;

    if (imagePayload) {
      if (!user?.id) {
        toast({
          title: copy.applyImageError,
          description: copy.missingUserError,
          variant: 'destructive'
        });
        imagePayload = null;
      } else if (!storage) {
        toast({
          title: copy.applyImageError,
          description: copy.storageUnavailableError,
          variant: 'destructive'
        });
        imagePayload = null;
      }
    }

    if (imagePayload) {
      try {
        const bytes = base64ToUint8Array(imagePayload.base64);
        const extension = imagePayload.mimeType?.split('/')?.[1]?.split('+')?.[0] || 'png';
        const fileName = `products/${user!.id}/${createdProductForMarketing.id}/marketing-${Date.now()}.${extension}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, bytes, { contentType: imagePayload.mimeType || 'image/png' });
        uploadedImageUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.error('Failed to attach marketing image to product', err);
        toast({
          title: copy.applyImageError,
          description: (err as Error).message,
          variant: 'destructive'
        });
        imagePayload = null;
      }
    }

    const updateData: Record<string, any> = {};
    if (trimmed) {
      updateData.description = trimmed;
    }

    if (uploadedImageUrl) {
      const existing =
        (Array.isArray(createdProductForMarketing.images) && createdProductForMarketing.images.length > 0
          ? createdProductForMarketing.images
          : Array.isArray(createdProductForMarketing.photos)
            ? createdProductForMarketing.photos
            : []) ?? [];
      const updatedImages = Array.from(new Set([uploadedImageUrl, ...existing]));
      updateData.images = updatedImages;
      updateData.photos = updatedImages;
    }

    try {
      if (Object.keys(updateData).length === 0) {
        throw new Error('No assets to apply.');
      }
      await DatabaseService.updateProduct(createdProductForMarketing.id, updateData as any);
      setCreatedProductForMarketing((prev) => (prev ? { ...prev, ...updateData } : prev));
      toast({
        title: copy.applyAssetsSuccess,
        description: createdProductForMarketing.name
      });
      setShowResultScreen(false);
      setShowPostApplySummary(true);
      if (typeof refreshUserData === 'function') {
        await refreshUserData();
      }
    } catch (err) {
      console.error('Failed to apply enhancement assets to product', err);
      toast({
        title: copy.applyTextError,
        description: (err as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsApplyingAssets(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="hidden md:block bg-gradient-to-r from-green-500 via-green-600 to-green-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">{t('farmer.products.title')}</h1>
            <p className="text-green-100 text-lg">{t('farmer.products.subtitle')}</p>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-2"></div>
                <span>{filteredProducts.length} {t('farmer.products.products')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-300 rounded-full mr-2"></div>
                <span>{filteredProducts.filter(p => p.isActive !== false).length} {t('farmer.products.active')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-300 rounded-full mr-2"></div>
                <span>{filteredProducts.filter(p => p.stock <= 10).length} {t('farmer.products.lowStock')}</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <Plus className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              <span className="md:hidden">{t('farmer.products.yourProducts')}</span>
              <span className="hidden md:inline">{t('farmer.products.catalog')}</span>
            </h2>
            <p className="hidden md:block text-gray-600">{t('farmer.products.catalogDescription')}</p>
            {lastRefreshTime && (
              <p className="hidden md:block text-sm text-gray-500 mt-1">
                {t('farmer.products.lastUpdated').replace('{time}', lastRefreshTime.toLocaleTimeString())}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshingData}
              aria-label={t('common.refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${(isLoading || isRefreshingData) ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              className="h-9 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg"
              onClick={() => setIsDialogOpen(true)}
              data-tour="products-add"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('farmer.products.addProduct')}
            </Button>
          </div>
        </div>
        <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
          <DialogContent className="max-w-none w-full h-[100dvh] md:h-auto md:max-w-sm overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('farmer.products.notificationsTitle')}</DialogTitle>
              <DialogDescription>{t('farmer.products.notificationsDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-red-900">{t('farmer.products.lowStock')}</span>
                  <Badge variant={lowStockProductsCount > 0 ? 'destructive' : 'secondary'}>
                    {lowStockProductsCount}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-red-800">{t('farmer.products.lowStockDesc')}</p>
                <p className="mt-2 text-xs text-red-700">{t('farmer.products.lowStockHow')}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{t('farmer.products.inactiveStatus')}</span>
                  <Badge variant={inactiveProductsCount > 0 ? 'secondary' : 'outline'}>
                    {inactiveProductsCount}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-gray-600">{t('farmer.products.inactiveDesc')}</p>
                <p className="mt-2 text-xs text-gray-600">{t('farmer.products.inactiveHow')}</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-green-900">{t('farmer.products.active')}</span>
                  <Badge variant="default">{activeProductsCount}</Badge>
                </div>
                <p className="mt-2 text-xs text-green-800">{t('farmer.products.activeDesc')}</p>
                <p className="mt-2 text-xs text-green-700">{t('farmer.products.activeHow')}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <button
          type="button"
          onClick={() => setIsSummaryDialogOpen(true)}
          className="md:hidden flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white/90 px-3 py-4 shadow-sm"
          aria-label={t('farmer.products.notificationsAria')}
        >
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">{t('farmer.products.summary')}</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
              {totalProductsCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
              {activeProductsCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
              {lowStockProductsCount}
            </span>
          </div>
          <span className="text-xs text-gray-400">{t('farmer.products.tapForDetails')}</span>
        </button>
        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshingData}
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${(isLoading || isRefreshingData) ? 'animate-spin' : ''}`} />
            {isLoading || isRefreshingData ? t('farmer.products.refreshing') : t('common.refresh')}
          </Button>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (open) {
                setPickupVerifyError(null);
                setPickupLookupError(null);
                setPickupSuggestions([]);
                setSelectedPickupStoreId('');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg"
                data-tour="products-add"
              >
                <Plus className="w-5 h-5 mr-2" />
                {t('farmer.products.addProduct')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('farmer.products.createNew')}</DialogTitle>
                <DialogDescription>{t('farmer.products.createDescription')}</DialogDescription>
              </DialogHeader>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <div className="text-xs font-semibold text-gray-500">
                      {stepLabel(mobileCreateStep + 1, createStepTotal)}
                    </div>
                    <div key={`create-step-${mobileCreateStep}`} className="space-y-6 animate-in fade-in-0 slide-in-from-right-2 duration-300">
                      {mobileCreateStep === 0 && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.productName')} *</label>
                            <Input
                              value={formData.name}
                              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                              placeholder={t('farmer.products.productNamePlaceholder')}
                              className="h-11"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.category')}</label>
                              <Select
                                value={formData.category}
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                              >
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder={t('farmer.products.chooseCategory')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="eggs">{t('farmer.products.eggs')}</SelectItem>
                                  <SelectItem value="poultry">{t('farmer.products.poultry')}</SelectItem>
                                  <SelectItem value="vegetables">{t('farmer.products.vegetables')}</SelectItem>
                                  <SelectItem value="fruits">{t('farmer.products.fruits')}</SelectItem>
                                  <SelectItem value="dairy">{t('farmer.products.dairy')}</SelectItem>
                                  <SelectItem value="other">{t('farmer.products.other')}</SelectItem>
                                  <SelectItem value="general">{t('farmer.products.general')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.unitColumn')}</label>
                              <Input
                                value={formData.unit}
                                onChange={(event) => setFormData((prev) => ({ ...prev, unit: event.target.value }))}
                                placeholder={t('farmer.products.unitPlaceholder')}
                                className="h-11"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {mobileCreateStep === 1 && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.price')} *</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.price}
                                onChange={(event) => setFormData((prev) => ({ ...prev, price: Number(event.target.value) }))}
                                onFocus={handleNumberFocus}
                                className="h-11"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.stockColumn')} *</label>
                              <Input
                                type="number"
                                min="0"
                                value={formData.stock}
                                onChange={(event) => setFormData((prev) => ({ ...prev, stock: Number(event.target.value) }))}
                                onFocus={handleNumberFocus}
                                className="h-11"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {mobileCreateStep === 2 && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupAddress')}</label>
                            <Input
                              value={formData.pickupAddress}
                              onChange={(event) => handlePickupAddressChange(event.target.value)}
                              placeholder={t('farmer.products.pickupAddressPlaceholder')}
                              className="h-11"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleUseLocationForPickup}
                                disabled={isPickupSearching}
                                className="gap-2"
                              >
                                {isPickupSearching ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('farmer.products.pickupSearching')}
                                  </>
                                ) : (
                                  <>
                                    <MapPin className="w-4 h-4" />
                                    {t('farmer.products.pickupUseLocation')}
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleLookupPickupAddress}
                                disabled={isPickupSearching || !formData.pickupAddress.trim()}
                                className="gap-2"
                              >
                                {isPickupSearching ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('farmer.products.pickupSearching')}
                                  </>
                                ) : (
                                  <>
                                    <Search className="w-4 h-4" />
                                    {t('farmer.products.pickupSearch')}
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleVerifyCreatePickup}
                                disabled={isVerifyingPickup || !formData.pickupAddress.trim()}
                                className="gap-2"
                              >
                                {isVerifyingPickup ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('farmer.products.pickupVerifying')}
                                  </>
                                ) : (
                                  t('farmer.products.pickupVerify')
                                )}
                              </Button>
                            </div>
                            {pickupLookupError && (
                              <p className="text-sm text-red-600">{pickupLookupError}</p>
                            )}
                          </div>
                          {pickupSuggestions.length > 0 && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs font-semibold text-gray-500 mb-2">
                                {t('farmer.products.pickupSuggestions')}
                              </p>
                              <div className="space-y-2">
                                {pickupSuggestions.map((suggestion, index) => (
                                  <button
                                    key={`${suggestion.address}-${index}`}
                                    type="button"
                                    onClick={() => applyPickupSuggestion(suggestion)}
                                    className="flex w-full items-center justify-between rounded-md bg-white px-3 py-2 text-left text-sm text-gray-700 shadow-sm hover:bg-gray-100"
                                  >
                                    <span className="truncate">{suggestion.address}</span>
                                    <MapPin className="h-4 w-4 text-gray-400" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {pickupVerifyError && (
                            <p className="text-sm text-red-600">{pickupVerifyError}</p>
                          )}
                          {pickupContactError && (
                            <p className="text-sm text-red-600">{pickupContactError}</p>
                          )}
                          {verifiedStores.length > 0 && (
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupUseStore')}</label>
                              <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                <Select value={selectedPickupStoreId} onValueChange={handleSelectPickupStore}>
                                  <SelectTrigger 
                                    className="h-11"
                                  >
                                    <SelectValue placeholder={t('farmer.products.pickupUseStorePlaceholder')} />
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
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactName')}</label>
                              <Input
                                value={formData.pickupContactName}
                                onChange={(event) => setFormData((prev) => ({ ...prev, pickupContactName: event.target.value }))}
                                placeholder={t('farmer.products.pickupContactNamePlaceholder')}
                                className="h-11"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactMobile')}</label>
                              <Input
                                value={formData.pickupContactMobile}
                                onChange={(event) => setFormData((prev) => ({ ...prev, pickupContactMobile: formatTaiwanMobileInput(event.target.value) }))}
                                placeholder={t('farmer.products.pickupContactMobilePlaceholder')}
                                className="h-11"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactTel')}</label>
                              <Input
                                value={formData.pickupContactTel}
                                onChange={(event) => setFormData((prev) => ({ ...prev, pickupContactTel: normalizeTaiwanTelInput(event.target.value) }))}
                                placeholder={t('farmer.products.pickupContactTelPlaceholder')}
                                className="h-11"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupPostNumber')}</label>
                              <Input
                                value={formData.pickupPostNumber ?? ''}
                                readOnly
                                placeholder={t('farmer.products.pickupPostNumberPlaceholder')}
                                className="h-11 bg-gray-50"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupYamatoZipCode')}</label>
                            <Input
                              value={formData.pickupYamatoZipCode ?? ''}
                              readOnly
                              placeholder={t('farmer.products.pickupYamatoZipCodePlaceholder')}
                              className="h-11 bg-gray-50"
                            />
                          </div>
                        </div>
                      )}
                      {mobileCreateStep === 3 && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.description')}</label>
                            <Textarea
                              value={formData.description}
                              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                              placeholder={t('farmer.products.descriptionPlaceholder')}
                              className="min-h-[120px]"
                            />
                          </div>
                          <div className="space-y-4">
                            <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.photos')}</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                              <input
                                ref={createImageInputRef}
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleCreateImageSelect(e.target.files)}
                                className="hidden"
                                id="create-image-upload-mobile"
                                disabled={isUploadingImages || createImages.length >= 10}
                              />
                              <input
                                ref={createCameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleCreateImageSelect(e.target.files)}
                                className="hidden"
                                disabled={isUploadingImages || createImages.length >= 10}
                              />
                              <label htmlFor="create-image-upload-mobile" className="cursor-pointer">
                                {isUploadingImages ? (
                                  <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-2"></div>
                                    <p className="text-sm text-gray-600">{t('farmer.products.uploadingImages')}</p>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-600">{t('farmer.products.uploadPrompt')}</p>
                                    <p className="text-xs text-gray-400 mt-1">{t('farmer.products.uploadHint')}</p>
                                  </div>
                                )}
                              </label>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => createImageInputRef.current?.click()}
                                disabled={isUploadingImages || createImages.length >= 10}
                                className="gap-2"
                              >
                                <Upload className="w-4 h-4" />
                                {t('farmer.products.uploadPhotos')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => createCameraInputRef.current?.click()}
                                disabled={isUploadingImages || createImages.length >= 10}
                                className="gap-2"
                              >
                                <Camera className="w-4 h-4" />
                                {t('farmer.products.useCamera')}
                              </Button>
                            </div>
                            {createImagePreviews.length > 0 && (
                              <div className="grid grid-cols-2 gap-3">
                                {createImagePreviews.map((preview, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={preview.url}
                                      alt={`Product ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCreateImage(index)}
                                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {createImagePreviews.length === 0 && (
                              <div className="text-center py-6 text-gray-400">
                                <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">{t('farmer.products.noImagesUploaded')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t pt-4">
                      {mobileCreateStep === 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                          className="px-5"
                          disabled={isSubmitting || isUploadingImages}
                        >
                          {t('common.cancel')}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setMobileCreateStep((prev) => Math.max(prev - 1, 0))}
                          className="px-5"
                        >
                          {t('common.back')}
                        </Button>
                      )}
                      {mobileCreateStep < createStepTotal - 1 ? (
                        <Button
                          key="create-next"
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            handleCreateNextStep();
                          }}
                          className="px-6"
                        >
                          {t('common.next')}
                        </Button>
                      ) : (
                        <Button
                          key="create-submit"
                          type="submit"
                          disabled={isSubmitting || isUploadingImages}
                          className="px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                        >
                          {isSubmitting ? (
                            <div className="flex items-center">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              {t('farmer.products.processing')}
                            </div>
                          ) : (
                            t('common.submit')
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader className="pb-3 md:pb-4">
          <CardTitle className="flex items-center text-lg md:text-xl">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <Search className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            {t('farmer.products.catalog')}
          </CardTitle>
          <CardDescription className="text-sm md:text-base">{t('farmer.products.catalogLiveDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative w-full lg:w-80">
                <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-9 md:pl-10 h-9 md:h-11"
                  placeholder={t('farmer.products.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 md:hidden"
                onClick={() => setShowMobileFilters((prev) => !prev)}
                aria-label={t('farmer.products.advancedFilters')}
              >
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="gap-2 h-11 hidden md:inline-flex" disabled>
                <Filter className="w-4 h-4" />
                {t('farmer.products.advancedFilters')}
              </Button>
            </div>
            <div
              className={`${showMobileFilters ? 'grid grid-cols-2 gap-2' : 'hidden'} md:flex md:items-center md:gap-3`}
            >
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full h-9 md:w-48 md:h-11">
                  <SelectValue placeholder={t('farmer.products.filterByCategory')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('farmer.products.allCategories')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="w-full h-9 md:w-40 md:h-11">
                  <SelectValue placeholder={t('farmer.products.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('farmer.products.allStatus')}</SelectItem>
                  <SelectItem value="active">{t('farmer.products.activeStatus')}</SelectItem>
                  <SelectItem value="inactive">{t('farmer.products.inactiveStatus')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border-2 border-gray-100 bg-white p-3 md:p-4" data-tour="products-table">
            {showLoadingState ? (
              <div className="flex flex-col items-center space-y-3 py-12">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">{t('farmer.products.loading')}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center space-y-3 py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-gray-500 font-medium">{t('farmer.products.noProductsFound')}</p>
                  <p className="text-sm text-gray-400">{t('farmer.products.tryAdjusting')}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => {
                  const isActive = product.isActive ?? true;
                  const stockVariant = getStockVariant(product.stock);
                  const primaryImage = product.images?.[0];
                  const updatedLabel = formatDate(product.updatedAt) || '—';
                  const pickupAddress = product.pickup?.address?.trim();

                  return (
                    <Card
                      key={product.id}
                      className="group relative overflow-hidden border border-gray-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-green-500"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenActions(product)}
                        className="flex h-full w-full flex-col p-3 md:p-4 text-left focus-visible:outline-none"
                        aria-label={`${product.name} ${t('farmer.products.actions')}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-green-100 to-green-200">
                              {primaryImage ? (
                                <img
                                  src={primaryImage}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-green-600">
                                  <ImageIcon className="h-6 w-6" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-lg font-semibold text-gray-900 truncate">
                                {product.name}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <Badge variant="outline" className="capitalize">
                                  {product.category || t('farmer.products.general')}
                                </Badge>
                                <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                                  {product.unit || '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 border ${
                              isActive
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-gray-200 bg-gray-100 text-gray-600'
                            }`}
                          >
                            {isActive ? t('farmer.products.activeStatus') : t('farmer.products.hidden')}
                          </Badge>
                        </div>

                        <div className="mt-3 text-sm text-gray-600 line-clamp-2 md:line-clamp-none">
                          {product.description?.trim() ? product.description : copy.noDescription}
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg bg-gray-50 p-3">
                            <dt className="text-xs uppercase tracking-wide text-gray-400">
                              {t('farmer.products.price')}
                            </dt>
                            <dd className="mt-1 text-base font-semibold text-green-600">
                              NT$ {product.price || 0}
                            </dd>
                            <dd className="mt-1 text-xs text-gray-500">
                              {t('farmer.products.unitColumn')}: {product.unit || '—'}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3">
                            <dt className="text-xs uppercase tracking-wide text-gray-400">
                              {t('farmer.products.stockColumn')}
                            </dt>
                            <dd className="mt-1 flex items-center gap-2">
                              <Badge variant={stockVariant} className="font-medium">
                                {product.stock}
                              </Badge>
                              {product.stock <= 10 && (
                                <span className="text-xs text-red-600 font-medium">
                                  {t('farmer.products.low')}
                                </span>
                              )}
                            </dd>
                            <dd className="mt-1 text-xs text-gray-500">
                              {t('farmer.products.updated')}: {updatedLabel}
                            </dd>
                          </div>
                        </dl>

                        {pickupAddress ? (
                          <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
                            <span className="break-words">{pickupAddress}</span>
                          </div>
                        ) : null}
                      </button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
      </CardContent>
      </Card>

      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct?.name ?? t('farmer.products.product')}
            </DialogTitle>
            <DialogDescription>{t('farmer.products.actions')}</DialogDescription>
          </DialogHeader>
          {selectedProduct ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{t('farmer.products.statusColumn')}</span>
                  <Badge
                    variant="outline"
                    className={`border ${
                      selectedProductIsActive
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-100 text-gray-600'
                    }`}
                  >
                    {selectedProductIsActive
                      ? t('farmer.products.activeStatus')
                      : t('farmer.products.hidden')}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">
                      {t('farmer.products.price')}
                    </div>
                    <div className="mt-1 text-base font-semibold text-green-600">
                      NT$ {selectedProduct.price || 0}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {t('farmer.products.unitColumn')}: {selectedProduct.unit || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">
                      {t('farmer.products.stockColumn')}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={selectedProductStockVariant} className="font-medium">
                        {selectedProduct.stock}
                      </Badge>
                      {selectedProduct.stock <= 10 && (
                        <span className="text-xs text-red-600 font-medium">
                          {t('farmer.products.low')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {t('farmer.products.updated')}: {formatDate(selectedProduct.updatedAt) || '—'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!selectedProduct) return;
                    setIsActionDialogOpen(false);
                    handleModifyClick(selectedProduct);
                  }}
                  className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {t('farmer.products.modify')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!selectedProduct) return;
                    setIsActionDialogOpen(false);
                    void handleToggleStatus(selectedProduct);
                  }}
                  className="border-gray-200"
                >
                  {selectedProductIsActive ? (
                    <EyeOff className="w-4 h-4 mr-2" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  {selectedProductIsActive
                    ? t('farmer.products.hidden')
                    : t('farmer.products.activeStatus')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (!selectedProduct) return;
                    setIsActionDialogOpen(false);
                    handleDeleteClick(selectedProduct);
                  }}
                  className="sm:col-span-2"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (open) {
            setPickupVerifyError(null);
            setEditPickupLookupError(null);
            setEditPickupSuggestions([]);
            setSelectedEditPickupStoreId('');
          } else {
            autoImagePickerRef.current = null;
            editStepOverrideRef.current = null;
            enhanceAfterImageRef.current = false;
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('farmer.products.modifyProduct')}</DialogTitle>
            <DialogDescription>{t('farmer.products.modifyDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-6" onSubmit={handleEditSubmit}>
            {isMobile ? (
              <div className="space-y-6">
                <div className="text-xs font-semibold text-gray-500">
                  {stepLabel(mobileEditStep + 1, editStepTotal)}
                </div>
                <div key={`edit-step-${mobileEditStep}`} className="space-y-6 animate-in fade-in-0 slide-in-from-right-2 duration-300">
                  {mobileEditStep === 0 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.productName')} *</label>
                        <Input
                          value={editFormData.name}
                          onChange={(event) => setEditFormData((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder={t('farmer.products.productNamePlaceholder')}
                          className="h-11"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.category')}</label>
                        <Select value={editFormData.category} onValueChange={(value) => setEditFormData((prev) => ({ ...prev, category: value }))}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={t('farmer.products.selectCategory')} />
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
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.unit')}</label>
                        <Input
                          value={editFormData.unit}
                          onChange={(event) => setEditFormData((prev) => ({ ...prev, unit: event.target.value }))}
                          placeholder={t('farmer.products.unitPlaceholder')}
                          className="h-11"
                        />
                      </div>
                    </div>
                  )}
                  {mobileEditStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.price')} *</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editFormData.price}
                          onChange={(event) => setEditFormData((prev) => ({ ...prev, price: Number(event.target.value) }))}
                          placeholder={t('farmer.products.pricePlaceholder')}
                          className="h-11"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.stockQuantity')} *</label>
                        <Input
                          type="number"
                          min="0"
                          value={editFormData.stock}
                          onChange={(event) => setEditFormData((prev) => ({ ...prev, stock: Number(event.target.value) }))}
                          placeholder={t('farmer.products.stockPlaceholder')}
                          className="h-11"
                          required
                        />
                      </div>
                    </div>
                  )}
                  {mobileEditStep === 2 && (
                    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-col gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">{t('farmer.products.pickupSectionTitle')}</h3>
                          <p className="text-xs text-gray-500">{t('farmer.products.pickupSectionHint')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleUseLocationForEditPickup}
                            disabled={isEditPickupSearching}
                            className="gap-2"
                          >
                            {isEditPickupSearching ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('farmer.products.pickupSearching')}
                              </>
                            ) : (
                              <>
                                <MapPin className="w-4 h-4" />
                                {t('farmer.products.pickupUseLocation')}
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleLookupEditPickupAddress}
                            disabled={isEditPickupSearching || !editFormData.pickupAddress.trim()}
                            className="gap-2"
                          >
                            {t('farmer.products.pickupSearch')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleVerifyEditPickup}
                            disabled={isVerifyingPickup || !editFormData.pickupAddress.trim()}
                            className="gap-2"
                          >
                            {isVerifyingPickup ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('farmer.products.pickupVerifying')}
                              </>
                            ) : (
                              t('farmer.products.pickupVerify')
                            )}
                          </Button>
                        </div>
                      </div>
                      {verifiedStores.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupUseStore')}</label>
                          <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                            <Select value={selectedEditPickupStoreId} onValueChange={handleSelectEditPickupStore}>
                              <SelectTrigger 
                                className="h-11"
                              >
                                <SelectValue placeholder={t('farmer.products.pickupUseStorePlaceholder')} />
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
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupAddress')}</label>
                        <Input
                          value={editFormData.pickupAddress}
                          onChange={(event) => {
                            const nextAddress = event.target.value;
                            setEditFormData((prev) => ({
                              ...prev,
                              pickupAddress: nextAddress,
                              pickupPostNumber: '',
                              pickupYamatoZipCode: ''
                            }));
                            setPickupVerifyError(null);
                            setEditPickupLookupError(null);
                            setEditPickupSuggestions([]);
                            setSelectedEditPickupStoreId('');
                          }}
                          placeholder={t('farmer.products.pickupAddressPlaceholder')}
                          className="h-11"
                        />
                        {editPickupSuggestions.length > 0 && (
                          <div className="rounded-md border border-gray-200 bg-white p-2">
                            <p className="text-xs text-gray-500">{t('farmer.products.pickupSuggestions')}</p>
                            <div className="flex flex-col gap-2 mt-2">
                              {editPickupSuggestions.map((candidate, index) => (
                                <button
                                  key={`${candidate.address}-${index}`}
                                  type="button"
                                  onClick={() => applyEditPickupSuggestion(candidate)}
                                  className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-green-400 hover:bg-green-50"
                                >
                                  {candidate.address}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {editPickupLookupError && (
                          <div className="text-sm text-red-600">{editPickupLookupError}</div>
                        )}
                      </div>
                      {pickupVerifyError && (
                        <div className="text-sm text-red-600">{pickupVerifyError}</div>
                      )}
                    </div>
                  )}
                  {mobileEditStep === 3 && (
                    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">{t('farmer.products.pickupSectionTitle')}</h3>
                        <p className="text-xs text-gray-500">{t('farmer.products.pickupSectionHint')}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactName')}</label>
                        <Input
                          value={editFormData.pickupContactName}
                          onChange={(event) => setEditFormData((prev) => ({ ...prev, pickupContactName: event.target.value }))}
                          placeholder={t('farmer.products.pickupContactNamePlaceholder')}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactTel')}</label>
                        <Input
                          value={editFormData.pickupContactTel}
                          onChange={(event) => handleEditPickupContactTelChange(event.target.value)}
                          placeholder={t('farmer.products.pickupContactTelPlaceholder')}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactMobile')}</label>
                        <Input
                          value={editFormData.pickupContactMobile}
                          onChange={(event) => handleEditPickupContactMobileChange(event.target.value)}
                          placeholder={t('farmer.products.pickupContactMobilePlaceholder')}
                          className="h-11"
                        />
                      </div>
                      {editPickupContactError && (
                        <div className="text-sm text-red-600">{editPickupContactError}</div>
                      )}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupPostNumber')}</label>
                        <Input
                          value={editFormData.pickupPostNumber ?? ''}
                          readOnly
                          placeholder={t('farmer.products.pickupPostNumberPlaceholder')}
                          className="h-11 bg-gray-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupYamatoZipCode')}</label>
                        <Input
                          value={editFormData.pickupYamatoZipCode ?? ''}
                          readOnly
                          placeholder={t('farmer.products.pickupYamatoZipCodePlaceholder')}
                          className="h-11 bg-gray-50"
                        />
                      </div>
                      {pickupVerifyError && (
                        <div className="text-sm text-red-600">{pickupVerifyError}</div>
                      )}
                    </div>
                  )}
                  {mobileEditStep === 4 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.description')}</label>
                        <textarea
                          value={editFormData.description}
                          onChange={(event) => setEditFormData((prev) => ({ ...prev, description: event.target.value }))}
                          placeholder={t('farmer.products.descriptionPlaceholder')}
                          className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.photos')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                          <input
                            ref={editImageInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e.target.files)}
                            className="hidden"
                            id="image-upload-mobile"
                            disabled={isUploadingImages || editFormData.images.length >= 10}
                          />
                          <input
                            ref={editCameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleImageUpload(e.target.files)}
                            className="hidden"
                            disabled={isUploadingImages || editFormData.images.length >= 10}
                          />
                          <label htmlFor="image-upload-mobile" className="cursor-pointer">
                            {isUploadingImages ? (
                              <div className="flex flex-col items-center">
                                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-2"></div>
                                <p className="text-sm text-gray-600">{t('farmer.products.uploadingImages')}</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600">{t('farmer.products.uploadPrompt')}</p>
                                <p className="text-xs text-gray-400 mt-1">{t('farmer.products.uploadHint')}</p>
                              </div>
                            )}
                          </label>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => editImageInputRef.current?.click()}
                            disabled={isUploadingImages || editFormData.images.length >= 10}
                            className="gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            {t('farmer.products.uploadPhotos')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => editCameraInputRef.current?.click()}
                            disabled={isUploadingImages || editFormData.images.length >= 10}
                            className="gap-2"
                          >
                            <Camera className="w-4 h-4" />
                            {t('farmer.products.useCamera')}
                          </Button>
                        </div>
                        {editFormData.images.length > 0 && (
                          <div className="grid grid-cols-2 gap-3">
                            {editFormData.images.map((imageUrl, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={imageUrl}
                                  alt={`Product ${index + 1}`}
                                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(index)}
                                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {editFormData.images.length === 0 && (
                          <div className="text-center py-6 text-gray-400">
                            <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">{t('farmer.products.noImagesUploaded')}</p>
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          setIsEditDialogOpen(false);
                          handleDeleteClick(selectedProduct!);
                        }}
                        className="w-full"
                        disabled={isSubmitting || isUploadingImages}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('farmer.products.deleteProduct')}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  {mobileEditStep === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditDialogOpen(false);
                        setSelectedProduct(null);
                      }}
                      className="px-5"
                      disabled={isSubmitting || isUploadingImages}
                    >
                      {t('common.cancel')}
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => setMobileEditStep((prev) => Math.max(prev - 1, 0))} className="px-5">
                      {t('common.back')}
                    </Button>
                  )}
                  {mobileEditStep < editStepTotal - 1 ? (
                    <Button
                      key="edit-next"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        handleEditNextStep();
                      }}
                      className="px-6"
                    >
                      {t('common.next')}
                    </Button>
                  ) : (
                    <Button
                      key="edit-submit"
                      type="submit"
                      disabled={isSubmitting || isUploadingImages}
                      className="px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          {t('farmer.products.saving')}
                        </div>
                      ) : (
                        t('farmer.products.saveChanges')
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.productName')} *</label>
                    <Input
                      value={editFormData.name}
                      onChange={(event) => setEditFormData((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder={t('farmer.products.productNamePlaceholder')}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.category')}</label>
                    <Select value={editFormData.category} onValueChange={(value) => setEditFormData((prev) => ({ ...prev, category: value }))}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t('farmer.products.selectCategory')} />
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
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.unit')}</label>
                    <Input
                      value={editFormData.unit}
                      onChange={(event) => setEditFormData((prev) => ({ ...prev, unit: event.target.value }))}
                      placeholder={t('farmer.products.unitPlaceholder')}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.price')} *</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editFormData.price}
                      onChange={(event) => setEditFormData((prev) => ({ ...prev, price: Number(event.target.value) }))}
                      placeholder={t('farmer.products.pricePlaceholder')}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.stockQuantity')} *</label>
                    <Input
                      type="number"
                      min="0"
                      value={editFormData.stock}
                      onChange={(event) => setEditFormData((prev) => ({ ...prev, stock: Number(event.target.value) }))}
                      placeholder={t('farmer.products.stockPlaceholder')}
                      className="h-11"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.description')}</label>
                  <textarea
                    value={editFormData.description}
                    onChange={(event) => setEditFormData((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder={t('farmer.products.descriptionPlaceholder')}
                    className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">{t('farmer.products.pickupSectionTitle')}</h3>
                      <p className="text-xs text-gray-500">{t('farmer.products.pickupSectionHint')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleUseLocationForEditPickup}
                        disabled={isEditPickupSearching}
                        className="gap-2"
                      >
                        {isEditPickupSearching ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('farmer.products.pickupSearching')}
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4" />
                            {t('farmer.products.pickupUseLocation')}
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleLookupEditPickupAddress}
                        disabled={isEditPickupSearching || !editFormData.pickupAddress.trim()}
                        className="gap-2"
                      >
                        {t('farmer.products.pickupSearch')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyEditPickup}
                        disabled={isVerifyingPickup || !editFormData.pickupAddress.trim()}
                        className="gap-2"
                      >
                        {isVerifyingPickup ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('farmer.products.pickupVerifying')}
                          </>
                        ) : (
                          t('farmer.products.pickupVerify')
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {verifiedStores.length > 0 && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupUseStore')}</label>
                        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                          <Select value={selectedEditPickupStoreId} onValueChange={handleSelectEditPickupStore}>
                            <SelectTrigger 
                              className="h-11"
                            >
                              <SelectValue placeholder={t('farmer.products.pickupUseStorePlaceholder')} />
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
                      </div>
                    )}
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupAddress')}</label>
                      <Input
                        value={editFormData.pickupAddress}
                        onChange={(event) => {
                          const nextAddress = event.target.value;
                          setEditFormData((prev) => ({
                            ...prev,
                            pickupAddress: nextAddress,
                            pickupPostNumber: '',
                            pickupYamatoZipCode: ''
                          }));
                          setPickupVerifyError(null);
                          setEditPickupLookupError(null);
                          setEditPickupSuggestions([]);
                          setSelectedEditPickupStoreId('');
                        }}
                        placeholder={t('farmer.products.pickupAddressPlaceholder')}
                        className="h-11"
                      />
                      {editPickupSuggestions.length > 0 && (
                        <div className="rounded-md border border-gray-200 bg-white p-2">
                          <p className="text-xs text-gray-500">{t('farmer.products.pickupSuggestions')}</p>
                          <div className="flex flex-col gap-2 mt-2">
                            {editPickupSuggestions.map((candidate, index) => (
                              <button
                                key={`${candidate.address}-${index}`}
                                type="button"
                                onClick={() => applyEditPickupSuggestion(candidate)}
                                className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-green-400 hover:bg-green-50"
                              >
                                {candidate.address}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {editPickupLookupError && (
                        <div className="text-sm text-red-600">{editPickupLookupError}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactName')}</label>
                      <Input
                        value={editFormData.pickupContactName}
                        onChange={(event) => setEditFormData((prev) => ({ ...prev, pickupContactName: event.target.value }))}
                        placeholder={t('farmer.products.pickupContactNamePlaceholder')}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactTel')}</label>
                      <Input
                        value={editFormData.pickupContactTel}
                        onChange={(event) => handleEditPickupContactTelChange(event.target.value)}
                        placeholder={t('farmer.products.pickupContactTelPlaceholder')}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupContactMobile')}</label>
                      <Input
                        value={editFormData.pickupContactMobile}
                        onChange={(event) => handleEditPickupContactMobileChange(event.target.value)}
                        placeholder={t('farmer.products.pickupContactMobilePlaceholder')}
                        className="h-11"
                      />
                    </div>
                    {editPickupContactError && (
                      <div className="text-sm text-red-600 md:col-span-2">{editPickupContactError}</div>
                    )}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupPostNumber')}</label>
                      <Input
                        value={editFormData.pickupPostNumber ?? ''}
                        readOnly
                        placeholder={t('farmer.products.pickupPostNumberPlaceholder')}
                        className="h-11 bg-gray-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.pickupYamatoZipCode')}</label>
                      <Input
                        value={editFormData.pickupYamatoZipCode ?? ''}
                        readOnly
                        placeholder={t('farmer.products.pickupYamatoZipCodePlaceholder')}
                        className="h-11 bg-gray-50"
                      />
                    </div>
                  </div>
                  {pickupVerifyError && (
                    <div className="text-sm text-red-600">{pickupVerifyError}</div>
                  )}
                </div>

                {/* Image Upload Section */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.photos')}</label>
                  
                  {/* Image Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                    <input
                      ref={editImageInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files)}
                      className="hidden"
                      id="image-upload"
                      disabled={isUploadingImages || editFormData.images.length >= 10}
                    />
                    <input
                      ref={editCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleImageUpload(e.target.files)}
                      className="hidden"
                      disabled={isUploadingImages || editFormData.images.length >= 10}
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      {isUploadingImages ? (
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-2"></div>
                          <p className="text-sm text-gray-600">{t('farmer.products.uploadingImages')}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">{t('farmer.products.uploadPrompt')}</p>
                          <p className="text-xs text-gray-400 mt-1">{t('farmer.products.uploadHint')}</p>
                        </div>
                      )}
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => editImageInputRef.current?.click()}
                      disabled={isUploadingImages || editFormData.images.length >= 10}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {t('farmer.products.uploadPhotos')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => editCameraInputRef.current?.click()}
                      disabled={isUploadingImages || editFormData.images.length >= 10}
                      className="gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      {t('farmer.products.useCamera')}
                    </Button>
                  </div>

                  {/* Display Existing Images */}
                  {editFormData.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {editFormData.images.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Product ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {editFormData.images.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('farmer.products.noImagesUploaded')}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="destructive"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      handleDeleteClick(selectedProduct!);
                    }}
                    className="px-6"
                    disabled={isSubmitting || isUploadingImages}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('farmer.products.deleteProduct')}
                  </Button>
                  <div className="flex space-x-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsEditDialogOpen(false);
                        setSelectedProduct(null);
                      }} 
                      className="px-6"
                      disabled={isSubmitting || isUploadingImages}
                    >
                      {t('farmer.products.cancel')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || isUploadingImages}
                      className="px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          {t('farmer.products.saving')}
                        </div>
                      ) : (
                        t('farmer.products.saveChanges')
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('farmer.products.deleteProduct')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('farmer.products.deleteConfirm').replace('{name}', selectedProduct?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('farmer.products.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {t('farmer.products.deleting')}
                </div>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isEnhancementDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEnhancementDialog();
          } else {
            setIsEnhancementDialogOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t('farmer.products.aiEnhanceTitle')}</DialogTitle>
            <DialogDescription>{t('farmer.products.aiEnhanceDescription')}</DialogDescription>
          </DialogHeader>

          {!createdProductForMarketing ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : (
            <div className="space-y-6">
              {showPostApplySummary ? (
                <div className="space-y-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleEnhancementVideoProduct}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleEnhancementVideoProduct();
                      }
                    }}
                    className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-4 shadow-[0_10px_35px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(16,185,129,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 animate-in fade-in-0 zoom-in-95 cursor-pointer"
                  >
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-200/40 blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-emerald-200/40 blur-2xl" />
                    <div className="pointer-events-none absolute left-6 top-6 h-3 w-3 rounded-full bg-amber-400/80 animate-ping" />
                    <div className="pointer-events-none absolute left-10 top-10 h-2 w-2 rounded-full bg-emerald-400/80 animate-ping" />
                    <div className="pointer-events-none absolute right-8 top-12 h-2.5 w-2.5 rounded-full bg-rose-400/80 animate-pulse" />
                    <div className="pointer-events-none absolute bottom-8 right-10 h-2 w-2 rounded-full bg-amber-300/80 animate-pulse" />
                    <div className="absolute right-4 top-4 text-[11px] font-semibold uppercase tracking-wide text-amber-700/80">
                      Click to view
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/60">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('farmer.products.postCreateTitle')}
                    </div>
                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-background">
                        {storedProductImageUrl ? (
                          <img
                            src={storedProductImageUrl}
                            alt={createdProductForMarketing.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-foreground">{createdProductForMarketing.name}</span>
                          {createdProductForMarketing.category ? (
                            <Badge variant="outline" className="text-xs capitalize">
                              {createdProductForMarketing.category}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {createdProductForMarketing.description || copy.productSummaryNoDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : showResultScreen ? (
                <div className="flex flex-col items-center gap-6">
                  {enhancementErrorBlock}
                  <div className="w-full max-w-4xl space-y-4">
                    {isEnhancing && !enhancementOutputText && enhancementOutputImages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-background p-8 shadow-sm">
                        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
                        <p className="text-sm text-muted-foreground">{copy.resultLoading}</p>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-xl border bg-background p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-foreground">{copy.outputCardTitle}</h3>
                              <p className="text-sm text-muted-foreground">{copy.outputCardDescription}</p>
                            </div>
                            {enhancementOutputText ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleEnhancementCopy}
                                className="flex items-center gap-2"
                              >
                                <Clipboard className="h-4 w-4" />
                                {enhancementCopied ? copy.copyButtonCopied : copy.copyButtonIdle}
                              </Button>
                            ) : null}
                          </div>
                          <div className="mt-4 space-y-3">
                            {isEnhancing && !enhancementOutputText ? (
                              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                                {copy.resultGenerating}
                              </div>
                            ) : enhancementOutputText ? (
                              <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed whitespace-pre-line">
                                {enhancementOutputText}
                              </div>
                            ) : (
                              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                                {copy.noTextYet}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border bg-background p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-foreground">{copy.imageGalleryTitle}</h3>
                              <p className="text-sm text-muted-foreground">{copy.imageGalleryDescription}</p>
                            </div>
                          </div>
                          <div className="mt-4">
                            {enhancementOutputImages.length > 0 ? (
                              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {enhancementOutputImages.map((img, index) => {
                                  const dataUrl = `data:${img.mimeType};base64,${img.base64}`;
                                  return (
                                    <div key={index} className="overflow-hidden rounded-xl border bg-muted/30 p-3">
                                      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-background">
                                        <img src={dataUrl} alt={`Generated ${index + 1}`} className="h-full w-full object-cover" />
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleDownloadEnhancementImage(img, index)}>
                                          <Download className="mr-2 h-4 w-4" />
                                          {copy.downloadButton}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                                {isEnhancing ? copy.resultGenerating : copy.noImageYet}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      onClick={handleApplyEnhancementAssets}
                      disabled={
                        isApplyingAssets ||
                        (!enhancementOutputText.trim() && enhancementOutputImages.length === 0)
                      }
                      className="flex items-center gap-2"
                    >
                      {isApplyingAssets ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isApplyingAssets ? copy.applyAssetsSaving : copy.applyAssetsButton}
                    </Button>
                    <Button variant="outline" onClick={handleResultBack}>
                      {copy.resultBackButton}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {enhancementErrorBlock}
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      <Sparkles className="h-4 w-4 text-green-600" />
                      <span className="text-base">{createdProductForMarketing.name}</span>
                      {createdProductForMarketing.category ? (
                        <Badge variant="outline" className="text-xs capitalize">
                          {createdProductForMarketing.category}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {createdProductForMarketing.description || copy.productSummaryNoDesc}
                    </p>
                    <dl className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                      <div>
                        <dt className="font-medium text-foreground">{copy.priceLabel}</dt>
                        <dd>
                          {new Intl.NumberFormat('zh-TW', {
                            style: 'currency',
                            currency: 'TWD',
                            maximumFractionDigits: 0
                          }).format(createdProductForMarketing.price ?? 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">{copy.unitLabel}</dt>
                        <dd>{createdProductForMarketing.unit || 'unit'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">{copy.stockLabel}</dt>
                        <dd>{createdProductForMarketing.stock ?? 0}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-xl border bg-background p-4 shadow-sm">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-foreground">{copy.generatorTitle}</h3>
                      <p className="text-sm text-muted-foreground">{copy.generatorDescription}</p>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{copy.referenceImageLabel}</label>
                        <input
                          ref={enhancementFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleEnhancementUpload}
                          className="hidden"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => enhancementFileInputRef.current?.click()}
                            className="flex items-center gap-2"
                          >
                            <ImageIcon className="h-4 w-4" />
                            {enhancementUploadedImage ? copy.changeImageButton : copy.uploadImageButton}
                          </Button>
                          {enhancementUploadedImage ? (
                            <Button type="button" variant="ghost" onClick={clearEnhancementUpload} className="flex items-center gap-2">
                              <X className="h-4 w-4" />
                              {copy.removeImageButton}
                            </Button>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {enhancementUploadedImage ? enhancementUploadedImage.name : copy.uploadHint}
                          </span>
                        </div>
                        {enhancementUploadedImage?.previewUrl ? (
                          <div className="overflow-hidden rounded-lg border bg-background p-2">
                            <img
                              src={enhancementUploadedImage.previewUrl}
                              alt={enhancementUploadedImage.name}
                              className="h-40 w-full object-cover"
                            />
                          </div>
                        ) : storedProductImageUrl ? (
                          <div className="overflow-hidden rounded-lg border bg-background p-2">
                            <img
                              src={storedProductImageUrl}
                              alt={createdProductForMarketing?.name || 'Product'}
                              className="h-40 w-full object-cover"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('farmer.products.usingStoredImage')}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{copy.promptLabel}</label>
                        <Textarea
                          value={enhancementPrompt}
                          onChange={(event) => setEnhancementPrompt(event.target.value)}
                          placeholder={copy.promptPlaceholder}
                          rows={5}
                        />
                        <p className="text-xs text-muted-foreground">
                          {copy.languageNote(languageLabel(language))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={generateEnhancement} disabled={isEnhancing} className="flex items-center gap-2">
                        {isEnhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isEnhancing ? copy.generatingLabel : copy.generateCTA}
                      </Button>
                      {isEnhancing ? (
                        <Button type="button" variant="outline" onClick={stopEnhancement}>
                          {copy.stopLabel}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                  <Button variant="outline" onClick={handleEnhancementViewProducts}>
                    {t('farmer.products.postCreateView')}
                  </Button>
                  <Button variant="outline" onClick={handleEnhancementAddAnother}>
                    {t('farmer.products.postCreateAddAnother')}
                  </Button>
                </div>
                {!showPostApplySummary ? (
                  <Button variant="ghost" onClick={handleEnhancementSkip}>
                    {t('farmer.products.aiEnhanceSkip')}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FarmerProducts;
