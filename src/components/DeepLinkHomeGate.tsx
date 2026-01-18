import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Home from '@/pages/Home';

const DeepLinkHomeGate: React.FC = () => {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [hasCheckedRedirect, setHasCheckedRedirect] = useState(false);

  // Check if we're in a LIFF context (LINE app)
  const isLiffContext = typeof window !== 'undefined' && 
    (window.location.origin.includes('liff.line.me') || 
     navigator.userAgent.toLowerCase().includes('line'));

  const shouldGate = useMemo(() => {
    const params = new URLSearchParams(location.search);
    let tab = params.get('tab');
    let roleParam = params.get('role') as 'farmer' | 'market' | null;
    let product = params.get('product');

    const liffState = params.get('liff.state');
    if (!tab && liffState) {
      try {
        const decoded = decodeURIComponent(liffState);
        const stateParams = new URLSearchParams(decoded.startsWith('?') ? decoded.slice(1) : decoded);
        tab = stateParams.get('tab') || tab;
        roleParam = (stateParams.get('role') as 'farmer' | 'market' | null) || roleParam;
        product = stateParams.get('product') || product;
      } catch {}
    }

    if (!tab && product) {
      tab = 'products';
    }

    if (!tab) return false;

    const role = (() => {
      if (product) return 'market';
      return user?.role || roleParam || null;
    })();

    const routeFor = (tabName: string): string | null => {
      switch (tabName) {
        case 'dashboard':
          return role === 'market' ? '/market' : '/farmer';
        case 'products':
          return role === 'market' ? '/market/products' : '/farmer/products';
        case 'stores':
          return role === 'market' ? '/market/farms' : '/farmer/stores';
        case 'marketing':
          return role === 'market' ? '/market' : '/farmer/marketing';
        case 'analytics':
          return role === 'market' ? '/market/ratings' : '/farmer/analytics';
        case 'settings':
          return '/settings';
        default:
          return null;
      }
    };

    return Boolean(routeFor(tab));
  }, [location.search, user?.role]);

  // Check if there are any query params that might trigger a redirect
  const hasRedirectParams = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.has('tab') || 
           params.has('liff.state') || 
           params.has('product') || 
           params.has('action') ||
           params.has('role');
  }, [location.search]);

  // Wait a brief moment for DeepLinkRouter to process redirects
  // This prevents the flash of the home page
  useEffect(() => {
    if (hasRedirectParams && isLiffContext) {
      // In LIFF context, wait a bit longer for auth to complete and redirect to process
      const timer = setTimeout(() => {
        setHasCheckedRedirect(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setHasCheckedRedirect(true);
    }
  }, [hasRedirectParams, isLiffContext]);

  // Show loading if we're checking for redirects or if auth is still loading
  if (!hasCheckedRedirect || (hasRedirectParams && isLoading)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (shouldGate) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return <Home />;
};

export default DeepLinkHomeGate;
