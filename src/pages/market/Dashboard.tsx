import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import {
  MapPin,
  Users,
  Package,
  TrendingUp,
  Star,
  Clock,
  Settings,
  Search,
  Filter,
  Heart,
  MessageCircle,
  Phone,
  Calendar,
  Award,
  Zap,
  Target,
  BarChart3,
  ShoppingCart,
  Eye,
  ThumbsUp
} from 'lucide-react';
import { DatabaseService, LineUser, Product, Store } from '@/lib/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { FarmerMapPreview, FarmerRelatedSection } from '@/components/FarmerDetailSections';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const FAVORITE_FARMERS_KEY = 'market_favorite_farmers';

const MarketDashboard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: farmers = [], isFetching: farmersFetching } = useQuery<LineUser[]>({
    queryKey: ['market-farmers'],
    queryFn: () => DatabaseService.getFarmers(12),
    staleTime: Infinity,
    cacheTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    initialData: () => queryClient.getQueryData(['market-farmers']) as LineUser[] | undefined,
  });
  const { data: products = [], isFetching: productsFetching } = useQuery<Product[]>({
    queryKey: ['market-products'],
    queryFn: () => DatabaseService.getAllProducts(12),
    staleTime: Infinity,
    cacheTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    initialData: () => queryClient.getQueryData(['market-products']) as Product[] | undefined,
  });
  const { data: stores = [], isFetching: storesFetching } = useQuery<Store[]>({
    queryKey: ['market-stores'],
    queryFn: () => DatabaseService.getAllStores(12),
    staleTime: Infinity,
    cacheTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    initialData: () => queryClient.getQueryData(['market-stores']) as Store[] | undefined,
  });
  const hasCachedData = farmers.length > 0 || products.length > 0 || stores.length > 0;
  const isLoading = !hasCachedData && (farmersFetching || productsFetching || storesFetching);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [favoriteFarmerIds, setFavoriteFarmerIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(FAVORITE_FARMERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load favorite farmers from storage', error);
      return [];
    }
  });
  const [selectedFarmer, setSelectedFarmer] = useState<LineUser | null>(null);
  const [farmerModalMode, setFarmerModalMode] = useState<'details' | 'contact'>('details');
  const [isFarmerModalOpen, setIsFarmerModalOpen] = useState(false);
  const [farmerProducts, setFarmerProducts] = useState<Product[]>([]);
  const [farmerStores, setFarmerStores] = useState<Store[]>([]);
  const [isFarmerDataLoading, setIsFarmerDataLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productFarmer, setProductFarmer] = useState<LineUser | null>(null);
  const [productFarmerStores, setProductFarmerStores] = useState<Store[]>([]);
  const [productRelatedProducts, setProductRelatedProducts] = useState<Product[]>([]);
  const [isProductDataLoading, setIsProductDataLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FAVORITE_FARMERS_KEY, JSON.stringify(favoriteFarmerIds));
  }, [favoriteFarmerIds]);

  useEffect(() => {
    if (!selectedFarmer || !isFarmerModalOpen) {
      setFarmerProducts([]);
      setFarmerStores([]);
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      try {
        setIsFarmerDataLoading(true);
        const farmerId = selectedFarmer.lineUserId || selectedFarmer.id;
        const [productsByFarmer, storesByFarmer] = await Promise.all([
          farmerId ? DatabaseService.getProductsByUser(farmerId) : Promise.resolve([]),
          farmerId ? DatabaseService.getStoresByUser(farmerId) : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setFarmerProducts(productsByFarmer);
          setFarmerStores(storesByFarmer);
        }
      } catch (error) {
        console.error('Failed to load farmer details', error);
        if (!cancelled) {
          setFarmerProducts([]);
          setFarmerStores([]);
        }
      } finally {
        if (!cancelled) {
          setIsFarmerDataLoading(false);
        }
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedFarmer, isFarmerModalOpen]);

  useEffect(() => {
    if (!selectedProduct || !isProductModalOpen) {
      setProductFarmer(null);
      setProductFarmerStores([]);
      setProductRelatedProducts([]);
      return;
    }

    let cancelled = false;
    const loadProductDetails = async () => {
      if (!selectedProduct.userId) return;
      try {
        setIsProductDataLoading(true);
        const [farmerProfile, farmerProductsList, farmerStoresList] = await Promise.all([
          DatabaseService.getLineUser(selectedProduct.userId),
          DatabaseService.getProductsByUser(selectedProduct.userId),
          DatabaseService.getStoresByUser(selectedProduct.userId),
        ]);
        if (!cancelled) {
          setProductFarmer(farmerProfile);
          setProductRelatedProducts(farmerProductsList);
          setProductFarmerStores(farmerStoresList);
        }
      } catch (error) {
        console.error('Failed to load product details', error);
        if (!cancelled) {
          setProductFarmer(null);
          setProductRelatedProducts([]);
          setProductFarmerStores([]);
        }
      } finally {
        if (!cancelled) {
          setIsProductDataLoading(false);
        }
      }
    };

    loadProductDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedProduct, isProductModalOpen]);

  const getFarmerKey = (farmer: LineUser) => farmer.lineUserId || farmer.id;

  const favoriteSet = useMemo(() => new Set(favoriteFarmerIds), [favoriteFarmerIds]);

  const totalRevenue = useMemo(
    () => stores.reduce((sum, store) => sum + (store.metadata?.totalRevenue || 0), 0),
    [stores]
  );

  const totalOrders = useMemo(
    () => stores.reduce((sum, store) => sum + (store.metadata?.totalOrders || 0), 0),
    [stores]
  );

  const avgRevenue = stores.length ? Math.round(totalRevenue / stores.length) : 0;
  const avgOrders = stores.length ? (totalOrders / stores.length).toFixed(1) : '0';

  const quickStats = [
    {
      key: 'farms',
      title: t('market.farms'),
      value: farmers.length,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      key: 'products',
      title: t('market.products'),
      value: products.length,
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      key: 'stores',
      title: t('dashboard.partnerStores'),
      value: stores.length,
      icon: MapPin,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      key: 'orders',
      title: t('dashboard.ordersPerStore'),
      value: avgOrders,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  // Filter and sort products based on search and filters
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort products
    switch (sortBy) {
      case 'price-low':
        return filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
      case 'price-high':
        return filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
      case 'stock':
        return filtered.sort((a, b) => (b.stock || 0) - (a.stock || 0));
      default:
        return filtered.sort((a, b) => (b.createdAt?.toDate().getTime() || 0) - (a.createdAt?.toDate().getTime() || 0));
    }
  }, [products, searchQuery, selectedCategory, sortBy]);

  const sortedFarmers = useMemo(() => {
    if (!farmers.length) return [];
    return [...farmers].sort((a, b) => {
      const aFav = favoriteSet.has(getFarmerKey(a));
      const bFav = favoriteSet.has(getFarmerKey(b));
      if (aFav !== bFav) {
        return aFav ? -1 : 1;
      }
      const aTime =
        a.metadata?.lastInteraction?.toMillis?.() ||
        a.createdAt?.toMillis?.() ||
        0;
      const bTime =
        b.metadata?.lastInteraction?.toMillis?.() ||
        b.createdAt?.toMillis?.() ||
        0;
      return bTime - aTime;
    });
  }, [farmers, favoriteSet]);

  const featuredFarmers = sortedFarmers.slice(0, 6);
  const featuredProducts = filteredProducts.slice(0, 6);
  const topStores = useMemo(() => {
    return [...stores]
      .filter((store) => store.metadata?.totalOrders)
      .sort((a, b) => (b.metadata?.totalOrders || 0) - (a.metadata?.totalOrders || 0))
      .slice(0, 5);
  }, [stores]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return cats;
  }, [products]);

  const insights = [
    t('market.featuredFarmers').replace('{count}', farmers.length.toString()),
    t('market.featuredProducts').replace('{count}', products.length.toString()),
    stores.length
      ? t('market.storeHighlights').replace('{amount}', avgRevenue.toLocaleString())
      : t('market.noStores')
  ];

  const toggleFavoriteFarmer = (farmer: LineUser) => {
    const key = getFarmerKey(farmer);
    setFavoriteFarmerIds((prev) =>
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]
    );
  };

  const openFarmerModal = (farmer: LineUser, mode: 'details' | 'contact') => {
    setSelectedFarmer(farmer);
    setFarmerModalMode(mode);
    setIsFarmerModalOpen(true);
  };

  const handleModalChange = (open: boolean) => {
    setIsFarmerModalOpen(open);
    if (!open) {
      setSelectedFarmer(null);
    }
  };

  const formatDate = (value?: any) => {
    if (!value) return t('market.detail.notProvided');
    if (typeof value === 'string') {
      return new Date(value).toLocaleDateString();
    }
    if (typeof value.toDate === 'function') {
      return value.toDate().toLocaleDateString();
    }
    return t('market.detail.notProvided');
  };

  const formatLocation = (farmer: LineUser | null) => {
    if (!farmer?.location) return t('market.detail.notProvided');
    const { lat, lng } = farmer.location;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    }
    return t('market.detail.notProvided');
  };

  const handleViewAllFarmers = () => {
    navigate('/market/farms');
  };

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleProductModalChange = (open: boolean) => {
    setIsProductModalOpen(open);
    if (!open) {
      setSelectedProduct(null);
    }
  };

  const contactEmail = selectedFarmer?.email;
  const contactPhone = selectedFarmer?.marketProfile?.contactPhone;
  const contactBusiness = selectedFarmer?.marketProfile?.businessName;
  const hasContactDetails = Boolean(contactEmail || contactPhone || contactBusiness);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl" data-tour="market-welcome">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              {t('market.title')}
            </h1>
            <p className="text-blue-100 text-lg">
              {t('market.description')}
            </p>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">Live Marketplace</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              data-tour={`market-metric-${stat.key}`}
              className="group hover:shadow-xl border-0 shadow-lg transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</p>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">+12% this week</span>
                    </div>
                  </div>
                  <div className={`w-14 h-14 ${stat.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-7 h-7 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Enhanced Farm Discovery Section */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            {t('market.featuredFarmersTitle')}
          </CardTitle>
          <CardDescription className="text-base">{t('market.featuredFarmersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {featuredFarmers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">{t('market.noFarmers')}</p>
              <p className="text-sm text-gray-400 mt-2">農家加入平台後會在此顯示</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredFarmers.map((farmer, index) => {
                const farmerKey = getFarmerKey(farmer);
                const isFavorite = favoriteSet.has(farmerKey);

                return (
                  <div
                    key={farmer.id || farmerKey || `farmer-${index}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openFarmerModal(farmer, 'details')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        openFarmerModal(farmer, 'details');
                      }
                    }}
                    className="bg-gradient-to-r from-green-50 to-white border-2 border-green-100 rounded-xl p-4 hover:border-green-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                          <span className="text-green-600 font-semibold text-sm">
                            {farmer.displayName?.charAt(0).toUpperCase() || 'F'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{farmer.displayName}</p>
                          <p className="text-xs text-gray-500">{t('market.certifiedFarmer')}</p>
                        </div>
                      </div>
                      {isFavorite && (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                          {t('market.favoriteAdded')}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {t('market.lastInteraction')}: {formatDate(farmer.metadata?.lastInteraction)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {farmer.marketProfile?.businessName || t('market.detail.notProvided')}
                        </Badge>
                        {farmer.preferences?.language && (
                          <Badge variant="outline" className="text-xs">
                            {farmer.preferences.language.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8"
                        onClick={(event) => {
                          event.stopPropagation();
                          openFarmerModal(farmer, 'contact');
                        }}
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        {t('market.contactButton')}
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={isFavorite ? 'default' : 'outline'}
                          className="flex-1 h-8"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavoriteFarmer(farmer);
                          }}
                        >
                          <Heart
                            className="w-3 h-3 mr-1"
                            fill={isFavorite ? 'currentColor' : 'none'}
                          />
                          {isFavorite ? t('market.favoriteAdded') : t('market.favoriteAdd')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 h-8 text-green-700 hover:text-green-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            openFarmerModal(farmer, 'details');
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          {t('market.detailsButton')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              className="w-full"
              disabled={farmers.length === 0}
              onClick={handleViewAllFarmers}
            >
              <Users className="w-4 h-4 mr-2" />
              {t('market.viewAllFarmers')} ({farmers.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Marketplace Insights */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            {t('market.marketInsightsTitle')}
          </CardTitle>
          <CardDescription className="text-base">{t('market.marketInsightsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.map((insight, index) => (
            <div key={index} className="bg-gradient-to-r from-blue-50 to-white border-2 border-blue-100 rounded-xl p-4 hover:border-blue-200 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">{index + 1}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Enhanced Product Comparison & Discovery */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            {t('market.featuredProductsTitle')}
          </CardTitle>
          <CardDescription className="text-base">{t('market.featuredProductsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜尋商品..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48 h-11">
                <SelectValue placeholder="分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分類</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48 h-11">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">最新</SelectItem>
                <SelectItem value="price-low">價格：低到高</SelectItem>
                <SelectItem value="price-high">價格：高到低</SelectItem>
                <SelectItem value="stock">有庫存</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">{t('market.noProducts')}</p>
              <p className="text-sm text-gray-400 mt-2">
                {searchQuery ? '請調整搜尋條件' : '農家新增商品後會在此顯示'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredProducts.map((product) => (
                <div
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProductModal(product)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      openProductModal(product);
                    }
                  }}
                  className="bg-gradient-to-r from-purple-50 to-white border-2 border-purple-100 rounded-xl p-4 hover:border-purple-200 transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-sm">
                          {product.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{product.name}</h4>
                        <p className="text-xs text-gray-500">由 {product.farmerId || '未知農家'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 capitalize">
                      {product.category || 'general'}
                    </Badge>
                  </div>
                  
                  <MarkdownRenderer
                    content={product.description || '無商品描述'}
                    compact
                    className="mb-3 line-clamp-2 text-sm text-gray-600 prose-p:my-0"
                  />
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-lg font-bold text-green-600">NT$ {product.price || 0}</div>
                    <Badge 
                      variant={product.stock && product.stock > 10 ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      庫存: {product.stock || 0}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="flex-1 h-8">
                      <Link
                        to={`/market/products?product=${product.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        {t('market.productModal.viewDetails')}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        openProductModal(product);
                      }}
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      {t('market.contactButton')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-6 text-center">
            <Button variant="outline" className="w-full" disabled={filteredProducts.length === 0}>
              <Package className="w-4 h-4 mr-2" />
              View All Products ({filteredProducts.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Store Performance */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            {t('market.topPerformingStores')}
          </CardTitle>
          <CardDescription className="text-base">{t('market.topPerformingStoresDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {topStores.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">{t('market.noStoreData')}</p>
              <p className="text-sm text-gray-400 mt-2">{t('market.storeDataWillAppear')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topStores.map((store, index) => (
                <div key={store.id} className="bg-gradient-to-r from-yellow-50 to-white border-2 border-yellow-100 rounded-xl p-4 hover:border-yellow-200 transition-colors">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-yellow-600">#{index + 1}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{store.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{store.location}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('market.totalOrders')}:</span>
                      <span className="font-semibold text-blue-600">{store.metadata?.totalOrders || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('market.revenue')}:</span>
                      <span className="font-semibold text-green-600">NT$ {(store.metadata?.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('market.status')}:</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {t('market.active')}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-8">
                      <Eye className="w-3 h-3 mr-1" />
                      檢視
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8">
                      <MessageCircle className="w-3 h-3 mr-1" />
                      聯絡
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Engagement Suggestions */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            {t('market.smartEngagementSuggestions')}
          </CardTitle>
          <CardDescription className="text-base">{t('market.smartEngagementDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-r from-orange-50 to-white border-2 border-orange-100 rounded-xl p-4 hover:border-orange-200 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{t('market.followUpActiveFarmers')}</p>
                  <p className="text-xs text-gray-600">{t('market.followUpActiveFarmersDesc')}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8">
                <Settings className="w-3 h-3 mr-1" />
                {t('market.plan')}
              </Button>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-white border-2 border-blue-100 rounded-xl p-4 hover:border-blue-200 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{t('market.reviewTopStores')}</p>
                  <p className="text-xs text-gray-600">{t('market.reviewTopStoresDesc')}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8">
                <BarChart3 className="w-3 h-3 mr-1" />
                {t('market.analyze')}
              </Button>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-white border-2 border-green-100 rounded-xl p-4 hover:border-green-200 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{t('market.exploreNewCategories')}</p>
                  <p className="text-xs text-gray-600">{t('market.exploreNewCategoriesDesc')}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8">
                <Package className="w-3 h-3 mr-1" />
                {t('market.explore')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isFarmerModalOpen} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {farmerModalMode === 'details'
                ? t('market.farmerDetailsTitle')
                : t('market.farmerContactTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedFarmer?.displayName || t('market.certifiedFarmer')}
            </DialogDescription>
          </DialogHeader>
          {farmerModalMode === 'details' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{selectedFarmer?.role || 'farmer'}</Badge>
                {favoriteSet.has(selectedFarmer ? getFarmerKey(selectedFarmer) : '') && (
                  <Badge variant="outline" className="border-green-200 text-green-700">
                    {t('market.favoriteAdded')}
                  </Badge>
                )}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.detail.location')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">{formatLocation(selectedFarmer)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.detail.lastInteraction')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {formatDate(selectedFarmer?.metadata?.lastInteraction)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.detail.messages')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedFarmer?.metadata?.totalMessages ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.detail.language')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedFarmer?.preferences?.language?.toUpperCase() || t('market.detail.notProvided')}
                  </dd>
                </div>
              </dl>
              {selectedFarmer?.location &&
                typeof selectedFarmer.location.lat === 'number' &&
                typeof selectedFarmer.location.lng === 'number' && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {t('market.farmerMapTitle')}
                    </p>
                    <div className="h-48 rounded-xl overflow-hidden border border-gray-100">
                      <FarmerMapPreview
                        lat={selectedFarmer.location.lat}
                        lng={selectedFarmer.location.lng}
                        label={selectedFarmer.displayName || t('market.certifiedFarmer')}
                      />
                    </div>
                  </div>
                )}

              <div className="space-y-3">
                <FarmerRelatedSection
                  title={t('market.farmerProductsTitle')}
                  emptyLabel={t('market.farmerProductsEmpty')}
                  isLoading={isFarmerDataLoading}
                >
                  {farmerProducts.length > 0 && (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {farmerProducts.slice(0, 4).map((product) => (
                        <li
                          key={product.id}
                          className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">
                              {product.category || 'general'} · {product.unit}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-green-600">
                              NT$ {(product.price || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {product.stock ?? 0} {t('market.detail.units')}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </FarmerRelatedSection>

                <FarmerRelatedSection
                  title={t('market.farmerStoresTitle')}
                  emptyLabel={t('market.farmerStoresEmpty')}
                  isLoading={isFarmerDataLoading}
                >
                  {farmerStores.length > 0 && (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {farmerStores.slice(0, 4).map((store) => (
                        <li
                          key={store.id}
                          className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{store.name}</p>
                            <p className="text-xs text-gray-500">
                              {store.type || 'other'} · {store.location || t('market.detail.notProvided')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{t('market.totalOrders')}</p>
                            <p className="text-sm font-semibold text-blue-600">
                              {(store.metadata?.totalOrders || 0).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </FarmerRelatedSection>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-xl space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">{t('market.farmerContactEmail')}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {contactEmail || t('market.detail.notProvided')}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-xl space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">{t('market.farmerContactPhone')}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {contactPhone || t('market.detail.notProvided')}
                </p>
              </div>
              {contactBusiness && (
                <div className="p-4 bg-muted rounded-xl space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{t('market.farmerBusinessName')}</p>
                  <p className="text-sm font-semibold text-gray-900">{contactBusiness}</p>
                </div>
              )}
              {!hasContactDetails && (
                <p className="text-sm text-gray-500">{t('market.farmerContactUnavailable')}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isProductModalOpen} onOpenChange={handleProductModalChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name || t('market.productModal.title')}</DialogTitle>
            <DialogDescription>
              {productFarmer?.displayName || t('market.productModal.farmerUnknown')}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.productModal.category')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1 capitalize">
                    {selectedProduct.category || t('market.detail.notProvided')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.productModal.unit')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedProduct.unit || t('market.detail.notProvided')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.productModal.price')}</dt>
                  <dd className="text-sm font-semibold text-green-700 mt-1">
                    NT$ {(selectedProduct.price || 0).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{t('market.productModal.stock')}</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedProduct.stock ?? 0} {t('market.detail.units')}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {t('market.productModal.descriptionLabel')}
                </p>
                <MarkdownRenderer
                  content={selectedProduct.description || t('market.detail.notProvided')}
                  className="prose-sm text-gray-700"
                />
              </div>

              {productFarmer?.location &&
                typeof productFarmer.location.lat === 'number' &&
                typeof productFarmer.location.lng === 'number' && (
                  <section className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {t('market.productModal.map')}
                    </p>
                    <div className="h-60 rounded-xl overflow-hidden border border-gray-100">
                      <FarmerMapPreview
                        lat={productFarmer.location.lat}
                        lng={productFarmer.location.lng}
                        label={productFarmer.displayName || selectedProduct.name}
                      />
                    </div>
                  </section>
                )}

              <section className="space-y-3">
                <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{t('market.productFarmerSummary')}</p>
                  {productFarmer ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-semibold text-gray-900">{productFarmer.displayName}</p>
                      <p className="text-xs text-gray-500">
                        {productFarmer.email || t('market.detail.notProvided')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {productFarmer.marketProfile?.businessName || t('market.farmerBusinessName')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{t('market.productModal.farmerUnknown')}</p>
                  )}
                </div>

                <FarmerRelatedSection
                  title={t('market.productModal.otherProducts')}
                  emptyLabel={t('market.productModal.otherProductsEmpty')}
                  isLoading={isProductDataLoading}
                >
                  {productRelatedProducts.filter((item) => item.id !== selectedProduct.id).length > 0 && (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {productRelatedProducts
                        .filter((item) => item.id !== selectedProduct.id)
                        .slice(0, 4)
                        .map((item) => (
                          <li
                            key={item.id}
                            className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.category || 'general'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-green-600">
                                NT$ {(item.price || 0).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">{item.stock ?? 0} {t('market.detail.units')}</p>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </FarmerRelatedSection>

                <FarmerRelatedSection
                  title={t('market.productModal.stores')}
                  emptyLabel={t('market.productModal.storesEmpty')}
                  isLoading={isProductDataLoading}
                >
                  {productFarmerStores.length > 0 && (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {productFarmerStores.slice(0, 4).map((store) => (
                        <li
                          key={store.id}
                          className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{store.name}</p>
                            <p className="text-xs text-gray-500">
                              {store.location || t('market.detail.notProvided')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{t('market.totalOrders')}</p>
                            <p className="text-sm font-semibold text-blue-600">
                              {(store.metadata?.totalOrders || 0).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </FarmerRelatedSection>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketDashboard;
