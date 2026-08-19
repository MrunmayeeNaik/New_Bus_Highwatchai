@echo off
title Neo Bus - Stopping...
color 0C

echo.
echo  ============================================================
echo   Stopping Neo Bus Application...
echo  ============================================================
echo.

docker compose down

echo.
echo  ============================================================
echo   All services stopped successfully.
echo  ============================================================
echo.
pause
