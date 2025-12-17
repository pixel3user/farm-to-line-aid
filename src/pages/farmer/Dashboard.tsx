import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Bell,
  Clock,
  FileText,
  MapPin,
  Package,
  Plus,
  Smartphone,
  TrendingUp,
  Users
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserDataService } from '@/services/userDataService';
import { Conversation, Store } from '@/lib/database';
import { featureFlags } from '@/config/featureFlags';
import FarmerLocationMap from '@/components/FarmerLocationMap';

const formatTimestamp = (timestamp?: Timestamp | Date) => {
  if (!timestamp) return '';

  try {
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    return date.toLocaleString();
  } catch (error) {
    console.error('Failed to format timestamp:', error);
    return '';
  }
};

const FarmerDashboard: React.FC = () => {
  const {
    user,
    userStats,
    userProducts,
    userStores,
    userMarketingMaterials,
    refreshUserData,
    isLoading: authLoading,
    isRefreshingData
  } = useAuth();
  const { t } = useLanguage();
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const hasRequestedDataRef = useRef(false);
  const marketingEnabled = featureFlags.marketingTools;

  useEffect(() => {
    if (!user?.id) {
      hasRequestedDataRef.current = false;
      return;
    }

    const missingCoreData = !userStats || !userProducts || !userStores;

    if (missingCoreData && !authLoading && !isRefreshingData && !hasRequestedDataRef.current) {
      hasRequestedDataRef.current = true;
      refreshUserData().catch((error) => {
        console.error('FarmerDashboard: failed to refresh overview data', error);
        hasRequestedDataRef.current = false;
      });
    } else if (!missingCoreData) {
      hasRequestedDataRef.current = false;
    }
  }, [user?.id, userStats, userProducts, userStores, authLoading, isRefreshingData, refreshUserData]);

  useEffect(() => {
    const loadConversations = async () => {
      if (!user?.id) {
        setRecentConversations([]);
        return;
      }

      setIsLoadingConversations(true);
      try {
        const conversations = await UserDataService.getRecentConversations(user.id, 5);
        setRecentConversations(conversations);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    loadConversations();
  }, [user?.id]);

  const isLoading =
    (!!user?.id && (!userStats || !userProducts || !userStores)) ||
    isLoadingConversations ||
    authLoading ||
    isRefreshingData;

  const metricCards = useMemo(() => {
    const cards = [
      {
        key: 'activeProducts',
        title: t('dashboard.metrics.activeProducts'),
        value: userStats?.activeProducts ?? 0,
        icon: Package,
        color: 'bg-green-100 text-green-700',
        href: '/farmer/products'
      },
      {
        key: 'lowStockAlerts',
        title: t('dashboard.metrics.lowStockAlerts'),
        value: userStats?.lowStockProducts ?? 0,
        icon: Bell,
        color: 'bg-red-100 text-red-700'
      },
      {
        key: 'partnerStores',
        title: t('dashboard.metrics.partnerStores'),
        value: userStats?.totalStores ?? 0,
        icon: Users,
        color: 'bg-blue-100 text-blue-700',
        href: '/farmer/stores'
      },
      {
        key: 'marketingAssets',
        title: t('dashboard.metrics.marketingAssets'),
        value: userStats?.totalMarketingMaterials ?? 0,
        icon: FileText,
        color: 'bg-purple-100 text-purple-700'
      }
    ];

    return marketingEnabled ? cards : cards.filter((card) => card.key !== 'marketingAssets');
  }, [t, userStats, marketingEnabled]);

  const quickActions = useMemo(
    () => [
      {
        key: 'createSupply',
        title: t('dashboard.quickActions.createSupply.title'),
        description: t('dashboard.quickActions.createSupply.desc'),
        icon: Plus,
        href: '/farmer/products?action=add',
        color: 'from-green-500 to-green-600',
        hoverColor: 'hover:from-green-600 hover:to-green-700'
      },
      {
        key: 'marketing',
        title: t('dashboard.quickActions.marketing.title'),
        description: t('dashboard.quickActions.marketing.desc'),
        icon: FileText,
        href: '/farmer/marketing?action=create',
        color: 'from-blue-500 to-blue-600',
        hoverColor: 'hover:from-blue-600 hover:to-blue-700'
      },
      {
        key: 'findStores',
        title: t('dashboard.quickActions.findStores.title'),
        description: t('dashboard.quickActions.findStores.desc'),
        icon: MapPin,
        href: '/farmer/stores',
        color: 'from-purple-500 to-purple-600',
        hoverColor: 'hover:from-purple-600 hover:to-purple-700'
      },
      {
        key: 'openDemo',
        title: t('dashboard.quickActions.openDemo.title'),
        description: t('dashboard.quickActions.openDemo.desc'),
        icon: Smartphone,
        href: '/demo/line',
        color: 'from-orange-500 to-orange-600',
        hoverColor: 'hover:from-orange-600 hover:to-orange-700'
      }
    ],
    [t]
  );
  const visibleQuickActions = marketingEnabled
    ? quickActions
    : quickActions.filter((action) => action.key !== 'marketing');

  const storeStatusSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    (userStores || []).forEach((store) => {
      const key = store.status || 'unknown';
      summary[key] = (summary[key] || 0) + 1;
    });
    return summary;
  }, [userStores]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-8 bg-gray-200 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-green-500 via-green-600 to-green-700 rounded-2xl p-8 text-white shadow-xl" data-tour="farmer-welcome">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">
              {t('dashboard.welcome')}, {user?.displayName || 'Farmer'}! 👋
            </h1>
            <p className="text-green-100 text-lg">
              Here's what's happening with your farm business today.
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-2"></div>
                <span>All systems operational</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <TrendingUp className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          const helper =
            metric.key === 'activeProducts' && (userStats?.activeProducts ?? 0) > 0
              ? { text: '+2 this week', className: 'text-xs text-green-600 font-medium' }
              : metric.key === 'lowStockAlerts' && (userStats?.lowStockProducts ?? 0) > 0
              ? { text: t('dashboard.lowStockAlerts'), className: 'text-xs text-red-600 font-medium' }
              : metric.key === 'partnerStores' && (userStats?.totalStores ?? 0) > 0
              ? { text: 'Growing network', className: 'text-xs text-blue-600 font-medium' }
              : metric.key === 'marketingAssets' && (userStats?.totalMarketingMaterials ?? 0) > 0
              ? { text: 'Active campaigns', className: 'text-xs text-purple-600 font-medium' }
              : null;

          const card = (
            <Card
              data-tour={`metric-${metric.key}`}
              className={`group hover:shadow-xl transition-all duration-300 border-0 shadow-lg ${
                metric.href ? 'cursor-pointer' : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                    <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform">{metric.value}</p>
                    {helper && <p className={helper.className}>{helper.text}</p>}
                  </div>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${metric.color} group-hover:scale-110 transition-transform shadow-lg`}>
                    <Icon className="w-8 h-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          return metric.href ? (
            <Link key={metric.key} to={metric.href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 rounded-2xl">
              {card}
            </Link>
          ) : (
            <div key={metric.key}>{card}</div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">{t('dashboard.quickActions')}</CardTitle>
          <CardDescription className="text-lg">
            {t('dashboard.quickActionsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {visibleQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.key} to={action.href} className="group">
                  <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-xl transition-all duration-300 h-full">
                    <div className={`w-16 h-16 bg-gradient-to-br ${action.color} ${action.hoverColor} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-gray-700 transition-colors">{action.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{action.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity, Performance & Location */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-lg border-0 lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              {t('dashboard.recentActivity')}
            </CardTitle>
            <CardDescription className="text-base">{t('dashboard.recentActivityDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentConversations.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Activity className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">{t('dashboard.noConversations')}</p>
                  <p className="text-sm text-gray-400 mt-2">Start by creating your first product or reaching out to stores</p>
                </div>
              ) : (
                recentConversations.map((conversation) => (
                  <div key={conversation.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Activity className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 capitalize">{conversation.type}</p>
                      <p className="text-sm text-gray-600 mt-1">{conversation.content}</p>
                      <p className="text-xs text-gray-400 mt-2">{formatTimestamp(conversation.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              {t('dashboard.performance')}
            </CardTitle>
            <CardDescription className="text-base">{t('dashboard.performanceDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-gray-500 mr-3" />
                  <span className="text-sm font-medium text-gray-700">{t('dashboard.lastActivity')}</span>
                </div>
                <Badge variant="secondary" className="font-medium">{formatTimestamp(userStats?.lastActivity)}</Badge>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="w-5 h-5 text-gray-500 mr-3" />
                  <span className="text-sm font-medium text-gray-700">{t('dashboard.totalRevenue')}</span>
                </div>
                <span className="text-lg font-bold text-green-600">
                  NT$ {userStats?.totalRevenue?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <Activity className="w-5 h-5 text-gray-500 mr-3" />
                  <span className="text-sm font-medium text-gray-700">{t('dashboard.monthlyGrowth')}</span>
                </div>
                <Badge variant={userStats && userStats.monthlyGrowth > 0 ? 'default' : 'destructive'} className="font-medium">
                  {userStats?.monthlyGrowth && userStats.monthlyGrowth > 0 ? '+' : ''}
                  {userStats?.monthlyGrowth || 0}%
                </Badge>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <Package className="w-5 h-5 text-gray-500 mr-3" />
                  <span className="text-sm font-medium text-gray-700">{t('dashboard.productsInStock')}</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{userProducts?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              {t('farmer.location.map.title')}
            </CardTitle>
            <CardDescription className="text-base">
              {t('farmer.location.map.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <FarmerLocationMap />
          </CardContent>
        </Card>
      </div>

      {/* Store Insights */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            {t('dashboard.storeSummary')}
          </CardTitle>
          <CardDescription className="text-base">{t('dashboard.storeSummaryDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {userStores && userStores.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(storeStatusSummary).map(([status, count]) => (
                <Link
                  key={status}
                  to={`/farmer/stores?status=${status}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 rounded-2xl"
                >
                  <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 rounded-xl p-6 hover:border-gray-200 transition-colors cursor-pointer">
                    <p className="text-sm font-medium text-gray-600 capitalize mb-2">{t(`stores.status.${status}`)}</p>
                    <p className="text-3xl font-bold text-gray-900">{count}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(count / Math.max(...Object.values(storeStatusSummary))) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg mb-2">{t('dashboard.noStoresMessage')}</p>
              <p className="text-sm text-gray-400">Start by finding nearby stores to expand your network</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marketing Materials */}
      {marketingEnabled && (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              {t('dashboard.marketingRecent')}
            </CardTitle>
            <CardDescription className="text-base">{t('dashboard.marketingRecentDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {userMarketingMaterials && userMarketingMaterials.length > 0 ? (
              <div className="space-y-4">
                {userMarketingMaterials.slice(0, 3).map((material) => (
                  <div key={material.id} className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-white border-2 border-orange-100 rounded-xl p-6 hover:border-orange-200 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-base font-semibold text-gray-900">{material.title}</p>
                        <p className="text-sm text-gray-600 capitalize">{material.type}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-sm font-medium border-orange-200 text-orange-700">
                      {(material.usage?.timesUsed || 0)} {t('dashboard.marketingUses')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg mb-2">{t('dashboard.noMarketing')}</p>
                <p className="text-sm text-gray-400">Create your first marketing material to promote your products</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FarmerDashboard;
