import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const MarketDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [farmers, setFarmers] = useState<LineUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    const load = async () => {
      try {
        const [farmerItems, productItems, storeItems] = await Promise.all([
          DatabaseService.getFarmers(12),
          DatabaseService.getAllProducts(12),
          DatabaseService.getAllStores(12)
        ]);
        setFarmers(farmerItems);
        setProducts(productItems);
        setStores(storeItems);
      } catch (error) {
        console.error('Failed to load marketplace data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

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
      title: t('market.farms'),
      value: farmers.length,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: t('market.products'),
      value: products.length,
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: t('dashboard.partnerStores'),
      value: stores.length,
      icon: MapPin,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
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

  const featuredFarmers = farmers.slice(0, 6);
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
      <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl">
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
            <Card key={stat.title} className="group hover:shadow-xl border-0 shadow-lg transition-all duration-300">
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
              {featuredFarmers.map((farmer) => (
                <div key={farmer.id} className="bg-gradient-to-r from-green-50 to-white border-2 border-green-100 rounded-xl p-4 hover:border-green-200 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 font-semibold text-sm">
                          {farmer.displayName?.charAt(0).toUpperCase() || 'F'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{farmer.displayName}</p>
                        <p className="text-xs text-gray-500">認證農家</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {t('market.active')}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-3 h-3" />
                      <span>{t('market.lastInteraction')}: {farmer.metadata?.lastInteraction?.toDate().toLocaleDateString() || '最近'}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-8">
                        <MessageCircle className="w-3 h-3 mr-1" />
                        聊天
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8">
                        <Heart className="w-3 h-3 mr-1" />
                        儲存
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 text-center">
            <Button variant="outline" className="w-full" disabled={farmers.length === 0}>
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
                <div key={product.id} className="bg-gradient-to-r from-purple-50 to-white border-2 border-purple-100 rounded-xl p-4 hover:border-purple-200 transition-colors group">
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
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2" title={product.description || ''}>
                    {product.description || '無商品描述'}
                  </p>
                  
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
                    <Button size="sm" variant="outline" className="flex-1 h-8">
                      <Eye className="w-3 h-3 mr-1" />
                      檢視
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8">
                      <MessageCircle className="w-3 h-3 mr-1" />
                      聯絡
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 px-2">
                      <Heart className="w-3 h-3" />
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
    </div>
  );
};

export default MarketDashboard;
