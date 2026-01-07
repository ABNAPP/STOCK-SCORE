@echo off
echo ========================================
echo   Stock Score - Development Server
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo node_modules not found. Installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies!
        echo Please check your internet connection and try again.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully!
    echo.
) else (
    echo Dependencies found. Skipping installation.
    echo.
)

echo Starting development server...
echo.

REM Start the dev server in a new window
start "Stock Score Dev Server" cmd /k "npm run dev"

REM Wait a few seconds for the server to start
echo Waiting for server to start...
timeout /t 4 /nobreak >nul

REM Open browser to localhost (Vite default port is 5173)
echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo   Server is running!
echo ========================================
echo.
echo Development server: http://localhost:5173
echo Server window is running in the background.
echo.
echo Press any key to close this window (server will continue running)...
pause >nul

