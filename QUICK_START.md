# 🚀 Quick Start Guide - Farm2Market AI

Get up and running in 5 minutes!

## Windows Quick Setup

### Method 1: Double-Click Setup (Easiest)

1. **Double-click** `setup-windows.bat`
2. Wait for setup to complete
3. Run `npm run dev`
4. Open http://localhost:8080

### Method 2: PowerShell

1. **Right-click** on `setup-windows.ps1`
2. Select **"Run with PowerShell"**
3. If prompted, allow script execution
4. Run `npm run dev`
5. Open http://localhost:8080

## What Gets Set Up?

✅ Node.js version check  
✅ Firebase CLI installation  
✅ Environment variables (`.env` from `setup.env`)  
✅ All npm dependencies (root + functions)  
✅ Functions TypeScript build  

## After Setup

### Start Development Server

```powershell
npm run dev
```

This starts:
- Frontend at http://localhost:8080
- Firebase Emulators at http://localhost:4000

### Available Commands

```powershell
npm run dev              # Start everything (frontend + emulators)
npm run dev:client       # Frontend only
npm run dev:emulators    # Firebase emulators only
npm run build            # Build for production
```

## Troubleshooting

**PowerShell execution error?**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Port already in use?**
- Change ports in `vite.config.ts` (frontend) or `firebase.json` (emulators)

**Need help?**
- See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions

---

**That's it! Happy coding! 🎉**

