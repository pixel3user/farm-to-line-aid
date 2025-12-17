import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService, Store } from '@/lib/database';
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
import { CheckCircle2, Circle, CircleDot, Leaf, Loader2, Package, Store as StoreIcon } from 'lucide-react';
import { storage } from '@/lib/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

type StepKey = 'profile' | 'store' | 'product' | 'done';

interface FarmerOnboardingProps {
  children: React.ReactNode;
}

const FarmerOnboarding: React.FC<FarmerOnboardingProps> = ({ children }) => {
  const {
    user,
    userStats,
    userStores,
    userProducts,
    refreshUserData,
    updateUserProfile,
    isLoading,
    isRefreshingData
  } = useAuth();
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
    contactName: '',
    contactPhone: '',
    notes: ''
  });
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'other',
    unit: 'kg',
    unitOther: '',
    price: '',
    stock: '',
    description: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [storeSaving, setStoreSaving] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const initialLoadRequestedRef = useRef(false);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [viewStep, setViewStep] = useState<StepKey | null>(null);

  useEffect(() => {
    setProfileForm({
      displayName: user?.displayName || '',
      email: user?.email || ''
    });
  }, [user?.displayName, user?.email]);

  useEffect(() => {
    if (user?.role === 'farmer' && user?.id && !initialLoadRequestedRef.current && !isRefreshingData) {
      initialLoadRequestedRef.current = true;
      refreshUserData().catch((error) => {
        console.error('FarmerOnboarding: failed to refresh user data', error);
      });
    }
  }, [user?.role, user?.id, isRefreshingData, refreshUserData]);

  const needsProfile = user?.role === 'farmer' && (!user?.displayName || !user?.email);
  const needsStore = user?.role === 'farmer' && ((userStores?.length || 0) === 0);
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

  const currentStep = useMemo<StepKey>(() => {
    if (needsProfile) return 'profile';
    if (needsStore) return 'store';
    if (needsProduct) return 'product';
    return 'done';
  }, [needsProfile, needsStore, needsProduct]);

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

    setStoreSaving(true);
    try {
      const contact: any = {};
      if (storeForm.contactName.trim()) contact.name = storeForm.contactName.trim();
      if (storeForm.contactPhone.trim()) contact.phone = storeForm.contactPhone.trim();

      await DatabaseService.createStore(user.id, {
        name: storeForm.name.trim(),
        type: storeForm.type,
        location: storeForm.location.trim(),
        contact: Object.keys(contact).length ? contact : undefined,
        metadata: {
          notes: storeForm.notes.trim() ? [storeForm.notes.trim()] : []
        }
      });

      await refreshUserData();
      setViewStep(null);
      toast({
        title: t('onboarding.farmer.store.savedTitle'),
        description: t('onboarding.farmer.savedBackend')
      });
      setStoreForm({
        name: '',
        type: 'farmers_market',
        location: '',
        contactName: '',
        contactPhone: '',
        notes: ''
      });
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

      await DatabaseService.createProduct(user.id, {
        name: productForm.name.trim(),
        category: productForm.category,
        unit: resolvedUnit,
        price,
        stock,
        description: productForm.description.trim(),
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
        description: ''
      });
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
                  onChange={(event) =>
                    setStoreForm((prev) => ({ ...prev, location: event.target.value }))
                  }
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
              <Button type="submit" disabled={storeSaving}>
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
