# Запускает приложение онлайн для тестирования (ссылка для MacBook / телефона)
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

Write-Host "=== Bolashak HR — онлайн-доступ для тестирования ===" -ForegroundColor Cyan

# Сборка фронтенда
Write-Host "[1/3] Сборка..."
npm run build --prefix client 2>&1 | Out-Null

# Остановить старые процессы на 3002
Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep 1

# Production-сервер (фронт + API на одном порту)
Write-Host "[2/3] Запуск сервера..."
$env:NODE_ENV = "production"
$env:HOST = "0.0.0.0"
$env:PORT = "3002"
Start-Process -WindowStyle Minimized powershell -ArgumentList @(
  "-NoProfile", "-Command",
  "Set-Location '$ProjectRoot\server'; `$env:NODE_ENV='production'; `$env:HOST='0.0.0.0'; node src/index.js"
)
Start-Sleep 3

# Проверка
try {
  $health = Invoke-RestMethod -Uri "http://localhost:3002/api/health" -TimeoutSec 5
  Write-Host "Сервер OK: $($health.status)" -ForegroundColor Green
} catch {
  Write-Host "Ошибка запуска сервера!" -ForegroundColor Red
  exit 1
}

# Публичный туннель (Cloudflare — стабильнее localtunnel)
Write-Host "[3/3] Создание публичной ссылки (Cloudflare)..."
Write-Host ""
Write-Host "Ссылка появится ниже. Отправьте её Айзаде." -ForegroundColor Yellow
Write-Host "Логин: aizada@bolashak.local  Пароль: admin123" -ForegroundColor Yellow
Write-Host ""
Write-Host "НЕ ЗАКРЫВАЙТЕ это окно — иначе ссылка перестанет работать (503)." -ForegroundColor Yellow
Write-Host ""

npx --yes cloudflared tunnel --url http://localhost:3002
