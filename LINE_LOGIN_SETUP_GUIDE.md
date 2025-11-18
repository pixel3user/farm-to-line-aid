# 🔧 LINE Login Setup Guide

## 🚨 **Current Issues Identified:**

### **1. Missing LIFF Configuration**
- `VITE_LIFF_ID` is not configured (shows as `'your-liff-id'`)
- No LIFF app created in LINE Developer Console
- LIFF URL not properly set up

### **2. Incorrect Redirect URLs**
- Bot is using placeholder URLs instead of actual website URL
- Need to update all redirect URLs to `https://farm2market-99.web.app`

### **3. Missing Environment Variables**
- No `.env` file with proper configuration
- LINE credentials not configured

## 🛠️ **Step-by-Step Fix:**

### **Step 1: Create LIFF App in LINE Developer Console**

1. **Go to LINE Developer Console**: https://developers.line.biz/console/
2. **Select your LINE Bot channel**
3. **Go to LIFF tab**
4. **Click "Add" to create new LIFF app**
5. **Configure LIFF app**:
   - **LIFF app name**: `Farm2Market AI Web App`
   - **Size**: Full
   - **Endpoint URL**: `https://farm2market-99.web.app`
   - **Scope**: Profile, OpenID
   - **Bot link feature**: On
6. **Copy the LIFF ID** (starts with `liff.`)

### **Step 2: Update Environment Variables**

Create a `.env` file in the project root:

```env
# LINE Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_actual_channel_access_token
LINE_CHANNEL_SECRET=your_actual_channel_secret
LIFF_URL=https://farm2market-99.web.app
VITE_LIFF_ID=your_actual_liff_id_from_step_1

# Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key

# Firebase Configuration (already configured)
VITE_FIREBASE_API_KEY=AIzaSyD2dpOd5vI7BYIAl1sBuumeKJ7wB2Ep06w
VITE_FIREBASE_AUTH_DOMAIN=farm2market-99.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=farm2market-99
VITE_FIREBASE_STORAGE_BUCKET=farm2market-99.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=766264273875
VITE_FIREBASE_APP_ID=1:766264273875:web:4d16eb47367395315edd26
```

### **Step 3: Update LINE Bot Webhook**

1. **Go to LINE Developer Console**
2. **Select your Bot channel**
3. **Go to Messaging API tab**
4. **Set Webhook URL**: `https://us-central1-farm2market-99.cloudfunctions.net/webhook`
5. **Enable webhook**
6. **Set Allow bot to join group chats**: On

### **Step 4: Test the Configuration**

1. **Build and deploy the updated code**:
   ```bash
   npm run build
   firebase deploy --only hosting
   firebase deploy --only functions:webhook
   ```

2. **Test LINE Bot redirect**:
   - Send "管理" to your LINE bot
   - Click the website access button
   - Should redirect to: `https://farm2market-99.web.app?userId=...&displayName=...&pictureUrl=...`

3. **Test website authentication**:
   - Open the redirected URL
   - Should automatically log in with LINE user data
   - Check console for authentication logs

## 🔍 **Current Status:**

### **✅ Fixed:**
- Updated redirect URLs to use correct website URL
- Fixed authentication flow to handle LINE redirects
- Added fallback mechanisms for demo mode

### **❌ Still Need to Fix:**
- Create LIFF app in LINE Developer Console
- Get actual LIFF ID and update environment variables
- Configure LINE Bot webhook URL
- Test end-to-end LINE login flow

## 🎯 **Expected Behavior After Fix:**

1. **LINE Bot**: User sends "管理" → Bot responds with website access button
2. **Website Redirect**: User clicks button → Redirects to website with user parameters
3. **Auto Login**: Website detects LINE parameters → Automatically logs in user
4. **Dashboard Access**: User sees personalized dashboard with their data

## 🚀 **Quick Test Commands:**

```bash
# Check current environment
echo $VITE_LIFF_ID

# Build and deploy
npm run build
firebase deploy --only hosting

# Test website
open https://farm2market-99.web.app/test-line-redirect
```

## 📞 **Next Steps:**

1. **Create LIFF app** in LINE Developer Console
2. **Update environment variables** with actual LIFF ID
3. **Deploy updated code**
4. **Test LINE Bot → Website redirect flow**
5. **Verify automatic login works**

---

**The main issue is that the LIFF app needs to be created in LINE Developer Console and the LIFF ID needs to be configured in the environment variables.**
















