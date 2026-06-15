@echo off
echo ========================================
echo  Bolashak HR - полная установка
echo  (потребуется разрешение администратора)
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0install-sqlserver.ps1\"'"

if errorlevel 1 (
  echo SQL Server install failed or was cancelled.
  pause
  exit /b 1
)

cd /d "%~dp0.."
echo.
echo Creating database and seed data...
call npm run db:setup
if errorlevel 1 (
  echo Database setup failed.
  pause
  exit /b 1
)

echo.
echo Starting application...
start "Bolashak HR API" cmd /k "npm run dev:server"
timeout /t 3 /nobreak >nul
start "Bolashak HR UI" cmd /k "npm run dev:client"

echo.
echo ========================================
echo  Готово!
echo  Откройте: http://localhost:5173
echo  Логин: aizada@bolashak.local / admin123
echo ========================================
pause
