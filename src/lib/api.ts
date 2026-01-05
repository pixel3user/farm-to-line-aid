export const resolveApiBaseUrl = (): string => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envBaseUrl) {
    const trimmed = envBaseUrl.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const isFirebaseHosting = /(?:web\.app|firebaseapp\.com)$/i.test(origin);
      const isCloudFunctions = /cloudfunctions\.net$/i.test(trimmed);
      if (isFirebaseHosting && isCloudFunctions) {
        // Prefer same-origin + hosting rewrite to avoid CORS on Firebase Hosting.
        return origin;
      }
    }
    // If user supplied a URL that already includes /api, strip it to avoid double-prefixing.
    const normalized = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    return normalized;
  }

  // LIFF embeds run on https://liff.line.me/..., which can't serve our API.
  // In that case, fall back to the deployed host (or emulator) base if provided.
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const fallbackHost =
      (import.meta.env.VITE_FRONTEND_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
      'https://farm2market-99.web.app';
    if (/liff\.line\.me/i.test(origin)) {
      return fallbackHost;
    }
    return origin;
  }

  return '';
};

export default resolveApiBaseUrl;
