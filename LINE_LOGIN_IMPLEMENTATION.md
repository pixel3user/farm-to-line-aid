# LINE Login Implementation Guide

## Overview

This implementation adds LINE Login functionality to the Farm to LINE web application, allowing users to authenticate directly from the website using their LINE account. This complements the existing LIFF auto-login for mobile users.

## Features Implemented

### 1. LINE Login Service (`src/lib/lineAuth.ts`)
- **LINE OAuth 2.0 Flow**: Complete implementation of LINE Login web flow
- **State Management**: Secure state parameter generation and validation
- **Token Exchange**: Authorization code to access token exchange
- **Profile Retrieval**: Get user profile information from LINE API
- **Error Handling**: Comprehensive error handling and logging
- **Mock Support**: Development mode with mock responses

### 2. LINE Login Button Component (`src/components/LineLoginButton.tsx`)
- **Reusable Component**: Can be used anywhere in the application
- **Loading States**: Visual feedback during authentication process
- **Error Handling**: Callback for error handling
- **Internationalization**: Supports multiple languages
- **Customizable**: Flexible styling and size options

### 3. LINE Callback Handler (`src/pages/auth/LineCallback.tsx`)
- **Callback Processing**: Handles LINE OAuth callback
- **User Feedback**: Loading, success, and error states
- **Profile Display**: Shows user information after successful login
- **Auto-redirect**: Redirects to appropriate dashboard after login
- **Error Recovery**: Retry and fallback options

### 4. API Endpoints (`src/routes/api/lineAuth.ts`)
- **Token Exchange**: `/api/auth/line/token` - Exchange code for access token
- **Profile Retrieval**: `/api/auth/line/profile` - Get user profile from LINE
- **Mock Implementation**: Development endpoints with mock data
- **Production Ready**: Real LINE API integration for production

### 5. Updated Sign-In Page (`src/pages/auth/SignIn.tsx`)
- **LINE Login Integration**: Prominent LINE login button
- **Error Handling**: Displays LINE login errors
- **User Experience**: Seamless integration with existing auth flow

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# LINE Login Configuration
VITE_LINE_CHANNEL_ID=your_line_channel_id_here
LINE_CHANNEL_SECRET=your_line_channel_secret_here
```

### LINE Developers Console Setup

1. **Create LINE Login Channel**:
   - Go to [LINE Developers Console](https://developers.line.biz/)
   - Create a new "LINE Login" channel
   - Note your Channel ID and Channel Secret

2. **Configure Callback URL**:
   - Set callback URL to: `https://yourdomain.com/auth/line/callback`
   - For development: `http://localhost:8080/auth/line/callback`

3. **Set Scopes**:
   - Required: `profile`
   - Optional: `openid` (for ID token)

## Usage

### Basic LINE Login Button

```tsx
import LineLoginButton from '@/components/LineLoginButton';

<LineLoginButton 
  onError={(error) => console.error(error)}
/>
```

### Custom Styled Button

```tsx
<LineLoginButton
  variant="outline"
  size="lg"
  className="w-full"
  onError={handleError}
>
  Sign in with LINE
</LineLoginButton>
```

### Manual LINE Login

```tsx
import { lineAuthService } from '@/lib/lineAuth';

const handleLogin = async () => {
  try {
    await lineAuthService.login();
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

## Authentication Flow

### 1. User Clicks LINE Login Button
- Button triggers `lineAuthService.login()`
- Generates secure state parameter
- Redirects to LINE OAuth authorization URL

### 2. User Authorizes on LINE
- User sees LINE authorization page
- User grants permission to your app
- LINE redirects back with authorization code

### 3. Callback Processing
- `LineCallback` component handles the redirect
- Exchanges authorization code for access token
- Retrieves user profile from LINE API
- Authenticates user in your system

### 4. User Redirected to Dashboard
- User is automatically logged in
- Redirected to appropriate dashboard (farmer/market)
- User session is established

## Security Features

### State Parameter Validation
- Random state parameter generated for each login attempt
- Stored in localStorage during login process
- Validated on callback to prevent CSRF attacks

### Token Security
- Access tokens are exchanged server-side
- Never exposed to client-side JavaScript
- Proper error handling for invalid tokens

### Error Handling
- Comprehensive error messages
- Graceful fallbacks for failed authentication
- User-friendly error display

## Development vs Production

### Development Mode
- Uses mock API endpoints
- Returns fake user data
- No real LINE API calls required
- Perfect for testing and development

### Production Mode
- Real LINE API integration
- Actual user authentication
- Secure token handling
- Production-ready error handling

## Testing

### Manual Testing
1. Start development server: `npm run dev`
2. Navigate to `/auth/signin`
3. Click "Continue with LINE" button
4. Verify redirect to LINE authorization
5. Test callback handling

### Mock Testing
- Mock endpoints return consistent test data
- No external dependencies required
- Perfect for automated testing

## Troubleshooting

### Common Issues

1. **Invalid Redirect URI**:
   - Ensure callback URL matches LINE console configuration
   - Check for trailing slashes and protocol (http vs https)

2. **Channel ID/Secret Issues**:
   - Verify environment variables are set correctly
   - Check LINE console for correct values

3. **CORS Issues**:
   - Ensure API endpoints are properly configured
   - Check server CORS settings

4. **State Parameter Mismatch**:
   - Clear localStorage and try again
   - Check for multiple tabs/windows interfering

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
```

## Integration with Existing Auth

The LINE login integrates seamlessly with the existing authentication system:

- **Firebase Integration**: LINE users are authenticated through Firebase
- **User Context**: LINE users get the same user context as other auth methods
- **Dashboard Access**: Same dashboard and features available
- **Session Management**: Consistent session handling

## Future Enhancements

### Potential Improvements
1. **LINE ID Token Verification**: Verify ID tokens for additional security
2. **Refresh Token Support**: Implement token refresh for long-lived sessions
3. **Profile Picture Sync**: Sync LINE profile pictures to user accounts
4. **LINE Notifications**: Send notifications through LINE after web login
5. **Multi-account Linking**: Link multiple LINE accounts to one user

### Additional Features
1. **Social Login Options**: Add other social login providers
2. **Account Linking**: Link LINE account with email/password accounts
3. **Profile Management**: Allow users to manage their LINE profile data
4. **Analytics**: Track LINE login usage and success rates

## Support

For issues or questions about the LINE login implementation:

1. Check the console for error messages
2. Verify environment variable configuration
3. Test with mock endpoints first
4. Check LINE Developers Console settings
5. Review the authentication flow documentation

The implementation is production-ready and follows LINE's best practices for web authentication.
