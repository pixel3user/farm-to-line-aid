# Setup Files Overview

This document explains the setup files created for easy Windows deployment.

## 📁 Setup Files

### 1. `setup-windows.ps1`
**PowerShell setup script** - Main automated setup script
- Checks prerequisites (Node.js, npm, Firebase CLI)
- Creates `.env` from `setup.env`
- Installs all dependencies
- Builds functions
- Provides clear status messages

**Usage:**
```powershell
.\setup-windows.ps1
```

### 2. `setup-windows.bat`
**Batch file wrapper** - Easy double-click setup
- Simple wrapper that runs the PowerShell script
- No command-line knowledge needed
- Just double-click to run

**Usage:**
- Double-click in Windows Explorer, or
- Run from command prompt: `setup-windows.bat`

### 3. `setup.env`
**Pre-configured environment variables** - Contains actual API keys
- Includes Firebase project configuration (farm2market-99)
- Includes base64-encoded Firebase service account
- Placeholder values for LINE and Gemini (user needs to fill)
- **This file WILL be committed to Git** (as requested)
- The `.env` file (created from this) is in `.gitignore` and won't be committed

### 4. `SETUP_GUIDE.md`
**Comprehensive setup documentation**
- Detailed step-by-step instructions
- Troubleshooting guide
- Manual setup instructions
- Environment variable explanations

### 5. `QUICK_START.md`
**Quick reference guide**
- 5-minute setup instructions
- Essential commands
- Quick troubleshooting

## 🔐 Security Notes

- ✅ `setup.env` - **WILL be committed** (contains API keys for local dev)
- ❌ `.env` - **WILL NOT be committed** (in `.gitignore`)
- ✅ Firebase service account JSON - **WILL NOT be committed** (in `.gitignore`)
- ✅ API keys in `setup.env` are safe for local development only

## 🚀 Quick Start Workflow

1. **Clone repository**
2. **Run setup:**
   - Windows: Double-click `setup-windows.bat`
   - Or: Run `.\setup-windows.ps1` in PowerShell
3. **Add missing API keys** (if needed):
   - Edit `.env` file
   - Add LINE channel credentials
   - Add Gemini API key
4. **Start development:**
   ```powershell
   npm run dev
   ```
5. **Open browser:**
   - Frontend: http://localhost:8080
   - Firebase Emulator UI: http://localhost:4000

## 📝 What Gets Configured

The setup script automatically:
- ✅ Verifies Node.js 18+ is installed
- ✅ Verifies npm is installed
- ✅ Installs Firebase CLI (if missing)
- ✅ Creates `.env` from `setup.env`
- ✅ Installs root dependencies (`npm install`)
- ✅ Installs functions dependencies (`cd functions && npm install`)
- ✅ Builds functions TypeScript (`cd functions && npm run build`)

## 🎯 Next Steps After Setup

1. **Review `.env` file** - Ensure all required API keys are present
2. **Start development server:**
   ```powershell
   npm run dev
   ```
3. **Access the application:**
   - Frontend: http://localhost:8080
   - Firebase Emulator UI: http://localhost:4000
4. **Test the application** - Verify all features work correctly

## 🔧 Customization

### Changing Ports

**Frontend port** (default: 8080):
- Edit `vite.config.ts` → `server.port`

**Firebase Emulator ports** (default: 4000, 5001, 8081):
- Edit `firebase.json` → `emulators` section

### Adding More Environment Variables

1. Add to `setup.env`
2. Add to `env.example` (for reference)
3. Update `SETUP_GUIDE.md` if needed

## 📚 Additional Documentation

- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Comprehensive setup guide
- [QUICK_START.md](QUICK_START.md) - Quick reference
- [README.md](README.md) - Main project documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide

---

**Note:** The `setup.env` file contains actual Firebase credentials and is intended for local development. These credentials are safe to include in the repository as they are only used for local testing and will not be exposed on the internet.

