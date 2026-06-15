@echo off
chcp 65001 >nul
cd /d "%~dp0.."

:: Проверка прав администратора
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Запуск с правами администратора...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo [1/4] Установка SQL Server Express...
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\bolashak-sql-setup\install-sql-elevated.ps1"
if errorlevel 1 (
    echo SQL Server: ошибка установки, используем SQLite...
    goto SQLITE
)

echo [2/4] Настройка .env для SQL Server...
powershell -NoProfile -Command "(Get-Content server\.env) -replace 'DB_DRIVER=.*','DB_DRIVER=mssql' -replace 'SQLSERVER_HOST=.*','SQLSERVER_HOST=localhost\\SQLEXPRESS' -replace 'SQLSERVER_PASSWORD=.*','SQLSERVER_PASSWORD=BolashakHR@2026!' | Set-Content server\.env"
goto DBSETUP

:SQLITE
echo [2/4] Используем SQLite (файл БД, без установки)...
powershell -NoProfile -Command "(Get-Content server\.env) -replace 'DB_DRIVER=.*','DB_DRIVER=sqlite' | Set-Content server\.env"

:DBSETUP
echo [3/4] Создание базы данных...
cd /d "%~dp0.."
call npm run db:setup
if errorlevel 1 exit /b 1

echo [4/4] Запуск приложения...
start "Bolashak HR API" cmd /k "npm run dev:server"
timeout /t 2 /nobreak >nul
start "Bolashak HR UI" cmd /k "npm run dev:client"

echo.
echo ========================================
echo  Готово! http://localhost:5173
echo  Логин: aizada@bolashak.local / admin123
echo ========================================
pause
