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

echo  [1/3] Pulling latest images from Docker Hub...
docker compose pull
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
echo   Frontend  ->  http://localhost:3000
echo   Backend   ->  http://localhost:3000/api/docs
echo   API Docs  ->  http://localhost:3000/api/docs
echo.
echo  ============================================================
echo.

:: Open the app in the default browser
start http://localhost:3000

echo  Press any key to view logs, or close this window to keep running in background...
pause >nul

docker compose logs -f
