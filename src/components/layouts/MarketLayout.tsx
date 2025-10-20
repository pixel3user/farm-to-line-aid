import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import TopNavigation from './TopNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  LayoutDashboard, 
  Trees, 
  Package, 
  Calendar, 
  Star,
  Menu,
  X,
  Search,
  MapPin,
  Filter
} from 'lucide-react';

const MarketLayout: React.FC = () => {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

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
  ];

  const isActive = (path: string) => {
    if (path === '/market') {
      return location.pathname === '/market';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation />
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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

      {/* Main content */}
      <div className="md:ml-64" style={{ marginTop: '64px' }}>
        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MarketLayout;
