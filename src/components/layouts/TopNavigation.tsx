import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  X,
  User,
  LogOut,
  Settings,
  Globe,
  LayoutDashboard,
  Trees,
  Package,
  Calendar,
  Star,
  Truck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const TopNavigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();

  const role = user?.role;
  const isAdmin = !!user?.isAdmin;

  const canAccessFarmer = isAdmin || role === 'farmer';
  const canAccessMarket = isAdmin || role === 'market';

  const navigationItems = [
    { label: t('nav.home'), href: '/', key: 'home' },
    ...(canAccessFarmer ? [{ label: t('nav.farmers'), href: '/farmer', key: 'farmers' as const }] : []),
    ...(canAccessMarket
      ? [
          { label: t('nav.markets'), href: '/market', key: 'markets' as const },
          { label: t('nav.store'), href: '/market/products', key: 'store' as const },
        ]
      : []),
    { label: t('nav.demo'), href: '/demo/line', key: 'demo' as const },
  ];

  // Market-specific navigation items for mobile
  const marketNavigationItems = [
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

  // Farmer-specific navigation items for mobile
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
      icon: Trees,
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
      icon: Calendar,
      key: 'marketing'
    },
    {
      label: t('analytics.title'),
      href: '/farmer/analytics',
      icon: Star,
      key: 'analytics'
    }
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleLanguageChange = (lang: 'en' | 'zh-TW') => {
    setLanguage(lang);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-bold text-xl text-gray-900">Farm2Market</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-4">
          {navigationItems.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className={`text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive(item.href) ? 'text-green-600 bg-green-50' : ''
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* Language Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">{language === 'en' ? 'EN' : '繁中'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleLanguageChange('en')} className="font-medium">
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLanguageChange('zh-TW')} className="font-medium">
                繁體中文
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth/User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  {user.pictureUrl ? (
                    <img 
                      src={user.pictureUrl} 
                      alt={user.displayName}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span className="text-sm hidden sm:inline">{user.displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    {t('nav.settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('nav.signout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth/signin">{t('nav.signin')}</Link>
            </Button>
          )}
        </div>

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg pb-4">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navigationItems.map((item) => (
              <Link
                key={item.key}
                to={item.href}
                className={`block text-base font-medium px-3 py-2 rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-green-50 text-green-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            
            {/* Market-specific navigation - only show when in market section */}
            {location.pathname.startsWith('/market') && (
              <>
                <div className="border-t border-gray-200 my-2"></div>
                <div className="px-3 py-1">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('nav.markets')}</h3>
                </div>
                {marketNavigationItems.map((item) => {
                  const Icon = item.icon;
                  const subActive = item.href === '/market'
                    ? location.pathname === '/market'
                    : location.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={`flex items-center text-base font-medium px-3 py-2 rounded-md transition-colors ${
                        subActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </Link>
                  );
                })}
              </>
            )}

            {/* Farmer-specific navigation - only show when in farmer section */}
            {location.pathname.startsWith('/farmer') && (
              <>
                <div className="border-t border-gray-200 my-2"></div>
                <div className="px-3 py-1">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('nav.farmers')}</h3>
                </div>
                {farmerNavigationItems.map((item) => {
                  const Icon = item.icon;
                  const subActive = item.href === '/farmer'
                    ? location.pathname === '/farmer'
                    : location.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={`flex items-center text-base font-medium px-3 py-2 rounded-md transition-colors ${
                        subActive
                          ? 'bg-green-50 text-green-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </Link>
                  );
                })}
              </>
            )}
            
            <div className="border-t border-gray-200 my-2"></div>
            {/* Mobile Language Toggle */}
            <div className="flex justify-around px-3 py-2">
              <Button
                variant={language === 'en' ? 'secondary' : 'ghost'}
                onClick={() => handleLanguageChange('en')}
                className="w-1/2 mr-1 font-medium"
              >
                English
              </Button>
              <Button
                variant={language === 'zh-TW' ? 'secondary' : 'ghost'}
                onClick={() => handleLanguageChange('zh-TW')}
                className="w-1/2 ml-1 font-medium"
              >
                繁體中文
              </Button>
            </div>
            {/* Mobile Auth/User Menu */}
            {user ? (
              <>
                <Link
                  to="/settings"
                  className="block text-base font-medium px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Settings className="w-4 h-4 mr-2 inline-block" /> {t('nav.settings')}
                </Link>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-base font-medium px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2 inline-block" /> {t('nav.signout')}
                </Button>
              </>
            ) : (
              <Link
                to="/auth/signin"
                className="block text-base font-medium px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 text-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('nav.signin')}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default TopNavigation;
