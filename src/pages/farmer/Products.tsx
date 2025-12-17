import React, { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { Copy, Eye, EyeOff, Filter, MoreHorizontal, Plus, RefreshCw, Search, Edit, Trash2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { DatabaseService, Product } from '@/lib/database';
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

const FarmerProducts: React.FC = () => {
  const { t } = useLanguage();
  const { user, userProducts, refreshUserData, isLoading, isRefreshingData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const previousUserIdRef = useRef<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'general',
    unit: '',
    price: 0,
    stock: 0,
    description: ''
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: 'general',
    unit: '',
    price: 0,
    stock: 0,
    description: '',
    images: [] as string[]
  });

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
      console.log('Product created successfully:', result);
      await refreshUserData();
      setLastRefreshTime(new Date());

      setIsDialogOpen(false);
      setFormData({ name: '', category: 'general', unit: '', price: 0, stock: 0, description: '' });
    } catch (error) {
      console.error('Failed to create product:', error);
      alert('Failed to create product. Please try again.');
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
      alert('Failed to delete product. Please try again.');
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
      const updatedImages = [...editFormData.images, ...newImageUrls].slice(0, 10); // Limit to 10 images
      setEditFormData(prev => ({ ...prev, images: updatedImages }));
    } catch (error) {
      console.error('Failed to upload images:', error);
      alert('Failed to upload images. Please try again.');
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
      alert('Failed to update product. Please try again.');
    } finally {
      setIsSubmitting(false);
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
              Last updated: {lastRefreshTime.toLocaleTimeString()}
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
            {isLoading || isRefreshingData ? 'Refreshing...' : 'Refresh'}
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
              
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="px-6">
                  {t('farmer.products.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isLoading || isRefreshingData}
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
          <CardDescription className="text-base">Filtered directly from Firestore collections with real-time updates</CardDescription>
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
                        <p className="text-gray-500 font-medium">Loading products...</p>
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
                          Modify
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
                              Delete
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
            <DialogTitle className="text-2xl font-bold">Modify Product</DialogTitle>
            <DialogDescription className="text-base">View and edit your product details</DialogDescription>
          </DialogHeader>
          <form className="space-y-6" onSubmit={handleEditSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Product Name *</label>
                <Input
                  value={editFormData.name}
                  onChange={(event) => setEditFormData((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Product name"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Category</label>
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
                <label className="block text-sm font-semibold text-gray-700">Unit</label>
                <Input
                  value={editFormData.unit}
                  onChange={(event) => setEditFormData((prev) => ({ ...prev, unit: event.target.value }))}
                  placeholder="Unit"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Price *</label>
                <Input
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
                <label className="block text-sm font-semibold text-gray-700">Stock Quantity *</label>
                <Input
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
              <label className="block text-sm font-semibold text-gray-700">Description</label>
              <textarea
                value={editFormData.description}
                onChange={(event) => setEditFormData((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Product description"
                className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Image Upload Section */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Product Photos</label>
              
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
                Delete Product
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingImages}
                  className="px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
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
    </div>
  );
};

export default FarmerProducts;
