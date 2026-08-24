@echo off
title Neo Bus - Starting...
color 0A

echo.
echo  ███╗   ██╗███████╗ ██████╗     ██████╗ ██╗   ██╗███████╗
echo  ████╗  ██║██╔════╝██╔═══██╗    ██╔══██╗██║   ██║██╔════╝
echo  ██╔██╗ ██║█████╗  ██║   ██║    ██████╔╝██║   ██║███████╗
echo  ██║╚██╗██║██╔══╝  ██║   ██║    ██╔══██╗██║   ██║╚════██║
echo  ██║ ╚████║███████╗╚██████╔╝    ██████╔╝╚██████╔╝███████║
echo  ╚═╝  ╚═══╝╚══════╝ ╚═════╝     ╚═════╝  ╚═════╝ ╚══════╝
echo.
echo  ============================================================
echo   Starting Neo Bus Application...
echo  ============================================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker Desktop is not running!
    echo  Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

:: docker-compose requires both JWT secrets. On a fresh clone there is no .env yet,
:: so generate one with real random values rather than shipping fixed secrets.
if not exist ".env" (
    echo  [setup] No .env found - generating JWT secrets...
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\new-env.ps1"
    if errorlevel 1 (
        echo  [ERROR] Could not create .env
        pause
        exit /b 1
    )
    echo.
)

echo  [1/3] Building the app image from source...
echo  (first run takes a few minutes; later runs are cached)
docker compose build
if errorlevel 1 (
    echo.
    echo  [ERROR] Build failed. Scroll up for the cause.
    pause
    exit /b 1
)
echo.

echo  [2/3] Starting all services (Database + Backend + Frontend)...
docker compose up -d
echo.

echo  [3/3] Waiting for services to be ready...
timeout /t 5 /nobreak >nul

echo.
echo  ============================================================
echo   Neo Bus is LIVE!
echo  ============================================================
echo.
echo   App       ->  http://localhost:3000
echo   API Docs  ->  http://localhost:3000/docs
echo   Database  ->  localhost:5433  (neobus/neobus)
echo.
echo   Log in as admin@newbus.com / password123, then click
echo   "Seed Master Data" to populate cities, routes and trips.
echo.
echo  ============================================================
echo.

:: Open the app in the default browser
start http://localhost:3000

echo  Press any key to view logs, or close this window to keep running in background...
pause >nul

docker compose logs -f
