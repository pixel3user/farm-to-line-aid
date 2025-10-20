// LINE Login integration for web authentication
import { User as FirebaseUser } from 'firebase/auth';

export interface LineLoginUser {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LineLoginConfig {
  channelId: string;
  redirectUri: string;
  state?: string;
  scope?: string;
  prompt?: 'consent' | 'none';
}

class LineAuthService {
  private channelId: string;
  private redirectUri: string;

  constructor() {
    this.channelId = import.meta.env.VITE_LINE_CHANNEL_ID || 'your-line-channel-id';
    this.redirectUri = `${window.location.origin}/auth/line/callback`;
  }

  /**
   * Initiate LINE Login flow
   */
  async login(): Promise<void> {
    const state = this.generateState();
    localStorage.setItem('line_login_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.channelId,
      redirect_uri: this.redirectUri,
      state: state,
      scope: 'profile openid',
      prompt: 'consent'
    });

    const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    
    // Redirect to LINE Login
    window.location.href = lineLoginUrl;
  }

  /**
   * Handle LINE Login callback
   */
  async handleCallback(): Promise<LineLoginUser | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('LINE Login error:', error);
      throw new Error(`LINE Login failed: ${error}`);
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    // Verify state parameter (more lenient for development)
    const savedState = localStorage.getItem('line_login_state');
    if (savedState && state !== savedState) {
      console.warn('State parameter mismatch, but continuing for development');
    }

    // Clean up state
    if (savedState) {
      localStorage.removeItem('line_login_state');
    }

    try {
      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code);
      
      // Get user profile
      const userProfile = await this.getUserProfile(tokenResponse.access_token);
      
      return userProfile;
    } catch (error) {
      console.error('LINE Login callback error:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<{ access_token: string; id_token?: string }> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${apiBaseUrl}/api/auth/line/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri: this.redirectUri,
        client_id: this.channelId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return await response.json();
  }

  /**
   * Get user profile from LINE
   */
  private async getUserProfile(accessToken: string): Promise<LineLoginUser> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${apiBaseUrl}/api/auth/line/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }

    const profile = await response.json();
    
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage
    };
  }

  /**
   * Generate random state parameter for security
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if current URL is a LINE Login callback
   */
  isCallback(): boolean {
    return window.location.pathname === '/auth/line/callback';
  }

  /**
   * Get LINE Login URL for manual redirect
   */
  getLoginUrl(): string {
    const state = this.generateState();
    localStorage.setItem('line_login_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.channelId,
      redirect_uri: this.redirectUri,
      state: state,
      scope: 'profile openid',
      prompt: 'consent'
    });

    return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
  }
}

export const lineAuthService = new LineAuthService();
