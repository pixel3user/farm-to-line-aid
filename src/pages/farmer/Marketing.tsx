import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  ShoppingBag,
  Package,
  Image as ImageIcon,
  X,
  Loader2,
  Clipboard,
  Download,
  CheckCircle2,
  Save,
  UploadCloud
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { featureFlags } from '@/config/featureFlags';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import resolveApiBaseUrl from '@/lib/api';
import { DatabaseService } from '@/lib/database';
import { storage } from '@/lib/firebase';
import { getMarketingCopy, languageLabel } from '@/lib/marketingCopy';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { cn } from '@/lib/utils';
import type { Product as ProductType } from '@/types';

type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; base64: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

type MarketingProduct = ProductType & { images?: string[]; isActive?: boolean };

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

const readRemoteImage = (url: string) =>
  new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch image (${response.status})`);
        }
        return response.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('Unable to read image data.'));
            return;
          }
          const base64 = reader.result.split(',')[1] ?? '';
          if (!base64) {
            reject(new Error('Unable to extract image data.'));
            return;
          }
          resolve({ base64, mimeType: blob.type || 'image/png' });
        };
        reader.onerror = () => reject(new Error('Unable to read image data.'));
        reader.readAsDataURL(blob);
      })
      .catch(reject);
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

const FarmerMarketing: React.FC = () => {
  const { user, userProducts = [], refreshUserData } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const copy = useMemo(() => getMarketingCopy(language), [language]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<{
    name: string;
    previewUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputText, setOutputText] = useState('');
  const [outputImages, setOutputImages] = useState<Array<{ base64: string; mimeType: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSavingText, setIsSavingText] = useState(false);
  const [savingImageIndex, setSavingImageIndex] = useState<number | null>(null);

  const marketingProducts = useMemo(() => {
    const products = (userProducts as MarketingProduct[]) || [];
    return products.filter((product) => {
      const activeFlag = typeof product.active === 'boolean' ? product.active : product.isActive;
      return activeFlag !== false;
    });
  }, [userProducts]);

  useEffect(() => {
    if (!marketingProducts.length) return;
    if (!selectedProductId || !marketingProducts.some((item) => item.id === selectedProductId)) {
      setSelectedProductId(marketingProducts[0].id);
    }
  }, [marketingProducts, selectedProductId]);

  const selectedProduct = useMemo(
    () => marketingProducts.find((product) => product.id === selectedProductId) ?? null,
    [marketingProducts, selectedProductId]
  );

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      toast({
        title: copy.copyToastTitle,
        description: copy.copyToastDesc
      });
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast({
        title: copy.copyToastErrorTitle,
        description: (err as Error).message,
        variant: 'destructive'
      });
    }
  };

  const handleDownloadImage = (image: { base64: string; mimeType: string }, index: number) => {
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `marketing-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setUploadedImage({ name: file.name, ...data });
    } catch (err) {
      toast({
        title: copy.uploadFailedTitle,
        description: (err as Error).message,
        variant: 'destructive'
      });
      event.target.value = '';
    }
  };

  const clearUpload = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const generate = async () => {
    if (!selectedProduct) {
      toast({
        title: copy.selectProductToastTitle,
        description: copy.selectProductToastDesc
      });
      return;
    }

    setIsGenerating(true);
    setOutputText('');
    setOutputImages([]);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const fallbackImageUrl = selectedProduct.photos?.[0] || selectedProduct.images?.[0];
      let imagePayload = uploadedImage
        ? {
            base64: uploadedImage.base64,
            mimeType: uploadedImage.mimeType
          }
        : undefined;

      if (!imagePayload && fallbackImageUrl) {
        try {
          imagePayload = await readRemoteImage(fallbackImageUrl);
        } catch (err) {
          console.warn('Failed to load product image for marketing enhancement', err);
          toast({
            title: copy.fallbackImageErrorTitle,
            description: copy.fallbackImageErrorDesc
          });
        }
      }

      const apiBaseUrl = resolveApiBaseUrl();
      const targetUrl = `${apiBaseUrl}/api/marketing/generate-stream`;
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          language,
          product: {
            name: selectedProduct.name,
            category: selectedProduct.category,
            description: selectedProduct.description
          },
          image: imagePayload
            ? {
                base64: imagePayload.base64,
                mimeType: imagePayload.mimeType
              }
            : undefined
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

          let event: StreamEvent;
          try {
            event = JSON.parse(trimmed) as StreamEvent;
          } catch {
            continue;
          }

          if (event.type === 'text') {
            setOutputText((prev) => prev + event.text);
          } else if (event.type === 'image') {
            setOutputImages((prev) => [...prev, { base64: event.base64, mimeType: event.mimeType }]);
          } else if (event.type === 'error') {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyTextToProduct = async () => {
    if (!selectedProduct) {
      toast({
        title: copy.selectProductToastTitle,
        description: copy.selectProductToastDesc
      });
      return;
    }
    const trimmed = outputText.trim();
    if (!trimmed) {
      toast({
        title: copy.applyTextButton,
        description: copy.applyTextMissing,
        variant: 'destructive'
      });
      return;
    }

    setIsSavingText(true);
    try {
      await DatabaseService.updateProduct(selectedProduct.id, {
        description: trimmed
      } as any);
      toast({
        title: copy.applyTextSuccess,
        description: selectedProduct.name
      });
      if (typeof refreshUserData === 'function') {
        await refreshUserData();
      }
    } catch (err) {
      console.error('Failed to update product description from marketing page', err);
      toast({
        title: copy.applyTextError,
        description: (err as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingText(false);
    }
  };

  const handleAttachImageToProduct = async (image: { base64: string; mimeType: string }, index: number) => {
    if (!selectedProduct) {
      toast({
        title: copy.selectProductToastTitle,
        description: copy.selectProductToastDesc
      });
      return;
    }
    if (!user?.id) {
      toast({
        title: copy.applyImageError,
        description: copy.missingUserError,
        variant: 'destructive'
      });
      return;
    }
    if (!storage) {
      toast({
        title: copy.applyImageError,
        description: copy.storageUnavailableError,
        variant: 'destructive'
      });
      return;
    }

    setSavingImageIndex(index);
    try {
      const bytes = base64ToUint8Array(image.base64);
      const extension = image.mimeType?.split('/')?.[1]?.split('+')?.[0] || 'png';
      const fileName = `products/${user.id}/${selectedProduct.id}/marketing-${Date.now()}-${index}.${extension}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, bytes, { contentType: image.mimeType || 'image/png' });
      const downloadURL = await getDownloadURL(storageRef);
      const existing =
        (Array.isArray(selectedProduct.images) && selectedProduct.images.length > 0
          ? selectedProduct.images
          : Array.isArray(selectedProduct.photos)
            ? selectedProduct.photos
            : []) ?? [];
      const updatedImages = Array.from(new Set([downloadURL, ...existing]));
      await DatabaseService.updateProduct(selectedProduct.id, {
        images: updatedImages,
        photos: updatedImages
      } as any);
      toast({
        title: copy.applyImageSuccess,
        description: selectedProduct.name
      });
      if (typeof refreshUserData === 'function') {
        await refreshUserData();
      }
    } catch (err) {
      console.error('Failed to attach marketing image to product', err);
      toast({
        title: copy.applyImageError,
        description: (err as Error).message,
        variant: 'destructive'
      });
    } finally {
      setSavingImageIndex(null);
    }
  };

  if (!featureFlags.marketingTools) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('marketing.title')}</CardTitle>
          <CardDescription>Marketing tools are temporarily hidden while we focus on other improvements.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Check back soon for updated marketing automation features.
        </CardContent>
      </Card>
    );
  }

  const heroTitle = t('farmer.marketing.title') ?? copy.heroTitle;
  const heroSubtitle = t('farmer.marketing.subtitle') ?? copy.heroSubtitle;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" />
          {copy.heroBadge}
        </div>
        <h1 className="text-3xl font-semibold leading-tight">{heroTitle}</h1>
        <p className="text-muted-foreground">{heroSubtitle}</p>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShoppingBag className="h-5 w-5 text-primary" />
              {copy.inventoryTitle}
            </CardTitle>
            <CardDescription>{copy.inventoryDescription}</CardDescription>
          </div>
          <Badge variant="outline" className="text-sm">
            {copy.productCount(marketingProducts.length)}
          </Badge>
        </CardHeader>
        <CardContent>
          {!marketingProducts.length ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              {copy.emptyState}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {marketingProducts.map((product) => {
                const isSelected = product.id === selectedProductId;
                const mainPhoto = product.photos?.[0] || product.images?.[0];
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    className={cn(
                      'group relative flex h-full flex-col gap-3 rounded-2xl border bg-background/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg',
                      isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                    )}
                  >
                    <div className="overflow-hidden rounded-xl border bg-muted">
                      {mainPhoto ? (
                        <img
                          src={mainPhoto}
                          alt={product.name}
                          className="h-40 w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center text-sm text-muted-foreground">
                          {copy.noPhoto}
                        </div>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold leading-tight">{product.name}</h3>
                        <p className="text-sm text-muted-foreground capitalize">{product.category}</p>
                      </div>
                      <Badge variant="secondary" className="text-[11px]">
                        {copy.productBadge}
                      </Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div className="space-y-0.5">
                        <dt>{copy.priceLabel}</dt>
                        <dd className="text-sm font-semibold text-foreground">
                          {new Intl.NumberFormat('zh-TW', {
                            style: 'currency',
                            currency: 'TWD',
                            maximumFractionDigits: 0
                          }).format(product.price ?? 0)}{' '}
                          / {product.unit || 'unit'}
                        </dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt>{copy.stockLabel}</dt>
                        <dd className="text-sm font-semibold text-foreground">{product.stock ?? 0}</dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt>{copy.packLabel}</dt>
                        <dd>{product.pack || 1}</dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt>{copy.gradeLabel}</dt>
                        <dd>{product.grade || '—'}</dd>
                      </div>
                    </dl>
                    {product.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{copy.noDescription}</p>
                    )}
                    {isSelected ? (
                      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-white shadow">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {copy.focusedBadge}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30 shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            {copy.generatorTitle}
          </CardTitle>
          <CardDescription>{copy.generatorDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedProduct ? (
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                <Package className="h-4 w-4 text-primary" />
                {selectedProduct.name}
                <Badge variant="outline" className="text-xs capitalize">
                  {selectedProduct.category}
                </Badge>
                {selectedProduct.grade ? (
                  <Badge variant="secondary" className="text-xs">
                    {copy.gradeBadgePrefix} {selectedProduct.grade}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedProduct.description || copy.productSummaryNoDesc}
              </p>
              <dl className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-foreground">{copy.priceLabel}</dt>
                  <dd>
                    {new Intl.NumberFormat('zh-TW', {
                      style: 'currency',
                      currency: 'TWD',
                      maximumFractionDigits: 0
                    }).format(selectedProduct.price ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">{copy.unitLabel}</dt>
                  <dd>{selectedProduct.unit || 'unit'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">{copy.stockLabel}</dt>
                  <dd>{selectedProduct.stock ?? 0}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              {copy.selectProductFallback}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{copy.referenceImageLabel}</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  {uploadedImage ? copy.changeImageButton : copy.uploadImageButton}
                </Button>
                {uploadedImage ? (
                  <Button type="button" variant="ghost" onClick={clearUpload} className="flex items-center gap-2">
                    <X className="h-4 w-4" />
                    {copy.removeImageButton}
                  </Button>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {uploadedImage ? uploadedImage.name : copy.uploadHint}
                </span>
              </div>
              {uploadedImage?.previewUrl ? (
                <div className="overflow-hidden rounded-xl border bg-background">
                  <img src={uploadedImage.previewUrl} alt={uploadedImage.name} className="h-56 w-full object-cover" />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{copy.promptLabel}</label>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={6}
                placeholder={copy.promptPlaceholder}
              />
              <p className="text-xs text-muted-foreground">{copy.languageNote(languageLabel(language))}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={isGenerating || !selectedProduct} className="flex items-center gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? copy.generatingLabel : copy.generateCTA}
            </Button>
            {isGenerating ? (
              <Button type="button" variant="outline" onClick={stop}>
                {copy.stopLabel}
              </Button>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive-foreground">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {(outputText || outputImages.length > 0) && (
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{copy.outputCardTitle}</CardTitle>
              <CardDescription>{copy.outputCardDescription}</CardDescription>
            </div>
            {outputText ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleApplyTextToProduct}
                  disabled={isSavingText}
                  className="flex items-center gap-2"
                >
                  {isSavingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSavingText ? copy.applyTextSaving : copy.applyTextButton}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="flex items-center gap-2">
                  <Clipboard className="h-4 w-4" />
                  {copied ? copy.copyButtonCopied : copy.copyButtonIdle}
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            {outputText ? (
              <div className="rounded-2xl border bg-background p-4 text-sm leading-relaxed whitespace-pre-line">{outputText}</div>
            ) : (
              <div className="text-sm text-muted-foreground">{copy.noTextYet}</div>
            )}

            {outputImages.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {outputImages.map((image, index) => {
                  const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
                  return (
                    <div key={`${image.mimeType}-${index}`} className="rounded-2xl border bg-muted/30 p-3">
                      <div className="relative overflow-hidden rounded-xl bg-background">
                        <img src={dataUrl} alt={`Generated ${index + 1}`} className="h-64 w-full object-cover" />
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        <Button
                          type="button"
                          onClick={() => handleAttachImageToProduct(image, index)}
                          disabled={savingImageIndex === index}
                          className="w-full gap-2"
                        >
                          {savingImageIndex === index ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UploadCloud className="h-4 w-4" />
                          )}
                          {savingImageIndex === index ? copy.applyImageSaving : copy.applyImageButton}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadImage(image, index)}
                          className="w-full gap-2"
                        >
                          <Download className="h-4 w-4" />
                          {copy.downloadButton}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{copy.noImageYet}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FarmerMarketing;
