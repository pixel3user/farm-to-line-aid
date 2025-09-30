# Farm2Market AI - LINE Bot Deployment Guide

This comprehensive LINE bot integrates Google Gemini AI with Firebase backend for farm product sales assistance.

## 🌟 Features

- **LINE Bot Integration**: Complete webhook handler with user authentication
- **Gemini AI Processing**: Text generation, image analysis, and marketing material creation
- **Firebase Backend**: User management, product/store tracking, conversation logging
- **Real-time Dashboard**: Monitor bot performance and user interactions
- **AI Marketing Tools**: Generate flyers, shelf cards, recipe cards automatically

## 📋 Prerequisites

### 1. LINE Developers Console
1. Create a LINE Developers account
2. Create a new provider and Messaging API channel
3. Get Channel Access Token and Channel Secret
4. Enable webhook URL

### 2. Google Gemini API
1. Go to [Google AI Studio](https://ai.google.dev/)
2. Create API key
3. Enable Gemini API access

### 3. Firebase Project
1. Create a new Firebase project
2. Enable Firestore Database
3. Enable Authentication
4. Get configuration values

## 🚀 Quick Deployment

### 1. Clone and Install
```bash
git clone <repository-url>
cd farm-to-line-aid-1
npm install
```

### 2. Environment Configuration
Create `.env` file:
```env
# LINE Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
LIFF_URL=https://your-app-url.com

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Server Configuration
PORT=3000
NODE_ENV=production
```

### 3. Development Mode
```bash
# Start both frontend and webhook server
npm run dev

# Frontend only
npm run dev:client

# Server only (for webhook testing)
npm run dev:server
```

### 4. Production Build
```

# Build for production
npm run build
npm start

# Or deploy to hosting platform
npm run build
```

## 🎯 Deployment Platforms

### Option 1: Vercel (Recommended)
1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Option 2: Firebase Hosting + Functions
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Build project: `npm run build`
3. Deploy: `firebase deploy`

### Option 3: Railway/Render
1. Connect repository
2. Set environment variables
3. Deploy with auto-scalin g

### Option 4: Traditional VPS
```bash
# Build and transfer files
npm run build
scp -r dist/* user@server:/path/to/deployment

# Run with PM2
npm install -g pm2
pm2 start dist/server.js --name farm2market-ai
```

## 🔧 LINE Bot Configuration

### 1. Webhook URL Setup
After deployment, set your webhook URL in LINE Developers Console:
```
https://your-domain.com/api/webhook
```

### 2. Rich Menu Configuration
Upload rich menu image with six sections:
- Dashboard
- Products  
- Stores
- Marketing
- Analytics
- Help

### 3. Auto-reply Settings
Disable default auto-replies in LINE Official Account Manager to let the bot handle all responses.

## 🤖 Bot Commands

Users can interact with the bot using these commands:

- **"產品"** - Access product management
- **"店家"** - Store management and lead generation
- **"行銷"** - Marketing tool access
- **"報告"** - Analytics and reports
- **Upload images** - AI product analysis and marketing material generation

## 📊 Dashboard Access

Visit `/dashboard` for admin controls:
- User management
- Analytics overview
- Webhook configuration
- System health monitoring

## 🔐 Security Considerations

1. **Environment Variables**: Never commit .env files
2. **Webhook Verification**: Automatic signature verification
3. **Rate Limiting**: Built-in API rate limiting
4. **Firebase Rules**: Configure proper Firestore security rules
5. **CORS**: Configured for production domains

## 🐛 Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check LINE Developer Console webhook URL
   - Verify domain SSL certificate
   - Test webhook endpoint manually

2. **Gemini API errors**
   - Verify API key is correct
   - Check API quota and billing
   - Review request format

3. **Firebase connection issues**
   - Verify Firebase configuration
   - Check Firestore security rules
   - Review network connectivity

### Logs and Monitoring
```bash
# Server logs
npm run dev:server

# Health check
curl https://your-domain.com/health

# API endpoints
curl https://your-domain.com/api/user/{userId}/stats
```

## 📈 Performance Optimization

### Database Optimization
- Use Firestore indexes for queries
- Implement pagination for large datasets
- Cache frequently accessed data

### AI Response Optimization
- Implement response caching
- Use batch API calls when possible
- Monitor token usage

### Infrastructure Scaling
- Use CDN for static assets
- Implement serverless functions for heavy processing
- Set up monitoring and alerting

## 🔄 Updates and Maintenance

### Regular Tasks
- Monitor Gemini API usage and costs
- Review webhook delivery rates
- Update dependencies regularly
- Backup Firebase data
- Review user feedback and analytics

### Scaling Considerations
- Implement request queuing for high volume
- Use Redis for session management
- Consider containerization (Docker)
- Implement horizontal scaling

## 📞 Support

For technical issues:
1. Check logs and error messages
2. Review Firebase console for database issues
3. Test individual components
4. Contact LINE Support for bot-specific issues

## 🎉 Success Metrics

Track these KPIs for bot success:
- User engagement rate
- AI response accuracy
- Marketing material generation rate
- User retention
- Revenue attribution

---

Built with ❤️ using React, Firebase, Gemini AI, and LINE Messaging API.
