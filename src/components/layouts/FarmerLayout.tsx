import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import TopNavigation from './TopNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { featureFlags } from '@/config/featureFlags';
import LocationReminder from '@/components/LocationReminder';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import FarmerOnboarding from '@/components/FarmerOnboarding';
import FarmerTutorial from '@/components/FarmerTutorial';
import { useAuth } from '@/contexts/AuthContext';
import VoiceAssistantPopup from '@/components/VoiceAssistantPopup';
import { 
  LayoutDashboard, 
  Package, 
  Store, 
  Megaphone, 
  BarChart3, 
  BookOpen,
  Truck,
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
  const { user, firebaseUser, liffUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLiffApp, setIsLiffApp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const showDesktopSidebar = !isMobile && !isLiffApp;
  const showVoiceAssistant = Boolean(user || firebaseUser || liffUser);

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
      label: t('schedule.title'), 
      href: '/farmer/delivery', 
      icon: Truck,
      key: 'delivery'
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
  ].filter((item) => {
    if (item.key === 'marketing') {
      return featureFlags.marketingTools;
    }
    if (item.key === 'analytics') {
      return featureFlags.analytics;
    }
    if (item.key === 'references') {
      return featureFlags.references;
    }
    return true;
  });

  const quickActions = [
    { key: 'add-product', label: t('products.add'), icon: Plus, href: '/farmer/products?action=add' },
    { key: 'marketing', label: t('marketing.generate'), icon: FileText, href: '/farmer/marketing?action=create' },
    { key: 'find-stores', label: t('dashboard.quickActions.findStores.title'), icon: MapPin, href: '/farmer/stores' },
  ].filter((action) => {
    if (action.key === 'marketing') {
      return featureFlags.marketingTools;
    }
    return true;
  });

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
      {isMobile && !isLiffApp ? (
        <div className="sticky top-16 z-30 bg-white border-b shadow-sm">
          <div className="flex overflow-x-auto gap-2 px-3 py-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                    active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : showDesktopSidebar ? (
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
                    key={action.key}
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
      ) : null}

      {/* Main content */}
      <div className={showDesktopSidebar ? 'md:ml-64' : ''} style={{ marginTop: '64px', paddingBottom: isLiffApp ? '80px' : undefined }}>
        {/* Page content */}
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          <LocationReminder />
          <FarmerOnboarding>
            <>
              <FarmerTutorial />
              <Outlet />
            </>
          </FarmerOnboarding>
        </div>
      </div>

      {/* Toast containers for protected routes */}
      <Toaster />
      <Sonner />
      {showVoiceAssistant && <VoiceAssistantPopup />}

      {/* Mobile Bottom Navigation for LIFF */}
      {isLiffApp && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${navigationItems.length}, minmax(0, 1fr))` }}
          >
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <button
                  key={item.key}
                  className={`flex flex-col items-center gap-1 py-2 px-1 text-xs ${
                    active ? 'text-green-600 font-semibold' : 'text-gray-600'
                  }`}
                  onClick={() => navigate(item.href)}
                  type="button"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px] leading-tight text-center">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerLayout;
