export const POST_ONBOARDING_REDIRECT_KEY = 'farm2market_post_onboarding_redirect';

type LocationLike = {
  pathname: string;
  search?: string;
  hash?: string;
};

export const buildPostOnboardingRedirectPath = (location: LocationLike): string => {
  const search = location.search ?? '';
  const hash = location.hash ?? '';
  return `${location.pathname}${search}${hash}`;
};

export const isAuthRoute = (path: string): boolean => path.startsWith('/auth');

export const savePostOnboardingRedirect = (path: string): void => {
  if (typeof window === 'undefined') return;
  if (!path || isAuthRoute(path)) return;
  if (!sessionStorage.getItem(POST_ONBOARDING_REDIRECT_KEY)) {
    sessionStorage.setItem(POST_ONBOARDING_REDIRECT_KEY, path);
  }
};

export const getPostOnboardingRedirect = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(POST_ONBOARDING_REDIRECT_KEY);
};

export const clearPostOnboardingRedirect = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(POST_ONBOARDING_REDIRECT_KEY);
};

export const consumePostOnboardingRedirect = (): string | null => {
  const redirect = getPostOnboardingRedirect();
  if (redirect) {
    clearPostOnboardingRedirect();
  }
  return redirect;
};

export const isRedirectAllowedForRole = (
  path: string,
  role?: 'farmer' | 'market'
): boolean => {
  if (!path || isAuthRoute(path)) return false;
  if (!role) return true;
  if (path.startsWith('/market') && role !== 'market') return false;
  if (path.startsWith('/farmer') && role !== 'farmer') return false;
  return true;
};
