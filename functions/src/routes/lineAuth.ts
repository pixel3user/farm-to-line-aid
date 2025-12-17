// API routes for LINE Login authentication
import { Request, Response } from 'express';
import runtimeConfig from '../lib/runtimeConfig';

interface LineTokenRequest {
  code: string;
  redirect_uri: string;
  client_id: string;
}

interface LineProfileRequest {
  access_token: string;
}

interface LineTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

interface LineProfileResponse {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (req: Request, res: Response) => {
  try {
    const { code, redirect_uri, client_id }: LineTokenRequest = req.body;

    // Prefer dedicated LINE Login channel secret; fall back to bot secret if needed
    const channelSecret =
      runtimeConfig.lineLoginChannelSecret ||
      runtimeConfig.lineChannelSecret ||
      process.env.LINE_LOGIN_CHANNEL_SECRET ||
      process.env.LINE_CHANNEL_SECRET ||
      'your-line-channel-secret';

    if (!code || !redirect_uri || !client_id) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id,
        client_secret: channelSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LINE token exchange error:', errorData);
      return res.status(400).json({ error: 'Failed to exchange code for token' });
    }

    const tokenData: LineTokenResponse = await tokenResponse.json();
    
    res.json({
      access_token: tokenData.access_token,
      id_token: tokenData.id_token,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user profile from LINE
 */
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { access_token }: LineProfileRequest = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Missing access token' });
    }

    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.text();
      console.error('LINE profile error:', errorData);
      return res.status(400).json({ error: 'Failed to get user profile' });
    }

    const profileData: LineProfileResponse = await profileResponse.json();
    
    res.json({
      userId: profileData.userId,
      displayName: profileData.displayName,
      pictureUrl: profileData.pictureUrl,
      statusMessage: profileData.statusMessage
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Mock implementation for development
 */
export const mockExchangeCodeForToken = async (req: Request, res: Response) => {
  try {
    const { code }: LineTokenRequest = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Mock response for development
    const mockTokenData = {
      access_token: `mock_access_token_${Date.now()}`,
      id_token: `mock_id_token_${Date.now()}`,
      expires_in: 3600,
      scope: 'profile openid'
    };

    res.json(mockTokenData);

  } catch (error) {
    console.error('Mock token exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Mock implementation for development
 */
export const mockGetUserProfile = async (req: Request, res: Response) => {
  try {
    const { access_token }: LineProfileRequest = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Missing access token' });
    }

    // Mock response for development
    const mockProfileData = {
      userId: `U${Math.random().toString(36).substr(2, 32)}`,
      displayName: 'Demo LINE User',
      pictureUrl: 'https://picsum.photos/150/150?random=1',
      statusMessage: 'Hello from LINE!'
    };

    res.json(mockProfileData);

  } catch (error) {
    console.error('Mock profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
