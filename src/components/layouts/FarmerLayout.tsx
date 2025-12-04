import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import TopNavigation from './TopNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  LayoutDashboard, 
  Package, 
  Store, 
  Megaphone, 
  BarChart3, 
  BookOpen,
  Menu,
  X,
  Plus,
  FileText,
  MapPin,
  Smartphone,
  Bot
} from 'lucide-react';

const FarmerLayout: React.FC = () => {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLiffApp, setIsLiffApp] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check if running inside LINE LIFF
    const userAgent = navigator.userAgent.toLowerCase();
    const isInLine = userAgent.includes('line');
    setIsLiffApp(isInLine);
  }, []);

  const navigationItems = [
    { 
      label: t('dashboard.overview'), 
      href: '/farmer', 
      icon: LayoutDashboard,
      key: 'dashboard'
    },
    { 
      label: t('products.title'), 
      href: '/farmer/products', 
      icon: Package,
      key: 'products'
    },
    { 
      label: t('stores.title'), 
      href: '/farmer/stores', 
      icon: Store,
      key: 'stores'
    },
    { 
      label: t('marketing.title'), 
      href: '/farmer/marketing', 
      icon: Megaphone,
      key: 'marketing'
    },
    { 
      label: t('analytics.title'), 
      href: '/farmer/analytics', 
      icon: BarChart3,
      key: 'analytics'
    },
    { 
      label: t('references.title'), 
      href: '/farmer/references', 
      icon: BookOpen,
      key: 'references'
    },
  ];

  const quickActions = [
    { label: t('products.add'), icon: Plus, href: '/farmer/products?action=add' },
    { label: t('marketing.generate'), icon: FileText, href: '/farmer/marketing?action=create' },
    { label: t('dashboard.quickActions.findStores.title'), icon: MapPin, href: '/farmer/stores' },
  ];

  const isActive = (path: string) => {
    if (path === '/farmer') {
      return location.pathname === '/farmer';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation />
      
      {/* Mobile Navigation */}
      {isMobile ? (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="fixed top-20 left-4 z-50 bg-white shadow-lg"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-white">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{t('nav.farmers')}</h2>
                  <p className="text-sm text-gray-500">智慧農業管理</p>
                </div>
                {isLiffApp && (
                  <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                    <Bot className="w-3 h-3" />
                    LINE
                  </div>
                )}
              </div>

              {/* Navigation Items */}
              <nav className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={`flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive(item.href)
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Quick Actions */}
              <div className="border-t pt-4">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t('dashboard.quickActions')}
                </h3>
                <div className="space-y-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.label}
                        to={action.href}
                        className="flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
                        onClick={() => setSidebarOpen(false)}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        {action.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* LINE Integration Info */}
              {isLiffApp && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">LINE 整合</span>
                  </div>
                  <p className="text-xs text-green-700">
                    您正在 LINE 應用程式中使用 Farm2Market AI
                  </p>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        /* Desktop Sidebar */
        <div className="fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg" style={{ top: '64px' }}>
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('nav.farmers')}</h2>
              <p className="text-xs text-gray-500">智慧農業管理</p>
            </div>
            {isLiffApp && (
              <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                <Bot className="w-3 h-3" />
                LINE
              </div>
            )}
          </div>

          <nav className="mt-6 px-3">
            <div className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive(item.href)
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Quick Actions */}
          <div className="mt-8 px-3">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('dashboard.quickActions')}
            </h3>
            <div className="mt-2 space-y-1">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    to={action.href}
                    className="flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors"
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    {action.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* LINE Integration Info */}
          {isLiffApp && (
            <div className="mt-8 mx-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">LINE 整合</span>
                </div>
                <p className="text-xs text-green-700">
                  您正在 LINE 應用程式中使用 Farm2Market AI
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className={isMobile ? '' : 'md:ml-64'} style={{ marginTop: '64px' }}>
        {/* Page content */}
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>

      {/* Mobile Bottom Navigation for LIFF */}
      {isMobile && isLiffApp && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 z-40">
          <div className="flex justify-around">
            <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 p-2">
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-xs">儀表板</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 p-2">
              <Package className="w-4 h-4" />
              <span className="text-xs">產品</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 p-2">
              <Store className="w-4 h-4" />
              <span className="text-xs">店家</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 p-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs">分析</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerLayout;
