import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, PaginationLink } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/use-toast';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { DatabaseService, Product } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Search, 
  Package, 
  ShoppingCart,
  Heart,
  Star,
  X,
  Minus,
  Plus,
  User,
  Edit,
  Trash2,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

type CatalogProduct = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  pack?: number;
  price?: number;
  stock?: number;
  images?: string[];
  createdAtMs?: number;
  updatedAtMs?: number;
  ownerId?: string;
  rating?: number;
  reviewCount?: number;
};

type CartItem = {
  product: CatalogProduct;
  quantity: number;
};

const MarketProducts: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user, refreshUserData } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc' | 'stock-desc'>('recent');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [farmNameByOwnerId, setFarmNameByOwnerId] = useState<Record<string, string>>({});
  const [dialogQty, setDialogQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [catalogScrollPosition, setCatalogScrollPosition] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: 'general',
    unit: '',
    price: 0,
    stock: 0,
    description: '',
    images: [] as string[]
  });
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [addedProduct, setAddedProduct] = useState<{ product: CatalogProduct; quantity: number } | null>(null);
  const [reviews, setReviews] = useState<Array<{
    id: string;
    productId: string;
    userId: string;
    rating: number;
    comment: string;
    reviewerName: string;
    createdAt: any;
  }>>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewFormData, setReviewFormData] = useState({
    rating: 5,
    comment: '',
    reviewerName: ''
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const navigate = useNavigate();

  // Load products using the same source as the market featured products
  useEffect(() => {
    const load = async () => {
      try {
        const list = await DatabaseService.getAllProducts(0);
        const mapped: CatalogProduct[] = list.map((p: any) => ({
          id: p.id || p?.docId || '',
          name: p.name || 'Unnamed Product',
          description: p.description || '',
          category: p.category || 'other',
          unit: p.unit || 'unit',
          pack: typeof p.pack === 'number' ? p.pack : 1,
          price: typeof p.price === 'number' ? p.price : 0,
          stock: typeof p.stock === 'number' ? p.stock : 0,
          images: Array.isArray(p.images) ? p.images : (Array.isArray(p.photos) ? p.photos : []),
          createdAtMs: p.createdAt?.toMillis?.() || Date.now(),
          updatedAtMs: p.updatedAt?.toMillis?.() || p.createdAt?.toMillis?.() || Date.now(),
          ownerId: p.userId || p.farmerId
        }));
        const withRatings = mapped.map(p => {
          const hash = Array.from(p.id).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0);
          const rating = 3.6 + ((hash % 15) / 10);
          const reviewCount = 5 + (hash % 150);
          return { ...p, rating: Math.min(5, Math.round(rating * 10) / 10), reviewCount };
        });
        setProducts(withRatings);
        const prices = mapped.map(p => p.price || 0);
        const minP = prices.length ? Math.floor(Math.min(...prices)) : 0;
        const maxP = prices.length ? Math.ceil(Math.max(...prices)) : 1000;
        setPriceRange([minP, maxP]);
        // fetch seller display names
        const ownerIds = Array.from(new Set(withRatings.map(p => p.ownerId).filter(Boolean))) as string[];
        if (ownerIds.length) {
          const pairs = await Promise.all(ownerIds.map(async (oid) => {
            try {
              const user = await DatabaseService.getLineUser(oid);
              return [oid, user?.displayName || 'Unknown Farm'] as const;
            } catch {
              return [oid, 'Unknown Farm'] as const;
            }
          }));
          const nameMap: Record<string, string> = {};
          pairs.forEach(([k, v]) => { nameMap[k] = v; });
          setFarmNameByOwnerId(nameMap);
        }
      } catch (e) {
        console.error('Failed to load products', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Open product detail from query parameter (?product=ID)
  useEffect(() => {
    const pid = searchParams.get('product');
    if (!pid || !products.length) return;
    const target = products.find(p => p.id === pid);
    if (target) {
      setSelectedProduct(target);
      // ensure we keep the query param to allow refresh deep-linking
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('product', pid);
        return next;
      }, { replace: true });
    }
  }, [searchParams, products]);

  // Cart persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem('f2m_cart');
      if (raw) {
        setCart(JSON.parse(raw));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('f2m_cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    setDialogQty(1);
    setImageIndex(0);
    if (selectedProduct) {
      loadReviews(selectedProduct.id);
    } else {
      setReviews([]);
    }
  }, [selectedProduct]);

  const loadReviews = async (productId: string) => {
    setIsLoadingReviews(true);
    try {
      const reviewList = await DatabaseService.getReviewsByProduct(productId);
      setReviews(reviewList);
    } catch (error) {
      console.error('Failed to load reviews', error);
      setReviews([]);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const handleSubmitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct || !user?.id) {
      toast({ title: 'Error', description: 'Please log in to submit a review.', variant: 'destructive' });
      return;
    }
    if (!reviewFormData.comment.trim()) {
      toast({ title: 'Error', description: 'Please enter a review comment.', variant: 'destructive' });
      return;
    }

    setIsSubmittingReview(true);
    try {
      await DatabaseService.createReview(selectedProduct.id, user.id, {
        rating: reviewFormData.rating,
        comment: reviewFormData.comment.trim(),
        reviewerName: reviewFormData.reviewerName.trim() || user.displayName || 'Anonymous'
      });
      toast({ title: 'Review submitted', description: 'Thank you for your review!' });
      setReviewFormData({ rating: 5, comment: '', reviewerName: '' });
      setShowReviewForm(false);
      await loadReviews(selectedProduct.id);
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast({ title: 'Error', description: 'Failed to submit review. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Handle scroll position when switching between catalog and product detail
  useEffect(() => {
    if (selectedProduct) {
      // Scroll to top when product detail opens
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Restore scroll position when returning to catalog
      if (catalogScrollPosition > 0) {
        window.scrollTo({ top: catalogScrollPosition, behavior: 'smooth' });
      }
    }
  }, [selectedProduct, catalogScrollPosition]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        setIsFiltersOpen(window.innerWidth >= 768);
      }
    } catch {}
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return ['all', ...Array.from(set)];
  }, [products]);

  const [minPrice, maxPrice] = useMemo(() => {
    const values = products.map(p => p.price || 0);
    return [values.length ? Math.floor(Math.min(...values)) : 0, values.length ? Math.ceil(Math.max(...values)) : 1000];
  }, [products]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter(p => {
      const matchesSearch = !term || p.name.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term);
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const withinPrice = (p.price || 0) >= priceRange[0] && (p.price || 0) <= priceRange[1];
      const hasStock = !inStockOnly || (p.stock || 0) > 0;
      return matchesSearch && matchesCategory && withinPrice && hasStock;
    });
  }, [products, searchTerm, selectedCategory, priceRange, inStockOnly]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortBy) {
      case 'price-asc':
        return copy.sort((a, b) => (a.price || 0) - (b.price || 0));
      case 'price-desc':
        return copy.sort((a, b) => (b.price || 0) - (a.price || 0));
      case 'stock-desc':
        return copy.sort((a, b) => (b.stock || 0) - (a.stock || 0));
      default:
        return copy.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    }
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0), [cartItems]);

  const addToCart = useCallback((product: CatalogProduct, quantity: number = 1, showPopup: boolean = true) => {
    setCart(prev => {
      const existing = prev[product.id];
      const nextQty = (existing?.quantity || 0) + quantity;
      const updated: Record<string, CartItem> = {
        ...prev,
        [product.id]: { product, quantity: nextQty }
      };
      return updated;
    });
    
    if (showPopup) {
      setAddedProduct({ product, quantity });
      setShowCartPopup(true);
      // Auto-hide after 5 seconds
      setTimeout(() => {
        setShowCartPopup(false);
      }, 5000);
    }
  }, []);

  const updateCartQty = useCallback((productId: string, quantity: number) => {
    setCart(prev => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[productId];
      } else {
        const item = next[productId];
        if (!item) return prev;
        next[productId] = { ...item, quantity };
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const handleModifyClick = (product: CatalogProduct) => {
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

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;
    setIsDeleting(true);
    try {
      await DatabaseService.deleteProduct(selectedProduct.id);
      await refreshUserData();
      // Reload products
      const list = await DatabaseService.getAllProducts(0);
      const mapped: CatalogProduct[] = list.map((p: any) => ({
        id: p.id || p?.docId || '',
        name: p.name || 'Unnamed Product',
        description: p.description || '',
        category: p.category || 'other',
        unit: p.unit || 'unit',
        pack: typeof p.pack === 'number' ? p.pack : 1,
        price: typeof p.price === 'number' ? p.price : 0,
        stock: typeof p.stock === 'number' ? p.stock : 0,
        images: Array.isArray(p.images) ? p.images : (Array.isArray(p.photos) ? p.photos : []),
        createdAtMs: p.createdAt?.toMillis?.() || Date.now(),
        updatedAtMs: p.updatedAt?.toMillis?.() || p.createdAt?.toMillis?.() || Date.now(),
        ownerId: p.userId || p.farmerId
      }));
      setProducts(mapped);
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
      toast({ title: 'Product deleted', description: 'The product has been deleted successfully.' });
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast({ title: 'Error', description: 'Failed to delete product. Please try again.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id || !selectedProduct) return;
    
    setIsUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const timestamp = Date.now();
        const fileName = `products/${user.id}/${selectedProduct.id}/${timestamp}-${file.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
      });

      const newImageUrls = await Promise.all(uploadPromises);
      const updatedImages = [...editFormData.images, ...newImageUrls].slice(0, 10);
      setEditFormData(prev => ({ ...prev, images: updatedImages }));
    } catch (error) {
      console.error('Failed to upload images:', error);
      toast({ title: 'Error', description: 'Failed to upload images. Please try again.', variant: 'destructive' });
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
      // Reload products
      const list = await DatabaseService.getAllProducts(0);
      const mapped: CatalogProduct[] = list.map((p: any) => ({
        id: p.id || p?.docId || '',
        name: p.name || 'Unnamed Product',
        description: p.description || '',
        category: p.category || 'other',
        unit: p.unit || 'unit',
        pack: typeof p.pack === 'number' ? p.pack : 1,
        price: typeof p.price === 'number' ? p.price : 0,
        stock: typeof p.stock === 'number' ? p.stock : 0,
        images: Array.isArray(p.images) ? p.images : (Array.isArray(p.photos) ? p.photos : []),
        createdAtMs: p.createdAt?.toMillis?.() || Date.now(),
        updatedAtMs: p.updatedAt?.toMillis?.() || p.createdAt?.toMillis?.() || Date.now(),
        ownerId: p.userId || p.farmerId
      }));
      setProducts(mapped);
      // Update selected product
      const updated = mapped.find(p => p.id === selectedProduct.id);
      if (updated) {
        setSelectedProduct(updated);
      }
      setIsEditDialogOpen(false);
      toast({ title: 'Product updated', description: 'The product has been updated successfully.' });
    } catch (error) {
      console.error('Failed to update product:', error);
      toast({ title: 'Error', description: 'Failed to update product. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <div className="space-y-6">
        {!selectedProduct ? (
          <>
            {/* Header and Cart */}
            <div className="flex items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('catalog.title')}</h1>
                <p className="text-gray-600">{t('catalog.description')}</p>
              </div>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {`${t('cart.label')} (${cartCount})`}
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">{cartCount}</span>
                  )}
                </Button>
              </SheetTrigger>
            </div>

            {/* Filters */}
            <Card data-tour="market-products-search">
              <CardContent className="p-3 md:p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input placeholder={t('catalog.searchPlaceholder')} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 h-10" />
                    </div>
                  </div>
                  <Button className="md:hidden" variant="outline" size="sm" onClick={() => setIsFiltersOpen(v => !v)}>
                    {isFiltersOpen ? 'Hide' : 'Filters'}
                  </Button>
                </div>
                <div className={`${isFiltersOpen ? 'grid' : 'hidden'} md:grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4`}>
                  <div className="flex gap-2">
                    <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setCurrentPage(1); }}>
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder={t('catalog.category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c} value={c}>{c === 'all' ? t('catalog.allCategories') : c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder={t('catalog.sortBy')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Newest</SelectItem>
                        <SelectItem value="price-asc">{t('catalog.priceLowToHigh')}</SelectItem>
                        <SelectItem value="price-desc">{t('catalog.priceHighToLow')}</SelectItem>
                        <SelectItem value="stock-desc">In Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Price range</span>
                      <span className="font-medium">NT$ {priceRange[0]} - {priceRange[1]}</span>
                    </div>
                    <Slider min={minPrice} max={maxPrice} step={1} value={priceRange} onValueChange={(v: any) => { setPriceRange([v[0], v[1]]); setCurrentPage(1); }} />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <input id="stockOnly" type="checkbox" className="h-4 w-4" checked={inStockOnly} onChange={(e) => { setInStockOnly(e.target.checked); setCurrentPage(1); }} />
                    <label htmlFor="stockOnly" className="text-gray-700">In stock only</label>
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Product Grid */}
          <div className="flex items-center justify-between" data-tour="market-products-list">
            <p className="text-sm text-gray-600">{t('catalog.availableProducts').replace('{count}', sorted.length.toString())}</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v, 10)); setCurrentPage(1); }}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[12, 24, 48].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Horizontal Category Chips */}
          <div className="-mx-2">
            <div className="px-2 overflow-x-auto no-scrollbar">
              <div className="flex gap-2 min-w-max py-1">
                {categories.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={selectedCategory === c ? 'default' : 'outline'}
                    className={`rounded-full ${selectedCategory === c ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0' : ''}`}
                    onClick={() => { setSelectedCategory(c); setCurrentPage(1); }}
                  >
                    {c === 'all' ? t('catalog.allCategories') : c}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {sorted.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No products match your filters.</p>
        </CardContent>
      </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {pageItems.map((p) => (
            <Card
              key={p.id}
              className="group overflow-hidden cursor-pointer hover:shadow-lg transition"
              onClick={() => {
                setCatalogScrollPosition(window.scrollY);
                setSelectedProduct(p);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { 
                if (e.key === 'Enter') {
                  setCatalogScrollPosition(window.scrollY);
                  setSelectedProduct(p);
                }
              }}
            >
                    <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
                    {p.images && p.images[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                        decoding="async"
                        sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
                        fetchpriority="low"
                      />
                    ) : (
                      <Package className="w-10 h-10 text-gray-300" />
                          )}
                        </div>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate text-sm md:text-base">{p.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="capitalize">{p.category || 'general'}</span>
                          {p.ownerId && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1"><User className="w-3 h-3" />{farmNameByOwnerId[p.ownerId] || '—'}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="shrink-0" onClick={(e) => {
                        e.stopPropagation();
                        try {
                          const raw = localStorage.getItem('f2m_favorites');
                          const setFav = new Set<string>(raw ? JSON.parse(raw) : []);
                          setFav.add(p.id);
                          localStorage.setItem('f2m_favorites', JSON.stringify(Array.from(setFav)));
                          toast({ title: 'Saved to favorites', description: p.name, duration: 1500 });
                        } catch {}
                      }}>
                        <Heart className="w-4 h-4" />
                          </Button>
                    </div>
                    <MarkdownRenderer
                      content={p.description || ''}
                      compact
                      className="line-clamp-2 text-xs md:text-sm text-gray-600 prose-p:my-0"
                    />
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 md:w-4 md:h-4 ${i < Math.round((p.rating || 0)) ? 'text-yellow-500' : 'text-gray-300'}`} />
                      ))}
                      <span className="text-[10px] md:text-xs text-gray-500 ml-1">{(p.rating || 0).toFixed(1)} ({p.reviewCount || 0})</span>
                      {p.rating && p.rating > 4.7 && (
                        <Badge variant="outline" className="ml-2 text-amber-700 border-amber-200 bg-amber-50">Best Seller</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                <div>
                        <div className="text-sm md:text-lg font-bold text-green-700">NT$ {(p.price || 0).toLocaleString()}</div>
                        <div className="text-[10px] md:text-xs text-gray-500">{p.stock && p.stock > 0 ? `In stock: ${p.stock}` : 'Out of stock'}</div>
                    </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-8" onClick={(e) => { e.stopPropagation(); addToCart(p, 1, true); }} disabled={!p.stock || p.stock === 0}>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {sorted.length > 0 && (
            <div className="flex items-center justify-center">
              <Pagination className="justify-center">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#" isActive>{currentPage}</PaginationLink>
                  </PaginationItem>
                  {currentPage < totalPages && (
                    <PaginationItem>
                      <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      ) : (
        // Full-page product detail view
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Button variant="outline" onClick={() => {
                setSelectedProduct(null);
                setSearchParams(prev => {
                  const next = new URLSearchParams(prev);
                  next.delete('product');
                  return next;
                }, { replace: true });
              }}>← Back to Catalog</Button>
              <h1 className="text-xl font-semibold mt-2">{selectedProduct.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              {user?.id && (isAdmin || selectedProduct.ownerId === user.id) && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleModifyClick(selectedProduct)}
                  className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {`${t('cart.label')} (${cartCount})`}
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">{cartCount}</span>
                  )}
                </Button>
              </SheetTrigger>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="bg-gray-50 rounded overflow-hidden">
                <div className="aspect-square flex items-center justify-center">
                  {selectedProduct.images && selectedProduct.images[imageIndex] ? (
                    <img
                      src={selectedProduct.images[imageIndex]}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                      decoding="async"
                      fetchpriority="high"
                    />
                  ) : (
                    <Package className="w-10 h-10 text-gray-300" />
                  )}
                    </div>
                  </div>
              {selectedProduct.images && selectedProduct.images.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {selectedProduct.images.map((src, idx) => (
                    <button key={idx} className={`h-16 w-16 rounded border overflow-hidden ${idx === imageIndex ? 'ring-2 ring-green-500' : ''}`} onClick={() => setImageIndex(idx)}>
                      <img
                        src={src}
                        alt={`thumb-${idx}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        width={64}
                        height={64}
                        sizes="64px"
                        fetchpriority="low"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.round((selectedProduct.rating || 0)) ? 'text-yellow-500' : 'text-gray-300'}`} />
                ))}
                <span className="text-xs text-gray-500">{(selectedProduct.rating || 0).toFixed(1)} ({selectedProduct.reviewCount || 0} reviews)</span>
              </div>
              {selectedProduct.ownerId && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Seller: {farmNameByOwnerId[selectedProduct.ownerId] || 'Unknown Farm'}</span>
                </div>
              )}
              <div className="text-3xl font-bold text-green-700">NT$ {(selectedProduct.price || 0).toLocaleString()}</div>
              <div className="text-sm text-gray-500 capitalize">Category: {selectedProduct.category || 'general'}</div>
              <div className="text-sm text-gray-500">Unit: {selectedProduct.unit || '-'}</div>
              <div className="text-sm text-gray-500">Stock: {selectedProduct.stock || 0}</div>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm text-gray-600">Qty</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setDialogQty(q => Math.max(1, q - 1))}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-8 text-center">{dialogQty}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setDialogQty(q => Math.min((selectedProduct.stock || 99), q + 1))}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button className="sm:flex-1" onClick={() => { addToCart(selectedProduct, dialogQty, true); }}>Add to Cart</Button>
                <Button
                  className="sm:flex-1"
                  variant="outline"
                  onClick={() => {
                    addToCart(selectedProduct, dialogQty, false);
                    setCartOpen(false);
                    navigate('/market/checkout');
                  }}
                >
                  Go to Checkout
                </Button>
                <Button className="sm:flex-1" variant="ghost" onClick={() => {
                  setSelectedProduct(null);
                  setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    next.delete('product');
                    return next;
                  }, { replace: true });
                }}>Back to list</Button>
              </div>
              <div className="text-xs text-gray-500 pt-2">Ships in 2–4 days. Free returns within 7 days.</div>
            </div>
          </div>
          {selectedProduct.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <MarkdownRenderer
                content={selectedProduct.description}
                className="prose-sm text-gray-700"
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded p-4">
              <h5 className="font-medium mb-2">Specifications</h5>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex justify-between"><span>Category</span><span className="capitalize">{selectedProduct.category || '-'}</span></div>
                <div className="flex justify-between"><span>Unit</span><span>{selectedProduct.unit || '-'}</span></div>
                <div className="flex justify-between"><span>Pack</span><span>{selectedProduct.pack || 1}</span></div>
                <div className="flex justify-between"><span>SKU</span><span>{selectedProduct.id}</span></div>
              </div>
            </div>
            <div className="bg-gray-50 rounded p-4">
              <h5 className="font-medium mb-2">Shipping & Returns</h5>
              <p className="text-sm text-gray-700">Standard shipping in 2–4 business days. Free returns within 7 days of delivery in original condition.</p>
            </div>
          </div>

          {/* Reviews Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Reviews</h4>
              {user?.id && (
                <Button variant="outline" size="sm" onClick={() => setShowReviewForm(!showReviewForm)}>
                  {showReviewForm ? 'Cancel' : 'Add a Review'}
                </Button>
              )}
            </div>

            {/* Add Review Form */}
            {showReviewForm && user?.id && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="review-name">Your Name (optional)</Label>
                      <Input
                        id="review-name"
                        value={reviewFormData.reviewerName}
                        onChange={(e) => setReviewFormData(prev => ({ ...prev, reviewerName: e.target.value }))}
                        placeholder={user.displayName || 'Anonymous'}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="review-rating">Rating</Label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setReviewFormData(prev => ({ ...prev, rating }))}
                            className="focus:outline-none"
                          >
                            <Star
                              className={`w-6 h-6 ${
                                rating <= reviewFormData.rating
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="text-sm text-gray-600 ml-2">{reviewFormData.rating} / 5</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="review-comment">Your Review *</Label>
                      <Textarea
                        id="review-comment"
                        value={reviewFormData.comment}
                        onChange={(e) => setReviewFormData(prev => ({ ...prev, comment: e.target.value }))}
                        placeholder="Share your experience with this product..."
                        className="min-h-[100px]"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="flex-1"
                      >
                        {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowReviewForm(false);
                          setReviewFormData({ rating: 5, comment: '', reviewerName: '' });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Reviews List */}
            {isLoadingReviews ? (
              <div className="text-center py-8 text-gray-500">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No reviews yet. Be the first to review this product!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{review.reviewerName}</p>
                          <p className="text-xs text-gray-500">
                            {review.createdAt?.toDate ? new Date(review.createdAt.toDate()).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{review.comment}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Modify Product</DialogTitle>
            <DialogDescription>View and edit your product details</DialogDescription>
          </DialogHeader>
          <form className="space-y-6" onSubmit={handleEditSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Product Name *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(event) => setEditFormData((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Product name"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={editFormData.category} onValueChange={(value) => setEditFormData((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eggs">Eggs</SelectItem>
                    <SelectItem value="poultry">Poultry</SelectItem>
                    <SelectItem value="vegetables">Vegetables</SelectItem>
                    <SelectItem value="fruits">Fruits</SelectItem>
                    <SelectItem value="dairy">Dairy</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-unit">Unit</Label>
                <Input
                  id="edit-unit"
                  value={editFormData.unit}
                  onChange={(event) => setEditFormData((prev) => ({ ...prev, unit: event.target.value }))}
                  placeholder="Unit"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price">Price *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editFormData.price}
                  onChange={(event) => setEditFormData((prev) => ({ ...prev, price: Number(event.target.value) }))}
                  placeholder="Price"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stock">Stock Quantity *</Label>
                <Input
                  id="edit-stock"
                  type="number"
                  min="0"
                  value={editFormData.stock}
                  onChange={(event) => setEditFormData((prev) => ({ ...prev, stock: Number(event.target.value) }))}
                  placeholder="Stock"
                  className="h-11"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(event) => setEditFormData((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Product description"
                className="min-h-[100px]"
              />
            </div>

            {/* Image Upload Section */}
            <div className="space-y-4">
              <Label>Product Photos</Label>
              
              {/* Image Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                  id="image-upload-edit"
                  disabled={isUploadingImages}
                />
                <label htmlFor="image-upload-edit" className="cursor-pointer">
                  {isUploadingImages ? (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-2"></div>
                      <p className="text-sm text-gray-600">Uploading images...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload photos or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 10MB (max 10 images)</p>
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
                  <p className="text-sm">No images uploaded yet</p>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button 
                type="button" 
                variant="destructive"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  handleDeleteClick();
                }}
                className="w-full px-6 sm:w-auto"
                disabled={isSubmitting || isUploadingImages}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Product
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                  }} 
                  className="w-full px-6 sm:w-auto"
                  disabled={isSubmitting || isUploadingImages}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingImages}
                  className="w-full px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 sm:w-auto"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Saving...
                    </div>
                  ) : (
                    'Save Changes'
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
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Deleting...
                </div>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Animated Cart Popup */}
      {showCartPopup && addedProduct && (
        <div className="fixed bottom-4 right-4 z-50 cart-popup-enter">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm w-full transform transition-all hover:shadow-3xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {addedProduct.product.images && addedProduct.product.images[0] ? (
                  <img
                    src={addedProduct.product.images[0]}
                    alt={addedProduct.product.name}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {t('cart.addedTitle')}
                      </p>
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-1">
                      {addedProduct.product.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('cart.quantity')}: {addedProduct.quantity} × NT$ {(addedProduct.product.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCartPopup(false)}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all"
                    onClick={() => {
                      setShowCartPopup(false);
                      setCartOpen(true);
                    }}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {t('cart.viewCart')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    <SheetContent side="right" className="w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>{t('cart.title')}</SheetTitle>
      </SheetHeader>
      <div className="mt-4 space-y-4">
        {cartItems.length === 0 ? (
          <p className="text-sm text-gray-500">{t('cart.empty')}</p>
        ) : (
          <div className="space-y-4">
            {cartItems.map(({ product, quantity }) => (
              <div key={product.id} className="flex gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                  {product.images && product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      width={64}
                      height={64}
                      sizes="64px"
                      fetchpriority="low"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
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
                    <Button size="icon" variant="ghost" className="h-8 w-8 ml-auto" onClick={() => removeFromCart(product.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="border-t pt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('cart.subtotal')}</span>
              <span className="text-lg font-bold">NT$ {cartTotal.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  setCartOpen(false);
                  navigate('/market/checkout');
                }}
              >
                {t('cart.checkout')}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setCartOpen(false)}>
                {t('cart.continueShopping')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SheetContent>
  </Sheet>
  );
};

export default MarketProducts;
