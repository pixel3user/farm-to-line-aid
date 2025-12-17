import { User as FirebaseUser } from 'firebase/auth';
import { resolveApiBaseUrl } from './api';

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
}

class LineAuthService {
  private channelId: string;
  private redirectUri: string;

  constructor() {
    this.channelId = import.meta.env.VITE_LINE_CHANNEL_ID || 'your-line-channel-id';
    this.redirectUri = `${window.location.origin}/auth/line/callback`;
  }

  async login(): Promise<void> {
    const state = this.generateState();
    localStorage.setItem('line_login_state', state);

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

    const savedState = localStorage.getItem('line_login_state');
    if (savedState && state !== savedState) {
      console.warn('State parameter mismatch, continuing for development');
    }

    if (savedState) {
      localStorage.removeItem('line_login_state');
    }

    const tokenResponse = await this.exchangeCodeForToken(code);
    const profile = await this.getUserProfile(tokenResponse.access_token);

    return {
      profile,
      idToken: tokenResponse.id_token,
      accessToken: tokenResponse.access_token,
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
    localStorage.setItem('line_login_state', state);

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
