# Farm2Market - Smart Agricultural Sales Platform

A professional web application connecting Taiwan's farms with markets through LINE integration, featuring AI-powered tools for demand prediction, marketing asset generation, and store discovery.

## Features

### For Farmers (Sellers)
- **Dashboard**: KPI tracking, quick actions, and activity feed
- **Product Management**: CRUD operations, inventory tracking, and bulk actions
- **Store Locator**: Find nearby markets with lead scoring and status tracking
- **Marketing Tools**: AI-powered flyer generation and message templates
- **Analytics**: Performance metrics and tiny-data forecasting
- **References**: Guidelines for respectful communication and LINE bot setup

### For Markets (Buyers)
- **Farm Discovery**: Search and filter local farms by location, category, and rating
- **Product Catalog**: Compare products across farms with pricing and availability
- **Delivery Schedule**: View and book delivery windows from multiple farms
- **Ratings & Reviews**: Read and submit reviews for farm experiences

### LINE Integration
- **Rich Menu Navigation**: Intuitive bot interface for farmers
- **LIFF Mini-Forms**: Quick data entry through LINE-integrated forms
- **Smart Notifications**: AI-powered reminders and insights
- **Safety Features**: Consent-based communication with quiet hours and frequency limits

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: React Query, Zustand
- **Routing**: React Router v6
- **Authentication**: Firebase Auth with LINE LIFF integration
- **Database**: Firebase Firestore
- **Maps**: Mapbox integration (optional)
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/
│   ├── layouts/          # App, Farmer, and Market layouts
│   └── ui/              # shadcn/ui components
├── pages/
│   ├── auth/            # Sign in/up pages
│   ├── farmer/          # Farmer dashboard and tools
│   ├── market/          # Market discovery and management
│   └── demo/            # LINE bot demo
├── types/               # TypeScript interfaces
├── lib/                 # Utilities and mock APIs
└── contexts/            # React contexts (Auth, etc.)
```

## 🎯 Getting Started - Windows Setup Guide

### 👶 Super Simple Setup

Don't worry if you're new to coding! This guide will walk you through everything step by step, just like learning to ride a bike. 🚲

---

## 📦 Step 1: Get the Code

**What you're doing:** Getting the project files on your computer.

### Option A: Using GitHub Desktop (Easiest Way)

1. **Download GitHub Desktop** (if you don't have it):
   - Go to: https://desktop.github.com/
   - Click the big green "Download" button
   - Install it like any other program (just click "Next" a bunch of times)

2. **Get the project:**
   - Open GitHub Desktop
   - Click "File" → "Clone Repository"
   - Paste this repository's URL `https://github.com/pixel3user/farm-to-line-aid`
   - Choose where to save it (like `C:\Users\YourName\Documents\farm-to-line-aid`)
   - Click "Clone"

**Done!** ✅ The files are now on your computer.

---

## 🛠️ Step 2: Install Node.js

**What you're doing:** Installing Node.js, which is like a toolbox that lets your computer understand and run the code.

1. **Go to the Node.js website:**
   - Open your web browser
   - Go to: https://nodejs.org/
   - You'll see two big green buttons

