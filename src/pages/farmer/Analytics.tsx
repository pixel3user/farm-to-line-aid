import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Layers,
  TrendingDown,
  TrendingUp,
  Target,
  DollarSign,
  Package,
  Users,
  Calendar,
  Zap,
  Brain,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Store, Product } from '@/lib/database';

const formatCurrency = (value: number | undefined) => {
  if (!value) return 'NT$ 0';
  return `NT$ ${value.toLocaleString()}`;
};

const FarmerAnalytics: React.FC = () => {
  const { t } = useLanguage();
  const { userStats, userProducts, userStores, userMarketingMaterials } = useAuth();

  const inventoryMetrics = useMemo(() => {
    const products = userProducts || [];
    const totalStock = products.reduce((sum, product) => sum + (product.stock || 0), 0);
    const lowStockProducts = products.filter((product) => (product.stock || 0) <= 10);
    const averagePrice = products.length
      ? products.reduce((sum, product) => sum + (product.price || 0), 0) / products.length
      : 0;

    return {
      totalProducts: products.length,
      totalStock,
      lowStock: lowStockProducts.length,
      averagePrice: Math.round(averagePrice)
    };
  }, [userProducts]);

  const storePerformance = useMemo(() => {
    const stores = (userStores || []) as Store[];
    const byOrders = [...stores].sort(
      (a, b) => (b.metadata?.totalOrders || 0) - (a.metadata?.totalOrders || 0)
    );
    const topStores = byOrders.slice(0, 3);
    const awaitingFollowUp = stores.filter((store) => store.status === 'contacted');

    return {
      total: stores.length,
      topStores,
      awaitingFollowUp: awaitingFollowUp.length
    };
  }, [userStores]);

  const insights = useMemo(() => {
    const messages: string[] = [];
    if (inventoryMetrics.lowStock > 0) {
      messages.push(t('farmer.analytics.productsNearingLowStock', { count: inventoryMetrics.lowStock }));
    }
    if (storePerformance.awaitingFollowUp > 0) {
      messages.push(t('farmer.analytics.storesWaitingFollowUp', { count: storePerformance.awaitingFollowUp }));
    }
    if ((userMarketingMaterials || []).length === 0) {
      messages.push(t('farmer.analytics.createMarketingMaterials'));
    }
    if (messages.length === 0) {
      messages.push(t('farmer.analytics.greatJob'));
    }
    return messages;
  }, [inventoryMetrics.lowStock, storePerformance.awaitingFollowUp, userMarketingMaterials, t]);

  // Mock forecasting data - in real app this would come from AI/ML service
  const forecastData = useMemo(() => {
    const nextWeekDemand = Math.floor(Math.random() * 50) + 20; // Mock data
    const confidence = Math.floor(Math.random() * 30) + 70; // 70-100%
    const topProduct = userProducts?.[0]?.name || 'Fresh Eggs';
    
    return {
      nextWeekDemand,
      confidence,
      topProduct,
      recommendedAction: nextWeekDemand > 40 ? 'Increase production' : 'Maintain current levels'
    };
  }, [userProducts]);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">{t('farmer.analytics.title')}</h1>
            <p className="text-blue-100 text-lg">{t('farmer.analytics.subtitle')}</p>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-300 rounded-full mr-2"></div>
                <span>{inventoryMetrics.totalProducts} {t('farmer.analytics.productsTracked')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-2"></div>
                <span>{storePerformance.total} {t('farmer.analytics.storesActive')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-300 rounded-full mr-2"></div>
                <span>{t('farmer.analytics.aiForecastingEnabled')}</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <Brain className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900">{t('farmer.analytics.performanceOverview')}</h2>
        <p className="text-gray-600">{t('farmer.analytics.realTimeInsights')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">{t('farmer.analytics.totalProducts')}</p>
                <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform">{inventoryMetrics.totalProducts}</p>
                <p className="text-xs text-green-600 font-medium">+2 {t('farmer.analytics.thisWeek')}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">{t('farmer.analytics.totalStock')}</p>
                <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform">{inventoryMetrics.totalStock}</p>
                <p className="text-xs text-blue-600 font-medium">{t('farmer.analytics.unitsAvailable')}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">{t('farmer.analytics.lowStockAlerts')}</p>
                <div className="flex items-baseline space-x-2">
                  <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform">{inventoryMetrics.lowStock}</p>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <p className="text-xs text-red-600 font-medium">{t('farmer.analytics.needsAttention')}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">{t('farmer.analytics.averagePrice')}</p>
                <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform">{formatCurrency(inventoryMetrics.averagePrice)}</p>
                <p className="text-xs text-green-600 font-medium">{t('farmer.analytics.perUnit')}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Forecasting Section */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            {t('farmer.analytics.aiDemandForecasting')}
          </CardTitle>
          <CardDescription className="text-base">{t('farmer.analytics.predictFutureDemand')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-purple-800">{t('farmer.analytics.nextWeekDemand')}</h4>
              </div>
              <p className="text-3xl font-bold text-purple-900 mb-2">{forecastData.nextWeekDemand}</p>
              <p className="text-sm text-purple-700">{t('farmer.analytics.unitsPredicted', { product: forecastData.topProduct })}</p>
            </div>
            
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-green-800">{t('farmer.analytics.confidenceLevel')}</h4>
              </div>
              <p className="text-3xl font-bold text-green-900 mb-2">{forecastData.confidence}%</p>
              <p className="text-sm text-green-700">{t('farmer.analytics.aiPredictionAccuracy')}</p>
            </div>
            
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-blue-800">{t('farmer.analytics.recommendedAction')}</h4>
              </div>
              <p className="text-lg font-semibold text-blue-900 mb-2">{forecastData.recommendedAction}</p>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {t('farmer.analytics.viewDetails')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              {t('farmer.analytics.inventoryHealth')}
            </CardTitle>
            <CardDescription className="text-base">{t('farmer.analytics.realTimeOverview')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(userProducts || []).slice(0, 6).map((product: Product) => (
              <div key={product.id} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-white border-2 border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-semibold text-sm">
                      {product.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{t('farmer.analytics.category')} {product.category}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge 
                    variant={product.stock <= 10 ? 'destructive' : 'secondary'}
                    className="font-medium"
                  >
                    {t('farmer.analytics.stock')} {product.stock}
                  </Badge>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(product.price)}</span>
                </div>
              </div>
            ))}
            {(userProducts || []).length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">{t('farmer.analytics.noProductsFound')}</p>
                <p className="text-sm text-gray-400 mt-2">{t('farmer.analytics.addFirstProduct')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              {t('farmer.analytics.storePerformance')}
            </CardTitle>
            <CardDescription className="text-base">{t('farmer.analytics.topStoresOrders')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {storePerformance.topStores.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">{t('farmer.analytics.noStoresRecorded')}</p>
                <p className="text-sm text-gray-400 mt-2">{t('farmer.analytics.startBuildingRelationships')}</p>
              </div>
            ) : (
              storePerformance.topStores.map((store, index) => (
                <div key={store.id} className="bg-gradient-to-r from-blue-50 to-white border-2 border-blue-100 rounded-xl p-4 hover:border-blue-200 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{store.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{t('farmer.analytics.status')} {store.status}</p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`${
                        store.status === 'customer' ? 'bg-green-50 text-green-700 border-green-200' :
                        store.status === 'contacted' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {store.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-600">{t('farmer.analytics.orders')} <span className="font-semibold text-blue-600">{store.metadata?.totalOrders || 0}</span></span>
                      <span className="text-gray-600">{t('farmer.analytics.revenue')} <span className="font-semibold text-green-600">{formatCurrency(store.metadata?.totalRevenue)}</span></span>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-yellow-800">{t('farmer.analytics.awaitingFollowUp')}</span>
                <span className="text-sm font-bold text-yellow-900">{storePerformance.awaitingFollowUp}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                {userStats && userStats.monthlyGrowth > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              {t('farmer.analytics.monthlyGrowth')}
            </CardTitle>
            <CardDescription className="text-base">{t('farmer.analytics.growthCompared')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-5xl font-bold mb-2">
                {userStats?.monthlyGrowth && userStats.monthlyGrowth > 0 ? '+' : ''}
                {userStats?.monthlyGrowth || 0}%
              </p>
              <div className="flex items-center justify-center gap-2 mb-4">
                {userStats && userStats.monthlyGrowth > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-600" />
                )}
                <span className="text-sm text-gray-600">
                  {userStats && userStats.monthlyGrowth > 0 ? t('farmer.analytics.growing') : t('farmer.analytics.declining')}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {t('farmer.analytics.basedOnChanges')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <Layers className="w-5 h-5 text-orange-600" />
              </div>
              {t('farmer.analytics.actionableInsights')}
            </CardTitle>
            <CardDescription className="text-base">{t('farmer.analytics.aiGeneratedSuggestions')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.map((insight, index) => (
              <div key={index} className="bg-gradient-to-r from-orange-50 to-white border-2 border-orange-100 rounded-xl p-4 hover:border-orange-200 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FarmerAnalytics;
