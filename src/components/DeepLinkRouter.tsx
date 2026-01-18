import { useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Observes URL query (?tab=products&action=add) and performs deep-link redirects
// so LIFF links like https://app/?tab=products land on the correct route.
export default function DeepLinkRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useLayoutEffect(() => {
    const params = new URLSearchParams(location.search);
    // Support LIFF redirect style: ?liff.state=%3Ftab%3Dproducts%26role%3Dmarket%26product%3Dabc
    let tab: string | null = params.get('tab');
    let action: string | null = params.get('action');
    let roleParam = params.get('role') as 'farmer' | 'market' | null;
    let product = params.get('product');

    const liffState = params.get('liff.state');
    if (!tab && liffState) {
      try {
        const decoded = decodeURIComponent(liffState);
        const stateParams = new URLSearchParams(decoded.startsWith('?') ? decoded.slice(1) : decoded);
        tab = stateParams.get('tab') || tab;
        action = stateParams.get('action') || action;
        roleParam = (stateParams.get('role') as 'farmer' | 'market' | null) || roleParam;
        product = stateParams.get('product') || product;
      } catch {}
    }
    const isEditAction = action === 'edit';
    // Allow product-only deep links to resolve to the catalog
    if (!tab && product && !isEditAction) {
      tab = 'products';
    }
    if (!tab) return;

    // If a specific product is being opened from LINE, force the market storefront
    // (we want a buyer-facing view even if role=farmer is present).
    const role = (() => {
      if (product && !isEditAction) return 'market';
      return user?.role || roleParam || null;
    })();

    function routeFor(tabName: string): string | null {
      switch (tabName) {
        case 'dashboard':
          return role === 'market' ? '/market' : '/farmer';
        case 'products':
          return role === 'market' ? '/market/products' : '/farmer/products';
        case 'stores':
          // Market area uses "farms" route in this app
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
    }

    const target = routeFor(tab);
    if (target && location.pathname !== target) {
      const nextParams = new URLSearchParams();
      if (action) nextParams.set('action', action);
      // Preserve role if provided in query and user role is not known
      if (!user?.role && role) nextParams.set('role', role);
      if (product) nextParams.set('product', product);
      const query = nextParams.toString();
      navigate(query ? `${target}?${query}` : target, { replace: true });
    }
  }, [location.pathname, location.search, navigate, user]);

  return null;
}
