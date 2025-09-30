# Farm2Market AI - Complete LINE Integration Guide

## Overview

This guide documents the complete integration of LINE login, LINE Bot, and real user data management for the Farm2Market AI application.

## Features Implemented

### 1. LINE LIFF Authentication
- **Automatic Login**: Users are automatically logged in when accessing from LINE app
- **Bot Redirect**: Users redirected from LINE Bot are automatically authenticated
- **Profile Management**: User profiles are created and managed in Firebase
- **Session Management**: Persistent login sessions with proper logout functionality

### 2. Real User Data Integration
- **Firebase Firestore**: All user data is stored in Firestore
- **Dynamic Data Loading**: Real-time data loading from database
- **Sample Data Creation**: Automatic sample data creation for new users
- **Data Synchronization**: Real-time updates across all components

### 3. LINE Bot Integration
- **Webhook Handling**: Complete webhook event processing
- **User Profile Access**: Bot can access user profiles and data
- **Web App Redirects**: Bot can redirect users to web app with authentication
- **Command Recognition**: Bot responds to various commands (管理, dashboard, etc.)

### 4. Component Updates
- **DashboardOverview**: Shows real user statistics and data
- **ProductManagement**: Displays and manages real user products
- **StoreManagement**: Shows real user stores and relationships
- **MarketingTools**: Uses real user marketing materials
- **UserProfile**: Complete user profile display and management

## Technical Implementation

### Authentication Flow

1. **LINE App Access**:
   ```typescript
   // Check if in LINE app
   const isInLine = userAgent.includes('line');
   
   // Initialize LIFF
   await liff.init({ liffId: LIFF_ID });
   
   // Get user profile and authenticate
   const profile = await liff.getProfile();
   await authenticateWithFirebase(idToken, profile);
   ```

2. **Bot Redirect Access**:
   ```typescript
   // Check URL parameters
   const urlParams = new URLSearchParams(window.location.search);
   const lineUserId = urlParams.get('userId');
   const lineDisplayName = urlParams.get('displayName');
   
   // Authenticate with provided data
   await authenticateWithFirebase('', profile);
   ```

### Data Management

1. **User Data Structure**:
   ```typescript
   interface LineUser {
     id: string;
     lineUserId: string;
     displayName: string;
     pictureUrl?: string;
     subscriptionTier: 'free' | 'premium' | 'pro';
     preferences: {
       language: string;
       notifications: boolean;
       marketingOptIn: boolean;
     };
     metadata: {
       totalMessages: number;
       lastInteraction: Timestamp;
       favoriteFeatures: string[];
     };
   }
   ```

2. **Real-time Data Loading**:
   ```typescript
   const loadUserData = async (userId: string) => {
     const [stats, products, stores, marketingMaterials] = await Promise.all([
       UserDataService.getUserStats(userId),
       UserDataService.getUserProducts(userId, 10),
       UserDataService.getUserStores(userId, 10),
       UserDataService.getMarketingMaterials(userId, 10)
     ]);
     
     setUserStats(stats);
     setUserProducts(products);
     setUserStores(stores);
     setUserMarketingMaterials(marketingMaterials);
   };
   ```

### LINE Bot Integration

1. **Webhook Handler**:
   ```typescript
   // Handle web app access request
   private async handleWebAppAccess(event: WebhookEvent) {
     const userProfile = await this.lineBot.getUserProfile(event.source.userId);
     const webAppUrl = `${LIFF_URL}?userId=${userProfile.userId}&displayName=${encodeURIComponent(userProfile.displayName)}`;
     
     // Send redirect message to user
     await this.lineBot.replyMessage(event.replyToken, messages);
   }
   ```

