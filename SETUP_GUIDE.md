# Farm2Market AI - Windows Setup Guide

This guide will help you set up the Farm2Market AI project on a Windows machine for local development.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download from git-scm.com](https://git-scm.com/download/win)
- **Firebase CLI** (will be installed automatically by setup script)

## 🚀 Quick Setup (Automated)

### Option 1: Using PowerShell Script (Recommended)

1. **Open PowerShell** as Administrator (Right-click → Run as Administrator)

2. **Navigate to the project directory:**
   ```powershell
   cd C:\path\to\farm-to-line-aid
   ```

3. **Run the setup script:**
   ```powershell
   .\setup-windows.ps1
   ```

   If you get an execution policy error, run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   .\setup-windows.ps1
   ```

### Option 2: Using Batch File (Easier)

1. **Double-click** `setup-windows.bat` in Windows Explorer
   - Or right-click and select "Run as Administrator"

2. The script will automatically:
   - Check prerequisites
   - Install Firebase CLI if needed
   - Create `.env` file from `setup.env`
   - Install all dependencies
   - Build the functions

## 🔧 Manual Setup

If you prefer to set up manually or the automated script fails:

### Step 1: Install Dependencies

```powershell
# Install root dependencies
npm install

# Install functions dependencies
cd functions
npm install
cd ..
```

### Step 2: Set Up Environment Variables

1. **Copy the environment template:**
   ```powershell
   copy setup.env .env
   ```
   
   Or if `setup.env` doesn't exist:
   ```powershell
   copy env.example .env
   ```

2. **Edit `.env` file** with your actual API keys:
   - Open `.env` in a text editor (Notepad, VS Code, etc.)
   - Replace placeholder values with your actual API keys
   - See [Environment Variables](#environment-variables) section below

### Step 3: Build Functions

```powershell
cd functions
npm run build
cd ..
```

## 🔑 Environment Variables

The project uses environment variables stored in `.env` file. The `setup.env` file contains pre-configured values that you can use directly.

### Required Variables

#### LINE Configuration
- `LINE_CHANNEL_ACCESS_TOKEN` - Your LINE bot channel access token
- `LINE_CHANNEL_SECRET` - Your LINE bot channel secret
- `LINE_LOGIN_CHANNEL_SECRET` - LINE Login channel secret
- `VITE_LIFF_ID` - LINE LIFF application ID
- `VITE_LINE_CHANNEL_ID` - LINE channel ID for web authentication

#### Firebase Configuration
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain (e.g., `your-project.firebaseapp.com`)
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase service account JSON (base64 encoded or JSON string)

#### Gemini API
- `VITE_GEMINI_API_KEY` - Google Gemini API key

### Optional Variables

- `VITE_MAPBOX_TOKEN` - Mapbox token for map features
- `GEOCODING_API_KEY` - Google Geocoding API key
- `YAMATO_*` - Yamato (Black Cat) logistics configuration

**Note:** The `setup.env` file includes actual API keys that are safe to use for local development. These keys are not exposed on the internet and are only used for local testing.

## 🏃 Running the Application

### Development Mode (Recommended)

Start both frontend and Firebase emulators:

```powershell
npm run dev
```

This will:
- Start Firebase emulators (Functions on port 5001, Firestore on port 8081)
- Start the frontend development server on port 8080
- Open http://localhost:8080 in your browser

### Frontend Only

If you only want to run the frontend:

```powershell
npm run dev:client
```

### Firebase Emulators Only

If you only want to run the emulators:

```powershell
npm run dev:emulators
```

### Access Points

- **Frontend:** http://localhost:8080
- **Firebase Emulator UI:** http://localhost:4000
- **Firestore Emulator:** localhost:8081
- **Functions Emulator:** localhost:5001

## 🛠️ Troubleshooting

### PowerShell Execution Policy Error

If you see: `cannot be loaded because running scripts is disabled on this system`

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port Already in Use

If ports 8080, 3000, 4000, 5001, or 8081 are already in use:

1. **Find the process using the port:**
   ```powershell
   netstat -ano | findstr :8080
   ```

2. **Kill the process:**
   ```powershell
   taskkill /PID <PID> /F
   ```

   Or change the ports in:
   - `vite.config.ts` (frontend port)
   - `firebase.json` (emulator ports)

### Firebase CLI Not Found

If Firebase CLI installation fails:

```powershell
npm install -g firebase-tools
```

### Dependencies Installation Fails

1. **Clear npm cache:**
   ```powershell
   npm cache clean --force
   ```

2. **Delete node_modules and reinstall:**
   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item -Recurse -Force functions\node_modules
   npm install
   cd functions
   npm install
   cd ..
   ```

### Environment Variables Not Loading

1. **Verify `.env` file exists** in the root directory
2. **Check file encoding** - should be UTF-8 without BOM
3. **Restart the development server** after changing `.env`

### Functions Build Errors

If TypeScript compilation fails:

```powershell
cd functions
npm run build
```

Check for TypeScript errors in the output.

## 📦 Project Structure

```
farm-to-line-aid/
├── src/                    # Frontend React application
├── functions/              # Firebase Cloud Functions (backend)
├── public/                 # Static assets
├── .env                    # Environment variables (created by setup)
├── setup.env               # Pre-configured environment template
├── env.example             # Environment variable template
├── package.json            # Root dependencies
├── vite.config.ts          # Vite configuration
├── firebase.json           # Firebase configuration
└── setup-windows.ps1       # Windows setup script
```

## 🔐 Security Notes

- The `.env` file is in `.gitignore` and will NOT be committed to Git
- API keys in `setup.env` are for local development only
- Never commit actual production API keys to the repository
- For production deployment, use secure environment variable management

## 📚 Additional Resources

- [Firebase Emulator Suite Documentation](https://firebase.google.com/docs/emulator-suite)
- [Vite Documentation](https://vitejs.dev/)
- [LINE Developers Documentation](https://developers.line.biz/en/docs/)
- [Google Gemini API Documentation](https://ai.google.dev/docs)

## 🆘 Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section above
2. Review error messages in the console
3. Check Firebase Emulator UI at http://localhost:4000 for backend issues
4. Verify all environment variables are set correctly

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Node.js and npm are installed
- [ ] Firebase CLI is installed
- [ ] `.env` file exists with API keys
- [ ] All dependencies are installed (root and functions)
- [ ] Functions build successfully
- [ ] `npm run dev` starts without errors
- [ ] Frontend loads at http://localhost:8080
- [ ] Firebase Emulator UI loads at http://localhost:4000

---

**Happy Coding! 🚀**

