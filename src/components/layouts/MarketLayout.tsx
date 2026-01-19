import React, { useEffect, useState, Suspense } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import TopNavigation from './TopNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { featureFlags } from '@/config/featureFlags';
import LocationReminder from '@/components/LocationReminder';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  BarChart3,
  BookOpen,
  Megaphone,
  Trees, 
  Package, 
  Calendar, 
  Star,
  Store,
  Truck,
  Menu,
  X,
  Search,
  MapPin,
  Filter,
  FileText
} from 'lucide-react';

const MarketOnboarding = React.lazy(() => import('@/components/MarketOnboarding'));
const MarketTutorial = React.lazy(() => import('@/components/MarketTutorial'));
const VoiceAssistantPopup = React.lazy(() => import('@/components/VoiceAssistantPopup'));

const MarketLayout: React.FC = () => {
  const { t } = useLanguage();
  const { user, firebaseUser, liffUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLiffApp, setIsLiffApp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const showDesktopSidebar = !isMobile && !isLiffApp;
  const showVoiceAssistant = Boolean(user || firebaseUser || liffUser);
  const isFarmer = user?.role === 'farmer';

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isInLine = userAgent.includes('line');
    setIsLiffApp(isInLine);
  }, []);

  const navigationItems = [
    { 
      label: t('dashboard.overview'), 
      href: '/market', 
      icon: LayoutDashboard,
      key: 'dashboard'
    },
    { 
      label: t('farms.title'), 
      href: '/market/farms', 
      icon: Trees,
      key: 'farms'
    },
    { 
      label: t('catalog.title'), 
      href: '/market/products', 
      icon: Package,
      key: 'products'
    },
    { 
      label: t('schedule.title'), 
      href: '/market/schedule', 
      icon: Calendar,
      key: 'schedule'
    },
    { 
      label: t('ratings.title'), 
      href: '/market/ratings', 
      icon: Star,
      key: 'ratings'
    },
    { 
      label: 'Invoice Management', 
      href: '/invoices', 
      icon: FileText,
      key: 'invoices'
    },
  ].filter((item) => {
    if (item.key === 'invoices') {
      return featureFlags.invoiceManager;
    }
    return true;
  });

  const farmerNavigationItems = [
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
      label: 'Invoice Management', 
      href: '/invoices', 
      icon: FileText,
      key: 'invoices'
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
    if (item.key === 'invoices') {
      return featureFlags.invoiceManager;
    }
    return true;
  });

  const liffNavigationItems = isFarmer ? farmerNavigationItems : navigationItems;

  const isActive = (path: string) => {
    if (path === '/market') {
      return location.pathname === '/market';
    }
    return location.pathname.startsWith(path);
  };

  const isLiffNavActive = (item: { href: string; key: string }) => {
    if (isFarmer && location.pathname.startsWith('/market/products')) {
      return item.key === 'products';
    }
    return isActive(item.href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation />
      {isMobile && !isLiffApp && (
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
                    active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {showDesktopSidebar && (
        <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`} style={{ top: '64px' }}>
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('nav.markets')}</h2>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
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
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* Main content */}
      <div className={showDesktopSidebar ? 'md:ml-64' : ''} style={{ marginTop: '64px', paddingBottom: isLiffApp ? '80px' : undefined }}>
        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8">
          <LocationReminder />
          <Suspense fallback={null}>
            <>
              <MarketTutorial />
              <MarketOnboarding>
                <Outlet />
              </MarketOnboarding>
            </>
          </Suspense>
        </div>
      </div>

      {/* Toast containers for protected routes */}
      <Toaster />
      <Sonner />
      {showVoiceAssistant && (
        <Suspense fallback={null}>
          <VoiceAssistantPopup />
        </Suspense>
      )}

      {isLiffApp && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${liffNavigationItems.length}, minmax(0, 1fr))` }}
          >
            {liffNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = isLiffNavActive(item);
              return (
                <button
                  key={item.key}
                  className={`flex flex-col items-center gap-1 py-2 px-1 text-xs ${
                    active
                      ? isFarmer
                        ? 'text-green-600 font-semibold'
                        : 'text-blue-600 font-semibold'
                      : 'text-gray-600'
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

export default MarketLayout;
