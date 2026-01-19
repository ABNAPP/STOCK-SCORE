@echo off
title Stock Score - Development Server

echo.
echo ========================================
echo   Stock Score - Development Server
echo ========================================
echo.

REM Check for package.json
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo Please run this script from the project root directory.
    echo.
    pause
    exit /b 1
)

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH!
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js and npm found
echo.

REM Install dependencies if needed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed
    echo.
)

REM Warn about .env.local
if not exist ".env.local" (
    echo [WARNING] .env.local file not found!
    echo See env.template for configuration details.
    echo.
)

REM Start server in background
echo [INFO] Starting development server...
echo.

REM Change to script directory and start server
cd /d "%~dp0"

REM Set environment variable to prevent Vite from auto-opening browser
REM We'll open it manually instead
set BROWSER=none
start "Stock Score Dev Server" cmd /k "set BROWSER=none && npm run dev"

echo [SUCCESS] Server window opened!
echo.
echo [INFO] Waiting 10 seconds for server to start...
timeout /t 10 /nobreak >nul

echo.
echo [INFO] Opening browser...

REM Open browser - use only one method
rundll32 url.dll,FileProtocolHandler http://localhost:5173

echo [SUCCESS] Done!
echo.
echo Server is running in a separate window.
echo If browser didn't open, go to: http://localhost:5173
echo.
echo Press any key to close this window...
pause >nul