2. **Command Recognition**:
   ```typescript
   // Recognize management commands
   if (lowerText.includes('管理') || lowerText.includes('dashboard')) {
     await this.handleWebAppAccess(event);
   }
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# LINE Configuration
VITE_LIFF_ID=your_liff_id
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
LIFF_URL=https://your-app-url.com

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## Setup Instructions

### 1. LINE Developer Setup
1. Create a LINE Channel in LINE Developers Console
2. Set up LIFF app with your domain
3. Configure webhook URL for your bot
4. Get Channel Access Token and Channel Secret

### 2. Firebase Setup
1. Create Firebase project
2. Enable Firestore Database
3. Set up authentication (optional, using custom tokens)
4. Get Firebase configuration

### 3. Application Setup
1. Install dependencies: `npm install`
2. Configure environment variables
3. Deploy Firebase Functions: `cd functions && npm run deploy`
4. Start development server: `npm run dev`

## Testing

### Integration Test Page
Access the "整合測試" (Integration Test) page to verify:
- User authentication status
- Data loading functionality
- Sample data creation
- Real-time data updates

### Test Commands
1. **Create Test Data**: Click "創建測試數據" to create sample data
2. **Run Tests**: Click "執行測試" to verify all functionality
3. **Refresh Data**: Click "重新載入數據" to update from database

## Usage Flow

### For Users
1. **From LINE App**: Open link in LINE app → Automatic login → Access dashboard
2. **From LINE Bot**: Send "管理" message → Get redirect link → Automatic login
3. **Direct Access**: Open website → Show login instructions for LINE app

### For Developers
1. **Authentication**: Users are automatically authenticated via LINE
2. **Data Management**: All data is stored in Firestore with user-specific collections
3. **Real-time Updates**: Components automatically update when data changes
4. **Bot Integration**: Bot can redirect users and access their data

## File Structure

```
src/
├── contexts/
│   └── AuthContext.tsx          # Main authentication context
├── components/
│   ├── DashboardOverview.tsx    # Real user data dashboard
│   ├── ProductManagement.tsx    # Real product management
│   ├── StoreManagement.tsx      # Real store management
│   ├── MarketingTools.tsx       # Real marketing materials
│   ├── UserProfile.tsx          # User profile display
│   └── LoginButton.tsx          # LINE login interface
├── services/
│   └── userDataService.ts       # User data service layer
├── utils/
│   └── sampleData.ts            # Sample data creation
├── api/
│   ├── lineBot.ts               # LINE Bot API
│   └── webhookHandler.ts        # Webhook event handling
└── pages/
    ├── Index.tsx                # Main application page
    └── TestIntegration.tsx      # Integration testing page
```

## Troubleshooting

### Common Issues

1. **LIFF Not Loading**:
   - Check LIFF ID configuration
   - Verify domain is registered in LINE Developers Console
   - Ensure HTTPS is used in production

2. **Authentication Fails**:
   - Verify Firebase configuration
   - Check LINE Channel credentials
   - Ensure webhook URL is accessible

3. **Data Not Loading**:
   - Check Firestore security rules
   - Verify Firebase project configuration
   - Check network connectivity

4. **Bot Not Responding**:
   - Verify webhook URL is set correctly
   - Check Channel Access Token
   - Ensure webhook handler is deployed

### Debug Steps

1. Check browser console for errors
2. Verify environment variables are set
3. Test Firebase connection
4. Check LINE Bot webhook logs
5. Use integration test page to verify functionality

## Security Considerations

1. **Environment Variables**: Never commit sensitive keys to version control
2. **Firestore Rules**: Implement proper security rules for user data
3. **Webhook Verification**: Always verify LINE webhook signatures
4. **HTTPS Only**: Use HTTPS in production for LIFF and webhooks
5. **User Data**: Respect user privacy and data protection regulations

## Future Enhancements

1. **Real-time Notifications**: Push notifications for important events
2. **Advanced Analytics**: More detailed user behavior analytics
3. **Multi-language Support**: Support for multiple languages
4. **Offline Support**: PWA features for offline functionality
5. **Advanced Bot Features**: More sophisticated bot interactions

## Support

For technical support or questions about the integration:
1. Check the integration test page for diagnostics
2. Review browser console for error messages
3. Verify all environment variables are correctly set
4. Test with sample data creation functionality

This integration provides a complete LINE-based authentication and data management system for the Farm2Market AI application.
