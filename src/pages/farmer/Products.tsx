import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clipboard, Download, Eye, EyeOff, Filter, Loader2, MoreHorizontal, Plus, RefreshCw, Search, Sparkles, Edit, Trash2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { DatabaseService, Product } from '@/lib/database';
import resolveApiBaseUrl from '@/lib/api';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { storage } from '@/lib/firebase';
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

const FarmerProducts: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userProducts, refreshUserData, isLoading, isRefreshingData } = useAuth();
  const copy = useMemo(() => getMarketingCopy(language), [language]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEnhancementDialogOpen, setIsEnhancementDialogOpen] = useState(false);
  const [createdProductForMarketing, setCreatedProductForMarketing] = useState<MarketingProduct | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const previousUserIdRef = useRef<string | null>(null);
  const createImageInputRef = useRef<HTMLInputElement | null>(null);
  const enhancementFileInputRef = useRef<HTMLInputElement | null>(null);
  const enhancementAbortRef = useRef<AbortController | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'general',
    unit: '',
    price: 0,
    stock: 0,
    description: ''
  });
  const [createImages, setCreateImages] = useState<File[]>([]);
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: 'general',
    unit: '',
    price: 0,
    stock: 0,
    description: '',
    images: [] as string[]
  });
  const createImagePreviews = useMemo(
    () => createImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [createImages]
  );
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
  const storedProductImageUrl =
    createdProductForMarketing?.images?.[0] || createdProductForMarketing?.photos?.[0] || '';
  const enhancementErrorBlock = enhancementError ? (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
      {enhancementError}
    </div>
  ) : null;

  const products = (userProducts || []) as Product[];

  const handleRefresh = async () => {
    if (!user?.id || isRefreshingData) {
      return;
    }

    try {
      await refreshUserData();
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
    if (userProducts) {
      setLastRefreshTime(new Date());
    }
  }, [userProducts]);

  React.useEffect(() => {
    return () => {
      createImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [createImagePreviews]);

  React.useEffect(() => {
    if (!createdProductForMarketing?.id || !userProducts?.length) return;
    const match = (userProducts as Product[]).find((product) => product.id === createdProductForMarketing.id);
    if (match) {
      setCreatedProductForMarketing((prev) => (prev ? { ...prev, ...match } : match));
    }
  }, [userProducts, createdProductForMarketing?.id]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    products.forEach((product) => {
      if (product.category) {
        unique.add(product.category);
      }
    });
    return Array.from(unique);
  }, [products]);

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

  React.useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsDialogOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

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
  };

  const handleRemoveCreateImage = (index: number) => {
    setCreateImages((prev) => prev.filter((_, i) => i !== index));
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      console.log('Creating product for user:', user.id, 'with data:', formData);
      const result = await DatabaseService.createProduct(user.id, {
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        price: Number(formData.price),
        stock: Number(formData.stock),
        description: formData.description,
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
      setFormData({ name: '', category: 'general', unit: '', price: 0, stock: 0, description: '' });
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

  const handleModifyClick = (product: Product) => {
    setSelectedProduct(product);
    setEditFormData({
      name: product.name,
      category: product.category || 'general',
      unit: product.unit || '',
      price: product.price || 0,
      stock: product.stock || 0,
      description: product.description || '',
      images: product.images || []
    });
    setIsEditDialogOpen(true);
  };

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
    if (!selectedProduct) return;
    setIsSubmitting(true);
    try {
      await DatabaseService.updateProduct(selectedProduct.id, {
        name: editFormData.name,
        category: editFormData.category,
        unit: editFormData.unit,
        price: Number(editFormData.price),
        stock: Number(editFormData.stock),
        description: editFormData.description,
        images: editFormData.images
      });
      await refreshUserData();
      setLastRefreshTime(new Date());
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
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
      <div className="bg-gradient-to-r from-green-500 via-green-600 to-green-700 rounded-2xl p-8 text-white shadow-xl">
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
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('farmer.products.catalog')}</h2>
          <p className="text-gray-600">{t('farmer.products.catalogDescription')}</p>
          {lastRefreshTime && (
            <p className="text-sm text-gray-500 mt-1">
              {t('farmer.products.lastUpdated').replace('{time}', lastRefreshTime.toLocaleTimeString())}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshingData}
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${(isLoading || isRefreshingData) ? 'animate-spin' : ''}`} />
            {isLoading || isRefreshingData ? t('farmer.products.refreshing') : t('common.refresh')}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-2xl font-bold">{t('farmer.products.createNew')}</DialogTitle>
              <DialogDescription className="text-base">{t('farmer.products.createDescription')}</DialogDescription>
            </DialogHeader>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.category')}</label>
                  <Select value={formData.category} onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}>
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
                    value={formData.unit}
                    onChange={(event) => setFormData((prev) => ({ ...prev, unit: event.target.value }))}
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
                    value={formData.price}
                    onChange={(event) => setFormData((prev) => ({ ...prev, price: Number(event.target.value) }))}
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
                    value={formData.stock}
                    onChange={(event) => setFormData((prev) => ({ ...prev, stock: Number(event.target.value) }))}
                    placeholder={t('farmer.products.stockPlaceholder')}
                    className="h-11"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder={t('farmer.products.descriptionPlaceholder')}
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.photos')}</label>
                <input
                  ref={createImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => handleCreateImageSelect(event.target.files)}
                  className="hidden"
                  disabled={isSubmitting || isUploadingImages || createImages.length >= 10}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => createImageInputRef.current?.click()}
                    disabled={isSubmitting || isUploadingImages || createImages.length >= 10}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {t('farmer.products.uploadPhotos')}
                  </Button>
                  <span className="text-sm text-gray-500">
                    {createImages.length > 0
                      ? `${createImages.length} ${t('farmer.products.photosSelected')}`
                      : t('farmer.products.noPhotosSelected')}
                  </span>
                </div>
                {createImagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {createImagePreviews.map((preview, index) => (
                      <div key={`${preview.file.name}-${index}`} className="group overflow-hidden rounded-lg border bg-white">
                        <div className="relative h-24 w-full overflow-hidden">
                          <img
                            src={preview.url}
                            alt={preview.file.name}
                            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCreateImage(index)}
                            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-gray-600 shadow-sm hover:bg-white"
                            aria-label={t('farmer.products.removeImage').replace('{name}', preview.file.name)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="px-2 py-1 text-xs text-gray-600">
                          <span className="block truncate">{preview.file.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="px-6">
                  {t('farmer.products.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isLoading || isRefreshingData || isUploadingImages}
                  className="px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {t('farmer.products.saving')}
                    </div>
                  ) : (
                    t('farmer.products.saveProduct')
                  )}
                </Button>
              </div>
            </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            {t('farmer.products.catalog')}
          </CardTitle>
          <CardDescription className="text-base">{t('farmer.products.catalogLiveDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="relative w-full lg:w-80">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-10 h-11"
                  placeholder={t('farmer.products.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <Button variant="outline" className="gap-2 h-11" disabled>
                <Filter className="w-4 h-4" />
                {t('farmer.products.advancedFilters')}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48 h-11">
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
                <SelectTrigger className="w-40 h-11">
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

          <div className="rounded-xl border-2 border-gray-100 overflow-hidden" data-tour="products-table">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-semibold text-gray-700">{t('farmer.products.product')}</TableHead>
                  <TableHead className="font-semibold text-gray-700">{t('farmer.products.category')}</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-gray-700">{t('farmer.products.unitColumn')}</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-gray-700">{t('farmer.products.priceColumn')}</TableHead>
                  <TableHead className="font-semibold text-gray-700">{t('farmer.products.stockColumn')}</TableHead>
                  <TableHead className="font-semibold text-gray-700">{t('farmer.products.statusColumn')}</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-gray-700">{t('farmer.products.updated')}</TableHead>
                  <TableHead className="w-20 font-semibold text-gray-700">{t('farmer.products.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isRefreshingData ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">{t('farmer.products.loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                          <span className="text-green-600 font-semibold text-sm">
                            {product.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{product.name}</span>
                          {product.description && (
                            <span className="text-xs text-gray-500 truncate max-w-[200px]">{product.description}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {product.category || t('farmer.products.general')}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-600">{product.unit || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="font-semibold text-green-600">NT$ {product.price || 0}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={product.stock <= 10 ? 'destructive' : product.stock <= 50 ? 'secondary' : 'default'}
                          className="font-medium"
                        >
                          {product.stock}
                        </Badge>
                        {product.stock <= 10 && (
                          <span className="text-xs text-red-600 font-medium">{t('farmer.products.low')}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(product)}
                        className={`flex items-center ${
                          product.isActive ?? true 
                            ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {product.isActive ?? true ? (
                          <>
                            <Eye className="w-4 h-4 mr-1" /> {t('farmer.products.activeStatus')}
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" /> {t('farmer.products.hidden')}
                          </>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500 text-sm">
                      {formatDate(product.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleModifyClick(product)}
                          className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {t('farmer.products.modify')}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(product)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))
                )}
                {!isLoading && !isRefreshingData && filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">{t('farmer.products.noProductsFound')}</p>
                          <p className="text-sm text-gray-400">{t('farmer.products.tryAdjusting')}</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold">{t('farmer.products.modifyProduct')}</DialogTitle>
            <DialogDescription className="text-base">{t('farmer.products.modifyDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-6" onSubmit={handleEditSubmit}>
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

            {/* Image Upload Section */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">{t('farmer.products.photos')}</label>
              
              {/* Image Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                  id="image-upload"
                  disabled={isUploadingImages}
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-semibold">{t('farmer.products.aiEnhanceTitle')}</DialogTitle>
            <DialogDescription>{t('farmer.products.aiEnhanceDescription')}</DialogDescription>
          </DialogHeader>

          {!createdProductForMarketing ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : (
            <div className="space-y-6">
              {showResultScreen ? (
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
                <Button variant="ghost" onClick={handleEnhancementSkip}>
                  {t('farmer.products.aiEnhanceSkip')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FarmerProducts;
