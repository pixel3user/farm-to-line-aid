@echo off
REM Farm2Market AI - Windows Quick Setup Batch File
REM This is a simple wrapper for the PowerShell script

echo ========================================
echo Farm2Market AI - Windows Setup
echo ========================================
echo.

REM Check if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PowerShell is not available!
    echo Please run this script on a system with PowerShell installed.
    pause
    exit /b 1
)

REM Run the PowerShell setup script
powershell -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Setup failed! Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo Setup completed! Press any key to exit...
pause >nul

