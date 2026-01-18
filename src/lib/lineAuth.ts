import { User as FirebaseUser } from 'firebase/auth';
import { resolveApiBaseUrl } from './api';
import {
  buildPostOnboardingRedirectPath,
  getPostOnboardingRedirect,
  isAuthRoute
} from './postOnboardingRedirect';

export interface LineLoginUser {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LineLoginResult {
  profile: LineLoginUser;
  idToken?: string;
  accessToken: string;
  redirectPath?: string;
}

const LINE_LOGIN_STATE_KEY = 'line_login_state';
const LINE_LOGIN_REDIRECT_KEY = 'farm2market_line_login_redirect';

const normalizeRedirectPath = (path: string | null): string | null => {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed;
};

const resolveLoginRedirectPath = (): string | null => {
  if (typeof window === 'undefined') return null;
  const stored = getPostOnboardingRedirect();
  const storedNormalized = normalizeRedirectPath(stored);
  if (storedNormalized && !isAuthRoute(storedNormalized)) {
    return storedNormalized;
  }
  const fallback = buildPostOnboardingRedirectPath({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash
  });
  const normalizedFallback = normalizeRedirectPath(fallback);
  if (!normalizedFallback || isAuthRoute(normalizedFallback)) return null;
  return normalizedFallback;
};

const saveLineLoginRedirect = (): void => {
  if (typeof window === 'undefined') return;
  const redirectPath = resolveLoginRedirectPath();
  if (!redirectPath) return;
  localStorage.setItem(LINE_LOGIN_REDIRECT_KEY, redirectPath);
};

const consumeLineLoginRedirect = (): string | null => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LINE_LOGIN_REDIRECT_KEY);
  localStorage.removeItem(LINE_LOGIN_REDIRECT_KEY);
  const normalized = normalizeRedirectPath(stored);
  if (!normalized || isAuthRoute(normalized)) return null;
  return normalized;
};

class LineAuthService {
  private channelId: string;
  private redirectUri: string;

  constructor() {
    this.channelId = import.meta.env.VITE_LINE_CHANNEL_ID || 'your-line-channel-id';
    this.redirectUri = this.resolveRedirectUri();
  }

  private resolveRedirectUri(): string {
    if (typeof window === 'undefined') {
      return this.redirectUri || '';
    }
    const origin = window.location.origin;
    const fallbackBase = (import.meta.env.VITE_FRONTEND_BASE_URL as string | undefined)?.replace(/\/+$/, '');
    // When inside LINE (liff.line.me), we should NOT use LINE Login - use LIFF instead
    // Only use fallback for access.line.me (LINE Login callback)
    const useFallback = Boolean(fallbackBase && /access\.line\.me/i.test(origin));
    const base = useFallback ? fallbackBase! : origin;
    return `${base}/auth/line/callback`;
  }

  async login(): Promise<void> {
    // Check if we're inside LINE app - if so, don't use LINE Login, use LIFF instead
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      const isInLineApp = userAgent.includes('line');
      const isLiffOrigin = window.location.origin.includes('liff.line.me');
      
      // If we're on a LIFF URL or in LINE app, prevent LINE Login
      if (isLiffOrigin || (isInLineApp && window.location.origin.includes('liff.line.me'))) {
        console.warn('Inside LINE app detected - LINE Login should not be used. Use LIFF authentication instead.');
        throw new Error('Please use LIFF authentication when inside LINE app. LINE Login is only for web browsers.');
      }
      
      // Check if LIFF is available and we're in LINE client
      try {
        const liff = (await import('@line/liff')).default;
        const isLiffClient = typeof liff.isInClient === 'function' ? liff.isInClient() : false;
        
        if (isLiffClient) {
          console.warn('Inside LINE app detected - LINE Login should not be used. Use LIFF authentication instead.');
          throw new Error('Please use LIFF authentication when inside LINE app. LINE Login is only for web browsers.');
        }
      } catch (error) {
        // If error is our custom error, re-throw it
        if (error instanceof Error && error.message.includes('LIFF authentication')) {
          throw error;
        }
        // If LIFF import fails, continue with LINE Login (fallback for web)
      }
    }

    const state = this.generateState();
    localStorage.setItem(LINE_LOGIN_STATE_KEY, state);
    saveLineLoginRedirect();
    this.redirectUri = this.resolveRedirectUri();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.channelId,
      redirect_uri: this.redirectUri,
      state,
      scope: 'profile openid',
      prompt: 'consent',
    });

    const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    window.location.href = lineLoginUrl;
  }

  async handleCallback(): Promise<LineLoginResult | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      throw new Error(`LINE Login failed: ${error}`);
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    const savedState = localStorage.getItem(LINE_LOGIN_STATE_KEY);
    if (savedState && state !== savedState) {
      console.warn('State parameter mismatch, continuing for development');
    }

    if (savedState) {
      localStorage.removeItem(LINE_LOGIN_STATE_KEY);
    }

    const redirectPath = consumeLineLoginRedirect();
    const tokenResponse = await this.exchangeCodeForToken(code);
    const profile = await this.getUserProfile(tokenResponse.access_token);

    return {
      profile,
      idToken: tokenResponse.id_token,
      accessToken: tokenResponse.access_token,
      redirectPath
    };
  }

  private async exchangeCodeForToken(code: string): Promise<{ access_token: string; id_token?: string }> {
    const apiBaseUrl = resolveApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/auth/line/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: this.redirectUri,
        client_id: this.channelId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return response.json();
  }

  private async getUserProfile(accessToken: string): Promise<LineLoginUser> {
    const apiBaseUrl = resolveApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/auth/line/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }

    const profile = await response.json();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage,
    };
  }

  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  isCallback(): boolean {
    return window.location.pathname === '/auth/line/callback';
  }

  getLoginUrl(): string {
    const state = this.generateState();
    localStorage.setItem(LINE_LOGIN_STATE_KEY, state);
    saveLineLoginRedirect();
    this.redirectUri = this.resolveRedirectUri();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.channelId,
      redirect_uri: this.redirectUri,
      state,
      scope: 'profile openid',
      prompt: 'consent',
    });

    return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
  }
}

export const lineAuthService = new LineAuthService();
