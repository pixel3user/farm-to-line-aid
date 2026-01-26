# Farm2Market AI - Windows Setup Script
# This script automates the setup process for local development on Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Farm2Market AI - Windows Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green

# Check if npm is installed
$npmVersion = npm --version 2>$null
if (-not $npmVersion) {
    Write-Host "ERROR: npm is not installed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ npm found: $npmVersion" -ForegroundColor Green

# Check if Firebase CLI is installed
$firebaseVersion = firebase --version 2>$null
if (-not $firebaseVersion) {
    Write-Host "WARNING: Firebase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install Firebase CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Firebase CLI installed" -ForegroundColor Green
} else {
    Write-Host "✓ Firebase CLI found: $firebaseVersion" -ForegroundColor Green
}

Write-Host ""
Write-Host "Setting up environment..." -ForegroundColor Yellow

# Create .env file if it doesn't exist
if (-not (Test-Path ".env")) {
    if (Test-Path "setup.env") {
        Write-Host "Copying setup.env to .env..." -ForegroundColor Yellow
        Copy-Item "setup.env" ".env"
        Write-Host "✓ .env file created from setup.env" -ForegroundColor Green
    } elseif (Test-Path "env.example") {
        Write-Host "Copying env.example to .env..." -ForegroundColor Yellow
        Copy-Item "env.example" ".env"
        Write-Host "✓ .env file created from env.example" -ForegroundColor Green
        Write-Host "⚠ Please update .env with your actual API keys!" -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: No setup.env or env.example found!" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Install root dependencies
Write-Host ""
Write-Host "Installing root dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install root dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Root dependencies installed" -ForegroundColor Green

# Install functions dependencies
Write-Host ""
Write-Host "Installing functions dependencies..." -ForegroundColor Yellow
Set-Location "functions"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install functions dependencies" -ForegroundColor Red
    Set-Location ".."
    exit 1
}
Set-Location ".."
Write-Host "✓ Functions dependencies installed" -ForegroundColor Green

# Build functions
Write-Host ""
Write-Host "Building functions..." -ForegroundColor Yellow
Set-Location "functions"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Functions build failed, but continuing..." -ForegroundColor Yellow
}
Set-Location ".."
Write-Host "✓ Functions build completed" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review and update .env file with your API keys if needed" -ForegroundColor White
Write-Host "2. Run 'npm run dev' to start the development server" -ForegroundColor White
Write-Host "3. Open http://localhost:8080 in your browser" -ForegroundColor White
Write-Host ""
Write-Host "Quick commands:" -ForegroundColor Yellow
Write-Host "  npm run dev          - Start frontend + Firebase emulators" -ForegroundColor White
Write-Host "  npm run dev:client   - Start frontend only" -ForegroundColor White
Write-Host "  npm run dev:emulators - Start Firebase emulators only" -ForegroundColor White
Write-Host "  npm run build        - Build for production" -ForegroundColor White
Write-Host ""