2. **Download Node.js:**
   - Click the button that says "LTS" (it's the recommended version)
   - This downloads a file called something like `node-v20.x.x-x64.msi`

3. **Install Node.js:**
   - Find the downloaded file (usually in your Downloads folder)
   - Double-click it
   - Click "Next" → "Next" → "Next" → "Install"
   - Wait for it to finish (this might take a few minutes)
   - Click "Finish"

4. **Check if it worked:**
   - Open Command Prompt again (Windows Key + R, type `cmd`, press Enter)
   - Type this and press Enter:
     ```bash
     node --version
     ```
   - You should see something like `v20.x.x` (the numbers might be different, that's okay!)
   - Type this too:
     ```bash
     npm --version
     ```
   - You should see something like `10.x.x`

**If you see numbers, you're good!** ✅ If you see an error, try closing and reopening Command Prompt.

---

## 🚀 Step 3: Run the Magic Setup Script (The Easy Button!)

**What you're doing:** Running a special script that does all the hard work for you automatically, like a robot helper.

### The Super Easy Way (Just Double-Click!)

1. **Open the project folder:**
   - Go to where you saved the project (like `C:\Users\YourName\Documents\farm-to-line-aid`)
   - You can use File Explorer (the folder icon on your taskbar)

2. **Find the setup file:**
   - Look for a file called `setup-windows.bat`
   - It might look like a little gear or just a file icon

3. **Run it:**
   - **Right-click** on `setup-windows.bat`
   - Click "Run as administrator" (this gives it permission to install things)
   - If Windows asks "Do you want to allow this app to make changes?", click "Yes"
   - A black window will appear with lots of text scrolling by - **this is normal!** It's the script working
   - Wait for it to finish (this might take 5-10 minutes, like waiting for a game to download)
   - When you see "Setup completed successfully!" you're done!

**What the script does for you:**
- ✅ Checks if Node.js is installed (like checking if you have batteries)
- ✅ Installs Firebase tools (like getting a special tool from the toolbox)
- ✅ Creates a special file called `.env` with all the settings (like writing down your game settings)
- ✅ Downloads all the code libraries needed (like downloading game assets)
- ✅ Builds the project (like assembling a toy)

**If something goes wrong:**
- Don't panic! 😊
- Read the error message (it's usually in red text)
- Try closing everything and running the script again
- Make sure you're connected to the internet

### The PowerShell Way (If Double-Click Doesn't Work)

1. **Open PowerShell:**
   - Press `Windows Key + X`
   - Click "Windows PowerShell (Admin)" or "Terminal (Admin)"
   - If it asks for permission, click "Yes"

2. **Go to your project folder:**
   ```powershell
   cd C:\Users\YourName\Documents\farm-to-line-aid
   ```
   (Replace the path with where you actually saved the project)

3. **Allow scripts to run:**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
   - Type `Y` and press Enter if it asks

4. **Run the setup:**
   ```powershell
   .\setup-windows.ps1
   ```
   - Wait for it to finish (watch the messages - they'll tell you what's happening)

**Done!** ✅ Everything is set up!

---

## 🎮 Step 4: Start the App

**What you're doing:** Starting the development server.

1. **Open Command Prompt or PowerShell:**
   - Press `Windows Key + R`
   - Type `cmd` and press Enter
   - Or use PowerShell (Windows Key + X → PowerShell)

2. **Go to your project folder:**
   ```bash
   cd C:\Users\YourName\Documents\farm-to-line-aid
   ```
   (Use your actual folder path)

3. **Start the app:**
   ```bash
   npm run dev
   ```
   - Press Enter
   - You'll see lots of text scrolling by - **this is normal!**
   - Look for a message that says something like:
     ```
     Local:   http://localhost:8080/
     ```
   - **Don't close this window!** It needs to stay open (like keeping a game running)

4. **Open the app in your browser:**
   - Open your web browser (Chrome, Edge, Firefox, etc.)
   - Type this in the address bar: `http://localhost:8080`
   - Press Enter
   - **Ta-da!** 🎉 The app should appear!

**What you should see:**
- A website with the Farm2Market app
- You can click around and explore
- The black window is still running (that's the server - keep it open!)

**To stop the app:**
- Go back to the black window
- Press `Ctrl + C` (hold Ctrl, press C)
- It will ask "Terminate batch job? (Y/N)" - type `Y` and press Enter

---

## 🎨 Step 5: What You Can Do Now!

**Congratulations!** 🎊 You've set up the app! Here's what you can do:

### Daily Commands (Like Game Controls)

**Start the app:**
```bash
npm run dev
```
- Opens the app at http://localhost:8080
- Starts both the website and the database

**Start just the website:**
```bash
npm run dev:client
```
- Only starts the website part

**Start just the database:**
```bash
npm run dev:emulators
```
- Only starts the database part

**Build for production (like packaging a game):**
```bash
npm run build
```
- Creates a folder called `dist` with the finished app

### Where Things Are

- **Website:** http://localhost:8080 (the main app)
- **Database Dashboard:** http://localhost:4000 (see your data)
- **Project Files:** In the folder where you saved it

---

## 🐛 Troubleshooting (When Things Go Wrong)

### Problem: "Node.js is not recognized"

**What it means:** Your computer can't find Node.js

**How to fix:**
1. Make sure you installed Node.js (go back to Step 2)
2. Close ALL Command Prompt/PowerShell windows
3. Open a NEW Command Prompt window
4. Try again

### Problem: "Port 8080 is already in use"

**What it means:** Something else is using that port (like another app)

**How to fix:**
1. Close any other apps that might be using the internet
2. Or change the port in `vite.config.ts` (ask for help if needed)

### Problem: "npm is not recognized"

**What it means:** npm didn't install with Node.js

**How to fix:**
1. Reinstall Node.js (go back to Step 2)
2. Make sure to check all the boxes during installation
3. Restart your computer
4. Try again

### Problem: "Permission denied" or "Access denied"

**What it means:** Windows is being protective (like a parent saying "are you sure?")

**How to fix:**
1. Right-click on Command Prompt or PowerShell
2. Click "Run as administrator"
3. Try again

### Problem: The website won't load (localhost:8080 shows error)

**What it means:** The server isn't running

**How to fix:**
1. Make sure you ran `npm run dev` in Command Prompt
2. Make sure the black window is still open
3. Check if you see any error messages in red
4. Try stopping it (Ctrl+C) and starting again

### Problem: Setup script won't run

**What it means:** Windows is blocking the script

**How to fix:**
1. Right-click `setup-windows.bat`
2. Click "Properties"
3. If you see "Unblock" button, click it
4. Click "OK"
5. Try running it again

---

## 📚 Need More Help?

- **Still confused?** Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for more details
- **Want quick commands?** Check [QUICK_START.md](QUICK_START.md)
- **Having problems?** Look at the error message - it usually tells you what's wrong!

---

## 🎓 What You Learned (Like a Report Card!)

After following this guide, you now know how to:
- ✅ Download code from GitHub (like downloading an app)
- ✅ Install Node.js (like installing a program)
- ✅ Run setup scripts (like using an installer)
- ✅ Start a development server (like starting a game)
- ✅ Open a local website (like opening a file)

**You're a developer now!** 🎉

---

## 🔧 Advanced Setup (For When You're Ready)

### Prerequisites (Things You Need)

- **Node.js 18+** - The toolbox (you installed this in Step 2!)
- **Firebase project** - The database (already configured in `setup.env`)
- **LINE Developer account** - For LINE bot features (optional, add your keys to `.env`)
- **Mapbox account** - For maps (optional, add your token to `.env`)

### Manual Installation (If You Want to Do It Step by Step)

1. **Get the code** (you did this in Step 1!)

2. **Install main dependencies:**
   ```bash
   npm install
   ```
   - This downloads all the code libraries (like downloading game assets)
   - Wait for it to finish (might take a few minutes)

3. **Install function dependencies:**
   ```bash
   cd functions
   npm install
   cd ..
   ```
   - This downloads libraries for the backend (like downloading server files)

4. **Create environment file:**
   ```bash
   copy setup.env .env
   ```
   - This copies the settings file (like copying a game save file)
   - The `.env` file has all your API keys and settings

5. **Build functions:**
   ```bash
   cd functions
   npm run build
   cd ..
   ```
   - This compiles the TypeScript code (like compiling a program)

6. **Start the app:**
   ```bash
   npm run dev
   ```
   - Opens everything at http://localhost:8080

### Environment Variables (Settings for Your App)

The `setup.env` file contains pre-configured values including Firebase credentials. You only need to add your LINE and Gemini API keys if you want to use those features.

**Key settings you might want to change:**
- `LINE_CHANNEL_ACCESS_TOKEN` - Your LINE bot token
- `VITE_GEMINI_API_KEY` - Your Google Gemini API key
- `VITE_MAPBOX_TOKEN` - Your Mapbox token (optional)

### Environment Variables

Key environment variables needed:

- `VITE_FIREBASE_*`: Firebase configuration
- `VITE_LIFF_ID`: LINE LIFF application ID
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE bot channel access token
- `LINE_CHANNEL_SECRET`: LINE bot channel secret
- `VITE_MAPBOX_TOKEN`: Mapbox token (optional)

### Granting Admin Access

To let a specific account manage every product (e.g., for merchandising or support staff):

1. Open the Firebase console for your project and go to **Firestore Database → line_users**.
2. Find the document whose `lineUserId` matches the account you want to promote.
3. Add or update a boolean field named `isAdmin` and set it to `true`, then save.
4. Ask the user to sign out/in (or refresh) so the new flag is picked up by the web app.

Admins can now modify any product from `/market/products`, while regular users remain limited to their own items.

## Routes

### Public Routes
- `/` - Home page with role selection
- `/auth/signin` - Sign in page
- `/auth/signup` - Sign up page
- `/demo/line` - LINE bot demo

### Farmer Routes
- `/farmer` - Farmer dashboard
- `/farmer/products` - Product management
- `/farmer/stores` - Store locator
- `/farmer/marketing` - Marketing tools
- `/farmer/analytics` - Analytics and forecasting
- `/farmer/references` - Help and guidelines

### Market Routes
- `/market` - Market dashboard
- `/market/farms` - Farm discovery
- `/market/products` - Product catalog
- `/market/schedule` - Delivery schedule
- `/market/ratings` - Ratings and reviews

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/eab91867-619b-4d6e-8e8e-7848944d8ab1) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
